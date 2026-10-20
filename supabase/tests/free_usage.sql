begin;
insert into auth.users(id,email,email_confirmed_at) values('a1000000-0000-0000-0000-000000000001','free-owner@example.invalid',now());
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000001','History tenant');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','owner','History owner');
insert into assets(id,organization_id,name) values('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','History motor');
insert into inventory(id,organization_id,type,name,quantity,data) values('a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','tool','Torque wrench',0,'{"unit":"kpl","partNumber":"TOOL-1"}');
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,priority,assigned_to,estimated_minutes,recurrence_days,data) values('a5000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Periodic check',now(),'planned','normal','a1000000-0000-0000-0000-000000000001',60,30,'{"description":"Periodic inspection","technician":"History owner","duration":60,"recurrence":30}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
do $$ declare original jsonb; next_id uuid; entry jsonb; bad jsonb; begin
-- Invalid free usage must roll back all changes, including registered part consumption.
for bad in select value from jsonb_array_elements('[{"type":"parts","name":"Seal","quantity":0},{"type":"tools","name":" "},{"type":"unknown","name":"X"},{"type":"parts","name":"Seal","quantity":"2"}]') loop
begin
perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'complete',jsonb_build_object('id','a5000000-0000-0000-0000-000000000001','actual','{}'::jsonb,'notes','Invalid','actualMinutes',20,'freeUsage',jsonb_build_array(bad)));
raise exception 'invalid free usage accepted';
exception when raise_exception then if sqlerrm='invalid free usage accepted' then raise;end if;end;
end loop;
if (select revision from organizations where id='a2000000-0000-0000-0000-000000000001')<>0 or exists(select 1 from maintenance_history where organization_id='a2000000-0000-0000-0000-000000000001') then raise exception 'invalid attempt changed data';end if;
perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'complete','{"id":"a5000000-0000-0000-0000-000000000001","actual":{"a4000000-0000-0000-0000-000000000001":1},"notes":"Seal replaced","actualMinutes":25,"completionNotes":"Recheck","freeUsage":[{"type":"tools","name":"Loan wrench"},{"type":"tools","name":"Pliers"},{"type":"parts","name":"Seal","quantity":2,"unit":"kpl"}]}');
select snapshot into original from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001';
if jsonb_array_length(original->'freeUsage')<>3 or original->'freeUsage'->2->>'quantity'<>'2' or original->>'assetName'<>'History motor' then raise exception 'free history missing';end if;
if exists(select 1 from inventory where organization_id='a2000000-0000-0000-0000-000000000001' and name in ('Loan wrench','Pliers','Seal')) or exists(select 1 from stock_movements where organization_id='a2000000-0000-0000-0000-000000000001') then raise exception 'free usage touched inventory';end if;
if not exists(select 1 from jsonb_array_elements(private_snapshot('a2000000-0000-0000-0000-000000000001')->'store'->'jobs') j where j->'freeUsage'->2->>'name'='Seal') then raise exception 'reload lost free usage';end if;
select id into next_id from maintenance_jobs where organization_id='a2000000-0000-0000-0000-000000000001' and status='planned';
if (select data ? 'freeUsage' from maintenance_jobs where id=next_id) then raise exception 'usage copied to next recurrence';end if;
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'complete',jsonb_build_object('id',next_id,'actual','{}'::jsonb,'notes','Stale','actualMinutes',20,'freeUsage',jsonb_build_array(jsonb_build_object('type','tools','name','Stale wrench'))));raise exception 'stale accepted';exception when serialization_failure then null;end;
if (select data ? 'freeUsage' from maintenance_jobs where id=next_id) then raise exception 'stale usage persisted';end if;
begin update maintenance_history set snapshot=snapshot||'{"freeUsage":[]}' where job_id='a5000000-0000-0000-0000-000000000001';raise exception 'history changed';exception when insufficient_privilege then null; when raise_exception then if sqlerrm<>'completed history is immutable' then raise;end if;end;
if (select snapshot from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'history altered';end if;
end $$;
rollback;
