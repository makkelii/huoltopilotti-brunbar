begin;
insert into auth.users(id,email,email_confirmed_at) values
('c1000000-0000-0000-0000-000000000001','line-owner@example.invalid',now()),
('c1000000-0000-0000-0000-000000000002','line-tech@example.invalid',now()),
('c1000000-0000-0000-0000-000000000003','line-viewer@example.invalid',now()),
('c1000000-0000-0000-0000-000000000004','line-foreign@example.invalid',now());
insert into organizations(id,name) values('c2000000-0000-0000-0000-000000000001','Line tenant'),('c2000000-0000-0000-0000-000000000002','Other line tenant');
insert into memberships(organization_id,user_id,role,display_name) values
('c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','owner','Line owner'),
('c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002','technician','Line tech'),
('c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000003','viewer','Line viewer'),
('c2000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000004','owner','Foreign owner');
insert into assets(id,organization_id,name,data) values('c3000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001','Existing machine','{"name":"Existing machine","status":"review","serial":"SER-OLD"}');
insert into inventory(id,organization_id,type,name,quantity) values('c4000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001','part','Bearing',4);
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,assigned_to,estimated_minutes,recurrence_days,data) values('c5000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001','c3000000-0000-0000-0000-000000000001','Existing job',now(),'planned','c1000000-0000-0000-0000-000000000001',60,30,'{"technician":"Line owner","duration":60,"recurrence":30}');
insert into production_lines(id,organization_id,name,identifier) values('c6000000-0000-0000-0000-000000000003','c2000000-0000-0000-0000-000000000002','Foreign line','OTHER');
set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-0000-0000-000000000001',true);
do $$ declare org constant uuid:='c2000000-0000-0000-0000-000000000001'; a constant uuid:='c3000000-0000-0000-0000-000000000001'; l1 constant uuid:='c6000000-0000-0000-0000-000000000001'; l2 constant uuid:='c6000000-0000-0000-0000-000000000002'; rev bigint; original jsonb; payload jsonb; bad jsonb;begin
-- Existing completion and recurrence still go through the original guarded transaction.
perform private_mutate(org,0,'complete','{"id":"c5000000-0000-0000-0000-000000000001","actual":{"c4000000-0000-0000-0000-000000000001":1},"notes":"Bearing repaired","actualMinutes":31,"freeUsage":[{"type":"tools","name":"Own wrench"}]}');
select snapshot into original from maintenance_history where job_id='c5000000-0000-0000-0000-000000000001';
if (select count(*) from maintenance_jobs where organization_id=org)<>2 then raise exception 'recurrence broken';end if;
select revision into rev from organizations where id=org;
perform private_mutate(org,rev,'production_line',jsonb_build_object('id',l1,'name','Packing line','identifier','PACK-1','location','Hall','description','First line'));
select revision into rev from organizations where id=org;
perform private_mutate(org,rev,'production_line',jsonb_build_object('id',l2,'name','Filling line','identifier','FILL-2'));
select revision into rev from organizations where id=org;
perform private_mutate(org,rev,'production_line',jsonb_build_object('id',l1,'name','Renamed packing line','identifier','PACK-1','location','North hall','description','Updated line'));
if not exists(select 1 from production_lines where id=l1 and name='Renamed packing line' and location='North hall') then raise exception 'line edit missing';end if;
payload:=jsonb_build_object('id',a,'name','Existing machine','status','review','serial','SER-OLD','productionLineId',l1);
select revision into rev from organizations where id=org;
perform private_mutate(org,rev,'asset',payload);
if (select production_line_id from assets where id=a)<>l1 then raise exception 'assignment failed';end if;
begin perform private_mutate(org,rev,'asset',jsonb_set(payload,'{productionLineId}',to_jsonb(l2)));raise exception 'stale line move accepted';exception when serialization_failure then null;end;
select revision into rev from organizations where id=org;
perform private_mutate(org,rev,'asset',jsonb_set(payload,'{productionLineId}',to_jsonb(l2)));
if (select production_line_id from assets where id=a)<>l2 then raise exception 'line move failed';end if;
-- Older clients can edit metadata without accidentally losing the assignment.
select revision into rev from organizations where id=org;
perform private_mutate(org,rev,'asset',payload-'productionLineId');
if (select production_line_id from assets where id=a)<>l2 then raise exception 'old client lost line';end if;
select revision into rev from organizations where id=org;
perform private_mutate(org,rev,'asset',jsonb_set(payload,'{productionLineId}','null'));
if (select production_line_id from assets where id=a) is not null then raise exception 'optional detach failed';end if;
select revision into rev from organizations where id=org;
perform private_mutate(org,rev,'asset',payload);
select revision into rev from organizations where id=org;
perform private_mutate(org,rev,'production_line_archive',jsonb_build_object('id',l1));
if not exists(select 1 from assets where id=a and production_line_id is null) or not exists(select 1 from production_lines where id=l1 and archived_at is not null) then raise exception 'archive lost device or metadata';end if;
if (select count(*) from maintenance_jobs where organization_id=org)<>2 or (select quantity from inventory where id='c4000000-0000-0000-0000-000000000001')<>3 or (select count(*) from stock_movements where organization_id=org)<>1 then raise exception 'hierarchy changed job or stock';end if;
if not exists(select 1 from audit_events ev where ev.organization_id=org and ev.entity_id=a and ev.action='asset.production_line' and ev.payload->>'from'=l1::text and ev.payload->'to'='null'::jsonb) then raise exception 'asset line audit missing';end if;
if (select snapshot from maintenance_history where job_id='c5000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'hierarchy changed immutable history';end if;
if jsonb_array_length(private_snapshot(org)->'store'->'productionLines')<>1 then raise exception 'snapshot showed archived or foreign line';end if;
if (private_snapshot(org)->'store'->'assets'->0->'productionLineId')<>'null'::jsonb then raise exception 'snapshot stale line JSON';end if;
if not exists(select 1 from audit_events ev where organization_id=org and entity_id=l1 and action='private.production_line_archive' and ev.payload->>'detachedAssetCount'='1') then raise exception 'archive audit missing';end if;
select revision into rev from organizations where id=org;
begin perform private_mutate(org,rev,'asset',payload);raise exception 'archived line reused';exception when insufficient_privilege then null;end;
begin perform private_mutate(org,rev,'asset',jsonb_set(payload,'{productionLineId}','"c6000000-0000-0000-0000-000000000003"'));raise exception 'foreign line assigned';exception when insufficient_privilege then null;end;
begin perform private_mutate(org,rev,'production_line',jsonb_build_object('id','c6000000-0000-0000-0000-000000000003','name','Stolen'));raise exception 'foreign line edited';exception when insufficient_privilege then null;end;
begin perform private_mutate(org,rev,'production_line_archive','{"id":"c6000000-0000-0000-0000-000000000003"}');raise exception 'foreign line archived';exception when insufficient_privilege then null;end;
begin perform private_mutate(org,rev,null,jsonb_build_object('id',l2));raise exception 'null kind archived line';exception when invalid_parameter_value then null;end;
begin perform private_mutate(org,rev,'production_line',jsonb_build_object('id',l1,'name','Resurrect'));raise exception 'archive resurrected';exception when insufficient_privilege then null;end;
begin perform private_mutate(org,rev,'production_line',jsonb_build_object('id',gen_random_uuid(),'name','Duplicate','identifier',' fill-2 '));raise exception 'duplicate identifier accepted';exception when unique_violation then null;end;
for bad in select value from jsonb_array_elements('[{},null,{"name":""},{"name":false},{"name":"x","identifier":null},{"name":"x","location":[]} ]') loop
begin perform private_mutate(org,rev,'production_line',coalesce(bad,'{}')||jsonb_build_object('id',gen_random_uuid()));raise exception 'invalid line accepted';exception when invalid_parameter_value then null;end;
end loop;
begin insert into production_lines(organization_id,name) values(org,'Bypass');raise exception 'direct write accepted';exception when insufficient_privilege then null;end;
begin update assets set production_line_id=l2 where id=a;raise exception 'direct asset write accepted';exception when insufficient_privilege then null;end;
begin perform private_mutate_before_lines(org,rev,'asset',payload);raise exception 'internal RPC callable';exception when insufficient_privilege then null;end;
begin perform private_snapshot_before_lines(org);raise exception 'internal snapshot callable';exception when insufficient_privilege then null;end;
end $$;
-- Worker and viewer can read their own tenant, never manage lines or move assets.
select set_config('request.jwt.claim.sub','c1000000-0000-0000-0000-000000000002',true);
do $$ declare rev bigint;begin
select revision into rev from organizations where id='c2000000-0000-0000-0000-000000000001';
if (select count(*) from production_lines)<>2 then raise exception 'RLS leaked foreign line';end if;
begin perform private_mutate('c2000000-0000-0000-0000-000000000001',rev,'production_line','{"id":"c6000000-0000-0000-0000-000000000004","name":"Denied"}');raise exception 'worker created line';exception when insufficient_privilege then null;end;
begin perform private_mutate('c2000000-0000-0000-0000-000000000001',rev,'asset','{"id":"c3000000-0000-0000-0000-000000000001","name":"Denied","productionLineId":"c6000000-0000-0000-0000-000000000002"}');raise exception 'worker moved asset';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','c1000000-0000-0000-0000-000000000003',true);
do $$ begin
if jsonb_array_length(private_snapshot('c2000000-0000-0000-0000-000000000001')->'store'->'productionLines')<>1 then raise exception 'viewer cannot read hierarchy';end if;
begin perform private_mutate('c2000000-0000-0000-0000-000000000001',0,'production_line_archive','{"id":"c6000000-0000-0000-0000-000000000002"}');raise exception 'viewer archived line';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','c1000000-0000-0000-0000-000000000004',true);
do $$ begin
if (select count(*) from production_lines)<>1 then raise exception 'foreign tenant read line';end if;
begin perform private_snapshot('c2000000-0000-0000-0000-000000000001');raise exception 'foreign tenant snapshot';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Composite FK remains a database-level boundary, even outside the application RPC.
do $$ begin
begin update assets set production_line_id='c6000000-0000-0000-0000-000000000003' where id='c3000000-0000-0000-0000-000000000001';raise exception 'cross-tenant FK bypass';exception when foreign_key_violation then null;end;
update assets set production_line_id='c6000000-0000-0000-0000-000000000002' where id='c3000000-0000-0000-0000-000000000001';
begin delete from production_lines where id='c6000000-0000-0000-0000-000000000002';raise exception 'line deletion cascaded';exception when foreign_key_violation then null;end;
end $$;
rollback;
