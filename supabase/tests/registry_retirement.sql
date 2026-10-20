-- Each assertion runs in a throwaway PostgreSQL database. No production connection.
begin;
insert into auth.users(id,email,email_confirmed_at) values('a1000000-0000-0000-0000-000000000001','free-owner@example.invalid',now());
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000001','Free usage tenant');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','owner','Asentaja');
insert into assets(id,organization_id,name) values('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Moottori');
insert into inventory(id,organization_id,type,name,quantity) values('a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','part','Tiiviste',10),('a4000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','tool','Avain',0);
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,assigned_to,estimated_minutes,recurrence_days,data) values('a5000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Tiivistehuolto',now(),'planned','a1000000-0000-0000-0000-000000000001',60,30,'{"technician":"Asentaja","duration":60,"recurrence":30}');
update maintenance_jobs set recurrence_days=null,data=data||'{"recurrence":0,"description":"Moottorin ylivirta"}' where id='a5000000-0000-0000-0000-000000000001';
insert into production_lines(id,organization_id,name,identifier) values('a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Vanha linja','LN-F');
update assets set serial_number='SER-F',production_line_id='a6000000-0000-0000-0000-000000000001' where id='a3000000-0000-0000-0000-000000000001';
insert into fault_reports(id,organization_id,asset_id,symptoms,confirmed_cause,repair) values('a7000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Moottorin ylivirta','Kaapelivaurio','Kaapeli vaihdettu');
insert into auth.users(id) values('a1000000-0000-0000-0000-000000000002'),('a1000000-0000-0000-0000-000000000003'),('a1000000-0000-0000-0000-000000000004');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','technician','Tech'),('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','viewer','Viewer');
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000002','Other company');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000004','owner','Other');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'asset_remove_registry','{"id":"a3000000-0000-0000-0000-000000000001","confirmation":"SER-F"}');raise exception 'active removal accepted';exception when object_not_in_prerequisite_state then null;end;
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'asset_delete','{"id":"a3000000-0000-0000-0000-000000000001","confirmation":"SER-F"}');raise exception 'legacy bypass accepted';exception when object_not_in_prerequisite_state then null;end;
end $$;
reset role;
-- Inconsistent legacy fixture with an open job: final removal still must refuse it.
update assets set archived_at=now() where id='a3000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'asset_remove_registry','{"id":"a3000000-0000-0000-0000-000000000001","confirmation":"SER-F"}');raise exception 'open work removal accepted';exception when object_in_use then null;end;
end $$;
reset role;
update assets set archived_at=null where id='a3000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ declare org uuid:='a2000000-0000-0000-0000-000000000001';original jsonb;fault_original jsonb;snap jsonb;found jsonb;begin
perform private_mutate(org,0,'complete','{"id":"a5000000-0000-0000-0000-000000000001","actual":{"a4000000-0000-0000-0000-000000000001":1},"notes":"Ylivirta korjattu","actualMinutes":20}');
select snapshot into original from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001';
select to_jsonb(f) into fault_original from fault_reports f where id='a7000000-0000-0000-0000-000000000001';
perform private_mutate(org,1,'asset_archive','{"id":"a3000000-0000-0000-0000-000000000001"}');
begin perform private_mutate(org,2,'asset_remove_registry','{"id":"a3000000-0000-0000-0000-000000000001","confirmation":"wrong"}');raise exception 'unconfirmed removal';exception when invalid_parameter_value then null;end;
perform private_mutate(org,2,'asset_remove_registry','{"id":"a3000000-0000-0000-0000-000000000001","confirmation":"SER-F"}');
snap:=private_snapshot(org);
if exists(select 1 from jsonb_array_elements(snap->'store'->'assets') a where a->>'id'='a3000000-0000-0000-0000-000000000001') or jsonb_array_length(snap->'store'->'removedAssets')<>1 then raise exception 'removed equipment still registered';end if;
if not exists(select 1 from assets where id='a3000000-0000-0000-0000-000000000001' and registry_removed_at is not null) then raise exception 'historical anchor lost';end if;
begin perform private_mutate(org,2,'asset_remove_registry','{"id":"a3000000-0000-0000-0000-000000000001","confirmation":"SER-F"}');raise exception 'duplicate revision accepted';exception when serialization_failure then null;end;
begin perform private_mutate(org,3,'asset_restore','{"id":"a3000000-0000-0000-0000-000000000001"}');raise exception 'removed equipment restored';exception when object_not_in_prerequisite_state then null;end;
begin perform private_mutate(org,3,'asset','{"id":"a3000000-0000-0000-0000-000000000001","name":"Overwrite"}');raise exception 'removed equipment overwritten';exception when object_not_in_prerequisite_state then null;end;
begin perform private_mutate(org,3,'job','{"id":"a5000000-0000-0000-0000-000000000099","assetId":"a3000000-0000-0000-0000-000000000001","name":"Bad recurrence","due":"2026-10-20","status":"planned","priority":"normal","technician":"Asentaja","duration":10,"recurrence":30,"requirements":[]}');raise exception 'new job on removed';exception when object_not_in_prerequisite_state then null;end;
perform private_mutate(org,3,'production_line_archive','{"id":"a6000000-0000-0000-0000-000000000001"}');
perform private_mutate(org,4,'production_line_remove_registry','{"id":"a6000000-0000-0000-0000-000000000001","confirmation":"LN-F"}');
snap:=private_snapshot(org);
if jsonb_array_length(snap->'store'->'productionLines')<>0 or jsonb_array_length(snap->'store'->'archivedProductionLines')<>0 or jsonb_array_length(snap->'store'->'removedProductionLines')<>1 then raise exception 'removed line still registered';end if;
found:=private_history_search(org,'ylivirta');
if jsonb_array_length(found->'results')<>2 or exists(select 1 from jsonb_array_elements(found->'results') r where r->>'removed'<>'true' or r->>'lineRemoved'<>'true' or r->>'lineName'<>'Vanha linja' or r->>'assetIdentifier'<>'SER-F') then raise exception 'search identity lost after removal';end if;
if private_history_record(org,'maintenance','a5000000-0000-0000-0000-000000000001') is distinct from original or (select to_jsonb(f) from fault_reports f where id='a7000000-0000-0000-0000-000000000001') is distinct from fault_original then raise exception 'history/fault changed';end if;
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>9 then raise exception 'removal changed stock';end if;
if (select count(*) from audit_events where organization_id=org and action in ('private.asset_remove_registry','private.production_line_remove_registry') and actor_id=auth.uid())<>2 then raise exception 'removal audit missing';end if;
begin perform private_mutate_before_registry_removal(org,5,'asset_restore','{"id":"a3000000-0000-0000-0000-000000000001"}');raise exception 'internal restore exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',5,'asset_remove_registry','{"id":"a3000000-0000-0000-0000-000000000001","confirmation":"SER-F"}');raise exception 'tech removed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
do $$ begin
if jsonb_array_length(private_history_search('a2000000-0000-0000-0000-000000000001','ylivirta')->'results')<>2 then raise exception 'viewer lost removed history';end if;
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',5,'production_line_remove_registry','{"id":"a6000000-0000-0000-0000-000000000001","confirmation":"LN-F"}');raise exception 'viewer removed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000004',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000002',0,'asset_remove_registry','{"id":"a3000000-0000-0000-0000-000000000001","confirmation":"SER-F"}');raise exception 'foreign removal';exception when insufficient_privilege then null;end;
begin perform private_history_search('a2000000-0000-0000-0000-000000000001','ylivirta');raise exception 'foreign removed history';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
