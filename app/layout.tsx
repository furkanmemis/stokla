import type { Metadata, Viewport } from "next";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stokla", template: "%s · Stokla" },
  description: "Dükkânın stoğu cebinde: satış, üretim ve malzeme takibi telefondan.",
  icons: { icon: "/logo/stokla-ikon-32.png", apple: "/logo/stokla-ikon-192.png" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#1F1A17", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
