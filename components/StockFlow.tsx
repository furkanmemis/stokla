// Illustration of how stock moves in Stokla, shown beside the sign-in forms.
// Pure SVG: the connectors' dashes drift along the flow (still for people who prefer less motion).

type Node = { x: number; y: number; w: number; title: string; sub: string; icon: string; accent?: boolean };

const ICON: Record<string, string> = {
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  oven: "M4 20h16M6 20V10l6-4 6 4v10M10 20v-5h4v5",
  shelf: "M4 5h16v4H4zM6 9v10h12V9M10 13h4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
};

const H = 78;
const NODES: Record<string, Node> = {
  receive: { x: 20, y: 24, w: 230, title: "Mal girişi", sub: "Alış tarihi ve SKT ile", icon: "truck" },
  produce: { x: 310, y: 24, w: 230, title: "Üretim", sub: "Tarif malzemeyi düşer", icon: "oven" },
  pool: { x: 150, y: 196, w: 260, title: "Ürün havuzu", sub: "Üretilen her şey burada", icon: "pool", accent: true },
  shelfA: { x: 20, y: 368, w: 230, title: "Merkez vitrini", sub: "Havuzdan alınır", icon: "shelf" },
  shelfB: { x: 310, y: 368, w: 230, title: "Şube vitrini", sub: "Her yerin kendi stoğu", icon: "shelf" },
  sale: { x: 150, y: 540, w: 260, title: "Satış", sub: "Fiş, ciro, fire, rapor", icon: "receipt" },
};

const mid = (n: Node) => n.x + n.w / 2;
const PATHS = [
  `M250 ${24 + H / 2} H310`,
  `M${mid(NODES.produce)} ${24 + H} V150 Q${mid(NODES.produce)} 170 ${mid(NODES.produce) - 20} 170 H${mid(NODES.pool) + 20} Q${mid(NODES.pool)} 170 ${mid(NODES.pool)} 196`,
  `M${mid(NODES.pool)} ${196 + H} V320 Q${mid(NODES.pool)} 340 ${mid(NODES.pool) - 20} 340 H${mid(NODES.shelfA) + 20} Q${mid(NODES.shelfA)} 340 ${mid(NODES.shelfA)} 368`,
  `M${mid(NODES.pool)} ${196 + H} V320 Q${mid(NODES.pool)} 340 ${mid(NODES.pool) + 20} 340 H${mid(NODES.shelfB) - 20} Q${mid(NODES.shelfB)} 340 ${mid(NODES.shelfB)} 368`,
  `M${mid(NODES.shelfA)} ${368 + H} V492 Q${mid(NODES.shelfA)} 512 ${mid(NODES.shelfA) + 20} 512 H${mid(NODES.sale) - 20} Q${mid(NODES.sale)} 512 ${mid(NODES.sale)} 540`,
  `M${mid(NODES.shelfB)} ${368 + H} V492 Q${mid(NODES.shelfB)} 512 ${mid(NODES.shelfB) - 20} 512 H${mid(NODES.sale) + 20} Q${mid(NODES.sale)} 512 ${mid(NODES.sale)} 540`,
];

function Box({ n }: { n: Node }) {
  return (
    <g transform={`translate(${n.x} ${n.y})`}>
      <rect width={n.w} height={H} rx="18" fill={n.accent ? "#3A2A1C" : "#2A2420"} stroke={n.accent ? "#F07A1A" : "#463D37"} strokeWidth={n.accent ? 2 : 1.5} />
      {n.icon === "pool" ? (
        <g transform="translate(18 17) scale(0.37)">
          <rect x="12" y="62" width="46" height="46" rx="7" fill="#F07A1A" />
          <rect x="62" y="62" width="46" height="46" rx="7" fill="#B65D14" />
          <rect x="37" y="12" width="46" height="46" rx="7" fill="#F07A1A" />
        </g>
      ) : (
        <g transform="translate(18 17)">
          <circle cx="22" cy="22" r="22" fill="#F07A1A" fillOpacity=".16" />
          <g transform="translate(10 10)">
            <path d={ICON[n.icon]} fill="none" stroke="#F6AD71" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      )}
      <text x="76" y="35" fill="#FFF8F1" fontSize="18" fontWeight="800">{n.title}</text>
      <text x="76" y="57" fill="#B9AEA6" fontSize="13.5" fontWeight="500">{n.sub}</text>
    </g>
  );
}

export function StockFlow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 560 640" role="img"
      aria-label="Stok akışı: mal girişi ve üretim, ürün havuzu, yerlerin vitrinleri, satış">
      <g fill="none" stroke="#F07A1A" strokeWidth="2.5" strokeLinecap="round">
        {PATHS.map((d, i) => <path key={i} d={d} className="flow-line" style={{ animationDelay: `${i * -0.4}s` }} />)}
      </g>
      {Object.values(NODES).map((n) => <Box key={n.title} n={n} />)}
    </svg>
  );
}
