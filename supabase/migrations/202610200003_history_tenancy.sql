-- Additive upgrade. Does not bootstrap organizations or change existing memberships.
begin;
alter table public.memberships add column is_default boolean not null default false;
create unique index membership_one_default on public.memberships(user_id) where is_default;
-- Multiple memberships without an administrator-assigned default fail closed in AuthGate.
alter table public.maintenance_history add column snapshot jsonb;

create function public.capture_maintenance_history() returns trigger language plpgsql security definer set search_path=public as $$
declare j maintenance_jobs; begin
select * into strict j from maintenance_jobs where organization_id=new.organization_id and id=new.job_id;
new.snapshot := j.data || jsonb_build_object('id',j.id,'name',j.name,'assetId',j.asset_id,'status','completed','completedAt',new.completed_at,'performedBy',coalesce((select display_name from memberships where organization_id=new.organization_id and user_id=new.completed_by),''),'performerId',new.completed_by,'notes',new.notes,'actual',new.actual_requirements,'usedItems',(select coalesce(jsonb_agg(i.data || jsonb_build_object('id',i.id,'name',i.name,'type',case i.type when 'tool' then 'tools' when 'part' then 'parts' else 'consumables' end,'usedQuantity',a.value::numeric)),'[]') from jsonb_each_text(new.actual_requirements) a join inventory i on i.organization_id=new.organization_id and i.id=a.key::uuid where a.value::numeric>0),'requirements',(select coalesce(jsonb_agg(data),'[]') from job_requirements where organization_id=new.organization_id and job_id=j.id));
return new;end $$;
revoke all on function public.capture_maintenance_history() from public,anon,authenticated;
create trigger capture_history before insert on public.maintenance_history for each row execute function public.capture_maintenance_history();
-- Legacy records are preserved. Values unavailable at completion are explicitly marked as reconstructed.
update public.maintenance_history h set snapshot=j.data || jsonb_build_object('id',j.id,'name',j.name,'assetId',j.asset_id,'status','completed','completedAt',h.completed_at,'notes',h.notes,'actual',h.actual_requirements,'legacyReconstructed',true,'requirements',(select coalesce(jsonb_agg(data),'[]') from job_requirements where organization_id=h.organization_id and job_id=j.id)) from public.maintenance_jobs j where j.organization_id=h.organization_id and j.id=h.job_id and h.snapshot is null;
alter table public.maintenance_history alter column snapshot set not null;

create function public.protect_completed_records() returns trigger language plpgsql set search_path=public as $$ begin
if old.status='completed' then raise exception 'completed history is immutable';end if;
if tg_op='DELETE' then return old;end if;return new;end $$;
-- Separate trigger functions avoid referencing a nonexistent status field on history.
create function public.protect_history() returns trigger language plpgsql set search_path=public as $$ begin raise exception 'completed history is immutable';end $$;
revoke all on function public.protect_history(),public.protect_completed_records() from public,anon,authenticated;
create trigger immutable_history before update or delete on public.maintenance_history for each row execute function public.protect_history();
create trigger immutable_completed_job before update or delete on public.maintenance_jobs for each row execute function public.protect_completed_records();

alter function public.private_snapshot(uuid) rename to private_snapshot_v2;
revoke all on function public.private_snapshot_v2(uuid) from public,anon,authenticated;
create function public.private_snapshot(p_org uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; begin
result:=private_snapshot_v2(p_org);
return jsonb_set(result,'{store,jobs}',(select coalesce(jsonb_agg(case when j->>'status'='completed' then coalesce((select h.snapshot from maintenance_history h where h.organization_id=p_org and h.job_id=(j->>'id')::uuid),j) else j end),'[]') from jsonb_array_elements(result->'store'->'jobs') j));
end $$;
revoke all on function public.private_snapshot(uuid) from public,anon;
grant execute on function public.private_snapshot(uuid) to authenticated;

alter function public.private_mutate(uuid,bigint,text,jsonb) rename to private_mutate_v2;
revoke all on function public.private_mutate_v2(uuid,bigint,text,jsonb) from public,anon,authenticated;
create function public.private_mutate(p_org uuid,p_revision bigint,p_kind text,p_data jsonb) returns void language plpgsql security definer set search_path=public as $$
declare minutes integer; a record; begin
if not has_role(p_org,array['owner','administrator','technician']::member_role[]) then raise exception 'forbidden' using errcode='42501';end if;
perform 1 from organizations where id=p_org for update;
if p_kind='complete' then
minutes:=(p_data->>'actualMinutes')::integer;
if (p_data ? 'actualMinutes' and minutes is null) or minutes<1 or minutes>100000 then raise exception 'invalid actual duration';end if;
for a in select key,value from jsonb_each_text(p_data->'actual') loop
if a.value::numeric>0 and exists(select 1 from inventory where organization_id=p_org and id=a.key::uuid and data->>'inactive'='true') then raise exception 'inactive inventory';end if;
end loop;
update maintenance_jobs set data=data||jsonb_build_object('actualMinutes',minutes,'completionNotes',coalesce(p_data->>'completionNotes','')) where organization_id=p_org and id=(p_data->>'id')::uuid and status<>'completed';
end if;
perform private_mutate_v2(p_org,p_revision,p_kind,p_data);
end $$;
revoke all on function public.private_mutate(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.private_mutate(uuid,bigint,text,jsonb) to authenticated;
-- Platform administrator enables additional private tenants explicitly; public creation stays closed.
create table public.organization_access_settings (
 organization_id uuid primary key references public.organizations(id),
 user_limit integer not null check(user_limit between 2 and 1000)
);
alter table public.organization_access_settings enable row level security;
revoke all on public.organization_access_settings from public,anon,authenticated;
create or replace function public.reserve_private_invitation(p_org uuid,p_email text) returns uuid language plpgsql security definer set search_path=public as $$ declare invitation_id uuid;begin
if not has_role(p_org,array['owner','administrator']::public.member_role[]) or not (exists(select 1 from private_deployment where organization_id=p_org) or exists(select 1 from organization_access_settings where organization_id=p_org)) then raise exception 'forbidden' using errcode='42501';end if;
perform 1 from organizations where id=p_org for update;
delete from private_invitations where organization_id=p_org and accepted_at is null and expires_at<now();
if (select count(*) from memberships where organization_id=p_org)+(select count(*) from private_invitations where organization_id=p_org and accepted_at is null)>=coalesce((select user_limit from organization_access_settings where organization_id=p_org),2) then raise exception 'private deployment is limited to two users';end if;
if p_email is null or p_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254 then raise exception 'invalid email';end if;
perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_email)),0));
if exists(select 1 from private_invitations where email=lower(trim(p_email)) and accepted_at is null and expires_at>now()) or exists(select 1 from auth.users where lower(email)=lower(trim(p_email))) then raise exception 'email already registered or invited';end if;
insert into private_invitations(organization_id,email,invited_by) values(p_org,lower(trim(p_email)),auth.uid()) returning id into invitation_id;return invitation_id;end $$;
revoke all on function public.reserve_private_invitation(uuid,text) from public,anon;
grant execute on function public.reserve_private_invitation(uuid,text) to authenticated;
create or replace function public.accept_private_invitation() returns trigger language plpgsql security definer set search_path=public as $$ declare invitation private_invitations;begin
if new.email_confirmed_at is null then return new;end if;
select * into invitation from private_invitations where email=lower(new.email) and accepted_at is null and expires_at>now() and (organization_id in(select organization_id from private_deployment) or organization_id in(select organization_id from organization_access_settings)) ;
if found then
if (select count(*) from private_invitations where email=lower(new.email) and accepted_at is null and expires_at>now())<>1 then raise exception 'ambiguous invitation';end if;
perform 1 from organizations where id=invitation.organization_id for update;
select * into invitation from private_invitations where id=invitation.id and accepted_at is null and expires_at>now() for update;
if not found then return new;end if;
if (select count(*) from memberships where organization_id=invitation.organization_id)>=coalesce((select user_limit from organization_access_settings where organization_id=invitation.organization_id),2) then raise exception 'private user limit';end if;
insert into memberships(organization_id,user_id,role,display_name) values(invitation.organization_id,new.id,'technician',new.email);
update private_invitations set accepted_at=now() where id=invitation.id;
end if;return new;end $$;

create function public.manage_organization_member(p_org uuid,p_user uuid,p_role public.member_role) returns void language plpgsql security definer set search_path=public as $$ begin
if not has_role(p_org,array['owner','administrator']::member_role[]) then raise exception 'forbidden' using errcode='42501';end if;
perform 1 from organizations where id=p_org for update;
if p_user=auth.uid() or p_role='owner' or exists(select 1 from memberships where organization_id=p_org and user_id=p_user and role='owner') then raise exception 'owner or self changes require platform review' using errcode='42501';end if;
if not has_role(p_org,array['owner']::member_role[]) and (p_role='administrator' or exists(select 1 from memberships where organization_id=p_org and user_id=p_user and role='administrator')) then raise exception 'owner required' using errcode='42501';end if;
update memberships set role=p_role where organization_id=p_org and user_id=p_user;
if not found then raise exception 'member absent';end if;
update organizations set revision=revision+1 where id=p_org;
insert into audit_events(organization_id,actor_id,action,entity_id) values(p_org,auth.uid(),'membership.role.'||p_role,p_user);
end $$;
revoke all on function public.manage_organization_member(uuid,uuid,public.member_role) from public,anon;
grant execute on function public.manage_organization_member(uuid,uuid,public.member_role) to authenticated;
commit;
