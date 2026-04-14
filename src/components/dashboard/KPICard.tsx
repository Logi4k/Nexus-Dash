import { motion } from "framer-motion";
import AnimatedNumber from "@/components/AnimatedNumber";
import { Card, CardHeader, CardDescription, CardTitle, CardContent } from "@/components/ui/card";

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

  const content = (
    <Card
      className={`h-full flex flex-col min-h-0 ${onClick ? "cursor-pointer hover:brightness-110" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <div
            className="rounded-lg p-1.5"
            style={{ background: `${color}18`, color }}
          >
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p
          className="text-[22px] sm:text-[26px] font-bold tabular-nums leading-none font-mono"
          style={{ color, letterSpacing: "-0.02em" }}
        >
          {prefix}<AnimatedNumber value={value} prefix="" decimals={decimals} />
        </p>
        <div className="flex items-center gap-2 mt-auto pt-3">
          {badge}
          {sub && <p className="text-[11px] text-tx-4 leading-tight truncate">{sub}</p>}
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
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: 44, opacity: 0.4 }}>
              <svg width="100%" height="44" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`sg-${sparkId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill={`url(#sg-${sparkId})`} />
                <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );

  return (
    <motion.div variants={item} className="min-w-0 h-full">
      {content}
    </motion.div>
  );
}
