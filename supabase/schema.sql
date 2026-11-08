-- Stokla database schema. Run the whole file in the Supabase SQL editor; it is safe to re-run.
--
-- Rules enforced here (not only in the app):
--  * Every row belongs to one business; members only ever see their own business (RLS).
--  * Stock changes only through the functions at the bottom (sale, waste, production,
--    goods received, stock count). Each runs in one transaction and writes a movement,
--    so stock and history can never disagree.
--  * Roles: admin (sees and manages everything) and employee (works at the one place they are assigned to).
--  * Places: every business has places (branches). A place produces, sells, or both. Each place keeps its
--    own ingredients. Whatever is produced goes into one shared pool of finished products; a selling place
--    takes products from the pool onto its own shelf, and sells from there.
--  * Receipts and production carry the day they happened and an optional expiry date.

create extension if not exists pgcrypto;

-- ============================================================== TABLES
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  sector text not null default 'bakery' check (sector in ('bakery', 'bookstore', 'general')),
  created_at timestamptz not null default now()
);

-- One business per user for now (user_id is the key).
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  role text not null,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create index if not exists members_business_idx on public.members (business_id);

create table if not exists public.invites (
  code text primary key check (code ~ '^[A-Z2-9]{6}$'),
  business_id uuid not null references public.businesses (id) on delete cascade,
  role text not null default 'employee',
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invites_business_idx on public.invites (business_id);

-- Roles were owner/counter/kitchen/depot in the first version; fold them into admin/employee.
alter table public.members drop constraint if exists members_role_check;
update public.members set role = case when role in ('owner', 'admin') then 'admin' else 'employee' end
  where role not in ('admin', 'employee');
alter table public.members add constraint members_role_check check (role in ('admin', 'employee'));
alter table public.invites drop constraint if exists invites_role_check;
update public.invites set role = 'employee' where role <> 'employee';
alter table public.invites alter column role set default 'employee';
alter table public.invites add constraint invites_role_check check (role = 'employee');

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  unit text not null check (unit in ('kg', 'g', 'L', 'ml', 'adet', 'paket')),
  min_stock numeric(14, 3) not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  emoji text check (emoji is null or length(emoji) <= 16),
  unit text not null default 'adet' check (unit in ('adet', 'dilim', 'porsiyon', 'paket', 'bütün', 'kg')),
  price numeric(12, 2) not null default 0 check (price >= 0),
  min_stock numeric(14, 3) not null default 0 check (min_stock >= 0),
  barcode text check (barcode is null or barcode ~ '^[0-9A-Za-z-]{4,32}$'),
  attrs jsonb not null default '{}'::jsonb, -- sector-specific fields (e.g. ISBN, author)
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);
create unique index if not exists products_barcode_idx on public.products (business_id, barcode) where barcode is not null;
-- Standard weight of one unit in grams (e.g. 80 for a poğaça); production can record a different one per batch.
alter table public.products add column if not exists weight_g int check (weight_g is null or weight_g between 1 and 100000);
-- Units grew with cafés (bardak, şişe); keep the check in one place.
alter table public.products drop constraint if exists products_unit_check;
alter table public.products add constraint products_unit_check
  check (unit in ('adet', 'dilim', 'porsiyon', 'paket', 'bütün', 'kg', 'bardak', 'şişe'));
-- Menu section shown as a filter on the sales screen (e.g. "Sıcak Kahveler").
alter table public.products add column if not exists category text check (category is null or length(trim(category)) between 1 and 40);
-- Made to order (coffee, tea…): no shelf stock; a sale uses up the recipe's ingredients instead.
alter table public.products add column if not exists made_to_order boolean not null default false;

-- How much of each ingredient one unit of a product uses.
create table if not exists public.recipe_items (
  product_id uuid not null references public.products (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  qty numeric(14, 4) not null check (qty > 0),
  primary key (product_id, ingredient_id)
);

-- ---------------------------------------------------------------- places
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  can_produce boolean not null default false,
  can_sell boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name),
  constraint locations_does_something check (can_produce or can_sell)
);
create index if not exists locations_business_idx on public.locations (business_id);
alter table public.locations add column if not exists address text check (address is null or length(address) <= 160);

-- Employees work at one place; admins see every place (location_id stays null for them).
alter table public.members add column if not exists location_id uuid references public.locations (id) on delete set null;
alter table public.invites add column if not exists location_id uuid references public.locations (id) on delete cascade;
-- An admin can also add a person by e-mail: when they sign up with that address they join without a code.
alter table public.invites add column if not exists email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.invites add column if not exists name text check (name is null or length(trim(name)) between 1 and 60);
create unique index if not exists invites_open_email_idx on public.invites (business_id, lower(email))
  where email is not null and used_by is null;

-- Finished products waiting to be sold: one pool per business, filled by production at any place.
create table if not exists public.pool_products (
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  qty numeric(14, 3) not null default 0,
  primary key (business_id, product_id)
);

-- Stock lives per place (products on a selling place's shelf, ingredients anywhere). A missing row means zero.
create table if not exists public.stock_products (
  location_id uuid not null references public.locations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  qty numeric(14, 3) not null default 0,
  primary key (location_id, product_id)
);
create table if not exists public.stock_ingredients (
  location_id uuid not null references public.locations (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  qty numeric(14, 3) not null default 0,
  primary key (location_id, ingredient_id)
);

-- Stock used to be one number per business; with places it starts again from zero (owner's decision).
alter table public.products drop column if exists stock;
alter table public.ingredients drop column if exists stock;

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text,
  total numeric(14, 2) not null default 0,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists movements_business_time_idx on public.movements (business_id, created_at desc);
-- The day the goods arrived or the batch was made (may be earlier than created_at when entered late).
alter table public.movements add column if not exists occurred_on date not null default (now() at time zone 'Europe/Istanbul')::date;
-- The place whose stock changed (null only for history from before places existed).
alter table public.movements add column if not exists location_id uuid references public.locations (id) on delete restrict;
create index if not exists movements_location_time_idx on public.movements (location_id, created_at desc);
alter table public.movements drop constraint if exists movements_kind_check;
alter table public.movements add constraint movements_kind_check
  check (kind in ('sale', 'waste', 'production', 'receipt', 'count', 'restock'));

-- Products and ingredients are deactivated, never deleted, once they appear in a movement.
create table if not exists public.movement_lines (
  id bigint generated always as identity primary key,
  movement_id uuid not null references public.movements (id) on delete cascade,
  product_id uuid references public.products (id) on delete restrict,
  ingredient_id uuid references public.ingredients (id) on delete restrict,
  qty numeric(14, 3) not null, -- signed: + into stock, - out of stock
  unit_price numeric(12, 2),
  check ((product_id is null) <> (ingredient_id is null))
);
create index if not exists movement_lines_movement_idx on public.movement_lines (movement_id);
alter table public.movement_lines add column if not exists expires_on date; -- batch expiry, optional
alter table public.movement_lines add column if not exists weight_g int check (weight_g is null or weight_g between 1 and 100000);

-- ============================================================== HELPERS
create or replace function public.my_business() returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from public.members where user_id = auth.uid()
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid()
$$;

create or replace function public.my_name() returns text
language sql stable security definer set search_path = public as $$
  select name from public.members where user_id = auth.uid()
$$;

-- The place an employee works at (null for admins and unassigned employees).
create or replace function public.my_location() returns uuid
language sql stable security definer set search_path = public as $$
  select location_id from public.members where user_id = auth.uid()
$$;

-- Admins see every place of their business; employees only their own.
create or replace function public.can_see_place(p_place uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.locations l
    where l.id = p_place and l.business_id = public.my_business()
      and (public.my_role() = 'admin' or l.id = public.my_location()))
$$;

create or replace function public.today_tr() returns date
language sql stable as $$ select (now() at time zone 'Europe/Istanbul')::date $$;

-- The day a receipt or production happened: today by default, never in the future, at most a year back.
create or replace function public.movement_day(p_day date) returns date
language plpgsql stable as $$
declare v date := coalesce(p_day, public.today_tr());
begin
  if v > public.today_tr() then raise exception 'Gelecek bir tarih girilemez.'; end if;
  if v < public.today_tr() - 365 then raise exception 'Tarih bir yıldan eski olamaz.'; end if;
  return v;
end $$;

create or replace function public.check_expiry(p_expires date, p_day date) returns date
language plpgsql immutable as $$
begin
  if p_expires is not null and p_expires < p_day then
    raise exception 'Son kullanma tarihi, alış ya da üretim tarihinden önce olamaz.';
  end if;
  return p_expires;
end $$;

-- ---------------------------------------------------------------- internal stock helpers
-- Not callable by users (see FUNCTION ACCESS); only the movement functions below use them.

-- The place the caller wants to act at, if they may: it belongs to their business, is open, they are
-- an admin or work there, and it does what is needed ('produce', 'sell' or null for anything).
create or replace function public.use_place(p_place uuid, p_need text default null)
returns public.locations language plpgsql stable security definer set search_path = public as $$
declare v locations;
begin
  select * into v from locations where id = p_place and business_id = my_business() and active;
  if not found then raise exception 'Yer bulunamadı.'; end if;
  if my_role() is distinct from 'admin' and v.id is distinct from my_location() then
    raise exception 'Bu yerde işlem yapma yetkin yok.';
  end if;
  if p_need = 'produce' and not v.can_produce then raise exception '% üretim yapmıyor.', v.name; end if;
  if p_need = 'sell' and not v.can_sell then raise exception '% satış yapmıyor.', v.name; end if;
  return v;
end $$;

create or replace function public.add_product_stock(p_place uuid, p_product uuid, p_qty numeric)
returns void language sql security definer set search_path = public as $$
  insert into stock_products (location_id, product_id, qty) values (p_place, p_product, p_qty)
  on conflict (location_id, product_id) do update set qty = stock_products.qty + excluded.qty
$$;

create or replace function public.add_ingredient_stock(p_place uuid, p_ingredient uuid, p_qty numeric)
returns void language sql security definer set search_path = public as $$
  insert into stock_ingredients (location_id, ingredient_id, qty) values (p_place, p_ingredient, p_qty)
  on conflict (location_id, ingredient_id) do update set qty = stock_ingredients.qty + excluded.qty
$$;

create or replace function public.add_pool_stock(p_business uuid, p_product uuid, p_qty numeric)
returns void language sql security definer set search_path = public as $$
  insert into pool_products (business_id, product_id, qty) values (p_business, p_product, p_qty)
  on conflict (business_id, product_id) do update set qty = pool_products.qty + excluded.qty
$$;

-- Takes products out of the pool, refusing to go below zero.
create or replace function public.take_pool_stock(p_business uuid, p_product uuid, p_qty numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  insert into pool_products (business_id, product_id, qty) values (p_business, p_product, 0) on conflict do nothing;
  select qty into v from pool_products where business_id = p_business and product_id = p_product for update;
  if v < p_qty then
    raise exception 'Havuzda yeterli % yok (kalan: %).', (select name from products where id = p_product), trim_scale(v);
  end if;
  update pool_products set qty = qty - p_qty where business_id = p_business and product_id = p_product;
end $$;

-- Takes products off a place's stock, refusing to go below zero.
create or replace function public.take_product_stock(p_place uuid, p_product uuid, p_qty numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  insert into stock_products (location_id, product_id, qty) values (p_place, p_product, 0) on conflict do nothing;
  select qty into v from stock_products where location_id = p_place and product_id = p_product for update;
  if v < p_qty then
    raise exception 'Yeterli % yok (kalan: %).', (select name from products where id = p_product), trim_scale(v);
  end if;
  update stock_products set qty = qty - p_qty where location_id = p_place and product_id = p_product;
end $$;

-- Uses up ingredients at a place. p_need: [{"id": "<ingredient uuid>", "qty": 1.5}, ...]
-- Locks the rows in a fixed order, checks all of them first, then deducts (all or nothing).
create or replace function public.take_ingredients(p_place uuid, p_need jsonb, p_label text)
returns void language plpgsql security definer set search_path = public as $$
declare v_short text;
begin
  if p_need is null or jsonb_array_length(p_need) = 0 then return; end if;
  create temporary table if not exists _need (id uuid primary key, qty numeric) on commit drop;
  truncate _need;
  insert into _need select x.id, sum(x.qty) from jsonb_to_recordset(p_need) as x(id uuid, qty numeric) group by x.id;
  insert into stock_ingredients (location_id, ingredient_id, qty) select p_place, id, 0 from _need on conflict do nothing;
  perform 1 from stock_ingredients where location_id = p_place and ingredient_id in (select id from _need)
    order by ingredient_id for update;
  select string_agg(format('%s (%s %s lazım, %s var)', i.name, trim_scale(round(n.qty, 3)), i.unit, trim_scale(round(s.qty, 3))), ', ' order by i.name)
    into v_short
    from _need n join stock_ingredients s on s.location_id = p_place and s.ingredient_id = n.id
    join ingredients i on i.id = n.id
    where s.qty < n.qty;
  if v_short is not null then raise exception '%: %', p_label, v_short; end if;
  update stock_ingredients s set qty = s.qty - n.qty from _need n where s.location_id = p_place and s.ingredient_id = n.id;
end $$;

-- ============================================================== ROW LEVEL SECURITY
alter table public.businesses enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.recipe_items enable row level security;
alter table public.movements enable row level security;
alter table public.movement_lines enable row level security;
alter table public.locations enable row level security;
alter table public.stock_products enable row level security;
alter table public.stock_ingredients enable row level security;
alter table public.pool_products enable row level security;

revoke all on public.businesses, public.members, public.invites, public.ingredients, public.products,
  public.recipe_items, public.movements, public.movement_lines, public.locations, public.stock_products,
  public.stock_ingredients, public.pool_products from anon;

drop policy if exists "members read own business" on public.businesses;
create policy "members read own business" on public.businesses
  for select using (id = public.my_business());
drop policy if exists "admin renames business" on public.businesses;
create policy "admin renames business" on public.businesses
  for update using (id = public.my_business() and public.my_role() = 'admin')
  with check (id = public.my_business());
revoke insert, update, delete on public.businesses from authenticated;
grant select on public.businesses to authenticated;
grant update (name) on public.businesses to authenticated;

drop policy if exists "members read team" on public.members;
create policy "members read team" on public.members
  for select using (business_id = public.my_business());
drop policy if exists "admin removes staff" on public.members;
create policy "admin removes staff" on public.members
  for delete using (business_id = public.my_business() and public.my_role() = 'admin' and user_id <> auth.uid());
revoke insert, update on public.members from authenticated;
grant select, delete on public.members to authenticated;

drop policy if exists "admin manages invites" on public.invites;
create policy "admin manages invites" on public.invites
  for select using (business_id = public.my_business() and public.my_role() = 'admin');
drop policy if exists "admin deletes invites" on public.invites;
create policy "admin deletes invites" on public.invites
  for delete using (business_id = public.my_business() and public.my_role() = 'admin');
revoke insert, update on public.invites from authenticated;
grant select, delete on public.invites to authenticated;

-- Catalog: everyone in the business reads it, only an admin edits it. Stock is not part of the
-- catalog; it lives per place and changes only through the functions below.
drop policy if exists "members read ingredients" on public.ingredients;
create policy "members read ingredients" on public.ingredients
  for select using (business_id = public.my_business());
drop policy if exists "admin adds ingredients" on public.ingredients;
create policy "admin adds ingredients" on public.ingredients
  for insert with check (business_id = public.my_business() and public.my_role() = 'admin');
drop policy if exists "admin edits ingredients" on public.ingredients;
create policy "admin edits ingredients" on public.ingredients
  for update using (business_id = public.my_business() and public.my_role() = 'admin')
  with check (business_id = public.my_business());
revoke update, delete on public.ingredients from authenticated;
grant select, insert on public.ingredients to authenticated;
grant update (name, unit, min_stock, active) on public.ingredients to authenticated;

drop policy if exists "members read products" on public.products;
create policy "members read products" on public.products
  for select using (business_id = public.my_business());
drop policy if exists "admin adds products" on public.products;
create policy "admin adds products" on public.products
  for insert with check (business_id = public.my_business() and public.my_role() = 'admin');
drop policy if exists "admin edits products" on public.products;
create policy "admin edits products" on public.products
  for update using (business_id = public.my_business() and public.my_role() = 'admin')
  with check (business_id = public.my_business());
revoke update, delete on public.products from authenticated;
grant select, insert on public.products to authenticated;
grant update (name, emoji, unit, price, min_stock, barcode, attrs, active, sort, weight_g, category, made_to_order) on public.products to authenticated;

drop policy if exists "members read recipes" on public.recipe_items;
create policy "members read recipes" on public.recipe_items
  for select using (exists (select 1 from public.products p where p.id = product_id and p.business_id = public.my_business()));
drop policy if exists "admin edits recipes" on public.recipe_items;
create policy "admin edits recipes" on public.recipe_items
  for all using (public.my_role() = 'admin' and exists (
    select 1 from public.products p where p.id = product_id and p.business_id = public.my_business()))
  with check (public.my_role() = 'admin'
    and exists (select 1 from public.products p where p.id = product_id and p.business_id = public.my_business())
    and exists (select 1 from public.ingredients i where i.id = ingredient_id and i.business_id = public.my_business()));
grant select, insert, update, delete on public.recipe_items to authenticated;

-- Places: everyone in the business reads the list (to see where goods go); changes only via functions.
drop policy if exists "members read places" on public.locations;
create policy "members read places" on public.locations
  for select using (business_id = public.my_business());

-- Stock per place: admins see all places, employees their own.
drop policy if exists "read own place product stock" on public.stock_products;
create policy "read own place product stock" on public.stock_products
  for select using (public.can_see_place(location_id));
drop policy if exists "read own place ingredient stock" on public.stock_ingredients;
create policy "read own place ingredient stock" on public.stock_ingredients
  for select using (public.can_see_place(location_id));

-- The pool: everyone in the business sees what is ready to be taken onto a shelf.
drop policy if exists "members read pool" on public.pool_products;
create policy "members read pool" on public.pool_products
  for select using (business_id = public.my_business());

revoke all on public.locations, public.stock_products, public.stock_ingredients, public.pool_products from authenticated;
grant select on public.locations, public.stock_products, public.stock_ingredients, public.pool_products to authenticated;

-- History: read-only; admins see every place, employees their own. Written only by the functions below.
drop policy if exists "members read movements" on public.movements;
create policy "members read movements" on public.movements
  for select using (business_id = public.my_business()
    and (public.my_role() = 'admin' or location_id = public.my_location()));
drop policy if exists "members read movement lines" on public.movement_lines;
create policy "members read movement lines" on public.movement_lines
  for select using (exists (select 1 from public.movements m where m.id = movement_id));
revoke insert, update, delete on public.movements, public.movement_lines from authenticated;
grant select on public.movements, public.movement_lines to authenticated;

-- ============================================================== ONBOARDING AND TEAM
create or replace function public.create_business(p_name text, p_sector text, p_owner_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Oturum bulunamadı.'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Zaten bir işletmeye bağlısın.'; end if;
  insert into businesses (name, sector) values (trim(p_name), coalesce(p_sector, 'bakery')) returning id into v_id;
  insert into members (user_id, business_id, role, name) values (auth.uid(), v_id, 'admin', trim(p_owner_name));
  return v_id;
end $$;

-- Adds a place (p_id null) or changes one.
create or replace function public.save_place(p_id uuid, p_name text, p_can_produce boolean, p_can_sell boolean, p_address text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid := my_business();
  v_name text := trim(coalesce(p_name, ''));
  v_address text := nullif(trim(left(p_address, 160)), '');
  v_id uuid;
begin
  if my_role() is distinct from 'admin' then raise exception 'Yerleri sadece admin düzenler.'; end if;
  if length(v_name) not between 1 and 60 then raise exception 'Yer adı 1 ile 60 karakter arasında olmalı.'; end if;
  if not (coalesce(p_can_produce, false) or coalesce(p_can_sell, false)) then
    raise exception 'Yer üretim ya da satış yapmalı (ya da ikisini birden).';
  end if;
  if p_id is null then
    insert into locations (business_id, name, can_produce, can_sell, address)
      values (v_biz, v_name, p_can_produce, p_can_sell, v_address) returning id into v_id;
    return v_id;
  end if;
  update locations set name = v_name, can_produce = p_can_produce, can_sell = p_can_sell, address = v_address
    where id = p_id and business_id = v_biz;
  if not found then raise exception 'Yer bulunamadı.'; end if;
  return p_id;
exception when unique_violation then
  raise exception 'Bu adda bir yer zaten var.';
end $$;

-- Closes or reopens a place. A closed place keeps its history but takes no new movements.
create or replace function public.set_place_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'admin' then raise exception 'Yerleri sadece admin düzenler.'; end if;
  update locations set active = p_active where id = p_id and business_id = my_business();
  if not found then raise exception 'Yer bulunamadı.'; end if;
end $$;

-- Moves an employee to another place (or leaves them unassigned with null).
create or replace function public.assign_member(p_user uuid, p_place uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'admin' then raise exception 'Çalışanları sadece admin atar.'; end if;
  if p_place is not null and not exists (select 1 from locations where id = p_place and business_id = my_business() and active) then
    raise exception 'Yer bulunamadı.';
  end if;
  update members set location_id = p_place where user_id = p_user and business_id = my_business() and role = 'employee';
  if not found then raise exception 'Çalışan bulunamadı.'; end if;
end $$;

drop function if exists public.create_invite(text);
drop function if exists public.create_invite();
-- An invite brings in an employee who works at the given place.
create or replace function public.create_invite(p_place uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  i int;
begin
  if my_role() is distinct from 'admin' then raise exception 'Sadece yönetici davet oluşturabilir.'; end if;
  if not exists (select 1 from locations where id = p_place and business_id = my_business() and active) then
    raise exception 'Çalışacağı yeri seç.';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from invites where code = v_code);
  end loop;
  insert into invites (code, business_id, role, created_by, location_id) values (v_code, my_business(), 'employee', auth.uid(), p_place);
  return v_code;
end $$;

create or replace function public.accept_invite(p_code text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv invites;
begin
  if auth.uid() is null then raise exception 'Oturum bulunamadı.'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Zaten bir işletmeye bağlısın.'; end if;
  select * into v_inv from invites where code = upper(trim(p_code)) for update;
  if not found or v_inv.used_by is not null or v_inv.expires_at < now() then
    raise exception 'Davet kodu geçersiz ya da süresi dolmuş. Patrondan yeni kod iste.';
  end if;
  insert into members (user_id, business_id, role, name, location_id)
    values (auth.uid(), v_inv.business_id, v_inv.role, trim(p_name), v_inv.location_id);
  update invites set used_by = auth.uid(), used_at = now() where code = v_inv.code;
  return v_inv.business_id;
end $$;

-- Adds an employee by name and e-mail. They create their own account (the app never sets other
-- people's passwords); on their first sign-in with this address they join at the given place.
create or replace function public.add_staff(p_name text, p_email text, p_place uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_code text;
begin
  if my_role() is distinct from 'admin' then raise exception 'Çalışanları sadece admin ekler.'; end if;
  if length(v_name) not between 1 and 60 then raise exception 'Çalışanın adını yaz.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Geçerli bir e-posta adresi yaz.'; end if;
  if exists (select 1 from members m join auth.users u on u.id = m.user_id where lower(u.email) = v_email) then
    raise exception 'Bu e-posta zaten bir işletmede çalışıyor.';
  end if;
  v_code := create_invite(p_place);
  update invites set email = v_email, name = v_name, expires_at = now() + interval '30 days' where code = v_code;
  return v_code;
exception when unique_violation then
  raise exception 'Bu e-posta için zaten bekleyen bir kayıt var.';
end $$;

-- Called after sign-in by a user without a business: joins them if an admin added their e-mail.
create or replace function public.claim_staff_invite()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_inv invites;
begin
  if auth.uid() is null or v_email is null then return null; end if;
  if exists (select 1 from members where user_id = auth.uid()) then return null; end if;
  select * into v_inv from invites
    where lower(email) = v_email and used_by is null and expires_at > now()
    order by created_at desc limit 1 for update;
  if not found then return null; end if;
  insert into members (user_id, business_id, role, name, location_id)
    values (auth.uid(), v_inv.business_id, v_inv.role, v_inv.name, v_inv.location_id);
  update invites set used_by = auth.uid(), used_at = now() where code = v_inv.code;
  return v_inv.business_id;
end $$;

-- ============================================================== STOCK MOVEMENTS
-- Every function acts at one place and writes one movement for that place.
drop function if exists public.record_sale(jsonb, boolean);
drop function if exists public.record_production(jsonb, date);
drop function if exists public.record_production(jsonb);
drop function if exists public.receive_ingredient(uuid, numeric, text, date, date);
drop function if exists public.receive_ingredient(uuid, numeric, text);
drop function if exists public.count_ingredient(uuid, numeric);
drop function if exists public.count_product(uuid, numeric);
drop function if exists public.expiring_batches(int);

-- Sale (or waste) at a place. p_items: [{"id": "<product uuid>", "qty": 2}, ...]
-- Waste can be recorded at any place; a sale only where the place sells.
create or replace function public.record_sale(p_place uuid, p_items jsonb, p_waste boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid := my_business();
  v_mov uuid;
  v_total numeric := 0;
  r record;
begin
  perform use_place(p_place, case when p_waste then null else 'sell' end);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Ürün seçilmedi.'; end if;
  insert into movements (business_id, location_id, kind, created_by, created_by_name)
    values (v_biz, p_place, case when p_waste then 'waste' else 'sale' end, auth.uid(), my_name()) returning id into v_mov;
  for r in
    select p.id, p.name, p.price, p.made_to_order, sum(x.qty) as qty
    from jsonb_to_recordset(p_items) as x(id uuid, qty numeric)
    join products p on p.id = x.id and p.business_id = v_biz and p.active
    group by p.id
    order by p.id
  loop
    if r.qty <= 0 then raise exception 'Adet sıfırdan büyük olmalı.'; end if;
    if r.made_to_order then
      -- made to order (coffee, tea…): the recipe's ingredients leave this place's stock
      perform take_ingredients(p_place,
        (select jsonb_agg(jsonb_build_object('id', ri.ingredient_id, 'qty', ri.qty * r.qty)) from recipe_items ri where ri.product_id = r.id),
        r.name || ' için yetersiz malzeme');
      insert into movement_lines (movement_id, ingredient_id, qty)
        select v_mov, ri.ingredient_id, -ri.qty * r.qty from recipe_items ri where ri.product_id = r.id;
    else
      perform take_product_stock(p_place, r.id, r.qty);
    end if;
    insert into movement_lines (movement_id, product_id, qty, unit_price) values (v_mov, r.id, -r.qty, r.price);
    v_total := v_total + r.qty * r.price;
  end loop;
  if not exists (select 1 from movement_lines where movement_id = v_mov and product_id is not null) then
    raise exception 'Ürün bulunamadı.';
  end if;
  update movements set total = v_total where id = v_mov;
  return v_mov;
end $$;

-- Production at a producing place: uses up the recipe's ingredients there and adds the finished products
-- to the shared pool, from where selling places take them.
-- p_items: [{"id": "<product uuid>", "qty": 40, "expires_on": "2026-11-10", "weight_g": 80}, ...]
-- expires_on and weight_g are optional; weight_g defaults to the product's standard weight.
create or replace function public.record_production(p_place uuid, p_items jsonb, p_day date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid := my_business();
  v_day date := movement_day(p_day);
  v_mov uuid;
  r record;
begin
  perform use_place(p_place, 'produce');
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Ürün seçilmedi.'; end if;

  create temporary table if not exists _prod (id uuid primary key, qty numeric, expires_on date, weight_g int) on commit drop;
  truncate _prod;
  insert into _prod
    select p.id, sum(x.qty), min(x.expires_on), coalesce(max(x.weight_g), p.weight_g)
    from jsonb_to_recordset(p_items) as x(id uuid, qty numeric, expires_on date, weight_g int)
    join products p on p.id = x.id and p.business_id = v_biz and p.active
    group by p.id;
  if not exists (select 1 from _prod) then raise exception 'Ürün bulunamadı.'; end if;
  if exists (select 1 from _prod where qty <= 0) then raise exception 'Adet sıfırdan büyük olmalı.'; end if;
  if exists (select 1 from _prod join products p on p.id = _prod.id where p.made_to_order) then
    raise exception 'Siparişle hazırlanan ürünler üretime girilmez; satışta malzemeleri düşer.';
  end if;
  if exists (select 1 from _prod where weight_g is not null and weight_g not between 1 and 100000) then
    raise exception 'Gramaj 1 ile 100.000 g arasında olmalı.';
  end if;
  perform check_expiry(expires_on, v_day) from _prod;

  perform take_ingredients(p_place,
    (select jsonb_agg(jsonb_build_object('id', ri.ingredient_id, 'qty', ri.qty * _prod.qty))
       from recipe_items ri join _prod on _prod.id = ri.product_id),
    'Yetersiz malzeme');

  insert into movements (business_id, location_id, kind, created_by, created_by_name, occurred_on)
    values (v_biz, p_place, 'production', auth.uid(), my_name(), v_day) returning id into v_mov;
  insert into movement_lines (movement_id, ingredient_id, qty)
    select v_mov, ri.ingredient_id, -sum(ri.qty * _prod.qty)
    from recipe_items ri join _prod on _prod.id = ri.product_id group by ri.ingredient_id;
  for r in select * from _prod order by id loop
    perform add_pool_stock(v_biz, r.id, r.qty);
    insert into movement_lines (movement_id, product_id, qty, expires_on, weight_g) values (v_mov, r.id, r.qty, r.expires_on, r.weight_g);
  end loop;
  return v_mov;
end $$;

-- Goods received at a place (any place: kitchens buy flour, shops buy coffee beans and bottled water).
create or replace function public.receive_ingredient(
  p_place uuid, p_ingredient uuid, p_qty numeric, p_note text default null, p_day date default null, p_expires date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mov uuid; v_biz uuid := my_business(); v_day date := movement_day(p_day);
begin
  perform use_place(p_place);
  if p_qty is null or p_qty <= 0 then raise exception 'Gelen miktarı yaz.'; end if;
  perform check_expiry(p_expires, v_day);
  if not exists (select 1 from ingredients where id = p_ingredient and business_id = v_biz and active) then
    raise exception 'Malzeme bulunamadı.';
  end if;
  perform add_ingredient_stock(p_place, p_ingredient, p_qty);
  insert into movements (business_id, location_id, kind, created_by, created_by_name, note, occurred_on)
    values (v_biz, p_place, 'receipt', auth.uid(), my_name(), nullif(trim(left(p_note, 300)), ''), v_day) returning id into v_mov;
  insert into movement_lines (movement_id, ingredient_id, qty, expires_on) values (v_mov, p_ingredient, p_qty, p_expires);
  return v_mov;
end $$;

-- Stock count at a place (admin only): sets the counted amount; the line stores the difference.
create or replace function public.count_ingredient(p_place uuid, p_ingredient uuid, p_counted numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mov uuid; v_biz uuid := my_business(); v_old numeric;
begin
  if my_role() is distinct from 'admin' then raise exception 'Bu işlem için yetkin yok.'; end if;
  perform use_place(p_place);
  if p_counted is null or p_counted < 0 then raise exception 'Sayılan miktarı yaz.'; end if;
  if not exists (select 1 from ingredients where id = p_ingredient and business_id = v_biz and active) then
    raise exception 'Malzeme bulunamadı.';
  end if;
  perform add_ingredient_stock(p_place, p_ingredient, 0);
  select qty into v_old from stock_ingredients where location_id = p_place and ingredient_id = p_ingredient for update;
  update stock_ingredients set qty = p_counted where location_id = p_place and ingredient_id = p_ingredient;
  insert into movements (business_id, location_id, kind, created_by, created_by_name)
    values (v_biz, p_place, 'count', auth.uid(), my_name()) returning id into v_mov;
  insert into movement_lines (movement_id, ingredient_id, qty) values (v_mov, p_ingredient, p_counted - v_old);
  return v_mov;
end $$;

create or replace function public.count_product(p_place uuid, p_product uuid, p_counted numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mov uuid; v_biz uuid := my_business(); v_old numeric;
begin
  if my_role() is distinct from 'admin' then raise exception 'Bu işlem için yetkin yok.'; end if;
  perform use_place(p_place);
  if p_counted is null or p_counted < 0 then raise exception 'Sayılan miktarı yaz.'; end if;
  if not exists (select 1 from products where id = p_product and business_id = v_biz and not made_to_order) then
    raise exception 'Ürün bulunamadı.';
  end if;
  perform add_product_stock(p_place, p_product, 0);
  select qty into v_old from stock_products where location_id = p_place and product_id = p_product for update;
  update stock_products set qty = p_counted where location_id = p_place and product_id = p_product;
  insert into movements (business_id, location_id, kind, created_by, created_by_name)
    values (v_biz, p_place, 'count', auth.uid(), my_name()) returning id into v_mov;
  insert into movement_lines (movement_id, product_id, qty) values (v_mov, p_product, p_counted - v_old);
  return v_mov;
end $$;

-- ---------------------------------------------------------------- pool
-- A selling place takes products from the pool onto its shelf. p_items: [{"id": "<product uuid>", "qty": 10}, ...]
create or replace function public.take_from_pool(p_place uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid := my_business();
  v_mov uuid;
  r record;
begin
  perform use_place(p_place, 'sell');
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Ürün seçilmedi.'; end if;
  insert into movements (business_id, location_id, kind, created_by, created_by_name)
    values (v_biz, p_place, 'restock', auth.uid(), my_name()) returning id into v_mov;
  for r in
    select p.id, sum(x.qty) as qty
    from jsonb_to_recordset(p_items) as x(id uuid, qty numeric)
    join products p on p.id = x.id and p.business_id = v_biz and p.active and not p.made_to_order
    group by p.id order by p.id
  loop
    if r.qty <= 0 then raise exception 'Adet sıfırdan büyük olmalı.'; end if;
    perform take_pool_stock(v_biz, r.id, r.qty);
    perform add_product_stock(p_place, r.id, r.qty);
    insert into movement_lines (movement_id, product_id, qty) values (v_mov, r.id, r.qty);
  end loop;
  if not exists (select 1 from movement_lines where movement_id = v_mov) then raise exception 'Ürün bulunamadı.'; end if;
  return v_mov;
end $$;

-- Pool count (admin only): sets the counted amount; the movement has no place, the line stores the difference.
create or replace function public.count_pool(p_product uuid, p_counted numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mov uuid; v_biz uuid := my_business(); v_old numeric;
begin
  if my_role() is distinct from 'admin' then raise exception 'Bu işlem için yetkin yok.'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Sayılan miktarı yaz.'; end if;
  if not exists (select 1 from products where id = p_product and business_id = v_biz and not made_to_order) then
    raise exception 'Ürün bulunamadı.';
  end if;
  perform add_pool_stock(v_biz, p_product, 0);
  select qty into v_old from pool_products where business_id = v_biz and product_id = p_product for update;
  update pool_products set qty = p_counted where business_id = v_biz and product_id = p_product;
  insert into movements (business_id, location_id, kind, created_by, created_by_name, note)
    values (v_biz, null, 'count', auth.uid(), my_name(), 'Ana havuz') returning id into v_mov;
  insert into movement_lines (movement_id, product_id, qty) values (v_mov, p_product, p_counted - v_old);
  return v_mov;
end $$;

-- Batches whose expiry is within p_days (or past), with the place they were received or made at.
-- Approximation: a batch counts until its expiry, whatever was sold from it. Runs with the caller's
-- rights, so employees only see their own place.
create or replace function public.expiring_batches(p_days int default 3)
returns table (location_id uuid, product_id uuid, ingredient_id uuid, qty numeric, expires_on date, occurred_on date)
language sql stable security invoker set search_path = public as $$
  select m.location_id, l.product_id, l.ingredient_id, l.qty, l.expires_on, m.occurred_on
  from movement_lines l join movements m on m.id = l.movement_id
  where m.business_id = my_business() and l.expires_on is not null and l.qty > 0
    and m.kind in ('receipt', 'production')
    and l.expires_on between today_tr() - 2 and today_tr() + greatest(0, least(p_days, 30))
  order by l.expires_on, m.occurred_on desc
$$;

-- ============================================================== FUNCTION ACCESS
-- Internal helpers: never callable directly.
revoke execute on function public.use_place(uuid, text), public.add_product_stock(uuid, uuid, numeric),
  public.add_pool_stock(uuid, uuid, numeric), public.take_pool_stock(uuid, uuid, numeric),
  public.add_ingredient_stock(uuid, uuid, numeric), public.take_product_stock(uuid, uuid, numeric),
  public.take_ingredients(uuid, jsonb, text)
  from public, anon, authenticated;

revoke execute on function public.my_business(), public.my_role(), public.my_name(), public.my_location(),
  public.can_see_place(uuid), public.today_tr(), public.movement_day(date), public.check_expiry(date, date),
  public.create_business(text, text, text), public.save_place(uuid, text, boolean, boolean, text),
  public.set_place_active(uuid, boolean), public.assign_member(uuid, uuid),
  public.create_invite(uuid), public.accept_invite(text, text), public.add_staff(text, text, uuid),
  public.claim_staff_invite(), public.record_sale(uuid, jsonb, boolean), public.record_production(uuid, jsonb, date),
  public.receive_ingredient(uuid, uuid, numeric, text, date, date), public.count_ingredient(uuid, uuid, numeric),
  public.count_product(uuid, uuid, numeric), public.take_from_pool(uuid, jsonb),
  public.count_pool(uuid, numeric), public.expiring_batches(int)
  from public, anon;
grant execute on function public.my_business(), public.my_role(), public.my_name(), public.my_location(),
  public.can_see_place(uuid), public.today_tr(), public.movement_day(date), public.check_expiry(date, date),
  public.create_business(text, text, text), public.save_place(uuid, text, boolean, boolean, text),
  public.set_place_active(uuid, boolean), public.assign_member(uuid, uuid),
  public.create_invite(uuid), public.accept_invite(text, text), public.add_staff(text, text, uuid),
  public.claim_staff_invite(), public.record_sale(uuid, jsonb, boolean), public.record_production(uuid, jsonb, date),
  public.receive_ingredient(uuid, uuid, numeric, text, date, date), public.count_ingredient(uuid, uuid, numeric),
  public.count_product(uuid, uuid, numeric), public.take_from_pool(uuid, jsonb),
  public.count_pool(uuid, numeric), public.expiring_batches(int)
  to authenticated;
