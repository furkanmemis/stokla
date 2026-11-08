import Link from "next/link";
import { Wordmark } from "./Logo";

/** Shared frame for the sign-in, sign-up and password screens. */
export function AuthCard({ title, intro, children, footer }: {
  title: string; intro?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <main className="auth">
      <div className="auth-card">
        <Link href="/" className="brand" style={{ color: "var(--ink)" }} aria-label="Stokla ana sayfa"><Wordmark size={24} /></Link>
        <h1>{title}</h1>
        {intro && <p style={{ marginTop: 0 }}>{intro}</p>}
        {children}
        {footer && <div className="auth-foot">{footer}</div>}
      </div>
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
