import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FuturesContract, MarketSession } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function fmtGBP(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function fmtUSD(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function fmtPct(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function fmtDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtShortDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function todayLocalIsoDate(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

export function toNum(v: number | string): number {
  return typeof v === "string" ? parseFloat(v) || 0 : v;
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

export function daysUntil(dateStr: string | undefined | null): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return Infinity;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

export function monthlyInterest(balance: number, apr: number): number {
  return (balance * (apr / 100)) / 12;
}

export function groupByFirm<T extends { description?: string; firm?: string }>(
  items: T[]
): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = item.description || item.firm || "Unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

export function groupByMonth<T extends { date: string }>(
  items: T[]
): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = item.date.slice(0, 7);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

export function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "funded") return "text-profit";
  if (s === "challenge") return "text-warn";
  if (s === "breached") return "text-loss";
  return "text-tx-2";
}

export function getStatusBg(status: string): string {
  const s = status.toLowerCase();
  if (s === "funded") return "bg-profit/10 text-profit border-profit/20";
  if (s === "challenge") return "bg-warn/10 text-warn border-warn/20";
  if (s === "breached") return "bg-loss/10 text-loss border-loss/20";
  return "bg-tx-4/50 text-tx-2 border-white/10";
}

export function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// UK Tax 2025/2026
export const UK_TAX = {
  PERSONAL_ALLOWANCE: 12570,
  BASIC_RATE_LIMIT: 50270,
  HIGHER_RATE_LIMIT: 125140,
  BASIC_RATE: 0.2,
  HIGHER_RATE: 0.4,
  ADDITIONAL_RATE: 0.45,
  NI_LOWER: 12570,
  NI_UPPER: 50270,
  NI_CLASS4_LOW: 0.09,
  NI_CLASS4_HIGH: 0.02,
  NI_CLASS2_WEEKLY: 3.45,
  TAX_YEAR: "2025/2026",
};

export function calcUKTax(income: number): {
  personalAllowance: number;
  taxableIncome: number;
  basicRateTax: number;
  higherRateTax: number;
  additionalRateTax: number;
  totalIncomeTax: number;
  ni: number;
  totalTax: number;
  effectiveRate: number;
} {
  const pa = Math.min(UK_TAX.PERSONAL_ALLOWANCE, income);
  const taxable = Math.max(0, income - pa);

  const basicBand = Math.max(0, Math.min(taxable, UK_TAX.BASIC_RATE_LIMIT - UK_TAX.PERSONAL_ALLOWANCE));
  const higherBand = Math.max(0, Math.min(taxable - basicBand, UK_TAX.HIGHER_RATE_LIMIT - UK_TAX.BASIC_RATE_LIMIT));
  const additionalBand = Math.max(0, taxable - basicBand - higherBand);

  const basicTax = basicBand * UK_TAX.BASIC_RATE;
  const higherTax = higherBand * UK_TAX.HIGHER_RATE;
  const additionalTax = additionalBand * UK_TAX.ADDITIONAL_RATE;
  const totalIncomeTax = basicTax + higherTax + additionalTax;

  // Class 4 NI (self-employed)
  const niLower = Math.max(0, Math.min(income, UK_TAX.NI_UPPER) - UK_TAX.NI_LOWER);
  const niUpper = Math.max(0, income - UK_TAX.NI_UPPER);
  const ni = niLower * UK_TAX.NI_CLASS4_LOW + niUpper * UK_TAX.NI_CLASS4_HIGH;

  const totalTax = totalIncomeTax + ni;
  const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;

  return {
    personalAllowance: pa,
    taxableIncome: taxable,
    basicRateTax: basicTax,
    higherRateTax: higherTax,
    additionalRateTax: additionalTax,
    totalIncomeTax,
    ni,
    totalTax,
    effectiveRate,
  };
}

// ---------------------------------------------------------------------------
// Futures contract specifications
// ---------------------------------------------------------------------------

export const FUTURES_CONTRACTS: FuturesContract[] = [
  {
    symbol: "ES",
    name: "E-mini S&P 500",
    exchange: "CME",
    tickSize: 0.25,
    tickValue: 12.5,
    pointValue: 50,
    contractMonths: "H, M, U, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
    microSymbol: "MES",
  },
  {
    symbol: "MES",
    name: "Micro E-mini S&P 500",
    exchange: "CME",
    tickSize: 0.25,
    tickValue: 1.25,
    pointValue: 5,
    contractMonths: "H, M, U, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
  },
  {
    symbol: "NQ",
    name: "E-mini Nasdaq-100",
    exchange: "CME",
    tickSize: 0.25,
    tickValue: 5,
    pointValue: 20,
    contractMonths: "H, M, U, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
    microSymbol: "MNQ",
  },
  {
    symbol: "MNQ",
    name: "Micro E-mini Nasdaq-100",
    exchange: "CME",
    tickSize: 0.25,
    tickValue: 0.5,
    pointValue: 2,
    contractMonths: "H, M, U, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
  },
  {
    symbol: "YM",
    name: "E-mini Dow ($5)",
    exchange: "CBOT",
    tickSize: 1,
    tickValue: 5,
    pointValue: 5,
    contractMonths: "H, M, U, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
    microSymbol: "MYM",
  },
  {
    symbol: "MYM",
    name: "Micro E-mini Dow",
    exchange: "CBOT",
    tickSize: 1,
    tickValue: 0.5,
    pointValue: 0.5,
    contractMonths: "H, M, U, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
  },
  {
    symbol: "RTY",
    name: "E-mini Russell 2000",
    exchange: "CME",
    tickSize: 0.1,
    tickValue: 5,
    pointValue: 50,
    contractMonths: "H, M, U, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
    microSymbol: "M2K",
  },
  {
    symbol: "M2K",
    name: "Micro E-mini Russell 2000",
    exchange: "CME",
    tickSize: 0.1,
    tickValue: 0.5,
    pointValue: 5,
    contractMonths: "H, M, U, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
  },
  {
    symbol: "CL",
    name: "Crude Oil",
    exchange: "NYMEX",
    tickSize: 0.01,
    tickValue: 10,
    pointValue: 1000,
    contractMonths: "All months",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
    microSymbol: "MCL",
  },
  {
    symbol: "MCL",
    name: "Micro WTI Crude Oil",
    exchange: "NYMEX",
    tickSize: 0.01,
    tickValue: 1,
    pointValue: 100,
    contractMonths: "All months",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
  },
  {
    symbol: "GC",
    name: "Gold",
    exchange: "COMEX",
    tickSize: 0.1,
    tickValue: 10,
    pointValue: 100,
    contractMonths: "G, J, M, Q, V, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
    microSymbol: "MGC",
  },
  {
    symbol: "MGC",
    name: "Micro Gold",
    exchange: "COMEX",
    tickSize: 0.1,
    tickValue: 1,
    pointValue: 10,
    contractMonths: "G, J, M, Q, V, Z",
    tradingHours: "Sun-Fri 6:00PM-5:00PM ET",
  },
];

// ---------------------------------------------------------------------------
// Market sessions (Eastern Time)
// ---------------------------------------------------------------------------

export const MARKET_SESSIONS: MarketSession[] = [
  { name: "Asia",     startET: "19:00", endET: "03:00", color: "#22d3ee" },
  { name: "London",   startET: "03:00", endET: "09:30", color: "#a78bfa" },
  { name: "New York", startET: "09:30", endET: "16:15", color: "#10f5a4" },
];

export function getEasternTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(date);

  const weekday =
    parts.find((p) => p.type === "weekday")?.value ?? "Sunday";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const second = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);
  const timeZoneName = parts.find((p) => p.type === "timeZoneName")?.value ?? "ET";

  const dayIndex = (
    { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }[weekday] ?? 0
  );

  return {
    weekday,
    dayIndex,
    hour,
    minute,
    second,
    minutes: hour * 60 + minute + second / 60,
    timeZoneName,
  };
}

/** Reliably extract Eastern Time h/m/s using Intl (DST-safe). */
export function getETMinutes(date: Date): number {
  return getEasternTimeParts(date).minutes;
}

export function getEasternTimeZoneAbbreviation(date: Date): string {
  return getEasternTimeParts(date).timeZoneName;
}

// Which days of the week (0=Sun…6=Sat) each session is valid to open on.
// Asia opens Sunday–Thursday evenings. London/NY open Monday–Friday mornings.
// Friday after ~17:00 ET is the CME weekly halt so Asia does NOT open Friday evenings.
const SESSION_VALID_DAYS: Record<string, number[]> = {
  "Asia":     [0, 1, 2, 3, 4], // Sun, Mon, Tue, Wed, Thu
  "London":   [1, 2, 3, 4, 5], // Mon–Fri
  "New York": [1, 2, 3, 4, 5], // Mon–Fri
};

/** Helper: get ET weekday as a day-index (0=Sun … 6=Sat). */
function getETDayIndex(date: Date): number {
  return getEasternTimeParts(date).dayIndex;
}

function isSessionActiveAt(session: MarketSession, date: Date): boolean {
  const { dayIndex, minutes } = getEasternTimeParts(date);
  const [startH, startM] = session.startET.split(":").map(Number);
  const [endH, endM] = session.endET.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const validDays = SESSION_VALID_DAYS[session.name] ?? [1, 2, 3, 4, 5];

  if (startMin > endMin) {
    if (minutes >= startMin) {
      return validDays.includes(dayIndex);
    }

    if (minutes < endMin) {
      const previousDay = (dayIndex + 6) % 7;
      return validDays.includes(previousDay);
    }

    return false;
  }

  return validDays.includes(dayIndex) && minutes >= startMin && minutes < endMin;
}

/**
 * Returns the currently active market session based on current Eastern Time,
 * or null if no session is active (weekends, CME halt, or gap between sessions).
 * Uses Intl for both weekday and time so DST (EST↔EDT) is handled automatically.
 */
export function getActiveSession(now: Date = new Date()): MarketSession | null {
  for (const session of MARKET_SESSIONS) {
    if (isSessionActiveAt(session, now)) {
      return session;
    }
  }

  return null;
}

/**
 * Returns the number of minutes until this session next opens,
 * correctly skipping weekends and the CME Friday halt.
 */
export function minutesUntilNextOpen(session: MarketSession, now: Date): number {
  const [sh, sm] = session.startET.split(":").map(Number);
  const sessionStartMin = sh * 60 + sm;

  const curDay = getETDayIndex(now);
  const curMin = getETMinutes(now);
  const validDays = SESSION_VALID_DAYS[session.name] ?? [1, 2, 3, 4, 5];

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidateDay = (curDay + daysAhead) % 7;
    if (!validDays.includes(candidateDay)) continue;
    // Skip if start time has already passed today
    if (daysAhead === 0 && sessionStartMin <= curMin) continue;
    // Total minutes = full days * 1440 + time-of-day difference
    return Math.max(0, daysAhead * 1440 + (sessionStartMin - curMin));
  }

  return 0;
}

export function formatMinutesAsLabel(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.ceil(totalMinutes));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function getNextMarketSession(now: Date = new Date()): MarketSession | null {
  const active = getActiveSession(now);
  if (active) {
    const activeIndex = MARKET_SESSIONS.findIndex((session) => session.name === active.name);
    if (activeIndex >= 0) {
      return MARKET_SESSIONS[(activeIndex + 1) % MARKET_SESSIONS.length];
    }
  }

  let nearest: MarketSession | null = null;
  let nearestMinutes = Number.POSITIVE_INFINITY;

  for (const session of MARKET_SESSIONS) {
    const openIn = minutesUntilNextOpen(session, now);
    if (openIn < nearestMinutes) {
      nearestMinutes = openIn;
      nearest = session;
    }
  }

  return nearest;
}

/**
 * Returns the next quarterly futures rollover date (second Friday of March, June, Sep, Dec).
 * Rollover months: H=Mar, M=Jun, U=Sep, Z=Dec
 */
export function getNextRolloverDate(): Date {
  const now = new Date();
  const rolloverMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (0-indexed)

  for (let offset = 0; offset < 5; offset++) {
    const candidate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const month = candidate.getMonth();

    if (!rolloverMonths.includes(month)) continue;

    // Find the second Friday of this month
    const firstDay = new Date(candidate.getFullYear(), month, 1);
    const dayOfWeek = firstDay.getDay(); // 0=Sun
    // Days until first Friday: (5 - dayOfWeek + 7) % 7
    const firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
    const secondFriday = firstFriday + 7;
    const rolloverDate = new Date(candidate.getFullYear(), month, secondFriday);

    if (rolloverDate > now) {
      return rolloverDate;
    }
  }

  // Fallback: next year March
  const nextYear = now.getFullYear() + 1;
  const firstDay = new Date(nextYear, 2, 1);
  const dayOfWeek = firstDay.getDay();
  const firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
  return new Date(nextYear, 2, firstFriday + 7);
}

/**
 * Calculate position size and risk for a futures trade.
 *
 * @param accountBalance  - Current account balance
 * @param riskPercent     - Percentage of account to risk (e.g. 1 for 1%)
 * @param entryPrice      - Planned entry price
 * @param stopLoss        - Stop-loss price
 * @param tickSize        - Minimum price increment for the contract
 * @param tickValue       - Dollar value of one tick
 * @returns Object with risk metrics
 */
export function calculateRisk(
  accountBalance: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number,
  tickSize: number,
  tickValue: number
): {
  riskAmount: number;
  stopDistance: number;
  ticksAtRisk: number;
  lossPerContract: number;
  maxContracts: number;
  actualRisk: number;
  actualRiskPercent: number;
} {
  const riskAmount = accountBalance * (riskPercent / 100);
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const ticksAtRisk = stopDistance / tickSize;
  const lossPerContract = ticksAtRisk * tickValue;
  const maxContracts = lossPerContract > 0 ? Math.floor(riskAmount / lossPerContract) : 0;
  const actualRisk = maxContracts * lossPerContract;
  const actualRiskPercent = accountBalance > 0 ? (actualRisk / accountBalance) * 100 : 0;

  return {
    riskAmount,
    stopDistance,
    ticksAtRisk,
    lossPerContract,
    maxContracts,
    actualRisk,
    actualRiskPercent,
  };
}
