-- Each assertion runs in a throwaway PostgreSQL database. No production connection.
begin;
insert into auth.users(id,email,email_confirmed_at) values('a1000000-0000-0000-0000-000000000001','free-owner@example.invalid',now());
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000001','Free usage tenant');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','owner','Asentaja');
insert into assets(id,organization_id,name) values('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Moottori');
insert into inventory(id,organization_id,type,name,quantity) values('a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','part','Tiiviste',10),('a4000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','tool','Avain',0);
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,assigned_to,estimated_minutes,recurrence_days,data) values('a5000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Tiivistehuolto',now(),'planned','a1000000-0000-0000-0000-000000000001',60,30,'{"technician":"Asentaja","duration":60,"recurrence":30}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
do $$ declare original jsonb;begin
perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'complete','{"id":"a5000000-0000-0000-0000-000000000001","actual":{"a4000000-0000-0000-0000-000000000001":1},"notes":"Old repair","actualMinutes":20}');
select snapshot into original from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001';
perform private_mutate('a2000000-0000-0000-0000-000000000001',1,'job','{"id":"a5000000-0000-0000-0000-000000000099","name":"Reviewed repeat","assetId":"a3000000-0000-0000-0000-000000000001","due":"2026-11-01","priority":"normal","status":"planned","technician":"Asentaja","duration":30,"recurrence":0,"notes":"","requirements":[]}');
if (select snapshot from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'repeat changed history';end if;
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>9 or (select count(*) from maintenance_history where organization_id='a2000000-0000-0000-0000-000000000001')<>1 then raise exception 'repeat consumed stock or completed';end if;
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',1,'job','{}');raise exception 'duplicate revision accepted';exception when serialization_failure then null;end;
end $$;
reset role;
rollback;
