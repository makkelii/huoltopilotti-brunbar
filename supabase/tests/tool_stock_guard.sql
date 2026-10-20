begin;
insert into auth.users(id,email,email_confirmed_at) values
('81000000-0000-0000-0000-000000000001','guard-owner@example.invalid',now()),
('81000000-0000-0000-0000-000000000002','guard-tech@example.invalid',now());
insert into organizations(id,name) values
('82000000-0000-0000-0000-000000000001','Tool guard tenant'),
('82000000-0000-0000-0000-000000000002','Other tenant');
insert into memberships(organization_id,user_id,role,display_name) values
('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','owner','Owner'),
('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000002','technician','Technician');
insert into inventory(id,organization_id,type,name,quantity) values
('84000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','tool','Legacy wrench',7),
('84000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000001','part','Bearing',3),
('84000000-0000-0000-0000-000000000003','82000000-0000-0000-0000-000000000001','consumable','Grease',4),
('84000000-0000-0000-0000-000000000004','82000000-0000-0000-0000-000000000002','part','Foreign bearing',5);
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',true);
do $$ declare delta numeric; begin
foreach delta in array array[-1,1] loop
  begin
    perform adjust_stock('82000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000001',delta,'tool adjustment');
    raise exception 'tool adjustment accepted';
  exception when invalid_parameter_value then null;
  end;
end loop;
if (select quantity from inventory where id='84000000-0000-0000-0000-000000000001')<>7 or exists(select 1 from stock_movements) or (select revision from organizations where id='82000000-0000-0000-0000-000000000001')<>0 then raise exception 'rejected tool edit changed state';end if;
begin perform private_adjust_stock_internal('82000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000001',1,'bypass');raise exception 'internal bypass allowed';exception when insufficient_privilege then null;end;
begin perform adjust_stock('82000000-0000-0000-0000-000000000002','84000000-0000-0000-0000-000000000004',-1,'foreign');raise exception 'foreign write allowed';exception when insufficient_privilege then null;end;
begin perform adjust_stock('82000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000004',-1,'foreign item');raise exception 'cross tenant reference allowed';exception when raise_exception then if sqlerrm<>'insufficient stock or unknown item' then raise;end if;end;
end $$;
select adjust_stock('82000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000002',-1,'part control');
select adjust_stock('82000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000003',-0.5,'consumable control');
do $$ begin
if (select quantity from inventory where id='84000000-0000-0000-0000-000000000002')<>2 or (select quantity from inventory where id='84000000-0000-0000-0000-000000000003')<>3.5 or (select count(*) from stock_movements)<>2 or (select revision from organizations where id='82000000-0000-0000-0000-000000000001')<>2 then raise exception 'part or consumable regression';end if;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000002',true);
do $$ begin
begin perform adjust_stock('82000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000002',-1,'technician adjustment');raise exception 'technician adjustment allowed';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ begin
begin perform adjust_stock('82000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000002',-1,'anonymous');raise exception 'anonymous adjustment allowed';exception when insufficient_privilege then null;end;
end $$;
rollback;
