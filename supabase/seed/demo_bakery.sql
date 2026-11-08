-- Demo data for a bakery: catalog with recipes and weights, plus one day of activity
-- (morning production, deliveries with expiry dates, sales spread over the day, a little waste).
-- Run in the Supabase SQL editor. Set the business name below; it only fills an EMPTY business.
-- Stock math goes through the normal stock functions, acting as the business admin, so stock and
-- history stay consistent; only the timestamps are spread over the day afterwards.
do $$
declare
  c_business constant text := 'Kayhan Pastanesi';  -- <- the business to fill
  v_biz uuid; v_admin uuid; v_mov uuid;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_day0 timestamptz := ((now() at time zone 'Europe/Istanbul')::date)::timestamp at time zone 'Europe/Istanbul';
  v_at timestamptz;
begin
  select b.id, m.user_id into v_biz, v_admin
    from businesses b join members m on m.business_id = b.id and m.role = 'admin'
    where b.name = c_business limit 1;
  if v_biz is null then raise exception 'İşletme bulunamadı: %', c_business; end if;
  if exists (select 1 from products where business_id = v_biz) or exists (select 1 from ingredients where business_id = v_biz) then
    raise exception 'Bu işletmede zaten ürün ya da malzeme var; demo verisi sadece boş işletmeye yüklenir.';
  end if;

  -- catalog
  insert into ingredients (business_id, name, unit, stock, min_stock) values
    (v_biz, 'Un', 'kg', 45, 15),
    (v_biz, 'Toz şeker', 'kg', 18, 8),
    (v_biz, 'Pudra şekeri', 'kg', 4, 2),
    (v_biz, 'Tereyağı', 'kg', 9, 4),
    (v_biz, 'Margarin', 'kg', 6, 3),
    (v_biz, 'Yumurta', 'adet', 210, 60),
    (v_biz, 'Süt', 'L', 14, 10),
    (v_biz, 'Krema', 'L', 4.5, 5),
    (v_biz, 'Bitter çikolata', 'kg', 2.6, 3),
    (v_biz, 'Kakao', 'kg', 2, 1),
    (v_biz, 'Taze meyve', 'kg', 3.5, 2),
    (v_biz, 'Beyaz peynir', 'kg', 5, 2),
    (v_biz, 'Krem peynir', 'kg', 3, 2),
    (v_biz, 'Siyah zeytin', 'kg', 2.5, 1),
    (v_biz, 'Susam', 'kg', 3, 1),
    (v_biz, 'Maya', 'kg', 1.2, 0.5),
    (v_biz, 'Pekmez', 'kg', 4, 1);
  insert into products (business_id, name, unit, price, stock, min_stock, weight_g, sort) values
    (v_biz, 'Peynirli poğaça', 'adet', 25, 0, 15, 80, 0),
    (v_biz, 'Zeytinli poğaça', 'adet', 25, 0, 12, 80, 1),
    (v_biz, 'Açma', 'adet', 22, 0, 12, 90, 2),
    (v_biz, 'Simit', 'adet', 15, 0, 15, 100, 3),
    (v_biz, 'Su böreği', 'porsiyon', 90, 0, 6, 200, 4),
    (v_biz, 'Tuzlu kurabiye (250 g)', 'paket', 85, 10, 4, 250, 5),
    (v_biz, 'Un kurabiyesi (250 g)', 'paket', 90, 9, 4, 250, 6),
    (v_biz, 'Ekler', 'adet', 30, 0, 10, 60, 7),
    (v_biz, 'Profiterol', 'porsiyon', 120, 0, 4, 180, 8),
    (v_biz, 'Supangle', 'porsiyon', 90, 7, 4, 200, 9),
    (v_biz, 'Trileçe dilim', 'dilim', 100, 8, 4, 160, 10),
    (v_biz, 'Tiramisu dilim', 'dilim', 130, 6, 3, 140, 11),
    (v_biz, 'Cheesecake dilim', 'dilim', 140, 0, 4, 140, 12),
    (v_biz, 'Yaş pasta dilim', 'dilim', 110, 0, 6, 150, 13),
    (v_biz, 'Çikolatalı pasta', 'bütün', 950, 1, 2, 1200, 14),
    (v_biz, 'Meyveli pasta', 'bütün', 900, 1, 2, 1100, 15),
    (v_biz, 'Doğum günü pastası (8 kişilik)', 'bütün', 1250, 0, 1, 1600, 16);
  insert into recipe_items (product_id, ingredient_id, qty)
  select p.id, i.id, r.qty from (values
    ('Peynirli poğaça', 'Un', 0.045),
    ('Peynirli poğaça', 'Tereyağı', 0.008),
    ('Peynirli poğaça', 'Margarin', 0.006),
    ('Peynirli poğaça', 'Yumurta', 0.1),
    ('Peynirli poğaça', 'Süt', 0.015),
    ('Peynirli poğaça', 'Beyaz peynir', 0.015),
    ('Peynirli poğaça', 'Maya', 0.001),
    ('Zeytinli poğaça', 'Un', 0.045),
    ('Zeytinli poğaça', 'Tereyağı', 0.008),
    ('Zeytinli poğaça', 'Margarin', 0.006),
    ('Zeytinli poğaça', 'Yumurta', 0.1),
    ('Zeytinli poğaça', 'Süt', 0.015),
    ('Zeytinli poğaça', 'Siyah zeytin', 0.012),
    ('Zeytinli poğaça', 'Maya', 0.001),
    ('Açma', 'Un', 0.055),
    ('Açma', 'Margarin', 0.012),
    ('Açma', 'Toz şeker', 0.005),
    ('Açma', 'Süt', 0.02),
    ('Açma', 'Maya', 0.0015),
    ('Simit', 'Un', 0.07),
    ('Simit', 'Pekmez', 0.01),
    ('Simit', 'Susam', 0.012),
    ('Simit', 'Maya', 0.001),
    ('Su böreği', 'Un', 0.06),
    ('Su böreği', 'Yumurta', 0.6),
    ('Su böreği', 'Tereyağı', 0.03),
    ('Su böreği', 'Beyaz peynir', 0.05),
    ('Su böreği', 'Süt', 0.03),
    ('Tuzlu kurabiye (250 g)', 'Un', 0.12),
    ('Tuzlu kurabiye (250 g)', 'Margarin', 0.07),
    ('Tuzlu kurabiye (250 g)', 'Yumurta', 0.5),
    ('Tuzlu kurabiye (250 g)', 'Susam', 0.008),
    ('Un kurabiyesi (250 g)', 'Un', 0.12),
    ('Un kurabiyesi (250 g)', 'Tereyağı', 0.08),
    ('Un kurabiyesi (250 g)', 'Pudra şekeri', 0.05),
    ('Ekler', 'Un', 0.012),
    ('Ekler', 'Tereyağı', 0.008),
    ('Ekler', 'Yumurta', 0.3),
    ('Ekler', 'Krema', 0.025),
    ('Ekler', 'Bitter çikolata', 0.01),
    ('Profiterol', 'Un', 0.03),
    ('Profiterol', 'Tereyağı', 0.02),
    ('Profiterol', 'Yumurta', 0.8),
    ('Profiterol', 'Krema', 0.06),
    ('Profiterol', 'Bitter çikolata', 0.04),
    ('Profiterol', 'Süt', 0.08),
    ('Supangle', 'Süt', 0.2),
    ('Supangle', 'Kakao', 0.012),
    ('Supangle', 'Toz şeker', 0.03),
    ('Supangle', 'Un', 0.015),
    ('Supangle', 'Bitter çikolata', 0.01),
    ('Trileçe dilim', 'Un', 0.02),
    ('Trileçe dilim', 'Yumurta', 0.4),
    ('Trileçe dilim', 'Süt', 0.12),
    ('Trileçe dilim', 'Krema', 0.03),
    ('Trileçe dilim', 'Toz şeker', 0.025),
    ('Tiramisu dilim', 'Krem peynir', 0.06),
    ('Tiramisu dilim', 'Krema', 0.04),
    ('Tiramisu dilim', 'Yumurta', 0.3),
    ('Tiramisu dilim', 'Toz şeker', 0.02),
    ('Tiramisu dilim', 'Kakao', 0.004),
    ('Cheesecake dilim', 'Krem peynir', 0.09),
    ('Cheesecake dilim', 'Toz şeker', 0.02),
    ('Cheesecake dilim', 'Yumurta', 0.4),
    ('Cheesecake dilim', 'Krema', 0.025),
    ('Cheesecake dilim', 'Tereyağı', 0.01),
    ('Yaş pasta dilim', 'Un', 0.025),
    ('Yaş pasta dilim', 'Toz şeker', 0.025),
    ('Yaş pasta dilim', 'Yumurta', 0.5),
    ('Yaş pasta dilim', 'Krema', 0.05),
    ('Yaş pasta dilim', 'Taze meyve', 0.03),
    ('Yaş pasta dilim', 'Süt', 0.04),
    ('Çikolatalı pasta', 'Un', 0.25),
    ('Çikolatalı pasta', 'Toz şeker', 0.25),
    ('Çikolatalı pasta', 'Yumurta', 6),
    ('Çikolatalı pasta', 'Krema', 0.5),
    ('Çikolatalı pasta', 'Bitter çikolata', 0.3),
    ('Çikolatalı pasta', 'Süt', 0.3),
    ('Meyveli pasta', 'Un', 0.25),
    ('Meyveli pasta', 'Toz şeker', 0.25),
    ('Meyveli pasta', 'Yumurta', 6),
    ('Meyveli pasta', 'Krema', 0.6),
    ('Meyveli pasta', 'Taze meyve', 0.35),
    ('Meyveli pasta', 'Süt', 0.3),
    ('Doğum günü pastası (8 kişilik)', 'Un', 0.35),
    ('Doğum günü pastası (8 kişilik)', 'Toz şeker', 0.3),
    ('Doğum günü pastası (8 kişilik)', 'Yumurta', 8),
    ('Doğum günü pastası (8 kişilik)', 'Krema', 0.7),
    ('Doğum günü pastası (8 kişilik)', 'Taze meyve', 0.3),
    ('Doğum günü pastası (8 kişilik)', 'Süt', 0.4)
  ) as r(product, ingredient, qty)
  join products p on p.business_id = v_biz and p.name = r.product
  join ingredients i on i.business_id = v_biz and i.name = r.ingredient;

  -- act as the admin so the stock functions accept the calls
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_mov := receive_ingredient((select id from ingredients where business_id = v_biz and name = 'Süt'), 20, 'Sütçü', v_today - 0, v_today - 0 + 3);
  update movements set created_at = v_day0 - interval '0 days' + interval '6 hours 40 minutes' where id = v_mov;
  v_mov := receive_ingredient((select id from ingredients where business_id = v_biz and name = 'Krema'), 6, 'Toptancı', v_today - 1, v_today - 1 + 4);
  update movements set created_at = v_day0 - interval '1 days' + interval '6 hours 40 minutes' where id = v_mov;
  v_mov := receive_ingredient((select id from ingredients where business_id = v_biz and name = 'Taze meyve'), 3, 'Manav', v_today - 0, v_today - 0 + 2);
  update movements set created_at = v_day0 - interval '0 days' + interval '6 hours 40 minutes' where id = v_mov;
  v_mov := receive_ingredient((select id from ingredients where business_id = v_biz and name = 'Un'), 25, 'Toptancı', v_today - 2, null);
  update movements set created_at = v_day0 - interval '2 days' + interval '6 hours 40 minutes' where id = v_mov;
  v_mov := receive_ingredient((select id from ingredients where business_id = v_biz and name = 'Yumurta'), 120, 'Çiftlik', v_today - 1, v_today - 1 + 14);
  update movements set created_at = v_day0 - interval '1 days' + interval '6 hours 40 minutes' where id = v_mov;
  v_mov := record_production(jsonb_build_array(
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 60, 'expires_on', v_today + 2),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 40, 'expires_on', v_today + 2),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Açma'), 'qty', 40, 'expires_on', v_today + 2),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 50, 'expires_on', v_today + 1),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Su böreği'), 'qty', 12, 'expires_on', v_today + 2),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Ekler'), 'qty', 30, 'expires_on', v_today + 2),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Profiterol'), 'qty', 10, 'expires_on', v_today + 3),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Cheesecake dilim'), 'qty', 12, 'expires_on', v_today + 4),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Yaş pasta dilim'), 'qty', 16, 'expires_on', v_today + 3),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Çikolatalı pasta'), 'qty', 2, 'expires_on', v_today + 3),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Meyveli pasta'), 'qty', 2, 'expires_on', v_today + 2),
    jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Doğum günü pastası (8 kişilik)'), 'qty', 1, 'expires_on', v_today + 3)), v_today);
  update movements set created_at = v_day0 + interval '6 hours 30 minutes' where id = v_mov;
  v_at := v_day0 + interval '7 hours 14 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 4)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '7 hours 15 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '7 hours 43 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '8 hours 6 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Açma'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '8 hours 17 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Cheesecake dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '8 hours 22 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Yaş pasta dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '8 hours 24 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Profiterol'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '8 hours 37 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Trileçe dilim'), 'qty', 2), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '8 hours 53 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Tiramisu dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '9 hours 5 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Ekler'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '9 hours 10 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Trileçe dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '9 hours 13 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Ekler'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '9 hours 17 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '9 hours 43 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Yaş pasta dilim'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Tiramisu dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '10 hours 8 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Yaş pasta dilim'), 'qty', 2), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '10 hours 13 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Tuzlu kurabiye (250 g)'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '10 hours 25 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '11 hours 5 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Cheesecake dilim'), 'qty', 2), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Ekler'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '11 hours 40 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '11 hours 47 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Tiramisu dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '12 hours 24 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Cheesecake dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '12 hours 29 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Cheesecake dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '12 hours 43 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Profiterol'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Tiramisu dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '12 hours 49 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Trileçe dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '13 hours 1 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Açma'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Su böreği'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '13 hours 9 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Su böreği'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '13 hours 15 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Ekler'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '13 hours 32 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '14 hours 5 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '14 hours 13 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '14 hours 35 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '15 hours 7 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Açma'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Yaş pasta dilim'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Cheesecake dilim'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '15 hours 20 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Çikolatalı pasta'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '15 hours 21 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '15 hours 37 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Un kurabiyesi (250 g)'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '15 hours 45 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '16 hours 6 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 2), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 2), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Yaş pasta dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '16 hours 13 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '16 hours 25 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Profiterol'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '16 hours 27 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Cheesecake dilim'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '16 hours 32 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Ekler'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '16 hours 57 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '17 hours 10 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Trileçe dilim'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '17 hours 29 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 2), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Açma'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '17 hours 34 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Zeytinli poğaça'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Açma'), 'qty', 1)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '17 hours 51 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Peynirli poğaça'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '17 hours 57 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Supangle'), 'qty', 2), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Açma'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '18 hours 0 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Açma'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '18 hours 37 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Supangle'), 'qty', 1), jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Açma'), 'qty', 2)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '18 hours 44 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 4)), false);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '12 hours 5 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Simit'), 'qty', 3)), true);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;
  v_at := v_day0 + interval '17 hours 40 minutes';
  if v_at <= now() then
    begin  -- a sale that would exceed stock is simply skipped
      v_mov := record_sale(jsonb_build_array(jsonb_build_object('id', (select id from products where business_id = v_biz and name = 'Ekler'), 'qty', 2)), true);
      update movements set created_at = v_at where id = v_mov;
    exception when others then null;
    end;
  end if;

  raise notice 'Demo verisi yüklendi: %', c_business;
end $$;
