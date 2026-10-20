begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000002',true);
select private_mutate('f2000000-0000-0000-0000-000000000001',0,'asset','{"id":"f3000000-0000-0000-0000-000000000001","name":"Race machine","productionLineId":"f6000000-0000-0000-0000-000000000001"}');
commit;
