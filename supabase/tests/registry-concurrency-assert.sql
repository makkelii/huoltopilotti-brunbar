do $$ begin
if (select revision from organizations where id='99200000-0000-0000-0000-000000000001')<>1 then raise exception 'race revision wrong';end if;
if (select count(*) from assets where organization_id='99200000-0000-0000-0000-000000000001')<>1 then raise exception 'race lost historical anchor';end if;
if exists(select 1 from assets where organization_id='99200000-0000-0000-0000-000000000001' and registry_removed_at is not null and archived_at is null) then raise exception 'removed asset restored';end if;
if (select count(*) from audit_events where organization_id='99200000-0000-0000-0000-000000000001' and action in ('private.asset_remove_registry','private.asset_restore'))<>1 then raise exception 'race audit wrong';end if;
end $$;
