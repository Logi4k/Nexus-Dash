import { FUTURES_CONTRACTS } from "@/lib/utils";
import { bwColor } from "@/lib/useBWMode";
import { normalizeAccountStatus } from "@/lib/accountStatus";

export const INSTRUMENTS = ["ES", "NQ", "YM", "RTY", "CL", "GC", "MES", "MNQ", "MYM", "MCL", "MGC"];
export const PROFIT = "#22c55e";
export const LOSS = "#f87171";

const FIRM_FEES: Record<string, Record<string, number>> = {
  lucid: {
    ES: 1.75, MES: 0.50,
    NQ: 1.75, MNQ: 0.50,
    YM: 1.75, MYM: 0.50,
    RTY: 1.75, M2K: 0.50,
    CL: 2.00, MCL: 0.50,
    GC: 2.30, MGC: 0.80,
    SI: 2.30, PL: 2.30, HG: 2.30,
    DEFAULT: 1.75,
  },
  tradeify: {
    ES: 2.84, MES: 0.87,
    NQ: 2.84, MNQ: 0.87,
    YM: 2.84, MYM: 0.87,
    RTY: 2.84, M2K: 0.87,
    CL: 2.84, MCL: 1.02,
    GC: 1.02, MGC: 1.02,
    DEFAULT: 1.74,
  },
};

export function getFeePerSide(firm: string, instrument: string): number {
  const table = FIRM_FEES[firm];
  if (!table) return 0;
  return table[instrument] ?? table.DEFAULT ?? 0;
}

export const POINT_VALUE: Record<string, number> = Object.fromEntries(
  FUTURES_CONTRACTS.map((c) => [c.symbol, c.pointValue])
);

const INSTRUMENT_COLOR: Record<string, string> = {
  ES: "#5b7fa3", NQ: "#8b7da3", YM: "#c49060", RTY: "#5aadaa",
  MES: "#5b7fa3", MNQ: "#8b7da3", MYM: "#c49060",
  CL: "#d4a84a", MCL: "#d4a84a",
  GC: "#b8a040", MGC: "#b8a040",
};

export const getInstrumentColor = (s: string) => INSTRUMENT_COLOR[s] ?? "#60a5fa";

export function fmtDisplayDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export function fmtShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function prevDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function nextDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function lastNDays(anchor: string, n: number): string[] {
  const days: string[] = [];
  const d = new Date(anchor + "T00:00:00");
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    days.push(dd.toISOString().slice(0, 10));
  }
  return days;
}

export const DRAFT_KEY = "nexus_trade_draft";
export const CUSTOM_INSTRUMENTS_KEY = "nexus_custom_instruments";

export function loadCustomInstruments(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_INSTRUMENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch { return []; }
}

export function saveCustomInstrument(name: string): void {
  const trimmed = name.trim().toUpperCase();
  if (!trimmed) return;
  const current = loadCustomInstruments();
  if (current.includes(trimmed)) return;
  localStorage.setItem(CUSTOM_INSTRUMENTS_KEY, JSON.stringify([...current, trimmed]));
}

export function deleteCustomInstrument(name: string): void {
  const current = loadCustomInstruments();
  localStorage.setItem(CUSTOM_INSTRUMENTS_KEY, JSON.stringify(current.filter((i) => i !== name)));
}

export const CUSTOM_SESSIONS_KEY = "nexus_custom_sessions";

export function loadCustomSessions(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch { return []; }
}

export function saveCustomSession(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = loadCustomSessions();
  if (current.includes(trimmed)) return;
  localStorage.setItem(CUSTOM_SESSIONS_KEY, JSON.stringify([...current, trimmed]));
}

export function deleteCustomSession(name: string): void {
  const current = loadCustomSessions();
  localStorage.setItem(CUSTOM_SESSIONS_KEY, JSON.stringify(current.filter((s) => s !== name)));
}

export const CUSTOM_FIRMS_KEY = "nexus_custom_firms";

export function loadCustomFirms(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FIRMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch { return []; }
}

export function saveCustomFirm(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = loadCustomFirms();
  if (current.includes(trimmed)) return;
  localStorage.setItem(CUSTOM_FIRMS_KEY, JSON.stringify([...current, trimmed]));
}

export function deleteCustomFirm(name: string): void {
  const current = loadCustomFirms();
  localStorage.setItem(CUSTOM_FIRMS_KEY, JSON.stringify(current.filter((f) => f !== name)));
}

export const CUSTOM_CATS_KEY = "nexus_custom_cats";

export function loadCustomCats(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CATS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch { return []; }
}

export function saveCustomCat(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = loadCustomCats();
  if (current.includes(trimmed)) return;
  localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify([...current, trimmed]));
}

export function deleteCustomCat(name: string): void {
  const current = loadCustomCats();
  localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(current.filter((c) => c !== name)));
}

export type LightboxState = {
  images: string[];
  index: number;
};

export function emptyTradeForm() {
  return {
    date: todayISO(),
    time: new Date().toTimeString().slice(0, 5),
    instrument: "ES",
    customInstrument: "",
    direction: "long" as "long" | "short",
    entryPrice: "",
    stopLoss: "",
    exitPrice: "",
    contracts: "1",
    pnl: "",
    fees: "",
    setup: "",
    session: "New York",
    customSession: "",
    notes: "",
    tags: [] as string[],
    firm: "" as "" | "lucid" | "tradeify",
    accountId: undefined as string | undefined,
  };
}

export function getAccountPhaseColor(status: string | undefined, isBW: boolean): string {
  const phase = normalizeAccountStatus(status);
  if (phase === "funded") return bwColor("#22c55e", isBW);
  if (phase === "challenge") return bwColor("#d4a84a", isBW);
  if (phase === "breached") return bwColor(LOSS, isBW);
  return "var(--tx-3)";
}

export function getTradePhaseLabel(phase: "challenge" | "funded" | undefined | null): string | null {
  if (!phase) return null;
  return phase === "funded" ? "Funded" : "Challenge";
}

export function getTradePhaseColors(phase: "challenge" | "funded" | undefined | null, bw: boolean) {
  const text = phase === "funded" ? bwColor("#22c55e", bw) : bwColor("#d4a84a", bw);
  const background = phase === "funded"
    ? bwColor("rgba(34,197,94,0.10)", bw)
    : bwColor("rgba(212,168,74,0.14)", bw);
  const border = phase === "funded"
    ? bwColor("rgba(34,197,94,0.22)", bw)
    : bwColor("rgba(212,168,74,0.28)", bw);
  return { text, background, border };
}
