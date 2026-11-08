import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const s = await getSession();
  const href = s.userId ? "/app" : "/login";

  return (
    <main className="wrap">
      <p style={{ margin: "18px 0 30px" }}><Wordmark size={28} /></p>
      <h1 style={{ fontSize: 34, lineHeight: 1.1 }}>Dükkânının stoğu cebinde.</h1>
      <p className="sub" style={{ margin: "10px 0 22px", fontSize: 18 }}>
        Satışı, üretimi ve malzemeyi kâğıda değil telefona yaz. Stok kendiliğinden tutulur, malzeme bitmeden haber verir.
      </p>
      <Link className="btn block" href={href}>{s.userId ? "Uygulamaya git" : "Ücretsiz başla"}</Link>

      <div className="card" style={{ marginTop: 22 }}>
        <h3>Herkes sadece kendi işini görür</h3>
        <div className="row"><span className="mid"><b>Tezgâh</b><small>Satılan ürüne dokunur, satış kaydedilir.</small></span></div>
        <div className="row"><span className="mid"><b>Mutfak</b><small>Üretimi girer, tarifteki malzemeler stoktan düşer.</small></span></div>
        <div className="row"><span className="mid"><b>Patron</b><small>Günün cirosunu, firesini ve azalan malzemeleri görür.</small></span></div>
      </div>
      <footer className="foot">Stokla · pastaneler ve küçük dükkânlar için stok takibi</footer>
    </main>
  );
}
