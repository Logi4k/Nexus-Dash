import type { ReactNode } from "react";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";

const item = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/** Dashboard KPI tile — same shell as Prop `StatCard` (accent wash, icon pill, stat num). */
export function KPICard({
  label, value, prefix = "£", decimals = 2,
  icon, color, sub, badge, onClick, sparkData, renderValue,
}: {
  label: string; value: number; prefix?: string; decimals?: number;
  icon: ReactNode; color: string; sub?: string;
  badge?: ReactNode; onClick?: () => void; sparkData?: number[];
  /** When set, replaces the animated number (e.g. liability formatting for debt). */
  renderValue?: ReactNode;
}) {
  return (
    <motion.div variants={item} className="min-w-0 h-full">
      <StatCard
        label={label}
        value={value}
        prefix={prefix}
        decimals={decimals}
        icon={icon}
        accentColor={color}
        subLabel={sub}
        badge={badge}
        onClick={onClick}
        sparkData={sparkData}
        renderValue={renderValue}
        className="h-full"
      />
    </motion.div>
  );
}
