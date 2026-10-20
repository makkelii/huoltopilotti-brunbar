do $$ begin
if (select revision from organizations where id='d2000000-0000-0000-0000-000000000001')<>1 then raise exception 'race revision wrong';end if;
if exists(select 1 from assets a join maintenance_jobs j on j.organization_id=a.organization_id and j.asset_id=a.id where a.organization_id='d2000000-0000-0000-0000-000000000001' and a.archived_at is not null and j.status<>'completed') then raise exception 'archive raced an active job';end if;
if (select count(*) from assets where organization_id='d2000000-0000-0000-0000-000000000001')<>1 then raise exception 'race lost asset';end if;
if (select count(*) from audit_events where organization_id='d2000000-0000-0000-0000-000000000001' and action in ('private.asset_archive','private.job'))<>1 then raise exception 'race audit wrong';end if;
end $$;
