-- Demo places for a business that already has its catalog (products, ingredients, recipes) but no places:
-- two producing places, a main shop that also produces, two shops, and one day of activity.
--   * opening ingredient counts sized to the day's production (and coffee/tea supplies at the shops)
--   * morning production at both producing places, into the shared pool
--   * each shop takes its share from the pool onto its shelf; some stays in the pool
--   * sales spread over the day until now (a sale that would exceed the shelf is skipped)
-- Run in the Supabase SQL editor after setting the business name. Stock changes go through the normal
-- stock functions, acting as the business admin, so stock and history stay consistent.
do $$
declare
  c_business constant text := 'Örnek Pastane';  -- <- the business to fill
  v_biz uuid; v_admin uuid; v_mov uuid; v_at timestamptz;
  v_merkez uuid; v_atolye uuid; v_carsi uuid; v_sahil uuid;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_day0 timestamptz := ((now() at time zone 'Europe/Istanbul')::date)::timestamp at time zone 'Europe/Istanbul';
  v_shop uuid; v_events int; v_items jsonb; i int;
begin
  select b.id, m.user_id into v_biz, v_admin
    from businesses b join members m on m.business_id = b.id and m.role = 'admin'
    where b.name = c_business order by m.created_at limit 1;
  if v_biz is null then raise exception 'İşletme bulunamadı: %', c_business; end if;
  if exists (select 1 from locations where business_id = v_biz) then
    raise exception 'Bu işletmede zaten yer var; demo yerleri sadece yeri olmayan işletmeye yüklenir.';
  end if;
  perform setseed(0.42);  -- the same demo every time

  -- act as the admin so the stock functions accept the calls
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_merkez  := save_place(null, 'Merkez', true, true, 'Cumhuriyet Cad. 12');
  v_atolye  := save_place(null, 'Atölye', true, false, 'Sanayi Sitesi');
  v_carsi     := save_place(null, 'Çarşı Şube', false, true, null);
  v_sahil := save_place(null, 'Sahil Şube', false, true, null);

  -- today's plan: products with a recipe, made at both producing places
  create temporary table _plan on commit drop as
    select p.id, p.min_stock,
           greatest(6, ceil(p.min_stock * 2))::numeric as at_merkez,
           greatest(10, ceil(p.min_stock * 3))::numeric as at_sanayi
    from products p
    where p.business_id = v_biz and p.active and not p.made_to_order
      and exists (select 1 from recipe_items r where r.product_id = p.id);

  -- opening counts: enough for the plan plus a margin at each producing place
  perform count_ingredient(v_merkez, n.id, round(n.need_m * 1.3 + n.min_stock * 2, 3)),
          count_ingredient(v_atolye, n.id, round(n.need_s * 1.3 + n.min_stock * 2, 3))
    from (select i.id, i.min_stock, sum(r.qty * pl.at_merkez) as need_m, sum(r.qty * pl.at_sanayi) as need_s
          from ingredients i join recipe_items r on r.ingredient_id = i.id join _plan pl on pl.id = r.product_id
          where i.business_id = v_biz and i.active group by i.id, i.min_stock) n;
  -- coffee, tea and other made-to-order supplies live at every selling place
  perform count_ingredient(s.id, n.id, round(n.per_unit * 80 + n.min_stock * 2, 3))
    from (select i.id, i.min_stock, max(r.qty) as per_unit
          from ingredients i join recipe_items r on r.ingredient_id = i.id join products p on p.id = r.product_id
          where i.business_id = v_biz and i.active and p.made_to_order and p.active group by i.id, i.min_stock) n
    cross join (values (v_merkez), (v_carsi), (v_sahil)) as s(id);
  update movements set created_at = v_day0 + interval '6 hours' where business_id = v_biz and kind = 'count' and created_at > now() - interval '1 minute';

  -- morning production into the pool
  if not exists (select 1 from _plan) then raise exception 'Tarifi olan ürün yok; önce ürünlere tarif ekle.'; end if;
  v_mov := record_production(v_merkez, (select jsonb_agg(jsonb_build_object('id', id, 'qty', at_merkez, 'expires_on', v_today + 3)) from _plan), v_today);
  update movements set created_at = v_day0 + interval '6 hours 30 minutes' where id = v_mov;
  v_mov := record_production(v_atolye, (select jsonb_agg(jsonb_build_object('id', id, 'qty', at_sanayi, 'expires_on', v_today + 3)) from _plan), v_today);
  update movements set created_at = v_day0 + interval '6 hours 40 minutes' where id = v_mov;

  -- shelves fill from the pool: Merkez 35 %, Çarşı 30 %, Sahil 20 %; the rest stays in the pool
  create temporary table _start on commit drop as
    select product_id, qty from pool_products where business_id = v_biz and qty >= 1;
  foreach v_shop in array array[v_merkez, v_carsi, v_sahil] loop
    v_items := (select jsonb_agg(jsonb_build_object('id', product_id, 'qty', n)) from (
                 select product_id, floor(qty * case when v_shop = v_merkez then 0.35 when v_shop = v_carsi then 0.30 else 0.20 end) as n
                 from _start) x where n > 0);
    if v_items is not null then
      v_mov := take_from_pool(v_shop, v_items);
      update movements set created_at = v_day0 + interval '7 hours 15 minutes' where id = v_mov;
    end if;
  end loop;

  -- sales from 08:00 until now: 1-3 products per receipt, 1-2 of each
  foreach v_shop in array array[v_merkez, v_carsi, v_sahil] loop
    v_events := case when v_shop = v_merkez then 40 when v_shop = v_carsi then 30 else 18 end;
    for i in 1..v_events loop
      v_at := v_day0 + interval '8 hours' + (random() * interval '13 hours');
      continue when v_at > now();
      v_items := (select jsonb_agg(jsonb_build_object('id', id, 'qty', 1 + floor(random() * 2)))
                  from (select p.id from products p
                        left join stock_products s on s.product_id = p.id and s.location_id = v_shop
                        where p.business_id = v_biz and p.active and (p.made_to_order or s.qty > 0)
                        order by random() limit 1 + floor(random() * 3)::int) pick);
      continue when v_items is null;
      begin
        v_mov := record_sale(v_shop, v_items, false);
        update movements set created_at = v_at where id = v_mov;
      exception when others then null;
      end;
    end loop;
  end loop;

  raise notice 'Demo yerleri yüklendi: %', c_business;
end $$;
