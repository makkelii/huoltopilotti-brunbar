do $$ begin
if (select count(*) from assets)<>(select count(*) from test_assets_before_lines) then raise exception 'migration changed asset count';end if;
if exists(select 1 from test_assets_before_lines old left join assets a using(id) where a.id is null or (to_jsonb(a)-'production_line_id') is distinct from old.original or a.production_line_id is not null) then raise exception 'migration changed existing asset';end if;
if exists(select 1 from test_history_before_lines old left join maintenance_history h using(id) where to_jsonb(h) is distinct from old.original) then raise exception 'migration changed history';end if;
end $$;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000001',true);
do $$ declare result jsonb;begin
result:=private_snapshot('b2000000-0000-0000-0000-000000000001');
if jsonb_array_length(result->'store'->'assets')<>1 or result->'store'->'productionLines'<>'[]'::jsonb or result->'store'->'assets'->0->'productionLineId'<>'null'::jsonb then raise exception 'old devices no longer load';end if;
end $$;
rollback;
drop table test_assets_before_lines,test_history_before_lines;
