-- Stokla database schema. Run the whole file in the Supabase SQL editor; it is safe to re-run.
--
-- Rules enforced here (not only in the app):
--  * Every row belongs to one business; members only ever see their own business (RLS).
--  * Stock changes only through the functions at the bottom (sale, waste, production,
--    goods received, stock count). Each runs in one transaction and writes a movement,
--    so stock and history can never disagree.
--  * Roles: admin (sees and manages everything) and employee (sales, production, goods received).
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
  stock numeric(14, 3) not null default 0,
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
  stock numeric(14, 3) not null default 0,
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

-- How much of each ingredient one unit of a product uses.
create table if not exists public.recipe_items (
  product_id uuid not null references public.products (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  qty numeric(14, 4) not null check (qty > 0),
  primary key (product_id, ingredient_id)
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('sale', 'waste', 'production', 'receipt', 'count')),
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text,
  total numeric(14, 2) not null default 0,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists movements_business_time_idx on public.movements (business_id, created_at desc);
-- The day the goods arrived or the batch was made (may be earlier than created_at when entered late).
alter table public.movements add column if not exists occurred_on date not null default (now() at time zone 'Europe/Istanbul')::date;

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

-- ============================================================== ROW LEVEL SECURITY
alter table public.businesses enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.recipe_items enable row level security;
alter table public.movements enable row level security;
alter table public.movement_lines enable row level security;

revoke all on public.businesses, public.members, public.invites, public.ingredients, public.products,
  public.recipe_items, public.movements, public.movement_lines from anon;

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

-- Catalog: everyone in the business reads it, only an admin edits it.
-- Stock columns cannot be updated directly; they change only through the functions below.
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
grant update (name, emoji, unit, price, min_stock, barcode, attrs, active, sort, weight_g) on public.products to authenticated;

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

-- History: read-only for members; written only by the functions below.
drop policy if exists "members read movements" on public.movements;
create policy "members read movements" on public.movements
  for select using (business_id = public.my_business());
drop policy if exists "members read movement lines" on public.movement_lines;
create policy "members read movement lines" on public.movement_lines
  for select using (exists (select 1 from public.movements m where m.id = movement_id and m.business_id = public.my_business()));
revoke insert, update, delete on public.movements, public.movement_lines from authenticated;
grant select on public.movements, public.movement_lines to authenticated;

-- ============================================================== ONBOARDING
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

drop function if exists public.create_invite(text);
create or replace function public.create_invite()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  i int;
begin
  if my_role() is distinct from 'admin' then raise exception 'Sadece yönetici davet oluşturabilir.'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from invites where code = v_code);
  end loop;
  insert into invites (code, business_id, role, created_by) values (v_code, my_business(), 'employee', auth.uid());
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
  insert into members (user_id, business_id, role, name) values (auth.uid(), v_inv.business_id, v_inv.role, trim(p_name));
  update invites set used_by = auth.uid(), used_at = now() where code = v_inv.code;
  return v_inv.business_id;
end $$;

-- ============================================================== STOCK MOVEMENTS
-- p_items: [{"id": "<product uuid>", "qty": 2}, ...]
create or replace function public.record_sale(p_items jsonb, p_waste boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid := my_business();
  v_mov uuid;
  v_total numeric := 0;
  r record;
begin
  if my_role() not in ('admin', 'employee') then raise exception 'Bu işlem için yetkin yok.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Ürün seçilmedi.'; end if;
  insert into movements (business_id, kind, created_by, created_by_name)
    values (v_biz, case when p_waste then 'waste' else 'sale' end, auth.uid(), my_name()) returning id into v_mov;
  for r in
    select p.id, p.name, p.price, p.stock, sum(x.qty) as qty
    from jsonb_to_recordset(p_items) as x(id uuid, qty numeric)
    join products p on p.id = x.id and p.business_id = v_biz and p.active
    group by p.id
    order by p.id
  loop
    if r.qty <= 0 then raise exception 'Adet sıfırdan büyük olmalı.'; end if;
    perform 1 from products where id = r.id for update;
    if (select stock from products where id = r.id) < r.qty then
      raise exception 'Yeterli % yok (kalan: %).', r.name, (select stock from products where id = r.id);
    end if;
    update products set stock = stock - r.qty where id = r.id;
    insert into movement_lines (movement_id, product_id, qty, unit_price) values (v_mov, r.id, -r.qty, r.price);
    v_total := v_total + r.qty * r.price;
  end loop;
  if not exists (select 1 from movement_lines where movement_id = v_mov) then raise exception 'Ürün bulunamadı.'; end if;
  update movements set total = v_total where id = v_mov;
  return v_mov;
end $$;

-- Production: adds finished products and uses up their recipe ingredients.
-- p_items: [{"id": "<product uuid>", "qty": 40, "expires_on": "2026-11-10", "weight_g": 80}, ...]
-- expires_on and weight_g are optional; weight_g defaults to the product's standard weight.
drop function if exists public.record_production(jsonb);
create or replace function public.record_production(p_items jsonb, p_day date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid := my_business();
  v_day date := movement_day(p_day);
  v_mov uuid;
  r record;
  v_short text;
begin
  if my_role() not in ('admin', 'employee') then raise exception 'Bu işlem için yetkin yok.'; end if;
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
  if exists (select 1 from _prod where weight_g is not null and weight_g not between 1 and 100000) then
    raise exception 'Gramaj 1 ile 100.000 g arasında olmalı.';
  end if;
  perform check_expiry(expires_on, v_day) from _prod;

  -- lock the ingredients involved, then check there is enough of each
  perform 1 from ingredients i where i.id in (
    select ri.ingredient_id from recipe_items ri join _prod on _prod.id = ri.product_id) order by i.id for update;
  select string_agg(format('%s (%s %s lazım, %s var)', i.name, round(n.need, 3), i.unit, round(i.stock, 3)), ', ')
    into v_short
    from (select ri.ingredient_id, sum(ri.qty * _prod.qty) as need
          from recipe_items ri join _prod on _prod.id = ri.product_id group by ri.ingredient_id) n
    join ingredients i on i.id = n.ingredient_id
    where i.stock < n.need;
  if v_short is not null then raise exception 'Yetersiz malzeme: %', v_short; end if;

  insert into movements (business_id, kind, created_by, created_by_name, occurred_on)
    values (v_biz, 'production', auth.uid(), my_name(), v_day) returning id into v_mov;
  for r in select ri.ingredient_id as id, sum(ri.qty * _prod.qty) as need
           from recipe_items ri join _prod on _prod.id = ri.product_id group by ri.ingredient_id loop
    update ingredients set stock = stock - r.need where id = r.id;
    insert into movement_lines (movement_id, ingredient_id, qty) values (v_mov, r.id, -r.need);
  end loop;
  for r in select * from _prod order by id loop
    update products set stock = stock + r.qty where id = r.id;
    insert into movement_lines (movement_id, product_id, qty, expires_on, weight_g) values (v_mov, r.id, r.qty, r.expires_on, r.weight_g);
  end loop;
  return v_mov;
end $$;

drop function if exists public.receive_ingredient(uuid, numeric, text);
create or replace function public.receive_ingredient(
  p_ingredient uuid, p_qty numeric, p_note text default null, p_day date default null, p_expires date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mov uuid; v_biz uuid := my_business(); v_day date := movement_day(p_day);
begin
  if my_role() not in ('admin', 'employee') then raise exception 'Bu işlem için yetkin yok.'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Gelen miktarı yaz.'; end if;
  perform check_expiry(p_expires, v_day);
  update ingredients set stock = stock + p_qty where id = p_ingredient and business_id = v_biz and active;
  if not found then raise exception 'Malzeme bulunamadı.'; end if;
  insert into movements (business_id, kind, created_by, created_by_name, note, occurred_on)
    values (v_biz, 'receipt', auth.uid(), my_name(), nullif(trim(left(p_note, 300)), ''), v_day) returning id into v_mov;
  insert into movement_lines (movement_id, ingredient_id, qty, expires_on) values (v_mov, p_ingredient, p_qty, p_expires);
  return v_mov;
end $$;

-- Stock count: sets the counted amount; the line stores the difference.
create or replace function public.count_ingredient(p_ingredient uuid, p_counted numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mov uuid; v_biz uuid := my_business(); v_old numeric;
begin
  if my_role() is distinct from 'admin' then raise exception 'Bu işlem için yetkin yok.'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Sayılan miktarı yaz.'; end if;
  select stock into v_old from ingredients where id = p_ingredient and business_id = v_biz and active for update;
  if not found then raise exception 'Malzeme bulunamadı.'; end if;
  update ingredients set stock = p_counted where id = p_ingredient;
  insert into movements (business_id, kind, created_by, created_by_name)
    values (v_biz, 'count', auth.uid(), my_name()) returning id into v_mov;
  insert into movement_lines (movement_id, ingredient_id, qty) values (v_mov, p_ingredient, p_counted - v_old);
  return v_mov;
end $$;

create or replace function public.count_product(p_product uuid, p_counted numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mov uuid; v_biz uuid := my_business(); v_old numeric;
begin
  if my_role() is distinct from 'admin' then raise exception 'Bu işlem için yetkin yok.'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Sayılan miktarı yaz.'; end if;
  select stock into v_old from products where id = p_product and business_id = v_biz for update;
  if not found then raise exception 'Ürün bulunamadı.'; end if;
  update products set stock = p_counted where id = p_product;
  insert into movements (business_id, kind, created_by, created_by_name)
    values (v_biz, 'count', auth.uid(), my_name()) returning id into v_mov;
  insert into movement_lines (movement_id, product_id, qty) values (v_mov, p_product, p_counted - v_old);
  return v_mov;
end $$;

-- Batches whose expiry is within p_days (or past), newest receipt/production first.
-- Approximation: a batch counts until its expiry, whatever was sold from it.
create or replace function public.expiring_batches(p_days int default 3)
returns table (product_id uuid, ingredient_id uuid, qty numeric, expires_on date, occurred_on date)
language sql stable security invoker set search_path = public as $$
  select l.product_id, l.ingredient_id, l.qty, l.expires_on, m.occurred_on
  from movement_lines l join movements m on m.id = l.movement_id
  where m.business_id = my_business() and l.expires_on is not null and l.qty > 0
    and m.kind in ('receipt', 'production')
    and l.expires_on between today_tr() - 2 and today_tr() + greatest(0, least(p_days, 30))
  order by l.expires_on, m.occurred_on desc
$$;

-- ============================================================== FUNCTION ACCESS
revoke execute on function public.my_business(), public.my_role(), public.my_name(),
  public.today_tr(), public.movement_day(date), public.check_expiry(date, date),
  public.create_business(text, text, text), public.create_invite(), public.accept_invite(text, text),
  public.record_sale(jsonb, boolean), public.record_production(jsonb, date),
  public.receive_ingredient(uuid, numeric, text, date, date), public.count_ingredient(uuid, numeric),
  public.count_product(uuid, numeric), public.expiring_batches(int)
  from public, anon;
grant execute on function public.my_business(), public.my_role(), public.my_name(),
  public.today_tr(), public.movement_day(date), public.check_expiry(date, date),
  public.create_business(text, text, text), public.create_invite(), public.accept_invite(text, text),
  public.record_sale(jsonb, boolean), public.record_production(jsonb, date),
  public.receive_ingredient(uuid, numeric, text, date, date), public.count_ingredient(uuid, numeric),
  public.count_product(uuid, numeric), public.expiring_batches(int)
  to authenticated;
