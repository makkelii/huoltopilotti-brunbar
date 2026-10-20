begin;
insert into auth.users(id,email,email_confirmed_at) values
('10000000-0000-0000-0000-000000000001','owner@example.invalid',now()),
('10000000-0000-0000-0000-000000000002','tech@example.invalid',now()),
('10000000-0000-0000-0000-000000000003','other@example.invalid',now()),
('10000000-0000-0000-0000-000000000004','viewer@example.invalid',now()),
('10000000-0000-0000-0000-000000000005','outsider@example.invalid',now());
insert into organizations(id,name) values('20000000-0000-0000-0000-000000000001','Shared private org'),('20000000-0000-0000-0000-000000000002','Foreign org');
insert into memberships(organization_id,user_id,role,display_name) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner','owner@example.invalid'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','technician','tech@example.invalid'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','owner','other@example.invalid'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','viewer','viewer@example.invalid');
insert into private_deployment(organization_id) values('20000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select private_mutate('20000000-0000-0000-0000-000000000001',0,'asset','{"id":"30000000-0000-0000-0000-000000000001","name":"Shared motor","manufacturer":"Test","model":"M1","serial":"S1","location":"Workshop","status":"operational","description":""}');
select private_mutate('20000000-0000-0000-0000-000000000001',1,'item','{"id":"40000000-0000-0000-0000-000000000001","name":"Bearing","type":"parts","quantity":1,"reserved":0,"location":"A1","spec":"Test","manufacturer":"Test","partNumber":"P1","calibration":"","compatible":"","alternatives":""}');
select private_mutate('20000000-0000-0000-0000-000000000001',2,'template','{"requirements":[{"id":"r1","category":"parts","label":["Laakeri","Bearing","Lager"],"itemId":"40000000-0000-0000-0000-000000000001","quantity":1,"state":"unchecked"}]}');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
if private_snapshot('20000000-0000-0000-0000-000000000001')->'store'->'assets'->0->>'name'<>'Shared motor' then raise exception 'shared asset not visible';end if;
if private_snapshot('20000000-0000-0000-0000-000000000001')->'store'->>'templateVersion'<>'1' then raise exception 'template missing';end if;
begin perform manage_organization_member('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','administrator');raise exception 'technician promoted self';exception when insufficient_privilege then null;end;
begin perform private_mutate('20000000-0000-0000-0000-000000000001',3,'item','{}');raise exception 'technician modified inventory';exception when insufficient_privilege then null;end;
begin perform private_mutate('20000000-0000-0000-0000-000000000001',3,'template','{"requirements":[]}');raise exception 'technician approved template';exception when insufficient_privilege then null;end;
begin update inventory set quantity=99;raise exception 'direct inventory write';exception when insufficient_privilege then null;end;
end $$;
select private_mutate('20000000-0000-0000-0000-000000000001',3,'job','{"id":"50000000-0000-0000-0000-000000000001","name":"Shared maintenance","assetId":"30000000-0000-0000-0000-000000000001","due":"2026-10-19","status":"planned","priority":"normal","technician":"tech@example.invalid","duration":60,"recurrence":30,"notes":"","requirements":[{"id":"r1","category":"parts","label":["Laakeri","Bearing","Lager"],"itemId":"40000000-0000-0000-0000-000000000001","quantity":1,"state":"ready"}]}');
do $$ begin
begin perform private_mutate('20000000-0000-0000-0000-000000000001',3,'complete','{"id":"50000000-0000-0000-0000-000000000001","actual":{},"notes":"stale"}');raise exception 'stale accepted';exception when serialization_failure then null;end;
begin perform private_mutate('20000000-0000-0000-0000-000000000001',4,'complete','{"id":"50000000-0000-0000-0000-000000000001","actual":{"40000000-0000-0000-0000-000000000001":2},"notes":"insufficient"}');raise exception 'overconsumption accepted';exception when raise_exception then if sqlerrm<>'insufficient stock' then raise;end if;end;
if (select quantity from inventory where id='40000000-0000-0000-0000-000000000001')<>1 or (select count(*) from maintenance_history)<>0 then raise exception 'failed completion not atomic';end if;
end $$;
select private_mutate('20000000-0000-0000-0000-000000000001',4,'complete','{"id":"50000000-0000-0000-0000-000000000001","actual":{"40000000-0000-0000-0000-000000000001":1},"notes":"Confirmed replacement"}');
select private_mutate('20000000-0000-0000-0000-000000000001',5,'fault','{"id":"60000000-0000-0000-0000-000000000001","assetId":"30000000-0000-0000-0000-000000000001","symptoms":["Moottori pysähtyy","Motor stops","Motor stoppt"],"cause":["Verified relay trip","Verified relay trip","Verified relay trip"],"check":["Read visible code","Read visible code","Read visible code"],"date":"2026-10-19"}');
do $$ begin
if (select count(*) from maintenance_history)<>1 or (select quantity from inventory where id='40000000-0000-0000-0000-000000000001')<>0 then raise exception 'completion/stock missing';end if;
if (select count(*) from maintenance_jobs)<>2 then raise exception 'recurrence missing';end if;
if (select count(*) from stock_movements where job_id='50000000-0000-0000-0000-000000000001')<>1 then raise exception 'movement missing';end if;
if private_snapshot('20000000-0000-0000-0000-000000000001')->'store'->'faults'->0->>'orgId'<>'20000000-0000-0000-0000-000000000001' then raise exception 'fault tenant spoofed';end if;
begin perform private_mutate('20000000-0000-0000-0000-000000000001',6,'complete','{"id":"50000000-0000-0000-0000-000000000001","actual":{},"notes":"duplicate"}');raise exception 'duplicate completion accepted';exception when serialization_failure then null;end;
end $$;
-- Populate the remaining tenant-owned ledgers so isolation checks are substantive.
reset role;
insert into subscriptions(organization_id) values('20000000-0000-0000-0000-000000000001');
insert into troubleshooting_suggestions(organization_id,fault_id,evidence_fault_id,matching_terms) values('20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',array['motor']);
insert into assets(id,organization_id,name) values('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Foreign equipment');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ begin
begin perform private_mutate('20000000-0000-0000-0000-000000000001',6,'asset','{"id":"30000000-0000-0000-0000-000000000002","name":"Stolen asset"}');raise exception 'foreign asset overwritten';exception when insufficient_privilege then null;end;
begin perform private_mutate('20000000-0000-0000-0000-000000000001',6,'job','{"id":"50000000-0000-0000-0000-000000000003","name":"Foreign reference","assetId":"30000000-0000-0000-0000-000000000002","due":"2026-10-19","status":"planned","priority":"normal","technician":"owner@example.invalid","duration":60,"recurrence":0,"notes":"","requirements":[]}');raise exception 'cross organization reference allowed';exception when foreign_key_violation then null;end;
end $$;
-- Other organization's owner cannot see or modify private data through RLS or RPC.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
do $$ declare tab text; n bigint;begin
foreach tab in array array['assets','maintenance_jobs','maintenance_templates','template_versions','inventory','job_requirements','stock_movements','maintenance_history','fault_reports','troubleshooting_suggestions','subscriptions','audit_events','memberships','private_invitations'] loop
execute format('select count(*) from %I where organization_id=$1',tab) into n using '20000000-0000-0000-0000-000000000001'::uuid;
if n<>0 then raise exception 'cross tenant read on %',tab;end if;
begin execute format('insert into %I default values',tab);raise exception 'direct write allowed on %',tab;exception when insufficient_privilege then null;end;
end loop;
begin perform private_snapshot('20000000-0000-0000-0000-000000000001');raise exception 'foreign snapshot allowed';exception when insufficient_privilege then null;end;
begin perform private_mutate('20000000-0000-0000-0000-000000000001',6,'complete','{}');raise exception 'foreign mutation allowed';exception when insufficient_privilege then null;end;
begin insert into organizations(name) values('Self creation');raise exception 'public org creation';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
do $$ begin
begin perform private_mutate('20000000-0000-0000-0000-000000000002',0,'job','{}');raise exception 'viewer mutation allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',true);
do $$ begin
if (select count(*) from organizations)<>0 then raise exception 'unauthorized organizations visible';end if;
begin perform private_snapshot('20000000-0000-0000-0000-000000000001');raise exception 'outsider snapshot';exception when insufficient_privilege then null;end;
end $$;
-- Completion snapshot cannot be rewritten by subsequent registry edits, even privileged SQL.
reset role;
do $$ declare original jsonb; begin
select snapshot into original from maintenance_history where job_id='50000000-0000-0000-0000-000000000001';
if original->'usedItems'->0->>'name'<>'Bearing' or original->>'performedBy'<>'tech@example.invalid' then raise exception 'snapshot incomplete';end if;
update inventory set name='Renamed bearing' where id='40000000-0000-0000-0000-000000000001';
if (select snapshot from maintenance_history where job_id='50000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'history changed';end if;
begin update maintenance_history set notes='overwrite';raise exception 'history mutable';exception when raise_exception then if sqlerrm<>'completed history is immutable' then raise;end if;end;
begin delete from maintenance_jobs where status='completed';raise exception 'job deletable';exception when raise_exception then if sqlerrm<>'completed history is immutable' then raise;end if;end;
end $$;
-- Private invitations: owner only, fixed technician role, confirmed email, single use.
reset role;
insert into organizations(id,name) values('20000000-0000-0000-0000-000000000003','Invitation fixture');
insert into memberships(organization_id,user_id,role,display_name) values('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','owner','owner@example.invalid');
update private_deployment set organization_id='20000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select reserve_private_invitation('20000000-0000-0000-0000-000000000003','new-tech@example.invalid');
reset role;
insert into auth.users(id,email) values('10000000-0000-0000-0000-000000000006','new-tech@example.invalid');
do $$ begin if exists(select 1 from memberships where user_id='10000000-0000-0000-0000-000000000006') then raise exception 'unconfirmed user joined';end if;end $$;
update auth.users set email_confirmed_at=now() where id='10000000-0000-0000-0000-000000000006';
update auth.users set email_confirmed_at=now() where id='10000000-0000-0000-0000-000000000006';
do $$ begin
if (select count(*) from memberships where user_id='10000000-0000-0000-0000-000000000006' and role='technician')<>1 then raise exception 'invitation not accepted exactly once as technician';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000006',true);
do $$ begin
begin perform reserve_private_invitation('20000000-0000-0000-0000-000000000003','third@example.invalid');raise exception 'technician invited';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ begin
begin perform reserve_private_invitation('20000000-0000-0000-0000-000000000003','third@example.invalid');raise exception 'third user invitation allowed';exception when raise_exception then if sqlerrm<>'private deployment is limited to two users' then raise;end if;end;
end $$;
set local role anon;
do $$ begin
begin perform private_snapshot('20000000-0000-0000-0000-000000000001');raise exception 'anonymous snapshot allowed';exception when insufficient_privilege then null;end;
begin perform private_mutate('20000000-0000-0000-0000-000000000001',0,'asset','{}');raise exception 'anonymous mutation allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare n bigint;begin
select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind='r' and not c.relrowsecurity;
if n<>0 then raise exception 'public tenant tables without RLS';end if;
end $$;
rollback;
