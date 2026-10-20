-- Optional, one-level grouping. Existing assets and immutable history are not rewritten.
begin;
create table public.production_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check(length(btrim(name)) between 1 and 120 and name ~ '[^[:space:]]'),
  identifier text not null default '' check(length(identifier)<=80),
  description text not null default '' check(length(description)<=4000),
  location text not null default '' check(length(location)<=200),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id,id)
);
create unique index production_lines_active_identifier on public.production_lines(organization_id,lower(btrim(identifier))) where archived_at is null and btrim(identifier)<>'';
alter table public.production_lines enable row level security;
create policy production_lines_tenant_read on public.production_lines for select to authenticated using(public.is_member(organization_id));
revoke all on public.production_lines from public,anon,authenticated;
grant select on public.production_lines to authenticated;
-- No direct client writes. All mutations share the existing organization revision lock.
alter table public.assets add column production_line_id uuid;
alter table public.assets add constraint assets_production_line_tenant_fk foreign key(organization_id,production_line_id) references public.production_lines(organization_id,id) on delete restrict;
create index assets_production_line on public.assets(organization_id,production_line_id);

create function public.audit_asset_production_line() returns trigger
language plpgsql security definer set search_path=public as $$ begin
if old.production_line_id is distinct from new.production_line_id then
  insert into public.audit_events(organization_id,actor_id,action,entity_id,payload)
  values(new.organization_id,auth.uid(),'asset.production_line',new.id,jsonb_build_object('from',old.production_line_id,'to',new.production_line_id));
end if;
return new;end $$;
revoke all on function public.audit_asset_production_line() from public,anon,authenticated;
create trigger audit_asset_line after update of production_line_id on public.assets for each row execute function public.audit_asset_production_line();

alter function public.private_snapshot(uuid) rename to private_snapshot_before_lines;
revoke all on function public.private_snapshot_before_lines(uuid) from public,anon,authenticated;
create function public.private_snapshot(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb; begin
-- Retains membership checks and the completed-history snapshot selection.
result:=public.private_snapshot_before_lines(p_org);
result:=jsonb_set(result,'{store,productionLines}',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'identifier',identifier,'description',description,'location',location) order by name,id),'[]'::jsonb) from public.production_lines where organization_id=p_org and archived_at is null));
-- The relational column is authoritative, including when an older client omits the JSON key.
return jsonb_set(result,'{store,assets}',(select coalesce(jsonb_agg(a||jsonb_build_object('productionLineId',s.production_line_id) order by s.created_at,s.id),'[]'::jsonb) from jsonb_array_elements(result->'store'->'assets') a join public.assets s on s.organization_id=p_org and s.id=(a->>'id')::uuid));
end $$;
revoke all on function public.private_snapshot(uuid) from public,anon;
grant execute on function public.private_snapshot(uuid) to authenticated;

alter function public.private_mutate(uuid,bigint,text,jsonb) rename to private_mutate_before_lines;
revoke all on function public.private_mutate_before_lines(uuid,bigint,text,jsonb) from public,anon,authenticated;
create function public.private_mutate(p_org uuid,p_revision bigint,p_kind text,p_data jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare current_revision bigint; entity uuid; line_id uuid; old_line production_lines; detached integer;
begin
if p_kind is null then raise exception 'mutation kind required' using errcode='22023';end if;
if p_kind not in ('production_line','production_line_archive','asset') then
  perform public.private_mutate_before_lines(p_org,p_revision,p_kind,p_data);
  return;
end if;
if not public.has_role(p_org,array['owner','administrator']::public.member_role[]) then raise exception 'manager required' using errcode='42501';end if;
select revision into current_revision from public.organizations where id=p_org for update;
if p_revision is distinct from current_revision then raise exception 'stale revision' using errcode='40001';end if;
if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>200000 then raise exception 'invalid payload' using errcode='22023';end if;
entity:=nullif(p_data->>'id','')::uuid;
if entity is null then raise exception 'id required' using errcode='22023';end if;
if p_kind='asset' then
  if p_data ? 'productionLineId' then
    if jsonb_typeof(p_data->'productionLineId') not in ('string','null') then raise exception 'invalid line reference' using errcode='22023';end if;
    line_id:=nullif(p_data->>'productionLineId','')::uuid;
    if line_id is not null and not exists(select 1 from public.production_lines where organization_id=p_org and id=line_id and archived_at is null) then raise exception 'unavailable production line' using errcode='42501';end if;
  end if;
  perform public.private_mutate_before_lines(p_org,p_revision,p_kind,p_data);
  if p_data ? 'productionLineId' then
    update public.assets set production_line_id=line_id where organization_id=p_org and id=entity;
  end if;
  return;
end if;
-- UUID ownership and archived-state checks prevent overwrite, resurrection and cross-tenant moves.
select * into old_line from public.production_lines where id=entity for update;
if found and (old_line.organization_id<>p_org or old_line.archived_at is not null) then raise exception 'unavailable production line' using errcode='42501';end if;
if p_kind='production_line' then
  if jsonb_typeof(p_data->'name') is distinct from 'string' or length(btrim(p_data->>'name')) not between 1 and 120 or (p_data->>'name') !~ '[^[:space:]]' then raise exception 'line name required' using errcode='22023';end if;
  if (p_data ? 'identifier' and jsonb_typeof(p_data->'identifier')<>'string') or (p_data ? 'location' and jsonb_typeof(p_data->'location')<>'string') or (p_data ? 'description' and jsonb_typeof(p_data->'description')<>'string') then raise exception 'invalid line fields' using errcode='22023';end if;
  if length(coalesce(p_data->>'identifier',''))>80 or length(coalesce(p_data->>'location',''))>200 or length(coalesce(p_data->>'description',''))>4000 then raise exception 'line fields too long' using errcode='22023';end if;
  insert into public.production_lines(id,organization_id,name,identifier,location,description)
    values(entity,p_org,btrim(p_data->>'name'),btrim(coalesce(p_data->>'identifier','')),btrim(coalesce(p_data->>'location','')),btrim(coalesce(p_data->>'description','')))
    on conflict(id) do update set name=excluded.name,identifier=excluded.identifier,location=excluded.location,description=excluded.description where production_lines.organization_id=p_org;
  if not found then raise exception 'unavailable production line' using errcode='42501';end if;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,payload) values(p_org,auth.uid(),'private.production_line',entity,jsonb_build_object('before',to_jsonb(old_line),'after',p_data));
else
  if old_line.id is null then raise exception 'production line absent' using errcode='40001';end if;
  -- Archive, never cascade-delete. Devices, jobs, histories and inventory are preserved.
  update public.assets set production_line_id=null,data=data-'productionLineId' where organization_id=p_org and production_line_id=entity;
  get diagnostics detached = row_count;
  update public.production_lines set archived_at=now() where organization_id=p_org and id=entity;
  insert into public.audit_events(organization_id,actor_id,action,entity_id,payload) values(p_org,auth.uid(),'private.production_line_archive',entity,jsonb_build_object('before',to_jsonb(old_line),'detachedAssetCount',detached));
end if;
update public.organizations set revision=revision+1 where id=p_org;
end $$;
revoke all on function public.private_mutate(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.private_mutate(uuid,bigint,text,jsonb) to authenticated;
commit;
