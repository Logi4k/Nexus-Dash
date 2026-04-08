import { motion } from "framer-motion";
import AnimatedNumber from "@/components/AnimatedNumber";

// ── Framer Motion variant (matches Dashboard stagger) ────────────────────────
const item = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
export function KPICard({
  label, value, prefix = "£", decimals = 2,
  icon, color, sub, badge, onClick, sparkData,
}: {
  label: string; value: number; prefix?: string; decimals?: number;
  icon: React.ReactNode; color: string; sub?: string;
  badge?: React.ReactNode; onClick?: () => void; sparkData?: number[];
}) {
  const sparkId = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <motion.div variants={item}>
      {/* ── Mobile compact strip (< md) ── */}
      <div
        className="md:hidden flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:brightness-110"
        onClick={onClick}
        style={{
          background: `${color}0a`,
          border: `1px solid ${color}18`,
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <span className="text-[10px] uppercase tracking-wider font-bold flex-shrink-0" style={{ color: `${color}bb` }}>
          {label}
        </span>
        <span className="ml-auto text-sm font-black tabular-nums font-mono" style={{ color }}>
          {prefix}<AnimatedNumber value={value} prefix="" decimals={decimals} />
        </span>
        {badge && <span className="flex-shrink-0">{badge}</span>}
      </div>

      {/* ── Desktop full card (>= md) ── */}
      <div
        className="hidden md:block card p-5 h-full group relative overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:brightness-110"
        onClick={onClick}
        style={{ "--color": color } as React.CSSProperties}
      >
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <p className="section-label" style={{ color: "var(--color)" }}>{label}</p>
          <div
            className="p-2 rounded-xl transition-all duration-200 group-hover:scale-110"
            style={{ background: `${color}18`, color }}
          >
            {icon}
          </div>
        </div>

        {/* Value */}
        <div className="stat-display mb-2.5">
          {prefix}
          <AnimatedNumber value={value} prefix="" decimals={decimals} />
        </div>

        {/* Sub row */}
        <div className="flex items-center gap-2 relative z-10">
          {badge}
          {sub && <p className="text-xs text-tx-3 leading-tight">{sub}</p>}
        </div>

        {/* Sparkline */}
        {sparkData && sparkData.length > 1 && (() => {
          const W = 200, H = 40;
          const min = Math.min(...sparkData);
          const max = Math.max(...sparkData);
          const range = max - min || 1;
          const pts = sparkData.map((v, i) => [
            (i / (sparkData.length - 1)) * W,
            H - 4 - ((v - min) / range) * (H - 8),
          ]);
          const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
          const area = `${line} L ${W} ${H} L 0 ${H} Z`;
          return (
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none"
              style={{ height: 44, opacity: 0.55 }}
            >
              <svg width="100%" height="44" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`sg-${sparkId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill={`url(#sg-${sparkId})`} />
                <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Last point dot */}
                <circle
                  cx={pts[pts.length - 1][0].toFixed(1)}
                  cy={pts[pts.length - 1][1].toFixed(1)}
                  r="2.5" fill={color}
                />
              </svg>
            </div>
          );
        })()}

        {/* Accent bottom line */}
        <div
          className="absolute bottom-0 left-4 right-4 h-px rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }}
        />
      </div>
    </motion.div>
  );
}
