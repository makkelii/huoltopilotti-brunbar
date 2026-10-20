-- Each assertion runs in a throwaway PostgreSQL database. No production connection.
begin;
insert into auth.users(id,email,email_confirmed_at) values('a1000000-0000-0000-0000-000000000001','free-owner@example.invalid',now());
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000001','Free usage tenant');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','owner','Asentaja');
insert into assets(id,organization_id,name) values('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Moottori');
insert into inventory(id,organization_id,type,name,quantity) values('a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','part','Tiiviste',10),('a4000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','tool','Avain',0);
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,assigned_to,estimated_minutes,recurrence_days,data) values('a5000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Tiivistehuolto',now(),'planned','a1000000-0000-0000-0000-000000000001',60,30,'{"technician":"Asentaja","duration":60,"recurrence":30}');
insert into assets(id,organization_id,name,serial_number) values('a3000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','Empty test equipment','SER-EMPTY');
insert into auth.users(id) values('a1000000-0000-0000-0000-000000000002'),('a1000000-0000-0000-0000-000000000003'),('a1000000-0000-0000-0000-000000000004');
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000002','Other company');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','viewer','Viewer'),('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','technician','Tech'),('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000004','owner','Other');
insert into assets(id,organization_id,name) values('a3000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000001','Compatibility reference');
update inventory set compatible_assets='["a3000000-0000-0000-0000-000000000003"]' where id='a4000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
do $$ declare org uuid:='a2000000-0000-0000-0000-000000000001';aid uuid:='a3000000-0000-0000-0000-000000000001';empty_id uuid:='a3000000-0000-0000-0000-000000000002';line_id uuid:='a6000000-0000-0000-0000-000000000001';payload jsonb;original jsonb; snap jsonb; rev bigint;begin
begin perform private_mutate(org,0,'asset_archive',jsonb_build_object('id',aid));raise exception 'open jobs archived';exception when object_in_use then null;end;
-- Complete legitimately with recurrence disabled first, so no open work remains.
payload:=jsonb_build_object('id','a5000000-0000-0000-0000-000000000001','name','Maintenance','assetId',aid,'due','2026-10-20','priority','normal','status','planned','technician','Asentaja','duration',30,'recurrence',0,'requirements','[]'::jsonb);
perform private_mutate(org,0,'job',payload);
perform private_mutate(org,1,'complete','{"id":"a5000000-0000-0000-0000-000000000001","actual":{"a4000000-0000-0000-0000-000000000001":1},"notes":"Repaired","actualMinutes":20}');
select snapshot into original from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001';
perform private_mutate(org,2,'production_line',jsonb_build_object('id',line_id,'name','Line','identifier','LN-1'));
perform private_mutate(org,3,'asset',jsonb_build_object('id',aid,'name','Motor','productionLineId',line_id));
perform private_mutate(org,4,'asset_archive',jsonb_build_object('id',aid));
snap:=private_snapshot(org);
if not exists(select 1 from jsonb_array_elements(snap->'store'->'assets') a where a->>'id'=aid::text and a->>'archivedAt' is not null and a->>'canDelete'='false') then raise exception 'archive not persisted';end if;
begin perform private_mutate(org,5,'asset_delete',jsonb_build_object('id',aid));raise exception 'history equipment deleted';exception when foreign_key_violation then null;end;
begin perform private_mutate(org,5,'job',payload||jsonb_build_object('id',gen_random_uuid()));raise exception 'archived job accepted';exception when object_not_in_prerequisite_state then null;end;
begin perform private_mutate(org,5,'fault',jsonb_build_object('id',gen_random_uuid(),'assetId',aid,'symptoms','["test symptom","x","x"]'::jsonb,'cause','["test cause","x","x"]'::jsonb));raise exception 'archived fault accepted';exception when object_not_in_prerequisite_state then null;end;
perform private_mutate(org,5,'production_line_archive',jsonb_build_object('id',line_id));
if (select production_line_id from assets where id=aid) is not null then raise exception 'line archive did not detach';end if;
begin perform private_mutate(org,6,'asset_restore',jsonb_build_object('id',aid,'productionLineId',line_id));raise exception 'archived line restored on asset';exception when object_not_in_prerequisite_state then null;end;
perform private_mutate(org,6,'asset_restore',jsonb_build_object('id',aid,'productionLineId',null));
if (select archived_at from assets where id=aid) is not null then raise exception 'asset restore failed';end if;
-- Active identifier conflict blocks line restoration without moving devices.
perform private_mutate(org,7,'production_line',jsonb_build_object('id','a6000000-0000-0000-0000-000000000002','name','Other line','identifier','LN-1'));
begin perform private_mutate(org,8,'production_line_restore',jsonb_build_object('id',line_id));raise exception 'duplicate restored';exception when unique_violation then null;end;
perform private_mutate(org,8,'production_line_delete','{"id":"a6000000-0000-0000-0000-000000000002"}');
perform private_mutate(org,9,'production_line_restore',jsonb_build_object('id',line_id));
if (select production_line_id from assets where id=aid) is not null then raise exception 'restore moved equipment';end if;
begin perform private_mutate(org,10,'production_line_delete',jsonb_build_object('id',line_id));raise exception 'line with retained references deleted';exception when foreign_key_violation then null;end;
perform private_mutate(org,10,'asset_archive',jsonb_build_object('id',empty_id));
perform private_mutate(org,11,'asset_restore',jsonb_build_object('id',empty_id));
perform private_mutate(org,12,'asset_delete',jsonb_build_object('id',empty_id));
if exists(select 1 from assets where id=empty_id) then raise exception 'empty equipment not deleted';end if;
if not exists(select 1 from audit_events ae where entity_id=empty_id and action='private.asset_delete' and ae.payload->'before'->>'serial_number'='SER-EMPTY') then raise exception 'deletion audit missing';end if;
begin perform private_mutate(org,13,'asset',jsonb_build_object('id',empty_id,'name','Resurrect'));raise exception 'deleted id reused';exception when object_not_in_prerequisite_state then null;end;
begin perform private_mutate(org,12,'asset_archive',jsonb_build_object('id',aid));raise exception 'stale accepted';exception when serialization_failure then null;end;
if (select snapshot from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'history changed';end if;
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>9 then raise exception 'lifecycle changed inventory';end if;
end $$;
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',13,'asset_delete','{"id":"a3000000-0000-0000-0000-000000000003"}');raise exception 'compatibility reference deleted';exception when foreign_key_violation then null;end;
end $$;
-- Direct client writes and internal helpers remain forbidden, for all roles.
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',13,'asset_archive','{"id":"a3000000-0000-0000-0000-000000000001"}');raise exception 'tech archived';exception when insufficient_privilege then null;end;
begin perform private_asset_dependencies('a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001');raise exception 'internal helper exposed';exception when insufficient_privilege then null;end;
begin delete from assets where id='a3000000-0000-0000-0000-000000000001';raise exception 'direct deletion accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',13,'production_line_delete','{"id":"a6000000-0000-0000-0000-000000000001"}');raise exception 'viewer deleted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000004',true);
do $$ begin
if exists(select 1 from assets where organization_id='a2000000-0000-0000-0000-000000000001') then raise exception 'archived assets leaked';end if;
begin perform private_mutate('a2000000-0000-0000-0000-000000000002',0,'asset_delete','{"id":"a3000000-0000-0000-0000-000000000001"}');raise exception 'foreign deletion accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into production_lines(id,organization_id,name) values('a6000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000001','Unused archive');
insert into production_lines(id,organization_id,name) values('a6000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000001','Legacy reference');
-- A legacy JSON reference must also prevent deletion, even without a current assignment.
insert into maintenance_jobs(organization_id,asset_id,name,due_at,data) values('a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000003','Legacy job',now(),'{"legacyLineId":"a6000000-0000-0000-0000-000000000004"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',13,'production_line_delete','{"id":"a6000000-0000-0000-0000-000000000004"}');raise exception 'legacy reference deleted';exception when foreign_key_violation then null;end;
end $$;
select private_mutate('a2000000-0000-0000-0000-000000000001',13,'production_line_archive','{"id":"a6000000-0000-0000-0000-000000000003"}');
select private_mutate('a2000000-0000-0000-0000-000000000001',14,'production_line_delete','{"id":"a6000000-0000-0000-0000-000000000003"}');
reset role;
-- Defense in depth: even the internal recurrence insert cannot add an active job to an archived asset.
update assets set archived_at=now() where id='a3000000-0000-0000-0000-000000000001';
do $$ begin
begin insert into maintenance_jobs(organization_id,asset_id,name,due_at) values('a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Recurrence',now());raise exception 'recurrence on archived equipment';exception when object_not_in_prerequisite_state then null;end;
end $$;
rollback;
