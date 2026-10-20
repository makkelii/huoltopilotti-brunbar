-- Snapshot existing 001–006 data before the optional line column is added.
create table public.test_assets_before_lines as select id,to_jsonb(a) as original from public.assets a;
create table public.test_history_before_lines as select id,to_jsonb(h) as original from public.maintenance_history h;
