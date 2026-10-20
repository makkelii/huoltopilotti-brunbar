-- Test-only baseline across 009 -> 010. Source rows must remain byte-for-byte equivalent as JSON.
create table public.history_search_upgrade_baseline as select
 (select coalesce(jsonb_agg(to_jsonb(h) order by id),'[]') from maintenance_history h) history,
 (select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from assets a) equipment,
 (select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]') from fault_reports f) faults;
