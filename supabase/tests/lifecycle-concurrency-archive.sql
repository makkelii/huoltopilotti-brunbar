begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-0000-0000-000000000001',true);
select private_mutate('d2000000-0000-0000-0000-000000000001',0,'asset_archive','{"id":"d3000000-0000-0000-0000-000000000001"}');
select pg_sleep(1);
commit;
