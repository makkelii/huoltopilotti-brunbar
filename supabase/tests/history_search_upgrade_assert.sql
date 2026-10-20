do $$ begin
if (select history from history_search_upgrade_baseline) is distinct from (select coalesce(jsonb_agg(to_jsonb(h) order by id),'[]') from maintenance_history h) or
(select equipment from history_search_upgrade_baseline) is distinct from (select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from assets a) or
(select faults from history_search_upgrade_baseline) is distinct from (select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]') from fault_reports f) then raise exception 'search upgrade changed source data';end if;
if exists(select 1 from maintenance_search_documents where metadata_known or line_id is not null) then raise exception 'backfill invented historical metadata';end if;
if (select count(*) from maintenance_search_documents)<>(select count(*) from maintenance_history)+(select count(*) from fault_reports) then raise exception 'backfill lost records';end if;
end $$;
drop table history_search_upgrade_baseline;
