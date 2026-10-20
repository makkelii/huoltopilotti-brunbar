begin;
insert into auth.users(id,email,email_confirmed_at) values('91000000-0000-0000-0000-000000000001','history-owner@example.invalid',now());
insert into organizations(id,name) values('92000000-0000-0000-0000-000000000001','History tenant');
insert into memberships(organization_id,user_id,role,display_name) values('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','owner','History owner');
insert into assets(id,organization_id,name) values('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','History motor');
insert into inventory(id,organization_id,type,name,quantity,data) values('94000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','tool','Torque wrench',0,'{"unit":"kpl","partNumber":"TOOL-1"}');
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,priority,assigned_to,estimated_minutes,recurrence_days,data) values('95000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','Periodic check',now(),'planned','normal','91000000-0000-0000-0000-000000000001',60,30,'{"description":"Periodic inspection","technician":"History owner","duration":60,"recurrence":30}');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select private_mutate('92000000-0000-0000-0000-000000000001',0,'complete','{"id":"95000000-0000-0000-0000-000000000001","actual":{"94000000-0000-0000-0000-000000000001":1},"notes":"First inspection","actualMinutes":35}');
do $$ declare next_id uuid; original jsonb;begin
select snapshot into original from maintenance_history where job_id='95000000-0000-0000-0000-000000000001';
if original->'usedItems'->0->>'name'<>'Torque wrench' or original->>'actualMinutes'<>'35' or original->>'description'<>'Periodic inspection' then raise exception 'missing frozen fields';end if;
select id into next_id from maintenance_jobs where organization_id='92000000-0000-0000-0000-000000000001' and status='planned';
perform private_mutate('92000000-0000-0000-0000-000000000001',1,'complete',jsonb_build_object('id',next_id,'actual',jsonb_build_object('94000000-0000-0000-0000-000000000001',1),'notes','Second inspection','actualMinutes',40));
if (select count(*) from maintenance_history where organization_id='92000000-0000-0000-0000-000000000001')<>2 then raise exception 'recurrence overwritten';end if;
if (select snapshot from maintenance_history where job_id='95000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'first run changed';end if;
if (select quantity from inventory where id='94000000-0000-0000-0000-000000000001')<>0 then raise exception 'tool consumed';end if;
if exists(select 1 from stock_movements where item_id='94000000-0000-0000-0000-000000000001') then raise exception 'tool stock movement';end if;
if jsonb_array_length(private_snapshot('92000000-0000-0000-0000-000000000001')->'store'->'jobs')<>3 then raise exception 'snapshot reload lost history';end if;
perform private_mutate('92000000-0000-0000-0000-000000000001',2,'item','{"id":"94000000-0000-0000-0000-000000000001","name":"Retired wrench","type":"tools","inactive":true,"location":"Cabinet","partNumber":"TOOL-1","calibration":"2027-01-01"}');
if (select snapshot from maintenance_history where job_id='95000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'deactivation changed history';end if;
if exists(select 1 from stock_movements where item_id='94000000-0000-0000-0000-000000000001') then raise exception 'tool edit stock movement';end if;
select id into next_id from maintenance_jobs where organization_id='92000000-0000-0000-0000-000000000001' and status='planned';
begin
perform private_mutate('92000000-0000-0000-0000-000000000001',3,'complete',jsonb_build_object('id',next_id,'actual',jsonb_build_object('94000000-0000-0000-0000-000000000001',1),'notes','Inactive attempt','actualMinutes',40));
raise exception 'inactive tool accepted';
exception when raise_exception then if sqlerrm<>'inactive inventory' then raise;end if;end;
begin perform manage_organization_member('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','technician');raise exception 'owner downgraded';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into organizations(id,name) values('92000000-0000-0000-0000-000000000002','Second independent tenant');
insert into organization_access_settings(organization_id,user_limit) values('92000000-0000-0000-0000-000000000002',5);
insert into memberships(organization_id,user_id,role,display_name,is_default) values('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000001','owner','History owner',true);
do $$ begin
begin update memberships set is_default=true where organization_id='92000000-0000-0000-0000-000000000001';raise exception 'two defaults allowed';exception when unique_violation then null;end;
end $$;
set local role authenticated;
select reserve_private_invitation('92000000-0000-0000-0000-000000000002','second-tenant-tech@example.invalid');
reset role;
insert into auth.users(id,email,email_confirmed_at) values('91000000-0000-0000-0000-000000000002','second-tenant-tech@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
do $$ begin
if (select count(*) from memberships where user_id=auth.uid() and organization_id='92000000-0000-0000-0000-000000000002' and role='technician')<>1 then raise exception 'second tenant invitation failed';end if;
begin perform private_snapshot('92000000-0000-0000-0000-000000000001');raise exception 'second tenant leaked first';exception when insufficient_privilege then null;end;
begin perform manage_organization_member('92000000-0000-0000-0000-000000000002',auth.uid(),'administrator');raise exception 'self promotion';exception when insufficient_privilege then null;end;
begin update memberships set is_default=true;raise exception 'client assigned defaults';exception when insufficient_privilege then null;end;
end $$;
rollback;

