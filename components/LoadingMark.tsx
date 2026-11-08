/**
 * Loading state: the Stokla mark builds itself box by box, like stock being stacked.
 * Pure CSS animation; it stays still for people who prefer less motion.
 */
export function LoadingMark({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <svg className="loading-mark" width="72" height="72" viewBox="0 0 120 120" aria-hidden="true">
        <g className="box b1"><rect x="12" y="62" width="46" height="46" rx="7" fill="#F07A1A" /><rect x="29" y="62" width="12" height="16" fill="#F6AD71" /></g>
        <g className="box b2"><rect x="62" y="62" width="46" height="46" rx="7" fill="#B65D14" /><rect x="79" y="62" width="12" height="16" fill="#F6AD71" fillOpacity=".75" /></g>
        <g className="box b3"><rect x="37" y="12" width="46" height="46" rx="7" fill="#F07A1A" /><rect x="54" y="12" width="12" height="16" fill="#F6AD71" /></g>
      </svg>
      <span className="loading-text">{label}</span>
    </div>
  );
}
