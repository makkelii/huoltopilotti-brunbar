-- Each assertion runs in a throwaway PostgreSQL database. No production connection.
begin;
insert into auth.users(id,email,email_confirmed_at) values('a1000000-0000-0000-0000-000000000001','free-owner@example.invalid',now());
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000001','Free usage tenant');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','owner','Asentaja');
insert into assets(id,organization_id,name) values('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Moottori');
insert into inventory(id,organization_id,type,name,quantity) values('a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','part','Tiiviste',10),('a4000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','tool','Avain',0);
insert into maintenance_jobs(id,organization_id,asset_id,name,due_at,status,assigned_to,estimated_minutes,recurrence_days,data) values('a5000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Tiivistehuolto',now(),'planned','a1000000-0000-0000-0000-000000000001',60,30,'{"technician":"Asentaja","duration":60,"recurrence":30}');
update maintenance_jobs set recurrence_days=null,data=data||'{"recurrence":0,"description":"Moottori menee ylivirralle käynnistyksessä","instructions":"Tarkista taajuusmuuttaja"}' where id='a5000000-0000-0000-0000-000000000001';
insert into production_lines(id,organization_id,name) values('a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Historiallinen pakkauslinja'),('a6000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','Nykyinen linja');
update assets set production_line_id='a6000000-0000-0000-0000-000000000001',serial_number='SER-010' where id='a3000000-0000-0000-0000-000000000001';
insert into auth.users(id) values('a1000000-0000-0000-0000-000000000002'),('a1000000-0000-0000-0000-000000000003');
insert into organizations(id,name) values('a2000000-0000-0000-0000-000000000002','Other search company');
insert into memberships(organization_id,user_id,role,display_name) values('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','owner','Other'),('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','viewer','Viewer');
insert into assets(id,organization_id,name) values('a3000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000002','Other machine');
insert into fault_reports(id,organization_id,asset_id,symptoms,confirmed_cause,repair) values('a7000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000002','Salainen moottori ylivirta','Toisen yrityksen tieto','Salainen korjaus');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
select private_mutate('a2000000-0000-0000-0000-000000000001',0,'complete','{"id":"a5000000-0000-0000-0000-000000000001","actual":{"a4000000-0000-0000-0000-000000000001":1},"notes":"Laakeri vaihdettu ja ylivirta korjattu","actualMinutes":20,"freeUsage":[{"type":"tools","name":"Momenttiavain"}]}');
do $$ declare result jsonb;org uuid:='a2000000-0000-0000-0000-000000000001';original jsonb;begin
select snapshot into original from maintenance_history where organization_id=org;
result:=private_history_search(org,'MOOTTORISSA ylivir');
if jsonb_array_length(result->'results')<>1 then raise exception 'Finnish morphology or mixed prefix failed';end if;
if result->'results'->0->>'lineName'<>'Historiallinen pakkauslinja' or result->'results'->0->>'assetIdentifier'<>'SER-010' then raise exception 'event metadata missing';end if;
if jsonb_array_length(private_history_search(org,'momenttiav')->'results')<>1 then raise exception 'tool usage not indexed';end if;
if jsonb_array_length(private_history_search(org,'SER-010')->'results')<>1 then raise exception 'identifier not indexed';end if;
if jsonb_array_length(private_history_search(org,'')->'results')<>0 or jsonb_array_length(private_history_search(org,'zzzzzz')->'results')<>0 then raise exception 'empty/unmatched search wrong';end if;
perform private_history_search(org,$query$'; DROP TABLE assets; --$query$);
if not exists(select 1 from assets where organization_id=org) then raise exception 'SQL injection';end if;
begin perform private_history_search(org,repeat('a',201));raise exception 'long search accepted';exception when invalid_parameter_value then null;end;
begin perform private_history_search(org,'moottori',p_page=>-1);raise exception 'invalid page accepted';exception when invalid_parameter_value then null;end;
if private_history_record(org,'maintenance','a5000000-0000-0000-0000-000000000001') is distinct from original then raise exception 'original history changed';end if;
begin perform private_history_record(org,'fault','a7000000-0000-0000-0000-000000000002');raise exception 'foreign record opened';exception when insufficient_privilege then null;end;
begin perform private_history_options('a2000000-0000-0000-0000-000000000002');raise exception 'foreign options';exception when insufficient_privilege then null;end;
begin perform private_index_history(org,'maintenance','a5000000-0000-0000-0000-000000000001');raise exception 'internal index function exposed';exception when insufficient_privilege then null;end;
begin perform count(*) from maintenance_search_documents;raise exception 'direct index read exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update assets set production_line_id='a6000000-0000-0000-0000-000000000002' where id='a3000000-0000-0000-0000-000000000001';
-- 5,000 real trigger-indexed synthetic cases, not browser-loaded search fixtures.
insert into fault_reports(organization_id,asset_id,symptoms,confirmed_cause,repair,created_at)
select 'a2000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Synteettinen moottorin ylivirta '||n,'Testisyyn tunnistus','Kaapeli vaihdettu',now()-n*interval '1 minute' from generate_series(1,5000) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
do $$ declare first_page jsonb;second_page jsonb;org uuid:='a2000000-0000-0000-0000-000000000001';begin
first_page:=private_history_search(org,'synteettinen moottor');second_page:=private_history_search(org,'synteettinen moottor',p_page=>1);
if jsonb_array_length(first_page->'results')<>20 or first_page->>'hasMore'<>'true' or jsonb_array_length(second_page->'results')<>20 then raise exception 'pagination failed at 5000 records';end if;
if exists(select 1 from jsonb_array_elements(first_page->'results') a join jsonb_array_elements(second_page->'results') b on a->>'id'=b->>'id') then raise exception 'pages overlap';end if;
if jsonb_array_length(private_history_search(org,'ylivirta',p_line=>'a6000000-0000-0000-0000-000000000001',p_kind=>'maintenance')->'results')<>1 then raise exception 'historical line changed after move';end if;
if jsonb_array_length(private_history_search(org,'ylivirta',p_asset=>'a3000000-0000-0000-0000-000000000002')->'results')<>0 then raise exception 'foreign filter leaked';end if;
if jsonb_array_length(private_history_search(org,'ylivirta',p_from=>'2099-01-01')->'results')<>0 then raise exception 'date filter failed';end if;
perform private_mutate(org,1,'asset_archive','{"id":"a3000000-0000-0000-0000-000000000001"}');
if private_history_search(org,'taajuusmuuttaja')->'results'->0->>'archived'<>'true' then raise exception 'archive lost search';end if;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
do $$ begin
if jsonb_array_length(private_history_search('a2000000-0000-0000-0000-000000000001','taajuusmuuttaja')->'results')<>1 then raise exception 'viewer cannot search';end if;
begin perform private_history_search('a2000000-0000-0000-0000-000000000002','salainen');raise exception 'cross tenant search';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
if not exists(select 1 from pg_indexes where tablename='maintenance_search_documents' and indexdef like '%USING gin%') then raise exception 'GIN index missing';end if;
end $$;
rollback;
