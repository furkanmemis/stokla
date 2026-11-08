-- Database rule tests: run after supabase_stub.sql and schema.sql on a throwaway local database.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql -f supabase/schema.sql -f supabase/tests/rules_test.sql
-- Every check raises on failure, so the run stops at the first broken rule.
\set QUIET on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'admin-b@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'shop-employee@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'late-joiner@test.local'),
  ('00000000-0000-0000-0000-0000000000e3', 'kitchen-employee@test.local');

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, true), set_config('role', 'authenticated', true)
$$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok  %', what; end $$;
create function pg_temp.fails(stmt text, expected text) returns boolean language plpgsql as $$
begin execute stmt; return false;
exception when others then
  if expected is not null and position(expected in sqlerrm) = 0 then raise exception 'unexpected error: %', sqlerrm; end if;
  return true;
end $$;
grant execute on function pg_temp.act_as(text), pg_temp.check(boolean, text), pg_temp.fails(text, text) to authenticated;

-- stock helpers for readability
create function pg_temp.pstock(place uuid, product uuid) returns numeric language sql as $$
  select coalesce((select qty from stock_products where location_id = place and product_id = product), 0) $$;
create function pg_temp.pool(product uuid) returns numeric language sql as $$
  select coalesce((select qty from pool_products where product_id = product), 0) $$;
create function pg_temp.istock(place uuid, ingredient uuid) returns numeric language sql as $$
  select coalesce((select qty from stock_ingredients where location_id = place and ingredient_id = ingredient), 0) $$;
grant execute on function pg_temp.pstock(uuid, uuid), pg_temp.istock(uuid, uuid), pg_temp.pool(uuid) to authenticated;

-- ---------- admin A sets up a bakery
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_business('Gül Pastanesi', 'bakery', 'Ayşe') as biz_a \gset
select pg_temp.check(public.my_role() = 'admin', 'creator becomes admin');
select pg_temp.check(pg_temp.fails($$select public.create_business('İkinci', 'bakery', 'Ayşe')$$, 'Zaten'), 'one business per user');

insert into ingredients (business_id, name, unit, min_stock) values (:'biz_a', 'Un', 'kg', 2), (:'biz_a', 'Yumurta', 'adet', 5);
insert into products (business_id, name, unit, price, min_stock, weight_g) values (:'biz_a', 'Poğaça', 'adet', 25, 1, 80);
select id as pogaca from products where name = 'Poğaça' \gset
select id as un from ingredients where name = 'Un' \gset
select id as yumurta from ingredients where name = 'Yumurta' \gset
insert into recipe_items values (:'pogaca', :'un', 0.25), (:'pogaca', :'yumurta', 1);

-- ---------- places
select public.save_place(null, 'Merkez', true, true, 'Cumhuriyet Cad.') as merkez \gset
select public.save_place(null, 'Şube', false, true) as sube \gset
select pg_temp.check((select address from locations where id = :'merkez') = 'Cumhuriyet Cad.', 'place keeps its address');
select pg_temp.check(pg_temp.fails($$select public.save_place(null, 'Boş', false, false)$$, 'üretim ya da satış'),
  'a place must produce or sell');
select pg_temp.check(pg_temp.fails($$select public.save_place(null, 'Merkez', true, false)$$, 'zaten var'),
  'place names are unique');
select pg_temp.check(pg_temp.fails(format($$insert into stock_products values (%L, %L, 99)$$, :'merkez', :'pogaca'), 'permission'),
  'stock cannot be written directly');
select pg_temp.check(pg_temp.fails(format($$insert into pool_products values (%L, %L, 99)$$, :'biz_a', :'pogaca'), 'permission'),
  'the pool cannot be written directly');
select pg_temp.check(pg_temp.fails(format($$select public.add_pool_stock(%L, %L, 99)$$, :'biz_a', :'pogaca'), 'permission'),
  'internal stock helpers cannot be called');

-- ---------- invites bring employees to a place
select pg_temp.check(pg_temp.fails($$select public.create_invite(null)$$, 'yeri seç'), 'invite needs a place');
select public.create_invite(:'sube') as code1 \gset
select public.create_invite(:'merkez') as code2 \gset
select pg_temp.check(:'code1' ~ '^[A-Z2-9]{6}$', 'invite code has 6 unambiguous characters');
select pg_temp.check((select role from invites where code = :'code1') = 'employee', 'invites always make employees');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select public.accept_invite(lower(:'code1'), 'Mehmet');
select pg_temp.check(public.my_role() = 'employee', 'invite gives the employee role (code is case-insensitive)');
select pg_temp.check(public.my_location() = :'sube', 'invite assigns the place');
select pg_temp.check(pg_temp.fails(format($$select public.create_invite(%L)$$, :'sube'), 'yönetici'), 'employee cannot invite');
select pg_temp.check(pg_temp.fails(format($$select public.accept_invite(%L, 'x')$$, :'code2'), 'Zaten'), 'member cannot join twice');
select pg_temp.check(pg_temp.fails($$select public.save_place(null, 'X', true, true)$$, 'admin'), 'employee cannot add places');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check(pg_temp.fails(format($$select public.accept_invite(%L, 'x')$$, :'code1'), 'geçersiz'), 'used invite cannot be reused');

select pg_temp.check(public.claim_staff_invite() is null, 'signing in without being added joins nothing');

-- admin adds a person by e-mail; they join on their first sign-in, no code needed
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(pg_temp.fails(format($$select public.add_staff('Zeynep', 'not-an-email', %L)$$, :'sube'), 'e-posta'), 'staff e-mail is checked');
select public.add_staff('Zeynep', ' Late-Joiner@TEST.LOCAL ', :'sube') is not null;
select pg_temp.check(pg_temp.fails(format($$select public.add_staff('Zeynep', 'late-joiner@test.local', %L)$$, :'sube'), 'bekleyen'),
  'one open entry per e-mail');
select pg_temp.check(pg_temp.fails(format($$select public.add_staff('Mehmet', 'shop-employee@test.local', %L)$$, :'sube'), 'zaten'),
  'cannot add someone who already works somewhere');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select set_config('request.jwt.claims', '{"email":"late-joiner@test.local"}', true);
select pg_temp.check(public.claim_staff_invite() = :'biz_a', 'added person joins on sign-in');
select pg_temp.check(public.my_location() = :'sube' and public.my_name() = 'Zeynep' and public.my_role() = 'employee',
  'they join as an employee of the chosen place, under the name the admin gave');
select pg_temp.check(public.claim_staff_invite() is null, 'joining happens once');
select set_config('request.jwt.claims', '', true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
select public.accept_invite(:'code2', 'Usta');

-- ---------- kitchen: goods received and production at Merkez
select public.receive_ingredient(:'merkez', :'un', 1) is not null;
select public.receive_ingredient(:'merkez', :'yumurta', 10) is not null;
select pg_temp.check(pg_temp.istock(:'merkez', :'un') = 1, 'goods received add to the place''s stock');
select pg_temp.check(pg_temp.fails(format($$select public.receive_ingredient(%L, %L, 5)$$, :'sube', :'un'), 'yetkin'),
  'employee works only at their own place');

select pg_temp.check(pg_temp.fails(format($$select public.record_production(%L, '[{"id":"%s","qty":8}]'::jsonb)$$, :'merkez', :'pogaca'), 'Yetersiz malzeme'),
  'production needs enough ingredients at the place (8 x 0.25 kg > 1 kg flour)');
select pg_temp.check(pg_temp.fails(format($$select public.record_production(%L, '[{"id":"%s","qty":1}]'::jsonb, today_tr() + 1)$$, :'merkez', :'pogaca'), 'Gelecek'),
  'production date cannot be in the future');
select pg_temp.check(pg_temp.fails(format($$select public.record_production(%L, '[{"id":"%s","qty":1,"expires_on":"%s"}]'::jsonb, today_tr())$$,
  :'merkez', :'pogaca', current_date - 10), 'önce olamaz'), 'expiry cannot be before the production day');
select pg_temp.check(pg_temp.fails(format($$select public.record_production(%L, '[{"id":"%s","qty":1,"weight_g":0}]'::jsonb)$$, :'merkez', :'pogaca'), 'Gramaj'),
  'weight must be positive');

select public.record_production(:'merkez', jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 4, 'expires_on', public.today_tr() + 2)),
  public.today_tr() - 1) as prod_mov \gset
select pg_temp.check(pg_temp.pool(:'pogaca') = 4, 'production adds products to the shared pool');
select pg_temp.check(pg_temp.pstock(:'merkez', :'pogaca') = 0, 'production does not fill a shelf by itself');
select pg_temp.check(pg_temp.istock(:'merkez', :'un') = 0, 'production uses flour by recipe');
select pg_temp.check(pg_temp.istock(:'merkez', :'yumurta') = 6, 'production uses eggs by recipe');
select pg_temp.check((select location_id from movements where id = :'prod_mov') = :'merkez', 'movement records the place');
select pg_temp.check((select occurred_on from movements where id = :'prod_mov') = public.today_tr() - 1, 'production keeps the entered day');
select pg_temp.check((select weight_g from movement_lines where movement_id = :'prod_mov' and product_id is not null) = 80,
  'production weight defaults to the product standard');

select public.receive_ingredient(:'merkez', :'un', 25, 'Toptancı', public.today_tr() - 2, public.today_tr() + 1) as rec \gset
select pg_temp.check((select occurred_on from movements where id = :'rec') = public.today_tr() - 2, 'receipt keeps the purchase day');
select pg_temp.check((select expires_on from movement_lines where movement_id = :'rec') = public.today_tr() + 1, 'receipt keeps the expiry');
select public.record_production(:'merkez', jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 4, 'weight_g', 95))) as prod2 \gset
select pg_temp.check((select weight_g from movement_lines where movement_id = :'prod2' and product_id is not null) = 95,
  'production can record a different batch weight');
select pg_temp.check(pg_temp.pool(:'pogaca') = 8, 'second batch adds up in the pool');
select pg_temp.check(pg_temp.fails(format($$select public.receive_ingredient(%L, %L, 1, null, today_tr() - 400)$$, :'merkez', :'un'), 'bir yıldan'),
  'purchase day at most a year back');
select pg_temp.check((select count(*) from public.expiring_batches(3)) = 2, 'expiring batches lists receipt and production');

-- a place that produces and sells takes from the pool onto its own shelf, then sells
select pg_temp.check(pg_temp.fails(format($$select public.record_sale(%L, '[{"id":"%s","qty":1}]'::jsonb, false)$$, :'merkez', :'pogaca'), 'Yeterli'),
  'nothing on the shelf yet: cannot sell straight from the pool');
select public.take_from_pool(:'merkez', jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 3))) as restock \gset
select pg_temp.check(pg_temp.pool(:'pogaca') = 5 and pg_temp.pstock(:'merkez', :'pogaca') = 3, 'taking moves products from the pool to the shelf');
select pg_temp.check((select kind from movements where id = :'restock') = 'restock', 'taking from the pool is one movement');
select pg_temp.check(pg_temp.fails(format($$select public.take_from_pool(%L, '[{"id":"%s","qty":99}]'::jsonb)$$, :'merkez', :'pogaca'), 'Havuzda yeterli'),
  'cannot take more than the pool has');
select public.record_sale(:'merkez', jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 2)), false) as merkez_sale \gset
select pg_temp.check(pg_temp.pstock(:'merkez', :'pogaca') = 1, 'sale lowers the place''s shelf');
select pg_temp.check((select total from movements where id = :'merkez_sale') = 50, 'sale total uses price');
select pg_temp.check(pg_temp.fails(format($$select public.record_sale(%L, '[{"id":"%s","qty":50}]'::jsonb, false)$$, :'merkez', :'pogaca'), 'Yeterli'),
  'cannot sell more than the place has');

-- a sell-only shop takes from the same pool
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check(pg_temp.pool(:'pogaca') = 5, 'everyone in the business sees the pool');
select pg_temp.check(pg_temp.fails(format($$select public.take_from_pool(%L, '[{"id":"%s","qty":1}]'::jsonb)$$, :'merkez', :'pogaca'), 'yetkin'),
  'an employee only fills their own shelf');
select public.take_from_pool(:'sube', jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 3)));
select pg_temp.check(pg_temp.pool(:'pogaca') = 2 and pg_temp.pstock(:'sube', :'pogaca') = 3, 'the shop''s shelf fills from the pool');
select public.record_sale(:'sube', jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 2)), false);
select pg_temp.check(pg_temp.pstock(:'sube', :'pogaca') = 1, 'the shop sells from its own shelf');
select pg_temp.check(pg_temp.fails(format($$select public.record_sale(%L, '[{"id":"%s","qty":1}]'::jsonb, false)$$, :'merkez', :'pogaca'), 'yetkin'),
  'shop employee cannot sell at another place');
select pg_temp.check(pg_temp.fails(format($$select public.record_production(%L, '[{"id":"%s","qty":1}]'::jsonb)$$, :'sube', :'pogaca'), 'üretim yapmıyor'),
  'a sell-only place does not produce');
select pg_temp.check((select count(*) from stock_products) = 1, 'shop employee sees only their place''s stock');
select pg_temp.check((select count(*) from movements where location_id <> :'sube') = 0, 'shop employee sees only their place''s history');
select pg_temp.check(pg_temp.fails(format($$select public.count_product(%L, %L, 5)$$, :'sube', :'pogaca'), 'yetkin'), 'employee cannot count stock');
select pg_temp.check(pg_temp.fails(format($$select public.count_pool(%L, 5)$$, :'pogaca'), 'yetkin'), 'employee cannot count the pool');
select pg_temp.check(pg_temp.fails(format($$update products set price = 1 where id = %L$$, :'pogaca'), null) or
  (select price from products where id = :'pogaca') = 25, 'employee cannot change prices');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
select pg_temp.check((select count(*) from stock_products where location_id = :'sube') = 0, 'kitchen employee cannot see the shop''s stock');

-- ---------- made to order (coffee): uses the selling place's own ingredients
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into ingredients (business_id, name, unit, min_stock) values (:'biz_a', 'Kahve çekirdeği', 'kg', 0.5);
insert into products (business_id, name, unit, price, made_to_order, category) values (:'biz_a', 'Espresso', 'adet', 60, true, 'Sıcak Kahveler');
select id as espresso from products where name = 'Espresso' \gset
select id as kahve from ingredients where name = 'Kahve çekirdeği' \gset
insert into recipe_items values (:'espresso', :'kahve', 0.009);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select public.receive_ingredient(:'sube', :'kahve', 0.02) is not null;
select public.record_sale(:'sube', jsonb_build_array(jsonb_build_object('id', :'espresso', 'qty', 2)), false) as coffee_sale \gset
select pg_temp.check(pg_temp.istock(:'sube', :'kahve') = 0.002, 'made-to-order sale uses the shop''s own ingredients');
select pg_temp.check((select total from movements where id = :'coffee_sale') = 120, 'made-to-order sale is priced');
select pg_temp.check(pg_temp.fails(format($$select public.record_sale(%L, '[{"id":"%s","qty":1}]'::jsonb, false)$$, :'sube', :'espresso'), 'yetersiz malzeme'),
  'made-to-order sale needs enough ingredients at the shop');

-- ---------- admin: counts, reassignment, history
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(pg_temp.istock(:'merkez', :'kahve') = 0, 'coffee at the shop did not touch the kitchen');
select pg_temp.check(pg_temp.fails(format($$select public.record_production(%L, '[{"id":"%s","qty":1}]'::jsonb)$$, :'merkez', :'espresso'), 'Siparişle'),
  'made-to-order products are not produced');
select public.count_ingredient(:'merkez', :'yumurta', 4);
select pg_temp.check((select qty from movement_lines l join movements m on m.id = l.movement_id
  where m.kind = 'count' and l.ingredient_id = :'yumurta') = 2, 'count stores the difference (6 -> 4 is -2)');
select pg_temp.check(pg_temp.istock(:'merkez', :'yumurta') = 4, 'count sets the counted amount');
select pg_temp.check((select count(*) from stock_products) = 2, 'admin sees every place''s stock');
select public.count_pool(:'pogaca', 1);
select pg_temp.check(pg_temp.pool(:'pogaca') = 1, 'admin counts the pool');
select public.assign_member('00000000-0000-0000-0000-0000000000e1', :'merkez');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check(public.my_location() = :'merkez', 'admin can move an employee to another place');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from movements m where not exists (select 1 from movement_lines l where l.movement_id = m.id)) = 0,
  'every movement has lines');

-- ---------- isolation: admin B sees nothing of A
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.create_business('Kitapevi', 'bookstore', 'Can') as biz_b \gset
select pg_temp.check((select count(*) from products) = 0, 'other business products are invisible');
select pg_temp.check((select count(*) from locations) = 0, 'other business places are invisible');
select pg_temp.check((select count(*) from stock_products) = 0, 'other business stock is invisible');
select pg_temp.check((select count(*) from pool_products) = 0, 'other business pool is invisible');
select pg_temp.check((select count(*) from movements) = 0, 'other business movements are invisible');
select pg_temp.check((select count(*) from members) = 1, 'other business team is invisible');
select pg_temp.check((select count(*) from public.expiring_batches(30)) = 0, 'other business batches are invisible');
select pg_temp.check(pg_temp.fails(format($$select public.record_sale(%L, '[{"id":"%s","qty":1}]'::jsonb, false)$$, :'sube', :'pogaca'), 'Yer bulunamadı'),
  'cannot act at another business''s place');
select pg_temp.check(pg_temp.fails(format($$select public.assign_member('00000000-0000-0000-0000-0000000000e1', null)$$), 'bulunamadı'),
  'cannot reassign another business''s employee');
select pg_temp.check(pg_temp.fails(format($$insert into products (business_id, name) values (%L, 'x')$$, :'biz_a'), 'row-level security'),
  'cannot add products to another business');

-- ---------- anonymous visitors get nothing
reset role;
set local role anon;
select pg_temp.check(pg_temp.fails($$select count(*) from products$$, 'permission'), 'anon cannot read data');
select pg_temp.check(pg_temp.fails($$select count(*) from stock_products$$, 'permission'), 'anon cannot read stock');

rollback;
\echo 'ALL DATABASE RULE TESTS PASSED'
