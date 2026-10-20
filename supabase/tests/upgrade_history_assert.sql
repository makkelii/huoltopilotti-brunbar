do $$ begin
if (select snapshot from maintenance_history where job_id='b5000000-0000-0000-0000-000000000001') is distinct from (select snapshot from test_expected_old_history) then raise exception 'migration changed old snapshot';end if;
end $$;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000001',true);
do $$ declare job jsonb;begin
select value into job from jsonb_array_elements(private_snapshot('b2000000-0000-0000-0000-000000000001')->'store'->'jobs') where value->>'id'='b5000000-0000-0000-0000-000000000001';
if job->>'notes'<>'Original work' or job->>'actualMinutes'<>'31' or job->>'performedBy'<>'Original name' then raise exception 'old history no longer loads';end if;
end $$;
rollback;
drop table test_expected_old_history;
