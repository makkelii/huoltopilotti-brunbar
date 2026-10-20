-- Additive lifecycle state. Never rewrite completed jobs/history or inventory.
begin;
alter table public.assets add column archived_at timestamptz;
create index lifecycle_jobs_asset on public.maintenance_jobs(organization_id,asset_id);
create index lifecycle_faults_asset on public.fault_reports(organization_id,asset_id);
create index assets_active_by_org on public.assets(organization_id,id) where archived_at is null;
create index lifecycle_deleted_audit on public.audit_events(organization_id,entity_id,action) where action in ('private.asset_delete','private.production_line_delete');

create function public.private_asset_dependencies(p_org uuid,p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from maintenance_jobs where organization_id=p_org and asset_id=p_id)
 or exists(select 1 from maintenance_history where organization_id=p_org and snapshot->>'assetId'=p_id::text)
 or exists(select 1 from fault_reports where organization_id=p_org and asset_id=p_id)
 or exists(select 1 from inventory where organization_id=p_org and (position(lower(p_id::text) in lower(compatible_assets::text))>0 or position(lower(p_id::text) in lower(data::text))>0))
 or exists(select 1 from maintenance_jobs where organization_id=p_org and position(lower(p_id::text) in lower(data::text))>0)
 or exists(select 1 from maintenance_history where organization_id=p_org and position(lower(p_id::text) in lower(snapshot::text))>0)
 or exists(select 1 from template_versions where organization_id=p_org and position(lower(p_id::text) in lower(instructions::text))>0);
$$;
create function public.private_line_dependencies(p_org uuid,p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from assets where organization_id=p_org and production_line_id=p_id)
 or exists(select 1 from audit_events where organization_id=p_org and ((action='asset.production_line' and (payload->>'from'=p_id::text or payload->>'to'=p_id::text)) or (action='private.production_line_archive' and entity_id=p_id and coalesce((payload->>'detachedAssetCount')::integer,0)>0)))
 or exists(select 1 from maintenance_jobs where organization_id=p_org and position(lower(p_id::text) in lower(data::text))>0)
 or exists(select 1 from maintenance_history where organization_id=p_org and position(lower(p_id::text) in lower(snapshot::text))>0)
 or exists(select 1 from template_versions where organization_id=p_org and position(lower(p_id::text) in lower(instructions::text))>0);
$$;
revoke all on function public.private_asset_dependencies(uuid,uuid),public.private_line_dependencies(uuid,uuid) from public,anon,authenticated;

create function public.guard_lifecycle_asset_refs() returns trigger
language plpgsql security definer set search_path=public as $$ begin
-- Also guards inserts by the internal recurring-job implementation and older clients.
if exists(select 1 from assets where organization_id=new.organization_id and id=new.asset_id and archived_at is not null) and new.status<>'completed' then
 raise exception 'archived equipment is unavailable' using errcode='55000';
end if;return new;end $$;
-- Separate fault trigger avoids referring to a job-only status column.
create function public.guard_lifecycle_fault_refs() returns trigger
language plpgsql security definer set search_path=public as $$ begin
if exists(select 1 from assets where organization_id=new.organization_id and id=new.asset_id and archived_at is not null) then raise exception 'archived equipment is unavailable' using errcode='55000';end if;return new;end $$;
create trigger active_job_equipment before insert or update on public.maintenance_jobs for each row execute function public.guard_lifecycle_asset_refs();
create trigger active_fault_equipment before insert on public.fault_reports for each row execute function public.guard_lifecycle_fault_refs();
revoke all on function public.guard_lifecycle_asset_refs(),public.guard_lifecycle_fault_refs() from public,anon,authenticated;

alter function public.private_snapshot(uuid) rename to private_snapshot_before_lifecycle;
revoke all on function public.private_snapshot_before_lifecycle(uuid) from public,anon,authenticated;
create function public.private_snapshot(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
result:=private_snapshot_before_lifecycle(p_org);
result:=jsonb_set(result,'{store,assets}',(select coalesce(jsonb_agg(a||jsonb_build_object('archivedAt',s.archived_at,'canDelete',not private_asset_dependencies(p_org,s.id)) order by s.created_at,s.id),'[]') from jsonb_array_elements(result->'store'->'assets') a join assets s on s.organization_id=p_org and s.id=(a->>'id')::uuid));
result:=jsonb_set(result,'{store,productionLines}',(select coalesce(jsonb_agg(l||jsonb_build_object('canDelete',not private_line_dependencies(p_org,(l->>'id')::uuid))),'[]') from jsonb_array_elements(result->'store'->'productionLines') l));
return jsonb_set(result,'{store,archivedProductionLines}',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'identifier',identifier,'location',location,'description',description,'archivedAt',archived_at,'canDelete',not private_line_dependencies(p_org,id)) order by name,id),'[]') from production_lines where organization_id=p_org and archived_at is not null));
end $$;
revoke all on function public.private_snapshot(uuid) from public,anon;
grant execute on function public.private_snapshot(uuid) to authenticated;

alter function public.private_mutate(uuid,bigint,text,jsonb) rename to private_mutate_before_lifecycle;
revoke all on function public.private_mutate_before_lifecycle(uuid,bigint,text,jsonb) from public,anon,authenticated;
create function public.private_mutate(p_org uuid,p_revision bigint,p_kind text,p_data jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare revision_now bigint;entity uuid;old_asset assets;old_line production_lines;target_line uuid;before_data jsonb;begin
if not has_role(p_org,array['owner','administrator','technician']::member_role[]) then raise exception 'forbidden' using errcode='42501';end if;
select revision into revision_now from organizations where id=p_org for update;
if p_revision is distinct from revision_now then raise exception 'stale revision' using errcode='40001';end if;
if p_kind is null or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>200000 then raise exception 'invalid mutation' using errcode='22023';end if;
entity:=nullif(p_data->>'id','')::uuid;
if p_kind in ('asset','production_line') and exists(select 1 from audit_events where organization_id=p_org and entity_id=entity and action='private.'||p_kind||'_delete') then raise exception 'deleted identity cannot be reused' using errcode='55000';end if;
if p_kind='asset' and exists(select 1 from assets where organization_id=p_org and id=entity and archived_at is not null) then raise exception 'restore equipment before editing' using errcode='55000';end if;
if p_kind='complete' and exists(select 1 from maintenance_jobs j join assets a on a.organization_id=j.organization_id and a.id=j.asset_id where j.organization_id=p_org and j.id=entity and a.archived_at is not null) then raise exception 'archived equipment is unavailable' using errcode='55000';end if;
if p_kind not in ('asset_archive','asset_restore','asset_delete','production_line_restore','production_line_delete') then
 perform private_mutate_before_lifecycle(p_org,p_revision,p_kind,p_data-'archivedAt'-'canDelete');return;
end if;
if not has_role(p_org,array['owner','administrator']::member_role[]) then raise exception 'manager required' using errcode='42501';end if;
if entity is null then raise exception 'id required' using errcode='22023';end if;
if p_kind like 'asset_%' then
 select * into old_asset from assets where organization_id=p_org and id=entity for update;
 if not found then raise exception 'equipment unavailable' using errcode='42501';end if;
 before_data:=to_jsonb(old_asset);
 if p_kind='asset_archive' then
  if old_asset.archived_at is not null then raise exception 'already archived' using errcode='55000';end if;
  if exists(select 1 from maintenance_jobs where organization_id=p_org and asset_id=entity and status<>'completed') then raise exception 'open maintenance prevents archive' using errcode='55006';end if;
  update assets set archived_at=now() where organization_id=p_org and id=entity;
 elsif p_kind='asset_restore' then
  if old_asset.archived_at is null then raise exception 'equipment is active' using errcode='55000';end if;
  target_line:=nullif(p_data->>'productionLineId','')::uuid;
  if target_line is not null and not exists(select 1 from production_lines where organization_id=p_org and id=target_line and archived_at is null) then raise exception 'unavailable production line' using errcode='55000';end if;
  update assets set archived_at=null,production_line_id=target_line where organization_id=p_org and id=entity;
 else
  if private_asset_dependencies(p_org,entity) then raise exception 'retained dependencies prevent deletion; archive instead' using errcode='23503';end if;
  delete from assets where organization_id=p_org and id=entity;
 end if;
else
 select * into old_line from production_lines where organization_id=p_org and id=entity for update;
 if not found then raise exception 'production line unavailable' using errcode='42501';end if;
 before_data:=to_jsonb(old_line);
 if p_kind='production_line_restore' then
  if old_line.archived_at is null then raise exception 'production line is active' using errcode='55000';end if;
  -- The existing active-identifier unique index rejects restoration conflicts atomically.
  update production_lines set archived_at=null where organization_id=p_org and id=entity;
 else
  if private_line_dependencies(p_org,entity) then raise exception 'retained line dependencies prevent deletion; archive instead' using errcode='23503';end if;
  delete from production_lines where organization_id=p_org and id=entity;
 end if;
end if;
insert into audit_events(organization_id,actor_id,action,entity_id,payload) values(p_org,auth.uid(),'private.'||p_kind,entity,jsonb_build_object('before',before_data,'requested',p_data));
update organizations set revision=revision+1 where id=p_org;
end $$;
revoke all on function public.private_mutate(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.private_mutate(uuid,bigint,text,jsonb) to authenticated;
commit;
