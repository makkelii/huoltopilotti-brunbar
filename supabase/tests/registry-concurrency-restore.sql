begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','99100000-0000-0000-0000-000000000001',true);
select private_mutate('99200000-0000-0000-0000-000000000001',0,'asset_restore','{"id":"99300000-0000-0000-0000-000000000001","confirmation":"RACE"}');
select pg_sleep(1);
commit;
