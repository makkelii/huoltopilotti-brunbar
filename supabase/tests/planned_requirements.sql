-- Each assertion runs in a throwaway PostgreSQL database. No production connection.
begin;
insert into auth.users(id,email,email_confirmed_at) values('a1000000-0000-0000-0000-000000000001','free-owner@example.invalid',now());
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000001','Free usage tenant');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','owner','Asentaja');
insert into assets(id,organization_id,name) values('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Moottori');
insert into inventory(id,organization_id,type,name,quantity) values('a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','part','Tiiviste',10),('a4000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','tool','Avain',0);
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,assigned_to,estimated_minutes,recurrence_days,data) values('a5000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Tiivistehuolto',now(),'planned','a1000000-0000-0000-0000-000000000001',60,30,'{"technician":"Asentaja","duration":60,"recurrence":30}');
insert into auth.users(id) values('a1000000-0000-0000-0000-000000000002'),('a1000000-0000-0000-0000-000000000003'),('a1000000-0000-0000-0000-000000000004');
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000002','Other plan tenant');
insert into memberships(organization_id,user_id,role,display_name) values
('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','viewer','Viewer'),
('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','technician','Tech'),
('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000004','owner','Other');
insert into inventory(id,organization_id,type,name,quantity) values('a4000000-0000-0000-0000-000000000099','a2000000-0000-0000-0000-000000000002','tool','Other tenant wrench',0);
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
do $$ declare rows jsonb; payload jsonb; original jsonb; bad jsonb;begin
rows := '[{"id":"p1","category":"parts","label":["Oma tiiviste","Own seal","Dichtung"],"quantity":3,"state":"unchecked"},{"id":"p2","category":"tools","label":["Oma avain","Own wrench","Schlüssel"],"quantity":99,"state":"unchecked"},{"id":"p3","category":"parts","label":["Tiiviste","Seal","Dichtung"],"itemId":"a4000000-0000-0000-0000-000000000001","quantity":2,"state":"unchecked"},{"id":"p4","category":"documents","label":["Puhdista","Clean","Reinigen"],"quantity":1,"state":"unchecked"}]';
perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'template',jsonb_build_object('requirements',rows));
payload:=jsonb_build_object('id','a5000000-0000-0000-0000-000000000001','name','Suunniteltu huolto','assetId','a3000000-0000-0000-0000-000000000001','due','2026-10-20','status','planned','priority','normal','technician','Asentaja','duration',30,'recurrence',30,'instructions','Irrota virta','requirements',rows);
perform private_mutate('a2000000-0000-0000-0000-000000000001',1,'job',payload);
if (select count(*) from job_requirements where job_id='a5000000-0000-0000-0000-000000000001')<>4 then raise exception 'planned rows missing';end if;
if exists(select 1 from job_requirements where job_id='a5000000-0000-0000-0000-000000000001' and category='tool' and quantity<>1) then raise exception 'tools have quantity';end if;
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>10 or exists(select 1 from stock_movements where organization_id='a2000000-0000-0000-0000-000000000001') then raise exception 'planning consumed stock';end if;
-- Bad references, nonfinite/negative quantities, null payloads and labels roll back the complete edit.
for bad in select value from jsonb_array_elements('[null,{},[{"category":"parts","label":["x","x","x"],"quantity":0}],[{"category":"tools","label":["x","x","x"],"quantity":1,"itemId":"a4000000-0000-0000-0000-000000000099"}],[{"category":"parts","label":[null,"x","x"],"quantity":1}]]') loop
begin
perform private_mutate('a2000000-0000-0000-0000-000000000001',2,'job',jsonb_set(payload,'{requirements}',bad));
raise exception 'invalid planning accepted';
exception when invalid_parameter_value or insufficient_privilege then null;end;
end loop;
perform private_mutate('a2000000-0000-0000-0000-000000000001',2,'complete','{"id":"a5000000-0000-0000-0000-000000000001","actual":{"a4000000-0000-0000-0000-000000000001":1},"freeUsage":[{"type":"tools","name":"Oma avain"},{"type":"parts","name":"Oma tiiviste","quantity":2}],"notes":"Tiiviste vaihdettu","actualMinutes":20}');
select snapshot into original from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001';
if original->>'instructions'<>'Irrota virta' or jsonb_array_length(original->'requirements')<>4 or jsonb_array_length(original->'freeUsage')<>2 then raise exception 'snapshot lost plan or usage';end if;
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>9 then raise exception 'planned quantity consumed instead of actual';end if;
perform private_mutate('a2000000-0000-0000-0000-000000000001',3,'template','{"requirements":[]}');
if (select snapshot from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'template rewrote history';end if;
if (select count(*) from job_requirements r join maintenance_jobs j on j.id=r.job_id where j.organization_id='a2000000-0000-0000-0000-000000000001' and j.status='planned')<>4 then raise exception 'recurrence lost plan';end if;
begin perform private_validate_requirements('a2000000-0000-0000-0000-000000000001',rows);raise exception 'internal validator exposed';exception when insufficient_privilege then null;end;
end $$;
-- Viewer cannot mutate free plans or templates. Technician cannot publish templates.
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',4,'job','{}');raise exception 'viewer wrote plan';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',4,'template','{"requirements":[]}');raise exception 'tech changed template';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000004',true);
do $$ begin
if exists(select 1 from job_requirements where organization_id='a2000000-0000-0000-0000-000000000001') then raise exception 'free plan leaked';end if;
begin perform private_snapshot('a2000000-0000-0000-0000-000000000001');raise exception 'other tenant snapshot allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
