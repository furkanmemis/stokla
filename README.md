<p align="center"><img src="public/logo/stokla-yatay.svg" alt="Stokla" width="320"></p>

# Stokla

Küçük işletmeler için **telefondan kullanılan, basit, rol odaklı stok takip sistemi**.
İlk hedef: kâğıda yazarak satış yapan bir pastane. Ardından kitapçı, kırtasiye ve benzeri dükkânlar.

## Ne yapıyor?

| Rol | Ekranlar |
|---|---|
| **Admin** | Genel bakış (tüm yerler: saat saat satış, yer yer ciro, azalan stok, son kullanma yaklaşanlar), Satış, Üretim, Ürün havuzu, Stok (mal girişi ve sayım), Ürünler ve tarifler, Yerler, Ekip, Hareketler |
| **Çalışan** | Sadece çalıştığı yerin ekranları: satış yeriyse Satış ve fire; üretim yeriyse Üretim (tarih, gramaj, son kullanma); ikisinde de Ürün havuzu ve Stok (mal girişi) |

- **Yerler (şube / bayi):** bir yer üretim yapar, satış yapar ya da ikisini birden. Her yerin malzeme stoğu ayrıdır.
- **Ürün havuzu:** hangi yerde üretilirse üretilsin, ürünler ortak havuza girer. Satış yapan yerler vitrinlerine havuzdan alır; satış vitrinden düşer. Kahve, çay gibi siparişle hazırlananlar satış yerinin kendi malzemesinden düşer.
- Admin çalışanı **ad, e-posta ve yer** girerek ekler; çalışan o e-postayla kayıt olunca kod girmeden o yere bağlanır. İsterse **6 haneli davet kodu** da verebilir.
- Stok yalnızca hareketlerle değişir (satış, fire, üretim, havuzdan alma, mal girişi, sayım). Her hareket tek işlemde kaydedilir; stok ve geçmiş hiçbir zaman çelişmez.
- Mal girişinde alış tarihi, üretimde üretim tarihi girilir (geçmiş bir gün olabilir); ikisinde de son kullanma tarihi isteğe bağlıdır. Üretimde her partinin gramajı kaydedilir.
- Her dükkânın verisi veritabanı düzeyinde (RLS) diğerlerinden ayrıdır.
- Panel telefona, tablete ve bilgisayara uyar.

## Teknoloji

- **Next.js 15** (App Router, server actions) · **Supabase** (PostgreSQL, giriş, RLS) · **Vercel**
- Telefona uygulama gibi eklenebilir (web app manifest).
- Giriş: e-posta ve şifre. Kayıtta e-posta doğrulaması, "Şifremi unuttum" ile e-postaya sıfırlama bağlantısı.

## Kurulum

1. Supabase'de yeni proje aç (bölge: **Frankfurt / eu-central-1**).
2. **SQL Editor**'de `supabase/schema.sql` dosyasının tamamını çalıştır. Tekrar çalıştırmak güvenlidir; şema değiştiğinde aynı dosyayı yeniden çalıştırmak yeterli.
3. **Authentication → URL Configuration**: Site URL'yi sitenin adresi yap; Redirect URLs'e `https://ADRES/**` ekle (geliştirirken `http://localhost:3000/**`). Kayıt doğrulama ve şifre sıfırlama bağlantıları `/auth/callback` üzerinden döner.
4. `.env.example` dosyasını `.env.local` olarak kopyala; Supabase **Project URL** ve **publishable (anon) key** değerlerini yaz. Secret / service_role anahtarı hiçbir yere yazılmaz.
5. `npm install` ve `npm run dev`.

Demo için:
- `supabase/seed/demo_bakery.sql`: boş bir işletmeye ürünleri, tarifleri, "Merkez" adında bir yeri ve bir günlük örnek hareketleri yükler.
- `supabase/seed/demo_places.sql`: ürünleri olan ama yeri olmayan bir işletmeye iki üretim yeri, iki bayi ve bir günlük üretim, havuz ve satış hareketlerini yükler.

İkisinde de dosyanın başındaki işletme adını değiştirip SQL Editor'de çalıştır.

Vercel'de aynı iki ortam değişkenini (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) tanımla.

## Testler

```bash
npm test                 # domain rules (vitest)
npx tsc --noEmit         # types
npx next build           # production build

# database rules, against a throwaway local PostgreSQL (never on Supabase):
psql -v ON_ERROR_STOP=1 -d stokla_test \
  -f supabase/tests/supabase_stub.sql -f supabase/schema.sql -f supabase/tests/rules_test.sql
```

## Klasörler

```
app/                 pages (routes) and server actions
  _actions/auth.ts       login, sign-out, create / join a business
  app/_actions/          stock movements, catalog, team (one file per responsibility)
  app/<screen>/          overview, sales, production, pool, stock, catalog, places, team, movements
components/          client UI (sale screen with receipt, production form, stock screen, navigation)
lib/domain/          pure business rules + tests (stock, places, pool, dates, auth, paging; no I/O)
lib/                 session, Supabase client, form helpers, types, sample bakery data
supabase/            schema.sql (tables, RLS, stock functions), SQL tests, seed/ (demo data)
public/logo/         logo set
demo/                single-file offline demo (no backend)
```

## Barkod planı (en ucuzdan)

1. **Telefon kamerası:** ek cihaz yok, tarayıcıdan okutulur.
2. **USB / Bluetooth el okuyucu:** klavye gibi çalışır, kurulum ve entegrasyon gerekmez.
3. **Termal etiket yazıcı:** pastanenin kendi ürünleri için sistemin ürettiği barkod etiketlerini basar.

## Marka

- Ana renk `#F07A1A` · Koyu `#B65D14` · Açık `#F6AD71` · Mürekkep `#1F1A17` · Krem `#FFF8F1`
- Yazı tipi: Plus Jakarta Sans (SIL Open Font License)
