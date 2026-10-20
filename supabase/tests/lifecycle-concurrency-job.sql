begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-0000-0000-000000000001',true);
select private_mutate('d2000000-0000-0000-0000-000000000001',0,'job','{"id":"d5000000-0000-0000-0000-000000000001","assetId":"d3000000-0000-0000-0000-000000000001","name":"Race work","due":"2026-10-20","status":"planned","priority":"normal","technician":"Race owner","duration":30,"recurrence":0,"requirements":[]}');
select pg_sleep(1);
commit;
