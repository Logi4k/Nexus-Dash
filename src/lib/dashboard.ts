import type { MarketSession } from "@/types";
import {
  formatMinutesAsLabel,
  getETMinutes,
  getEasternTimeParts,
  minutesUntilNextOpen,
} from "@/lib/utils";

export const PROFIT = "#22c55e";
export const LOSS = "#f87171";
export const WARN = "#d97706";

export const ACCENT_RAW = "#c4a06b";
export const PURPLE_RAW = "#8f88aa";
export const BLUE_RAW = "#7f99ac";
export const ORANGE_RAW = "#b98966";

export function sessionProgress(s: MarketSession, now: Date): number {
  const cur = getETMinutes(now);
  const [sh, sm] = s.startET.split(":").map(Number);
  const [eh, em] = s.endET.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const total = end > start ? end - start : 1440 - start + end;
  const elapsed = end > start ? cur - start : cur >= start ? cur - start : 1440 - start + cur;
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

export function sessionCountdown(s: MarketSession, now: Date): string {
  const { hour, minute, second } = getEasternTimeParts(now);
  const totalSec = hour * 3600 + minute * 60 + second;
  const [eh, em] = s.endET.split(":").map(Number);
  const endSec = eh * 3600 + em * 60;
  const rem = endSec > totalSec ? endSec - totalSec : 86400 - totalSec + endSec;
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function opensInLabel(session: MarketSession, now: Date): string {
  return formatMinutesAsLabel(minutesUntilNextOpen(session, now));
}
