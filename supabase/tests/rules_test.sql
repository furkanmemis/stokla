-- Database rule tests: run after supabase_stub.sql and schema.sql on a throwaway local database.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql -f supabase/schema.sql -f supabase/tests/rules_test.sql
-- Every check raises on failure, so the run stops at the first broken rule.
\set QUIET on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test'),
  ('00000000-0000-0000-0000-0000000000c1', 'counter-a@test'),
  ('00000000-0000-0000-0000-0000000000c2', 'kitchen-a@test');

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

-- ---------- owner A sets up a bakery
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_business('Gül Pastanesi', 'bakery', 'Ayşe') as biz_a \gset
select pg_temp.check(public.my_role() = 'owner', 'creator becomes owner');
select pg_temp.check(pg_temp.fails($$select public.create_business('İkinci', 'bakery', 'Ayşe')$$, 'Zaten'), 'one business per user');

insert into ingredients (business_id, name, unit, stock, min_stock) values
  (:'biz_a', 'Un', 'kg', 1, 2), (:'biz_a', 'Yumurta', 'adet', 10, 5);
insert into products (business_id, name, unit, price, stock, min_stock) values
  (:'biz_a', 'Poğaça', 'adet', 25, 3, 1);
select id as pogaca from products where name = 'Poğaça' \gset
select id as un from ingredients where name = 'Un' \gset
select id as yumurta from ingredients where name = 'Yumurta' \gset
insert into recipe_items values (:'pogaca', :'un', 0.25), (:'pogaca', :'yumurta', 1);

select pg_temp.check(pg_temp.fails(format($$update products set stock = 999 where id = %L$$, :'pogaca'), 'permission'),
  'stock column cannot be edited directly');

-- ---------- invites
select public.create_invite('counter') as code_counter \gset
select public.create_invite('kitchen') as code_kitchen \gset
select pg_temp.check(:'code_counter' ~ '^[A-Z2-9]{6}$', 'invite code has 6 unambiguous characters');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select public.accept_invite(lower(:'code_counter'), 'Mehmet');
select pg_temp.check(public.my_role() = 'counter', 'invite gives its role (code is case-insensitive)');
select pg_temp.check(pg_temp.fails(format($$select public.accept_invite(%L, 'x')$$, :'code_counter'), 'Zaten'), 'member cannot join twice');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check(pg_temp.fails(format($$select public.accept_invite(%L, 'x')$$, :'code_counter'), 'geçersiz'), 'used invite cannot be reused');
select public.accept_invite(:'code_kitchen', 'Zeynep');

-- ---------- sales (counter)
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select public.record_sale(jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 2)), false);
select pg_temp.check((select stock from products where id = :'pogaca') = 1, 'sale lowers stock');
select pg_temp.check((select total from movements where kind = 'sale') = 50, 'sale total uses price');
select pg_temp.check(pg_temp.fails(format($$select public.record_sale('[{"id":"%s","qty":5}]'::jsonb, false)$$, :'pogaca'), 'Yeterli'),
  'cannot sell more than in stock');
select pg_temp.check((select stock from products where id = :'pogaca') = 1, 'failed sale changes nothing');
select pg_temp.check(pg_temp.fails($$select public.record_production('[]'::jsonb)$$, 'yetkin'), 'counter cannot record production');
select pg_temp.check(pg_temp.fails(format($$select public.count_ingredient(%L, 5)$$, :'un'), 'yetkin'), 'counter cannot count ingredients');

-- ---------- production (kitchen)
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check(pg_temp.fails(format($$select public.record_production('[{"id":"%s","qty":8}]'::jsonb)$$, :'pogaca'), 'Yetersiz malzeme'),
  'production needs enough ingredients (8 x 0.25 kg > 1 kg flour)');
select public.record_production(jsonb_build_array(jsonb_build_object('id', :'pogaca', 'qty', 4)));
select pg_temp.check((select stock from products where id = :'pogaca') = 5, 'production adds products');
select pg_temp.check((select stock from ingredients where id = :'un') = 0, 'production uses flour by recipe');
select pg_temp.check((select stock from ingredients where id = :'yumurta') = 6, 'production uses eggs by recipe');
select public.receive_ingredient(:'un', 25, 'Toptancı');
select pg_temp.check((select stock from ingredients where id = :'un') = 25, 'goods received adds stock');

-- ---------- owner: count + history
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.count_ingredient(:'yumurta', 4);
select pg_temp.check((select qty from movement_lines l join movements m on m.id = l.movement_id
  where m.kind = 'count' and l.ingredient_id = :'yumurta') = -2, 'count stores the difference');
select pg_temp.check((select count(*) from movements) = 4, 'every change wrote one movement');

-- ---------- isolation: owner B sees nothing of A
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.create_business('Kitapevi', 'bookstore', 'Can') as biz_b \gset
select pg_temp.check((select count(*) from products) = 0, 'other business products are invisible');
select pg_temp.check((select count(*) from movements) = 0, 'other business movements are invisible');
select pg_temp.check((select count(*) from members) = 1, 'other business team is invisible');
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
