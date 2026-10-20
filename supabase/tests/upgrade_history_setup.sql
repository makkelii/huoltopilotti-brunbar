-- Capture a completion using only migrations 001–005, before applying 006.
insert into auth.users(id,email,email_confirmed_at) values('b1000000-0000-0000-0000-000000000001','old-history@example.invalid',now());
insert into organizations(id,name) values('b2000000-0000-0000-0000-000000000001','Existing tenant');
insert into memberships(organization_id,user_id,role,display_name) values('b2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','owner','Original name');
insert into assets(id,organization_id,name) values('b3000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000001','Original asset');
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,assigned_to,estimated_minutes,data) values('b5000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001','Old completion',now(),'planned','b1000000-0000-0000-0000-000000000001',60,'{"technician":"Original name","duration":60}');
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000001',true);
select private_mutate('b2000000-0000-0000-0000-000000000001',0,'complete','{"id":"b5000000-0000-0000-0000-000000000001","actual":{},"notes":"Original work","actualMinutes":31}');
commit;
create table public.test_expected_old_history as select snapshot from maintenance_history where job_id='b5000000-0000-0000-0000-000000000001';
