do $$ begin
if (select equipment from registry_upgrade_baseline) is distinct from (select coalesce(jsonb_agg(to_jsonb(a)-'registry_removed_at' order by id),'[]') from assets a) or
(select lines from registry_upgrade_baseline) is distinct from (select coalesce(jsonb_agg(to_jsonb(l)-'registry_removed_at' order by id),'[]') from production_lines l) or
(select history from registry_upgrade_baseline) is distinct from (select coalesce(jsonb_agg(to_jsonb(h) order by id),'[]') from maintenance_history h) or
(select search_docs from registry_upgrade_baseline) is distinct from (select coalesce(jsonb_agg(to_jsonb(d) order by organization_id,kind,source_id),'[]') from maintenance_search_documents d) then raise exception 'registry upgrade changed existing data';end if;
if exists(select 1 from assets where registry_removed_at is not null) or exists(select 1 from production_lines where registry_removed_at is not null) then raise exception 'upgrade retired existing records';end if;
end $$;
drop table registry_upgrade_baseline;
