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
do $$ declare payload jsonb; bad jsonb; next_id uuid; original jsonb;begin
payload:='{"id":"a5000000-0000-0000-0000-000000000001","actual":{"a4000000-0000-0000-0000-000000000001":2.5,"a4000000-0000-0000-0000-000000000002":1},"notes":"Vaihdettu tiiviste","actualMinutes":25,"completionNotes":"Tarkistettu","freeUsage":[{"type":"tools","name":" Oma avain ","quantity":999,"id":"a4000000-0000-0000-0000-000000000001"},{"type":"tools","name":"Pihdit"},{"type":"parts","name":"Tiiviste","quantity":3}]}';
-- Validate all malformed entries and rollback every side effect.
for bad in select value from jsonb_array_elements('[null,{},[{"type":"parts","name":"x","quantity":0}],[{"type":"parts","name":"x","quantity":-1}],[{"type":"parts","name":"x","quantity":"NaN"}],[{"type":"parts","name":"x","quantity":100000001}],[{"type":"parts","name":"x"}],[{"type":"tools","name":" "}],[{"type":"other","name":"x"}],[{"type":"parts","name":false,"quantity":1}]]') loop
begin
perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'complete',jsonb_set(payload,'{freeUsage}',bad));
raise exception 'invalid usage accepted';
exception when raise_exception then if sqlerrm='invalid usage accepted' then raise;end if;end;
end loop;
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>10 or exists(select 1 from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001') then raise exception 'validation changed data';end if;
perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'complete',payload);
select snapshot into original from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001';
if original->'freeUsage' <> '[{"type":"tools","name":"Oma avain"},{"type":"tools","name":"Pihdit"},{"type":"parts","name":"Tiiviste","quantity":3}]'::jsonb or original->>'assetName'<>'Moottori' or original->>'performedBy'<>'Asentaja' or original->>'actualMinutes'<>'25' then raise exception 'snapshot lost details';end if;
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>7.5 or (select quantity from inventory where id='a4000000-0000-0000-0000-000000000002')<>0 then raise exception 'wrong stock';end if;
if (select count(*) from inventory where organization_id='a2000000-0000-0000-0000-000000000001')<>2 or (select count(*) from stock_movements where organization_id='a2000000-0000-0000-0000-000000000001')<>1 then raise exception 'manual entry changed inventory';end if;
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',0,'complete',payload);raise exception 'stale accepted';exception when serialization_failure then null;end;
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',1,'complete',payload);raise exception 'duplicate accepted';exception when serialization_failure then null;end;
begin update maintenance_history set snapshot='{}' where job_id='a5000000-0000-0000-0000-000000000001';raise exception 'history changed';exception when insufficient_privilege then null; when raise_exception then if sqlerrm<>'completed history is immutable' then raise;end if;end;
select id into next_id from maintenance_jobs where organization_id='a2000000-0000-0000-0000-000000000001' and status='planned';
if exists(select 1 from maintenance_jobs where id=next_id and (data ? 'freeUsage' or data ? 'actualMinutes' or data ? 'completionNotes')) then raise exception 'recurrence inherited completion';end if;
-- Manual-only completion works without any inventory selections.
perform private_mutate('a2000000-0000-0000-0000-000000000001',1,'complete',jsonb_build_object('id',next_id,'actual','{}'::jsonb,'notes','Oma varaosa','actualMinutes',10,'freeUsage','[{"type":"parts","name":"Tiiviste","quantity":5}]'::jsonb));
if (select quantity from inventory where id='a4000000-0000-0000-0000-000000000001')<>7.5 then raise exception 'manual-only stock changed';end if;
if (select snapshot from maintenance_history where job_id='a5000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'old history changed';end if;
if jsonb_array_length(private_snapshot('a2000000-0000-0000-0000-000000000001')->'store'->'jobs')<>3 then raise exception 'reload lost completion';end if;
end $$;
reset role;
-- Other tenant cannot read or complete this tenant's work, including manual data.
insert into auth.users(id,email,email_confirmed_at) values('a1000000-0000-0000-0000-000000000002','other-free@example.invalid',now());
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000002','Other tenant');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','technician','Other');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);
do $$ begin
if exists(select 1 from maintenance_history where organization_id='a2000000-0000-0000-0000-000000000001') then raise exception 'manual history leaked';end if;
begin perform private_mutate('a2000000-0000-0000-0000-000000000001',2,'complete','{}');raise exception 'foreign completion accepted';exception when insufficient_privilege then null;end;
end $$;
rollback;
