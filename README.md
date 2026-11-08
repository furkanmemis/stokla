<p align="center"><img src="public/logo/stokla-yatay.svg" alt="Stokla" width="320"></p>

# Stokla

Küçük işletmeler için **telefondan kullanılan, basit, rol odaklı stok takip sistemi**.
İlk hedef: kâğıda yazarak satış yapan bir pastane. Ardından kitapçı, kırtasiye ve benzeri dükkânlar.

> Durum: **fikir ve demo aşaması.** `demo/` klasöründe tek dosyalık, internet gerektirmeyen bir pastane demosu var.

## Demo

`demo/index.html` dosyasını telefonda ya da bilgisayarda tarayıcıyla aç. Veriler sadece o cihazda tutulur.

- **Tezgâh:** satılan ürüne dokun, satışı kaydet. Atılan ürünler için "Fire" modu.
- **Mutfak:** günlük üretimi gir. Tarifteki malzemeler stoktan kendiliğinden düşer.
- **Patron:** günlük ciro ve fire, azalan malzeme uyarıları, mal girişi ve sayım, tüm hareketler.

## Yapı: çekirdek + sektör modülleri

| Katman | İçerik |
|---|---|
| **Çekirdek** | Ürünler, stok giriş/çıkış, kullanıcılar ve roller, azalan stok uyarısı, raporlar. Her işletmenin verisi tamamen ayrı. |
| **Pastane modülü** | Tarif → malzeme (üretimde otomatik düşüm), günlük üretim, son kullanma tarihi, gün sonu fire. |
| **Kitapçı modülü** (sonra) | Barkod okutunca ISBN'den kitap bilgisi, yayınevine göre sipariş listesi, konsinye takibi. |

## Roller

Her kişi sadece kendi işini görür; bir işlem en fazla 3 dokunuş.

| Rol | Görür / yapar |
|---|---|
| Patron | Her şey, raporlar, kullanıcı ekleme, mal girişi, sayım |
| Tezgâh / Kasa | Satış ve fire |
| Mutfak / Üretim | Üretim ve malzeme kullanımı |
| Depo | Mal kabul ve sayım |

## Barkod planı (en ucuzdan)

1. **Telefon kamerası:** ek cihaz yok, tarayıcıdan okutulur.
2. **USB / Bluetooth el okuyucu:** klavye gibi çalışır, kurulum ve entegrasyon gerekmez.
3. **Termal etiket yazıcı:** pastanenin kendi ürünleri için sistemin ürettiği barkod etiketlerini basar.

## Teknik plan

- **Next.js** (telefona uygulama gibi kurulabilen web uygulaması, PWA), **Supabase** (veritabanı, giriş, satır düzeyi güvenlik ile işletme verilerinin ayrılması), **Vercel** (yayın).
- Arayüz metinleri Türkçe; kod, dosya adları ve kod yorumları İngilizce.
- KVKK: yalnızca işin gerektirdiği veri tutulur.

## Klasörler

```
demo/          tek dosyalık pastane demosu (HTML, internet gerekmez)
public/logo/   logo seti (SVG + ikon PNG'leri)
```

## Marka

- Ana renk `#F07A1A` · Koyu `#B65D14` · Açık `#F6AD71` · Mürekkep `#1F1A17` · Krem `#FFF8F1`
- Yazı tipi: Plus Jakarta Sans (SIL Open Font License)
