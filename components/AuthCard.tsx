import Link from "next/link";
import { Mark } from "./Logo";
import { StockFlow } from "./StockFlow";

/**
 * Shared frame for the sign-in, sign-up and password screens: the stock flow on the left,
 * the form on the right (stacked on phones, with the flow kept short).
 */
export function AuthCard({ title, intro, children, footer }: {
  title: string; intro?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <main className="auth-split">
      <section className="auth-art" aria-label="Stokla nasıl çalışır">
        <Link href="/" className="auth-brand" aria-label="Stokla ana sayfa"><Mark size={38} /><b>Stokla</b></Link>
        <div className="auth-pitch">
          <h2>Kâğıt defteri bırakın. Stok kendini tutsun.</h2>
          <p>Mal girişinden satışa kadar her adım tek yerde. Üretilen ürün havuza, havuzdan vitrine, vitrinden fişe.</p>
        </div>
        <StockFlow className="auth-flow" />
        <ul className="auth-points">
          <li>Her yerin ayrı stoğu</li>
          <li>Telefon ve bilgisayar</li>
          <li>Admin ve çalışan</li>
        </ul>
      </section>
      <section className="auth-side">
        <div className="auth-card">
          <h1>{title}</h1>
          {intro && <p style={{ marginTop: 0 }}>{intro}</p>}
          {children}
          {footer && <div className="auth-foot">{footer}</div>}
        </div>
      </section>
    </main>
  );
}

/** Hidden field that only bots fill in. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="sr-only">
      <label htmlFor="website">Web sitesi</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
