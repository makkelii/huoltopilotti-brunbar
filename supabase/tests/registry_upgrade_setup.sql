create table registry_upgrade_baseline as select
(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from assets a) equipment,
(select coalesce(jsonb_agg(to_jsonb(l) order by id),'[]') from production_lines l) lines,
(select coalesce(jsonb_agg(to_jsonb(h) order by id),'[]') from maintenance_history h) history,
(select coalesce(jsonb_agg(to_jsonb(d) order by organization_id,kind,source_id),'[]') from maintenance_search_documents d) search_docs;
