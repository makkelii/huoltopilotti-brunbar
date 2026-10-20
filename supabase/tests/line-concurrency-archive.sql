begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000001',true);
select private_mutate('f2000000-0000-0000-0000-000000000001',0,'production_line_archive','{"id":"f6000000-0000-0000-0000-000000000001"}');
select pg_sleep(1);
commit;
