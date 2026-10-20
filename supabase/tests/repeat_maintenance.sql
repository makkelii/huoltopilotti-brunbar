-- Each assertion runs in a throwaway PostgreSQL database. No production connection.
begin;
insert into auth.users(id,email,email_confirmed_at) values('a1000000-0000-0000-0000-000000000001','free-owner@example.invalid',now());
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000001','Free usage tenant');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','owner','Asentaja');
insert into assets(id,organization_id,name) values('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Moottori');
insert into inventory(id,organization_id,type,name,quantity) values('a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','part','Tiiviste',10),('a4000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','tool','Avain',0);
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,assigned_to,estimated_minutes,recurrence_days,data) values('a5000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Tiivistehuolto',now(),'planned','a1000000-0000-0000-0000-000000000001',60,30,'{"technician":"Asentaja","duration":60,"recurrence":30}');
insert into auth.users(id) values('a1000000-0000-0000-0000-000000000002'),('a1000000-0000-0000-0000-000000000003'),('a1000000-0000-0000-0000-000000000004');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','technician','Asentaja 2'),('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','viewer','Katselija');
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000002','Other repeat tenant');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000004','owner','Other owner');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
do $$ declare original jsonb; movements bigint;begin
perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'complete','{"id":"a5000000-0000-0000-0000-000000000001","actual":{"a4000000-0000-0000-0000-000000000001":1},"notes":"Old repair","actualMinutes":20,"freeUsage":[{"type":"parts","name":"Oma tiiviste","quantity":2.5},{"type":"tools","name":"Oma avain"}]}');
select snapshot into original from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001';
select count(*) into movements from stock_movements where organization_id='a2000000-0000-0000-0000-000000000001';
perform private_mutate('a2000000-0000-0000-0000-000000000001',1,'job','{"id":"a5000000-0000-0000-0000-000000000099","name":"Reviewed repeat","assetId":"a3000000-0000-0000-0000-000000000001","due":"2026-11-01","priority":"normal","status":"planned","technician":"Asentaja","duration":30,"recurrence":0,"notes":"","requirements":[{"id":"repeat-part","category":"parts","label":["Tiiviste","Tiiviste","Tiiviste"],"quantity":1,"itemId":"a4000000-0000-0000-0000-000000000001","state":"unchecked"},{"id":"repeat-free","category":"parts","label":["Oma tiiviste","Oma tiiviste","Oma tiiviste"],"quantity":2.5,"state":"unchecked"},{"id":"repeat-tool","category":"tools","label":["Oma avain","Oma avain","Oma avain"],"quantity":1,"state":"unchecked"}]}');
if (select snapshot from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'repeat changed history';end if;
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>9 or (select count(*) from maintenance_history where organization_id='a2000000-0000-0000-0000-000000000001')<>1 then raise exception 'repeat consumed stock or completed';end if;
if (select count(*) from stock_movements where organization_id='a2000000-0000-0000-0000-000000000001')<>movements then raise exception 'repeat created a stock movement';end if;
if (select count(*) from inventory where organization_id='a2000000-0000-0000-0000-000000000001')<>2 then raise exception 'repeat created registry items';end if;
if (select count(*) from job_requirements where job_id='a5000000-0000-0000-0000-000000000099')<>3 then raise exception 'actual-derived plan missing';end if;
if exists(select 1 from maintenance_jobs where id='a5000000-0000-0000-0000-000000000099' and (status<>'planned' or data->>'completedAt' is not null or data->>'actualMinutes' is not null or coalesce(data->'actual','{}'::jsonb)<>'{}'::jsonb or coalesce(data->'freeUsage','[]'::jsonb)<>'[]'::jsonb)) then raise exception 'repeat acquired completion';end if;
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',1,'job','{}');raise exception 'duplicate revision accepted';exception when serialization_failure then null;end;
end $$;
-- Viewer and another tenant cannot create a repeat even by calling the RPC directly.
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',2,'job','{}');raise exception 'viewer repeated work';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000004',true);
do $$ begin
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',2,'job','{}');raise exception 'cross-tenant repeat';exception when insufficient_privilege then null;end;
end $$;
-- A technician may create a reviewed plan, still without consuming anything.
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);
do $$ begin
perform private_mutate('a2000000-0000-0000-0000-000000000001',2,'job','{"id":"a5000000-0000-0000-0000-000000000098","name":"Technician repeat","assetId":"a3000000-0000-0000-0000-000000000001","due":"2026-11-01","priority":"normal","status":"planned","technician":"Asentaja 2","duration":30,"recurrence":0,"notes":"","requirements":[{"id":"manual-part","category":"parts","label":["Oma osa","Oma osa","Oma osa"],"quantity":2,"state":"unchecked"}]}');
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>9 then raise exception 'technician plan consumed stock';end if;
end $$;
reset role;
rollback;
