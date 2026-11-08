/** The Stokla mark (three stacked boxes). Decorative unless a label is given. */
export function Mark({ size = 30, label }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flexShrink: 0 }}>
      <rect x="12" y="62" width="46" height="46" rx="7" fill="#F07A1A" />
      <rect x="62" y="62" width="46" height="46" rx="7" fill="#B65D14" />
      <rect x="37" y="12" width="46" height="46" rx="7" fill="#F07A1A" />
      <rect x="29" y="62" width="12" height="16" fill="#F6AD71" />
      <rect x="79" y="62" width="12" height="16" fill="#F6AD71" fillOpacity=".75" />
      <rect x="54" y="12" width="12" height="16" fill="#F6AD71" />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.35 }}>
      <Mark size={size * 1.35} />
      <b style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.035em" }}>Stokla</b>
    </span>
  );
}
