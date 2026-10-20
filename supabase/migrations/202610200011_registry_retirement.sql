-- Irreversible registry retirement, retaining all physical references and historical source rows.
begin;
alter table assets add column registry_removed_at timestamptz;
alter table assets add constraint removed_asset_stays_archived check(registry_removed_at is null or archived_at is not null);
alter table production_lines add column registry_removed_at timestamptz;
alter table production_lines add constraint removed_line_stays_archived check(registry_removed_at is null or archived_at is not null);

alter function private_snapshot(uuid) rename to private_snapshot_before_registry_removal;
revoke all on function private_snapshot_before_registry_removal(uuid) from public,anon,authenticated;
create function public.private_snapshot(p_org uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;all_assets jsonb;all_lines jsonb;begin
result:=private_snapshot_before_registry_removal(p_org);
select coalesce(jsonb_agg(v||jsonb_build_object('registryRemovedAt',a.registry_removed_at)),'[]') into all_assets from jsonb_array_elements(result->'store'->'assets') v join assets a on a.organization_id=p_org and a.id=(v->>'id')::uuid;
select coalesce(jsonb_agg(v||jsonb_build_object('registryRemovedAt',l.registry_removed_at)),'[]') into all_lines from jsonb_array_elements(result->'store'->'archivedProductionLines') v join production_lines l on l.organization_id=p_org and l.id=(v->>'id')::uuid;
result:=jsonb_set(result,'{store,assets}',(select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(all_assets) v where v->>'registryRemovedAt' is null));
result:=jsonb_set(result,'{store,removedAssets}',(select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(all_assets) v where v->>'registryRemovedAt' is not null));
result:=jsonb_set(result,'{store,archivedProductionLines}',(select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(all_lines) v where v->>'registryRemovedAt' is null));
return jsonb_set(result,'{store,removedProductionLines}',(select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(all_lines) v where v->>'registryRemovedAt' is not null));
end $$;
revoke all on function private_snapshot(uuid) from public,anon;
grant execute on function private_snapshot(uuid) to authenticated;

alter function private_mutate(uuid,bigint,text,jsonb) rename to private_mutate_before_registry_removal;
revoke all on function private_mutate_before_registry_removal(uuid,bigint,text,jsonb) from public,anon,authenticated;
create function public.private_mutate(p_org uuid,p_revision bigint,p_kind text,p_data jsonb) returns void language plpgsql security definer set search_path=public as $$
declare revision_now bigint;entity uuid;a assets;l production_lines;identifier text;before_data jsonb;begin
if not has_role(p_org,array['owner','administrator','technician']::member_role[]) then raise exception 'forbidden' using errcode='42501';end if;
if p_kind in ('asset_remove_registry','production_line_remove_registry','asset_delete','production_line_delete') and not has_role(p_org,array['owner','administrator']::member_role[]) then raise exception 'manager required' using errcode='42501';end if;
select revision into revision_now from organizations where id=p_org for update;
if p_revision is distinct from revision_now then raise exception 'stale revision' using errcode='40001';end if;
if p_kind is null or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>200000 then raise exception 'invalid mutation' using errcode='22023';end if;
entity:=nullif(p_data->>'id','')::uuid;
-- Includes legacy mutation routes: a hidden tombstone cannot be restored or overwritten.
if p_kind in ('asset','asset_archive','asset_restore','asset_delete','asset_remove_registry') and exists(select 1 from assets where organization_id=p_org and id=entity and registry_removed_at is not null) then raise exception 'equipment removed irreversibly from registry' using errcode='55000';end if;
if p_kind in ('production_line','production_line_archive','production_line_restore','production_line_delete','production_line_remove_registry') and exists(select 1 from production_lines where organization_id=p_org and id=entity and registry_removed_at is not null) then raise exception 'line removed irreversibly from registry' using errcode='55000';end if;
if p_kind not in ('asset_remove_registry','production_line_remove_registry','asset_delete','production_line_delete') then
 perform private_mutate_before_registry_removal(p_org,p_revision,p_kind,p_data-'registryRemovedAt');return;
end if;
if p_kind like 'asset_%' then
 select * into a from assets where organization_id=p_org and id=entity for update;
 if not found then raise exception 'equipment unavailable' using errcode='42501';end if;
 if a.archived_at is null then raise exception 'archive equipment before final removal' using errcode='55000';end if;
 if exists(select 1 from maintenance_jobs where organization_id=p_org and asset_id=entity and status<>'completed') then raise exception 'open work prevents final removal' using errcode='55006';end if;
 identifier:=coalesce(nullif(btrim(a.serial_number),''),btrim(a.name));before_data:=to_jsonb(a);
else
 select * into l from production_lines where organization_id=p_org and id=entity for update;
 if not found then raise exception 'line unavailable' using errcode='42501';end if;
 if l.archived_at is null then raise exception 'archive line before final removal' using errcode='55000';end if;
 if exists(select 1 from assets where organization_id=p_org and production_line_id=entity) then raise exception 'attached equipment prevents final removal' using errcode='23503';end if;
 identifier:=coalesce(nullif(btrim(l.identifier),''),btrim(l.name));before_data:=to_jsonb(l);
end if;
if jsonb_typeof(p_data->'confirmation') is distinct from 'string' or btrim(p_data->>'confirmation') is distinct from identifier then raise exception 'typed identifier confirmation required' using errcode='22023';end if;
-- Empty-record physical deletion remains guarded for legacy clients, but now also requires archive and typed confirmation.
if p_kind in ('asset_delete','production_line_delete') then perform private_mutate_before_registry_removal(p_org,p_revision,p_kind,p_data);return;end if;
if p_kind='asset_remove_registry' then update assets set registry_removed_at=now() where organization_id=p_org and id=entity;
else update production_lines set registry_removed_at=now() where organization_id=p_org and id=entity;end if;
insert into audit_events(organization_id,actor_id,action,entity_id,payload) values(p_org,auth.uid(),'private.'||p_kind,entity,jsonb_build_object('before',before_data,'identifier',identifier,'removedAt',now()));
update organizations set revision=revision+1 where id=p_org;
end $$;
revoke all on function private_mutate(uuid,bigint,text,jsonb) from public,anon;
grant execute on function private_mutate(uuid,bigint,text,jsonb) to authenticated;

alter function private_history_search(uuid,text,uuid,uuid,date,date,text,integer) rename to private_history_search_before_registry_removal;
revoke all on function private_history_search_before_registry_removal(uuid,text,uuid,uuid,date,date,text,integer) from public,anon,authenticated;
create function public.private_history_search(p_org uuid,p_query text,p_asset uuid default null,p_line uuid default null,p_from date default null,p_to date default null,p_kind text default null,p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
result:=private_history_search_before_registry_removal(p_org,p_query,p_asset,p_line,p_from,p_to,p_kind,p_page);
return jsonb_set(result,'{results}',(select coalesce(jsonb_agg(v||jsonb_build_object('removed',a.registry_removed_at is not null,'lineRemoved',l.registry_removed_at is not null) order by n),'[]') from jsonb_array_elements(result->'results') with ordinality e(v,n) join assets a on a.organization_id=p_org and a.id=(v->>'assetId')::uuid left join production_lines l on l.organization_id=p_org and l.id=nullif(v->>'lineId','')::uuid));
end $$;
revoke all on function private_history_search(uuid,text,uuid,uuid,date,date,text,integer) from public,anon;
grant execute on function private_history_search(uuid,text,uuid,uuid,date,date,text,integer) to authenticated;
commit;
