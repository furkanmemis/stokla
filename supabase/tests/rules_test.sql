-- Database rule tests: run after supabase_stub.sql and schema.sql on a throwaway local database.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql -f supabase/schema.sql -f supabase/tests/rules_test.sql
-- Every check raises on failure, so the run stops at the first broken rule.
\set QUIET on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin-a@test'),
  ('00000000-0000-0000-0000-00000000000b', 'admin-b@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'employee-a@test'),
  ('00000000-0000-0000-0000-0000000000e2', 'late-joiner@test');

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

-- ---------- admin A sets up a bakery
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_business('Gül Pastanesi', 'bakery', 'Ayşe') as biz_a \gset
select pg_temp.check(public.my_role() = 'admin', 'creator becomes admin');
select pg_temp.check(pg_temp.fails($$select public.create_business('İkinci', 'bakery', 'Ayşe')$$, 'Zaten'), 'one business per user');

insert into ingredients (business_id, name, unit, stock, min_stock) values
  (:'biz_a', 'Un', 'kg', 1, 2), (:'biz_a', 'Yumurta', 'adet', 10, 5);
insert into products (business_id, name, unit, price, stock, min_stock, weight_g) values
  (:'biz_a', 'Poğaça', 'adet', 25, 3, 1, 80);
select id as pogaca from products where name = 'Poğaça' \gset
select id as un from ingredients where name = 'Un' \gset
select id as yumurta from ingredients where name = 'Yumurta' \gset
insert into recipe_items values (:'pogaca', :'un', 0.25), (:'pogaca', :'yumurta', 1);

select pg_temp.check(pg_temp.fails(format($$update products set stock = 999 where id = %L$$, :'pogaca'), 'permission'),
  'stock column cannot be edited directly');

-- ---------- invites
select public.create_invite() as code1 \gset
select public.create_invite() as code2 \gset
select pg_temp.check(:'code1' ~ '^[A-Z2-9]{6}$', 'invite code has 6 unambiguous characters');
select pg_temp.check((select role from invites where code = :'code1') = 'employee', 'invites always make employees');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select public.accept_invite(lower(:'code1'), 'Mehmet');
select pg_temp.check(public.my_role() = 'employee', 'invite gives the employee role (code is case-insensitive)');
select pg_temp.check(pg_temp.fails($$select public.create_invite()$$, 'yönetici'), 'employee cannot invite');
select pg_temp.check(pg_temp.fails(format($$select public.accept_invite(%L, 'x')$$, :'code2'), 'Zaten'), 'member cannot join twice');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check(pg_temp.fails(format($$select public.accept_invite(%L, 'x')$$, :'code1'), 'geçersiz'), 'used invite cannot be reused');

-- ---------- employee: sales, production, goods received
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select public.record_sale(jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 2)), false);
select pg_temp.check((select stock from products where id = :'pogaca') = 1, 'sale lowers stock');
select pg_temp.check((select total from movements where kind = 'sale') = 50, 'sale total uses price');
select pg_temp.check(pg_temp.fails(format($$select public.record_sale('[{"id":"%s","qty":5}]'::jsonb, false)$$, :'pogaca'), 'Yeterli'),
  'cannot sell more than in stock');
select pg_temp.check((select stock from products where id = :'pogaca') = 1, 'failed sale changes nothing');

select pg_temp.check(pg_temp.fails(format($$select public.record_production('[{"id":"%s","qty":8}]'::jsonb)$$, :'pogaca'), 'Yetersiz malzeme'),
  'production needs enough ingredients (8 x 0.25 kg > 1 kg flour)');
select pg_temp.check(pg_temp.fails(format($$select public.record_production('[{"id":"%s","qty":1}]'::jsonb, today_tr() + 1)$$, :'pogaca'), 'Gelecek'),
  'production date cannot be in the future');
select pg_temp.check(pg_temp.fails(format($$select public.record_production('[{"id":"%s","qty":1,"expires_on":"%s"}]'::jsonb, today_tr())$$,
  :'pogaca', current_date - 10), 'önce olamaz'), 'expiry cannot be before the production day');
select pg_temp.check(pg_temp.fails(format($$select public.record_production('[{"id":"%s","qty":1,"weight_g":0}]'::jsonb)$$, :'pogaca'), 'Gramaj'),
  'weight must be positive');

select public.record_production(jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 4, 'expires_on', public.today_tr() + 2)),
  public.today_tr() - 1) as prod_mov \gset
select pg_temp.check((select stock from products where id = :'pogaca') = 5, 'production adds products');
select pg_temp.check((select stock from ingredients where id = :'un') = 0, 'production uses flour by recipe');
select pg_temp.check((select stock from ingredients where id = :'yumurta') = 6, 'production uses eggs by recipe');
select pg_temp.check((select occurred_on from movements where id = :'prod_mov') = public.today_tr() - 1, 'production keeps the entered day');
select pg_temp.check((select weight_g from movement_lines where movement_id = :'prod_mov' and product_id is not null) = 80,
  'production weight defaults to the product standard');

select public.receive_ingredient(:'un', 25, 'Toptancı', public.today_tr() - 2, public.today_tr() + 1) as rec \gset
select pg_temp.check((select stock from ingredients where id = :'un') = 25, 'goods received adds stock');
select pg_temp.check((select occurred_on from movements where id = :'rec') = public.today_tr() - 2, 'receipt keeps the purchase day');
select pg_temp.check((select expires_on from movement_lines where movement_id = :'rec') = public.today_tr() + 1, 'receipt keeps the expiry');
select public.record_production(jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 0.5, 'weight_g', 95))) as prod2 \gset
select pg_temp.check((select weight_g from movement_lines where movement_id = :'prod2' and product_id is not null) = 95,
  'production can record a different batch weight');
select pg_temp.check((select stock from ingredients where id = :'un') = 24.875, 'second batch uses flour from the new delivery');
select pg_temp.check(pg_temp.fails(format($$select public.receive_ingredient(%L, 1, null, today_tr() - 400)$$, :'un'), 'bir yıldan'),
  'purchase day at most a year back');
select pg_temp.check((select count(*) from public.expiring_batches(3)) = 2, 'expiring batches lists receipt and production');

select pg_temp.check(pg_temp.fails(format($$select public.count_ingredient(%L, 5)$$, :'un'), 'yetkin'), 'employee cannot count stock');
select pg_temp.check(pg_temp.fails(format($$update products set price = 1 where id = %L$$, :'pogaca'), null) or
  (select price from products where id = :'pogaca') = 25, 'employee cannot change prices');

-- ---------- made to order (coffee): sale uses the recipe, not shelf stock
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into ingredients (business_id, name, unit, stock, min_stock) values (:'biz_a', 'Kahve çekirdeği', 'kg', 0.02, 0.5);
insert into products (business_id, name, unit, price, stock, made_to_order, category) values (:'biz_a', 'Espresso', 'adet', 60, 0, true, 'Sıcak Kahveler');
select id as espresso from products where name = 'Espresso' \gset
select id as kahve from ingredients where name = 'Kahve çekirdeği' \gset
insert into recipe_items values (:'espresso', :'kahve', 0.009);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select public.record_sale(jsonb_build_array(jsonb_build_object('id', :'espresso', 'qty', 2)), false) as coffee_sale \gset
select pg_temp.check((select stock from ingredients where id = :'kahve') = 0.002, 'made-to-order sale uses recipe ingredients');
select pg_temp.check((select stock from products where id = :'espresso') = 0, 'made-to-order sale leaves product stock alone');
select pg_temp.check((select total from movements where id = :'coffee_sale') = 120, 'made-to-order sale is priced');
select pg_temp.check(pg_temp.fails(format($$select public.record_sale('[{"id":"%s","qty":1}]'::jsonb, false)$$, :'espresso'), 'yetersiz malzeme'),
  'made-to-order sale needs enough ingredients');
select pg_temp.check(pg_temp.fails(format($$select public.record_production('[{"id":"%s","qty":1}]'::jsonb)$$, :'espresso'), 'Siparişle'),
  'made-to-order products are not produced');

-- ---------- admin: count + history
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.count_ingredient(:'yumurta', 4);
select pg_temp.check((select qty from movement_lines l join movements m on m.id = l.movement_id
  where m.kind = 'count' and l.ingredient_id = :'yumurta') = -1.5, 'count stores the difference');
select pg_temp.check((select count(*) from movements) = 6, 'every change wrote one movement');

-- ---------- isolation: admin B sees nothing of A
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.create_business('Kitapevi', 'bookstore', 'Can') as biz_b \gset
select pg_temp.check((select count(*) from products) = 0, 'other business products are invisible');
select pg_temp.check((select count(*) from movements) = 0, 'other business movements are invisible');
select pg_temp.check((select count(*) from members) = 1, 'other business team is invisible');
select pg_temp.check((select count(*) from public.expiring_batches(30)) = 0, 'other business batches are invisible');
select pg_temp.check(pg_temp.fails(format($$select public.record_sale('[{"id":"%s","qty":1}]'::jsonb, false)$$, :'pogaca'), 'bulunamadı'),
  'cannot sell another business''s product');
select pg_temp.check(pg_temp.fails(format($$insert into products (business_id, name) values (%L, 'x')$$, :'biz_a'), 'row-level security'),
  'cannot add products to another business');

-- ---------- anonymous visitors get nothing
reset role;
set local role anon;
select pg_temp.check(pg_temp.fails($$select count(*) from products$$, 'permission'), 'anon cannot read data');

rollback;
\echo 'ALL DATABASE RULE TESTS PASSED'
