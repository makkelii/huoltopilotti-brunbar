do $$ begin
if (select revision from organizations where id='f2000000-0000-0000-0000-000000000001')<>1 then raise exception 'line race revision wrong';end if;
if exists(select 1 from assets a join production_lines l on l.organization_id=a.organization_id and l.id=a.production_line_id where a.organization_id='f2000000-0000-0000-0000-000000000001' and l.archived_at is not null) then raise exception 'device assigned to retired line';end if;
if (select count(*) from assets where organization_id='f2000000-0000-0000-0000-000000000001')<>1 then raise exception 'race lost device';end if;
if (select count(*) from audit_events where organization_id='f2000000-0000-0000-0000-000000000001' and action in ('private.asset','private.production_line_archive'))<>1 then raise exception 'line race audit wrong';end if;
end $$;
