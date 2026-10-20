insert into auth.users(id,email,email_confirmed_at) values('f1000000-0000-0000-0000-000000000001','line-race-owner@example.invalid',now()),('f1000000-0000-0000-0000-000000000002','line-race-admin@example.invalid',now());
insert into organizations(id,name) values('f2000000-0000-0000-0000-000000000001','Line race tenant');
insert into memberships(organization_id,user_id,role,display_name) values('f2000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001','owner','Race owner'),('f2000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000002','administrator','Race admin');
insert into production_lines(id,organization_id,name) values('f6000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','Race line');
insert into assets(id,organization_id,name) values('f3000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','Race machine');
