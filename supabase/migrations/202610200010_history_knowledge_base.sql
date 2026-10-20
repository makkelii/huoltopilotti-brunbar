-- Derived, tenant-scoped search index. Source history remains immutable.
begin;
create table public.maintenance_search_documents(
 organization_id uuid not null references organizations(id),kind text not null check(kind in ('maintenance','fault')),source_id uuid not null,
 asset_id uuid not null,line_id uuid,title text not null,asset_name text not null,asset_identifier text not null default '',line_name text,
 happened_at timestamptz not null,problem text not null default '',repair text not null default '',parts text not null default '',tools text not null default '',metadata_known boolean not null,
 document tsvector generated always as (
  setweight(to_tsvector('finnish',problem||' '||repair||' '||regexp_replace(asset_identifier,'[^[:alnum:]_]+',' ','g')),'A') || setweight(to_tsvector('finnish',title||' '||parts||' '||tools),'B') || setweight(to_tsvector('finnish',asset_name||' '||coalesce(line_name,'')),'C') ||
  setweight(to_tsvector('simple',problem||' '||repair||' '||regexp_replace(asset_identifier,'[^[:alnum:]_]+',' ','g')),'A') || setweight(to_tsvector('simple',title||' '||parts||' '||tools),'B') || setweight(to_tsvector('simple',asset_name||' '||coalesce(line_name,'')),'C')) stored,
 primary key(organization_id,kind,source_id),foreign key(organization_id,asset_id) references assets(organization_id,id),foreign key(organization_id,line_id) references production_lines(organization_id,id)
);
alter table maintenance_search_documents enable row level security;
revoke all on maintenance_search_documents from public,anon,authenticated;
create index maintenance_search_text on maintenance_search_documents using gin(document);
create index maintenance_search_scope on maintenance_search_documents(organization_id,happened_at desc,source_id,kind);
create index maintenance_search_asset on maintenance_search_documents(organization_id,asset_id);
create index maintenance_search_line on maintenance_search_documents(organization_id,line_id);

create function public.private_index_history(p_org uuid,p_kind text,p_id uuid,p_legacy boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare h maintenance_history;f fault_reports;a assets;l production_lines;s jsonb;title_text text;problem_text text;repair_text text;parts_text text;tools_text text;happened timestamptz;begin
if p_kind='maintenance' then
 select * into strict h from maintenance_history where organization_id=p_org and job_id=p_id;
 s:=h.snapshot;select * into strict a from assets where organization_id=p_org and id=(s->>'assetId')::uuid;
 title_text:=coalesce(s->>'name','');problem_text:=concat_ws(' ',s->>'description',s->>'instructions',s->>'completionNotes');repair_text:=coalesce(s->>'notes',h.notes,'');happened:=h.completed_at;
 select string_agg(concat_ws(' ',v->>'name',v->>'usedQuantity',v->>'quantity'),' ') into parts_text from (select value v from jsonb_array_elements(case when jsonb_typeof(s->'usedItems')='array' then s->'usedItems' else '[]'::jsonb end) union all select value from jsonb_array_elements(case when jsonb_typeof(s->'freeUsage')='array' then s->'freeUsage' else '[]'::jsonb end)) entries where v->>'type'<>'tools';
 select string_agg(v->>'name',' ') into tools_text from (select value v from jsonb_array_elements(case when jsonb_typeof(s->'usedItems')='array' then s->'usedItems' else '[]'::jsonb end) union all select value from jsonb_array_elements(case when jsonb_typeof(s->'freeUsage')='array' then s->'freeUsage' else '[]'::jsonb end)) entries where v->>'type'='tools';
else
 select * into strict f from fault_reports where organization_id=p_org and id=p_id;
 select * into strict a from assets where organization_id=p_org and id=f.asset_id;
 s:=f.data;title_text:=f.symptoms;problem_text:=f.symptoms;repair_text:=concat_ws(' ',f.confirmed_cause,f.repair);happened:=f.created_at;
end if;
if not p_legacy then select * into l from production_lines where organization_id=p_org and id=a.production_line_id;end if;
insert into maintenance_search_documents(organization_id,kind,source_id,asset_id,line_id,title,asset_name,asset_identifier,line_name,happened_at,problem,repair,parts,tools,metadata_known)
values(p_org,p_kind,p_id,a.id,l.id,title_text,coalesce(s->>'assetName',a.name),case when p_legacy then coalesce(s->>'assetSerial','') else coalesce(a.serial_number,'') end,l.name,happened,problem_text,repair_text,coalesce(parts_text,''),coalesce(tools_text,''),not p_legacy)
on conflict(organization_id,kind,source_id) do update set title=excluded.title,problem=excluded.problem,repair=excluded.repair,parts=excluded.parts,tools=excluded.tools;
end $$;
revoke all on function public.private_index_history(uuid,text,uuid,boolean) from public,anon,authenticated;
create function public.index_history_insert() returns trigger language plpgsql security definer set search_path=public as $$ begin
if tg_table_name='maintenance_history' then perform private_index_history(new.organization_id,'maintenance',new.job_id);else perform private_index_history(new.organization_id,'fault',new.id);end if;return new;end $$;
revoke all on function public.index_history_insert() from public,anon,authenticated;
create trigger index_completed_history after insert on maintenance_history for each row execute function index_history_insert();
create trigger index_fault_history after insert or update on fault_reports for each row execute function index_history_insert();
-- Backfill only the derived index. Unknown old line/serial metadata is deliberately left unknown.
do $$ declare r record;begin
for r in select organization_id,job_id from maintenance_history loop perform private_index_history(r.organization_id,'maintenance',r.job_id,true);end loop;
for r in select organization_id,id from fault_reports loop perform private_index_history(r.organization_id,'fault',r.id,true);end loop;
end $$;

create function public.private_history_query(p_query text) returns tsquery language plpgsql immutable set search_path=public as $$
declare term text;q tsquery;piece tsquery;stem tsquery;begin
for term in select regexp_split_to_table(lower(p_query),'[^[:alnum:]_]+') loop
 if length(term)<2 then continue;end if;
 piece:=to_tsquery('simple',quote_literal(term)||':*');stem:=plainto_tsquery('finnish',term);
 if numnode(stem)>0 then piece:=piece||stem;end if;
 if q is null then q:=piece;else q:=q&&piece;end if;
end loop;
return q;end $$;
revoke all on function public.private_history_query(text) from public,anon,authenticated;

create function public.private_history_search(p_org uuid,p_query text,p_asset uuid default null,p_line uuid default null,p_from date default null,p_to date default null,p_kind text default null,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare q tsquery;rows jsonb;begin
if not is_member(p_org) then raise exception 'forbidden' using errcode='42501';end if;
if p_query is null or length(p_query)>200 or p_page is null or p_page<0 or p_page>5000 or (p_kind is not null and p_kind not in ('maintenance','fault')) or p_from>p_to then raise exception 'invalid search' using errcode='22023';end if;
q:=private_history_query(p_query);
if q is null then return '{"results":[],"hasMore":false}'::jsonb;end if;
select coalesce(jsonb_agg(row_data order by score desc,happened_at desc,source_id,kind),'[]') into rows from (
 select source_id,happened_at,d.kind,ts_rank_cd(document,q)+(case when position(lower(p_query) in lower(problem||' '||repair||' '||regexp_replace(asset_identifier,'[^[:alnum:]_]+',' ','g')))>0 then 2 else 0 end) score,
 jsonb_build_object('id',d.source_id,'kind',d.kind,'title',d.title,'assetId',d.asset_id,'assetName',d.asset_name,'assetIdentifier',d.asset_identifier,'lineId',d.line_id,'lineName',d.line_name,'at',d.happened_at,'problem',d.problem,'repair',d.repair,'parts',d.parts,'tools',d.tools,'metadataKnown',d.metadata_known,'archived',a.archived_at is not null,
 'matchedFields',array_remove(array[case when (to_tsvector('finnish',problem)||to_tsvector('simple',problem))@@q then 'problem' end,case when (to_tsvector('finnish',repair)||to_tsvector('simple',repair))@@q then 'repair' end,case when (to_tsvector('finnish',title)||to_tsvector('simple',title))@@q then 'title' end,case when (to_tsvector('finnish',parts||' '||tools)||to_tsvector('simple',parts||' '||tools))@@q then 'supplies' end],null)) row_data
 from maintenance_search_documents d join assets a on a.organization_id=d.organization_id and a.id=d.asset_id
 where d.organization_id=p_org and document@@q and (p_asset is null or d.asset_id=p_asset) and (p_line is null or d.line_id=p_line) and (p_kind is null or d.kind=p_kind)
 and (p_from is null or happened_at >= p_from::timestamp at time zone 'Europe/Helsinki') and (p_to is null or happened_at < (p_to+1)::timestamp at time zone 'Europe/Helsinki')
 order by score desc,happened_at desc,source_id,kind offset p_page*20 limit 21
) ranked;
return jsonb_build_object('results',(select coalesce(jsonb_agg(v order by n),'[]') from jsonb_array_elements(rows) with ordinality e(v,n) where n<=20),'hasMore',jsonb_array_length(rows)>20);
end $$;
revoke all on function public.private_history_search(uuid,text,uuid,uuid,date,date,text,integer) from public,anon;
grant execute on function public.private_history_search(uuid,text,uuid,uuid,date,date,text,integer) to authenticated;

create function public.private_history_record(p_org uuid,p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
if not is_member(p_org) then raise exception 'forbidden' using errcode='42501';end if;
if p_kind='maintenance' then select snapshot into result from maintenance_history where organization_id=p_org and job_id=p_id;
elsif p_kind='fault' then select data||jsonb_build_object('id',id,'orgId',organization_id,'assetId',asset_id,'symptoms',jsonb_build_array(symptoms,symptoms,symptoms),'cause',jsonb_build_array(concat_ws(' ',confirmed_cause,repair),concat_ws(' ',confirmed_cause,repair),concat_ws(' ',confirmed_cause,repair)),'verified',verified_by is not null,'date',created_at) into result from fault_reports where organization_id=p_org and id=p_id;
else raise exception 'invalid source type' using errcode='22023';end if;
if result is null then raise exception 'history unavailable' using errcode='42501';end if;return result;end $$;
revoke all on function public.private_history_record(uuid,text,uuid) from public,anon;
grant execute on function public.private_history_record(uuid,text,uuid) to authenticated;

create function public.private_history_options(p_org uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin
if not is_member(p_org) then raise exception 'forbidden' using errcode='42501';end if;
return jsonb_build_object('assets',(select coalesce(jsonb_agg(jsonb_build_object('value',asset_id,'label',asset_name||case when asset_identifier<>'' then ' · '||asset_identifier else '' end)),'[]') from (select distinct on(asset_id) asset_id,asset_name,asset_identifier from maintenance_search_documents where organization_id=p_org order by asset_id,happened_at desc limit 5000) x),
'lines',(select coalesce(jsonb_agg(jsonb_build_object('value',line_id,'label',line_name)),'[]') from (select distinct on(line_id) line_id,line_name from maintenance_search_documents where organization_id=p_org and line_id is not null order by line_id,happened_at desc limit 5000) x));end $$;
revoke all on function public.private_history_options(uuid) from public,anon;
grant execute on function public.private_history_options(uuid) to authenticated;
commit;
