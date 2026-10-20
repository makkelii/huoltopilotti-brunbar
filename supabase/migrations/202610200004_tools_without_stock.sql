-- Additive upgrade: no inventory or historical rows are rewritten.
-- Tools retain legacy quantity columns for compatibility; availability is active registration.
begin;
create or replace function public.private_mutate_v2(p_org uuid,p_revision bigint,p_kind text,p_data jsonb) returns void language plpgsql security definer set search_path=public as $$
declare current_revision bigint; entity uuid; old_quantity numeric; n numeric; row_item inventory; row_job maintenance_jobs; r record; tid uuid; v integer; new_job uuid; next_due date; assigned uuid; clean jsonb; begin
if not public.has_role(p_org,array['owner','administrator','technician']::public.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
select revision into current_revision from organizations where id=p_org for update;
if p_revision is distinct from current_revision then raise exception 'stale revision' using errcode='40001'; end if;
if p_kind in ('asset','item','template') and not public.has_role(p_org,array['owner','administrator']::public.member_role[]) then raise exception 'manager required' using errcode='42501'; end if;
if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>200000 then raise exception 'invalid payload'; end if;
entity:=nullif(p_data->>'id','')::uuid;
if p_kind in ('asset','item','job','fault') and (coalesce(length(trim(p_data->>'name')),0)=0 and p_kind<>'fault') then raise exception 'name required'; end if;
if p_kind='asset' then
if exists(select 1 from assets where id=entity and organization_id<>p_org) then raise exception 'foreign entity' using errcode='42501';end if;
insert into assets(id,organization_id,name,manufacturer,model,serial_number,location,description,data) values(entity,p_org,p_data->>'name',p_data->>'manufacturer',p_data->>'model',p_data->>'serial',p_data->>'location',p_data->>'description',p_data) on conflict(id) do update set name=excluded.name,manufacturer=excluded.manufacturer,model=excluded.model,serial_number=excluded.serial_number,location=excluded.location,description=excluded.description,data=excluded.data where assets.organization_id=p_org;
elsif p_kind='item' then
if exists(select 1 from inventory where id=entity and organization_id<>p_org) then raise exception 'foreign entity' using errcode='42501';end if;
n:=case when p_data->>'type'='tools' then coalesce((select quantity from inventory where organization_id=p_org and id=entity),0) else (p_data->>'quantity')::numeric end;
if n is null or n<0 or n>100000000 or n in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then raise exception 'invalid quantity';end if;
select quantity into old_quantity from inventory where id=entity and organization_id=p_org for update;
if exists(select 1 from stock_movements where item_id=entity) and exists(select 1 from inventory where id=entity and type<>case p_data->>'type' when 'tools' then 'tool' when 'parts' then 'part' else 'consumable' end) then raise exception 'cannot change used inventory type';end if;
insert into inventory(id,organization_id,type,name,manufacturer,part_number,specifications,storage_location,quantity,calibration_due,data) values(entity,p_org,case p_data->>'type' when 'tools' then 'tool' when 'parts' then 'part' when 'consumables' then 'consumable' else 'invalid' end,p_data->>'name',p_data->>'manufacturer',p_data->>'partNumber',p_data->>'spec',p_data->>'location',n,nullif(p_data->>'calibration','')::date,p_data) on conflict(id) do update set name=excluded.name,type=excluded.type,manufacturer=excluded.manufacturer,part_number=excluded.part_number,specifications=excluded.specifications,storage_location=excluded.storage_location,quantity=excluded.quantity,calibration_due=excluded.calibration_due,data=excluded.data where inventory.organization_id=p_org;
if p_data->>'type'<>'tools' and n<>coalesce(old_quantity,0) then insert into stock_movements(organization_id,item_id,delta,reason,actor_id) values(p_org,entity,n-coalesce(old_quantity,0),'inventory.adjust',auth.uid());end if;
elsif p_kind='job' then
if exists(select 1 from maintenance_jobs where id=entity and organization_id<>p_org) then raise exception 'foreign entity' using errcode='42501';end if;
if exists(select 1 from maintenance_jobs where id=entity and status='completed') or p_data->>'status' not in ('planned','progress') then raise exception 'completion requires transaction';end if;
select user_id into assigned from memberships where organization_id=p_org and display_name=p_data->>'technician' and role in ('owner','administrator','technician') limit 1;
if assigned is null then raise exception 'invalid technician';end if;
if (p_data->>'recurrence')::integer<0 or (p_data->>'recurrence')::integer>3650 then raise exception 'invalid recurrence';end if;
clean:=p_data-'actual'-'completedAt'-'requirements'||jsonb_build_object('actual','{}'::jsonb);
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,priority,assigned_to,estimated_minutes,recurrence_days,notes,data) values(entity,p_org,(p_data->>'assetId')::uuid,p_data->>'name',(p_data->>'due')::date,p_data->>'status',p_data->>'priority',assigned,(p_data->>'duration')::integer,nullif((p_data->>'recurrence')::integer,0),p_data->>'notes',clean) on conflict(id) do update set asset_id=excluded.asset_id,name=excluded.name,due_at=excluded.due_at,status=excluded.status,priority=excluded.priority,assigned_to=excluded.assigned_to,estimated_minutes=excluded.estimated_minutes,recurrence_days=excluded.recurrence_days,notes=excluded.notes,data=excluded.data where maintenance_jobs.organization_id=p_org;
perform private_requirements(p_org,entity,p_data->'requirements');
elsif p_kind='complete' then
select * into row_job from maintenance_jobs where organization_id=p_org and id=entity for update;
if not found or row_job.status='completed' then raise exception 'job already completed or absent' using errcode='40001';end if;
if coalesce(length(trim(p_data->>'notes')),0)=0 or jsonb_typeof(p_data->'actual')<>'object' then raise exception 'completion data required';end if;
-- Stable ordering plus organization lock serializes stock edits and completions.
for r in select key,value from jsonb_each_text(p_data->'actual') order by key loop
n:=r.value::numeric;
if n is null or n<0 or n>100000000 or n in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then raise exception 'invalid consumption';end if;
select * into row_item from inventory where organization_id=p_org and id=r.key::uuid for update;
if not found or (row_item.type<>'tool' and n>row_item.quantity-row_item.reserved) then raise exception 'insufficient stock';end if;
if row_item.type<>'tool' and n>0 then
update inventory set quantity=quantity-n where id=row_item.id;
insert into stock_movements(organization_id,item_id,job_id,delta,reason,actor_id) values(p_org,row_item.id,entity,-n,'maintenance.consume',auth.uid());
end if;
end loop;
update maintenance_jobs set status='completed',notes=p_data->>'notes',data=data||jsonb_build_object('actual',p_data->'actual','notes',p_data->>'notes','completedAt',now()) where id=entity;
insert into maintenance_history(organization_id,job_id,actual_requirements,notes,completed_by) values(p_org,entity,p_data->'actual',p_data->>'notes',auth.uid());
if row_job.recurrence_days>0 then
new_job:=gen_random_uuid();next_due:=row_job.due_at::date+row_job.recurrence_days;
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,priority,assigned_to,estimated_minutes,recurrence_days,notes,data) values(new_job,p_org,row_job.asset_id,row_job.name,next_due,'planned',row_job.priority,row_job.assigned_to,row_job.estimated_minutes,row_job.recurrence_days,'',row_job.data-'completedAt'||jsonb_build_object('id',new_job,'due',next_due,'notes','','actual','{}'::jsonb));
insert into job_requirements(organization_id,job_id,item_id,category,description,quantity,state,data) select p_org,new_job,item_id,category,description,quantity,'unchecked',data||jsonb_build_object('state','unchecked') from job_requirements where job_id=entity and organization_id=p_org;
end if;
elsif p_kind='fault' then
if exists(select 1 from fault_reports where id=entity) then raise exception 'fault outcomes are append only';end if;
if coalesce(length(p_data->'symptoms'->>0),0)<4 or coalesce(length(p_data->'cause'->>0),0)<5 then raise exception 'verified evidence required';end if;
insert into fault_reports(id,organization_id,asset_id,symptoms,confirmed_cause,repair,verified_by,data) values(entity,p_org,(p_data->>'assetId')::uuid,p_data->'symptoms'->>0,p_data->'cause'->>0,p_data->'cause'->>0,auth.uid(),p_data||jsonb_build_object('orgId',p_org,'verified',true));
elsif p_kind='template' then
if jsonb_typeof(p_data->'requirements')<>'array' then raise exception 'invalid template';end if;
-- Validate requirements with a temporary job-free loop. Never trust cross-tenant part references.
for clean in select value from jsonb_array_elements(p_data->'requirements') loop
if coalesce((clean->>'quantity')::numeric,0)<=0 or (clean->>'quantity')::numeric>100000 or clean->>'category' not in ('tools','parts','consumables','safety','documents','personnel') or jsonb_typeof(clean->'label')<>'array' or jsonb_array_length(clean->'label')<>3 then raise exception 'invalid template requirement';end if;
if clean->>'category' in ('tools','parts','consumables') and not exists(select 1 from inventory where organization_id=p_org and id=(clean->>'itemId')::uuid and type=case clean->>'category' when 'tools' then 'tool' when 'parts' then 'part' else 'consumable' end) then raise exception 'foreign template inventory';end if;
end loop;
select id into tid from maintenance_templates where organization_id=p_org order by id limit 1;
if tid is null then insert into maintenance_templates(organization_id,name) values(p_org,'Maintenance preparation') returning id into tid;end if;
select coalesce(max(version),0)+1 into v from template_versions where template_id=tid;
insert into template_versions(organization_id,template_id,version,instructions,approved_by,approved_at) values(p_org,tid,v,p_data->'requirements',auth.uid(),now());
else raise exception 'unsupported mutation';end if;
update organizations set revision=revision+1 where id=p_org;
insert into audit_events(organization_id,actor_id,action,entity_id) values(p_org,auth.uid(),'private.'||p_kind,entity);
end $$;
revoke all on function public.private_mutate_v2(uuid,bigint,text,jsonb) from public,anon,authenticated;
commit;
