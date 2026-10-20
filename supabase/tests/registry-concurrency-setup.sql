insert into auth.users(id) values('99100000-0000-0000-0000-000000000001');
insert into organizations(id,name) values('99200000-0000-0000-0000-000000000001','Registry race');
insert into memberships(organization_id,user_id,role,display_name) values('99200000-0000-0000-0000-000000000001','99100000-0000-0000-0000-000000000001','owner','Race owner');
insert into assets(id,organization_id,name,serial_number,archived_at) values('99300000-0000-0000-0000-000000000001','99200000-0000-0000-0000-000000000001','Race device','RACE',now());
