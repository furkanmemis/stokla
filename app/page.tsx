import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const s = await getSession();

  return (
    <main className="auth" style={{ alignItems: "start" }}>
      <div style={{ width: "100%", maxWidth: 880, display: "flex", flexDirection: "column", gap: 22, paddingTop: "4vh" }}>
        <Wordmark size={26} />
        <h1 style={{ margin: 0, fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.035em", fontWeight: 800, maxWidth: "16ch" }}>
          Dükkânının stoğu tek ekranda.
        </h1>
        <p className="lead" style={{ fontSize: 18 }}>
          Satışı, üretimi ve gelen malı kâğıda değil Stokla&apos;ya yaz. Stok kendiliğinden tutulur, malzeme ve son kullanma tarihi yaklaşınca uyarır.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {s.userId ? <Link className="btn" href="/app">Panele git</Link> : (
            <>
              <Link className="btn" href="/register">Ücretsiz kayıt ol</Link>
              <Link className="btn secondary" href="/login">Giriş yap</Link>
            </>
          )}
        </div>
        <div className="row">
          <section className="panel"><h2>Admin</h2><p className="lead">Günün satışını saat saat görür; ürünleri, tarifleri, sayımı ve ekibi yönetir.</p></section>
          <section className="panel"><h2>Çalışan</h2><p className="lead">Satışı fiş gibi girer, üretimi gramaj ve tarihiyle kaydeder, gelen malı stoğa ekler.</p></section>
        </div>
      </div>
    </main>
  );
}
