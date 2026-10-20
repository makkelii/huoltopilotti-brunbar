-- Function-only hardening: no schema or existing inventory/history rows change.
begin;
create or replace function public.adjust_stock(
  p_org uuid, p_item uuid, p_delta numeric, p_reason text
) returns numeric language plpgsql security definer set search_path=public as $$
declare result numeric; item_type text;
begin
  if not public.has_role(p_org,array['owner','administrator']::public.member_role[]) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  -- Keep the same lock ordering as private_mutate, including item type edits.
  perform 1 from organizations where id=p_org for update;
  select type into item_type from inventory where organization_id=p_org and id=p_item for update;
  if not found then raise exception 'insufficient stock or unknown item'; end if;
  if item_type='tool' then
    raise exception 'tools do not have stock movements' using errcode='22023';
  end if;
  result:=private_adjust_stock_internal(p_org,p_item,p_delta,p_reason);
  update organizations set revision=revision+1 where id=p_org;
  return result;
end $$;
revoke all on function public.adjust_stock(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.adjust_stock(uuid,uuid,numeric,text) to authenticated;
commit;
