insert into auth.users(id) values('d1000000-0000-0000-0000-000000000001');
insert into organizations(id,name) values('d2000000-0000-0000-0000-000000000001','Lifecycle race');
insert into memberships(organization_id,user_id,role,display_name) values('d2000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','owner','Race owner');
insert into assets(id,organization_id,name) values('d3000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000001','Race device');
