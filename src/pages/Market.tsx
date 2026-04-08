import { useState, useEffect, useMemo } from "react";
import { PAGE_THEMES } from "@/lib/theme";
import {
  Globe,
  Clock,
  Calendar,
  FileText,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Info,
  Timer,
  ArrowUpDown,
  StickyNote,
  Zap,
  Target,
  RefreshCw,
  WifiOff,
  Newspaper,
  ExternalLink,
} from "lucide-react";
import { useAppData } from "@/lib/store";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import type { AppData } from "@/types";
import {
  cn,
  formatMinutesAsLabel,
  FUTURES_CONTRACTS,
  MARKET_SESSIONS,
  getActiveSession,
  getETMinutes,
  getEasternTimeZoneAbbreviation,
  getLocalTimeZoneAbbreviation,
  getNextMarketSession,
  getNextRolloverDate,
  minutesUntilNextOpen,
  calculateRisk,
} from "@/lib/utils";
import Modal from "@/components/Modal";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import CustomSelect from "@/components/CustomSelect";
import type { MarketSession } from "@/types";
import { tauriFetch } from "@/lib/tauriFetch";
import { open as tauriOpen } from "@tauri-apps/plugin-shell";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  name: string;
  impact: "high" | "medium" | "low";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXCHANGE_COLORS: Record<string, string> = {
  CME:   "#5b8bbf",
  NYMEX: "#c49060",
  COMEX: "#fbbf24",
  CBOT:  "#9b8ec2",
};

// ---------------------------------------------------------------------------
// Forex Factory Calendar types + constants
// ---------------------------------------------------------------------------

interface FFEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
}

interface FFCalendarCacheEntry {
  cachedAt: number;
  events: FFEvent[];
}

const FF_IMPACT: Record<string, { color: string; bg: string; border: string; label: string }> = {
  High:   { color: "#f87171", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",  label: "H" },
  Medium: { color: "var(--color-warn)", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", label: "M" },
  Low:    { color: "#64748b", bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.15)", label: "L" },
};

const COUNTRY_FLAG: Record<string, string> = {
  USD: "🇺🇸", GBP: "🇬🇧", EUR: "🇪🇺", JPY: "🇯🇵",
  AUD: "🇦🇺", CAD: "🇨🇦", CHF: "🇨🇭", NZD: "🇳🇿",
};

const FF_CACHE_PREFIX = "nexus.ff_calendar";
const FF_CACHE_TTL_MS = 1000 * 60 * 30;
const FF_RATE_LIMIT_COOLDOWN_MS = 1000 * 60 * 5;
const ffInFlightLoads: Partial<Record<"this" | "next", Promise<FFEvent[]>>> = {};
const ffRateLimitedUntil: Partial<Record<"this" | "next", number>> = {};

const NEWS_SOURCES_PROXY = [
  { id: "forexlive", label: "ForexLive", url: "/rss/forexlive" },
  { id: "fxstreet",  label: "FX Street",  url: "/rss/fxstreet"  },
] as const;

const NEWS_SOURCES_DIRECT = [
  { id: "forexlive", label: "ForexLive", url: "https://www.forexlive.com/feed/news" },
  { id: "fxstreet",  label: "FX Street",  url: "https://www.fxstreet.com/rss/news"  },
] as const;

const NEWS_SOURCES = isTauri ? NEWS_SOURCES_DIRECT : NEWS_SOURCES_PROXY;

type NewsSourceId = (typeof NEWS_SOURCES_PROXY)[number]["id"];

interface NewsItem {
  title: string;
  pubDate: string;
  link: string;
  author?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSessionProgress(session: MarketSession, now: Date): number {
  const cur = getETMinutes(now);

  const [sh, sm] = session.startET.split(":").map(Number);
  const [eh, em] = session.endET.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;

  // If start equals end the session is inactive or runs all day — treat as 0%
  if (start === end) return 0;

  const totalMins = end > start ? end - start : 1440 - start + end;
  const elapsed =
    end > start
      ? cur - start
      : cur >= start
        ? cur - start
        : 1440 - start + cur;

  return Math.max(0, Math.min(100, (elapsed / totalMins) * 100));
}

const STANDARD_SYMBOLS = new Set(["ES", "NQ", "YM", "RTY", "CL", "GC"]);
const MICRO_SYMBOLS = new Set(["MES", "MNQ", "MYM", "M2K", "MCL", "MGC"]);

/** Returns "Xh Ym" or "Ym" until a session's start time (ET minutes). */
function opensInLabel(session: MarketSession, now: Date): string {
  return formatMinutesAsLabel(minutesUntilNextOpen(session, now));
}

/** City label + IANA timezone for the world clock strip. */
const WORLD_CLOCKS = [
  { city: "London",   tz: "Europe/London"    },
  { city: "New York", tz: "America/New_York" },
  { city: "Tokyo",    tz: "Asia/Tokyo"       },
  { city: "Sydney",   tz: "Australia/Sydney" },
] as const;

// ---------------------------------------------------------------------------
// Live Session Tracker
// ---------------------------------------------------------------------------

function LiveSessionTracker() {
  const [now, setNow] = useState(new Date());
  const [active, setActive] = useState<MarketSession | null>(() => getActiveSession(new Date()));

  useEffect(() => {
    const id = setInterval(() => {
      const current = new Date();
      setNow(current);
      setActive(getActiveSession(current));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const nextSession = getNextMarketSession(now);
  const easternTz = getEasternTimeZoneAbbreviation(now);

  const etTime = now.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // World clock times — recomputed every second via `now`
  const worldTimes = WORLD_CLOCKS.map(({ city, tz }) => ({
    city,
    time: now.toLocaleTimeString("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  }));

  return (
    <div className="space-y-3">
      {/* Header row: title + ET clock + world clocks */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-accent" />
          <h2 className="text-sm font-semibold text-tx-1">Live Market Sessions</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* World clocks strip */}
          {worldTimes.map(({ city, time }) => (
            <div
              key={city}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(var(--surface-rgb),0.03)] border border-[rgba(var(--border-rgb),0.06)]"
            >
              <span className="text-[10px] text-tx-3 uppercase tracking-wider font-medium">{city}</span>
              <span className="text-[11px] font-mono tabular-nums text-tx-2">{time}</span>
            </div>
          ))}
          {/* ET clock */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: `${PAGE_THEMES.market.dim}`, border: `1px solid ${PAGE_THEMES.market.border}` }}
          >
            <Clock size={11} className="text-accent" />
            <span className="text-tx-2 text-xs font-mono tabular-nums">{etTime} {easternTz}</span>
          </div>
        </div>
      </div>

      {/* Session Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MARKET_SESSIONS.map((session) => {
          const isActive = active?.name === session.name;
          const isNext = !active && nextSession?.name === session.name;
          const progress = isActive ? getSessionProgress(session, now) : 0;
          const openLabel = !isActive ? opensInLabel(session, now) : "";

          return (
            <div
              key={session.name}
              className={cn("card p-4 transition-all duration-300 relative overflow-hidden", isActive ? "accent-top" : "")}
              style={
                isActive
                  ? {
                      border: `1px solid ${session.color}35`,
                      borderLeft: 0,
                      boxShadow: `0 0 28px ${session.color}0d, 0 4px 20px rgba(0,0,0,0.4)`,
                      background: `linear-gradient(160deg, ${session.color}09 0%, var(--bg-base) 60%)`,
                    }
                  : isNext
                    ? {
                        border: `1px solid rgba(var(--border-rgb),0.07)`,
                        borderLeft: 0,
                        background: "rgba(var(--surface-rgb),0.03)",
                        opacity: 0.6,
                      }
                    : {
                        borderLeft: 0,
                        background: "rgba(var(--surface-rgb),0.03)",
                        opacity: 0.4,
                      }
              }
            >
              {/* Subtle color wash top line for inactive */}
              {!isActive && (
                <div
                  className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                  style={{ background: `linear-gradient(90deg, ${session.color}40, transparent)` }}
                />
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: session.color,
                        boxShadow: `0 0 8px ${session.color}cc`,
                        animation: "pulseDot 2s ease-in-out infinite",
                      }}
                    />
                  ) : (
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: session.color,
                        opacity: isNext ? 0.5 : 0.22,
                      }}
                    />
                  )}
                  <span
                    className="font-semibold text-sm"
                    style={{ color: isActive ? session.color : "var(--tx-4)" }}
                  >
                    {session.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isActive && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                      style={{
                        background: `${session.color}18`,
                        color: session.color,
                        border: `1px solid ${session.color}35`,
                      }}
                    >
                      Active
                    </span>
                  )}
                  {isNext && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                      style={{
                        background: `${session.color}12`,
                        color: `${session.color}cc`,
                        border: `1px solid ${session.color}28`,
                      }}
                    >
                      Next
                    </span>
                  )}
                </div>
              </div>

              {/* Time range */}
              <div className="text-xs font-mono mb-1" style={{ color: isActive ? "var(--tx-3)" : "var(--tx-4)" }}>
                {session.startET} &ndash; {session.endET}{" "}
                <span style={{ color: "var(--tx-4)" }}>ET</span>
              </div>

              {/* "Opens in" label for non-active sessions */}
              {!isActive && (
                <div className="mb-3">
                  <span
                    className="text-[10px] font-mono tabular-nums"
                    style={{ color: isNext ? "var(--tx-3)" : "var(--tx-4)" }}
                  >
                    {isNext ? `Opens in ${openLabel}` : `Opens in ${openLabel}`}
                  </span>
                </div>
              )}
              {isActive && <div className="mb-3" />}

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="progress-track h-1.5">
                  <div
                    className="progress-fill transition-all duration-1000"
                    style={{
                      width: `${isActive ? progress : 0}%`,
                      background: isActive
                        ? `linear-gradient(90deg, ${session.color}60, ${session.color})`
                        : "transparent",
                    }}
                  />
                </div>
                {isActive && (
                  <div className="flex justify-between">
                    <span className="text-tx-4 text-[10px] font-mono">{session.startET}</span>
                    <span className="text-[10px] font-mono tabular-nums" style={{ color: session.color }}>
                      {progress.toFixed(1)}%
                    </span>
                    <span className="text-tx-4 text-[10px] font-mono">{session.endET}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next Rollover Countdown
// ---------------------------------------------------------------------------

function RolloverCountdown() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const rollover = useMemo(() => getNextRolloverDate(), []);

  const diffMs = rollover.getTime() - now.getTime();
  const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const rolloverStr = rollover.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const month = rollover.getMonth();
  const monthCodes: Record<number, string> = { 2: "H", 5: "M", 8: "U", 11: "Z" };
  const code = monthCodes[month] ?? "?";
  const yr = String(rollover.getFullYear()).slice(-2);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="card p-5 animate-fade-up"
      style={{ animationDelay: "120ms", animationFillMode: "both" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Timer size={14} className="text-accent" />
        <h2 className="text-sm font-semibold text-tx-1">Next Futures Rollover</h2>
      </div>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Countdown */}
        <div className="flex items-end gap-3">
          {[
            { val: pad(days), label: "Days" },
            { val: pad(hours), label: "Hrs" },
            { val: pad(mins), label: "Min" },
            { val: pad(secs), label: "Sec" },
          ].map(({ val, label }, i) => (
            <div key={label} className="flex items-end gap-1">
              {i > 0 && (
                <span className="text-tx-4 text-lg font-mono mb-1">:</span>
              )}
              <div className="flex flex-col items-center">
                <span
                  className="text-2xl font-bold font-mono tabular-nums text-tx-1"
                  style={{ textShadow: `0 0 20px ${PAGE_THEMES.market.glow}` }}
                >
                  {val}
                </span>
                <span className="text-tx-4 text-[10px] uppercase tracking-wider mt-0.5">
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div
          className="hidden md:block w-px self-stretch"
          style={{ background: PAGE_THEMES.market.dim }}
        />

        {/* Details */}
        <div className="space-y-2">
          <div className="text-tx-2 text-sm">{rolloverStr}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-tx-3 text-xs">Active contract code:</span>
            {["ES", "NQ", "YM", "RTY", "CL", "GC"].map((sym) => (
              <span
                key={sym}
                className="px-2 py-0.5 rounded text-xs font-mono"
                style={{
                  background: PAGE_THEMES.market.dim,
                  border: `1px solid ${PAGE_THEMES.market.border}`,
                  color: PAGE_THEMES.market.accent,
                }}
              >
                {sym}
                {code}
                {yr}
              </span>
            ))}
          </div>
        </div>

        {/* Quarter codes */}
        <div className="ml-auto hidden lg:flex items-center gap-4">
          {[
            { c: "H", m: "Mar" },
            { c: "M", m: "Jun" },
            { c: "U", m: "Sep" },
            { c: "Z", m: "Dec" },
          ].map((q) => (
            <div key={q.c} className="text-center">
              <div
                className={cn(
                  "text-base font-mono font-bold",
                  q.c === code ? "text-accent-bright" : "text-tx-4",
                )}
              >
                {q.c}
              </div>
              <div className="text-tx-4 text-[10px]">{q.m}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract Specs Table
// ---------------------------------------------------------------------------

type SortKey = "symbol" | "name";

function ContractTable() {
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    return [...FUTURES_CONTRACTS].sort((a, b) => {
      const av = a[sortKey].toLowerCase();
      const bv = b[sortKey].toLowerCase();
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const SortBtn = ({ col }: { col: SortKey }) => (
    <button
      onClick={() => toggleSort(col)}
      className="inline-flex items-center gap-1 hover:text-tx-1 transition-colors"
    >
      {col === "symbol" ? "Symbol" : "Name"}
      <ArrowUpDown
        size={10}
        className={cn(
          "transition-colors",
          sortKey === col ? "text-accent" : "text-tx-4",
        )}
      />
    </button>
  );

  return (
    <div
      className="card overflow-hidden animate-fade-up"
      style={{ animationDelay: "180ms", animationFillMode: "both" }}
    >
      <div className="px-5 py-4 border-b border-[rgba(var(--border-rgb),0.06)] flex items-center gap-2">
        <FileText size={14} className="text-accent" />
        <h2 className="text-sm font-semibold text-tx-1">Contract Specifications</h2>
        <span className="ml-auto text-tx-4 text-xs">
          {FUTURES_CONTRACTS.length} contracts
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(var(--border-rgb),0.06)]">
              <th className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-tx-3 font-medium">
                <SortBtn col="symbol" />
              </th>
              <th className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-tx-3 font-medium">
                <SortBtn col="name" />
              </th>
              <th className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-tx-3 font-medium">
                Exchange
              </th>
              <th className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-tx-3 font-medium">
                Tick Size
              </th>
              <th className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-tx-3 font-medium">
                Tick Value
              </th>
              <th className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-tx-3 font-medium">
                Point Value
              </th>
              <th className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-tx-3 font-medium">
                Contract Months
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(var(--border-rgb),0.04)]">
            {sorted.map((c, i) => {
              const isStandard = STANDARD_SYMBOLS.has(c.symbol);
              const isMicro = MICRO_SYMBOLS.has(c.symbol);
              return (
                <tr
                  key={c.symbol}
                  className={cn(
                    "hover:bg-[rgba(var(--surface-rgb),0.025)] transition-colors",
                    i % 2 === 1 ? "bg-[rgba(var(--surface-rgb),0.015)]" : "bg-transparent",
                  )}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono font-bold text-sm",
                          isStandard ? "text-accent-bright" : "text-tx-3",
                        )}
                      >
                        {c.symbol}
                      </span>
                      {isMicro && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[rgba(var(--surface-rgb),0.04)] text-tx-4 border border-[rgba(var(--border-rgb),0.06)]">
                          Micro
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-tx-2">{c.name}</td>
                  <td className="px-5 py-3">
                    {(() => {
                      const col = EXCHANGE_COLORS[c.exchange] ?? "#94a3b8";
                      return (
                        <span
                          className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md"
                          style={{ background: `${col}15`, color: col }}
                        >
                          {c.exchange}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-3 text-sm text-tx-2 font-mono tabular-nums">
                    {c.tickSize}
                  </td>
                  <td className="px-5 py-3 text-sm text-tx-2 font-mono tabular-nums">
                    ${c.tickValue.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-sm text-tx-2 font-mono tabular-nums">
                    ${c.pointValue.toFixed(0)}
                  </td>
                  <td className="px-5 py-3 text-sm text-tx-3">{c.contractMonths}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Economic Calendar
// ---------------------------------------------------------------------------

const IMPACT_CONFIG = {
  high: {
    label: "High",
    color: "var(--color-loss)",
    bg: "rgba(255,61,90,0.08)",
    border: "rgba(255,61,90,0.2)",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    color: "var(--color-warn)",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.2)",
    icon: AlertCircle,
  },
  low: {
    label: "Low",
    color: "var(--color-profit)",
    bg: "rgba(16,245,164,0.08)",
    border: "rgba(16,245,164,0.2)",
    icon: Info,
  },
} as const;

// ---------------------------------------------------------------------------
// Forex Factory Live Calendar
// ---------------------------------------------------------------------------

// FF `date` field is an ISO string with embedded time: "2026-03-18T08:30:00-04:00"
function extractFFTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" });
}

function fmtFFDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "America/New_York" });
}

function isFFToday(dateStr: string): boolean {
  // Compare the ET date portion (YYYY-MM-DD) directly from the FF ISO string
  const etDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return dateStr.slice(0, 10) === etDate;
}

function getFFCacheKey(week: "this" | "next"): string {
  return `${FF_CACHE_PREFIX}.${week}`;
}

function readFFCache(week: "this" | "next"): FFCalendarCacheEntry | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(getFFCacheKey(week));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<FFCalendarCacheEntry>;
    if (!Array.isArray(parsed.events) || typeof parsed.cachedAt !== "number") {
      return null;
    }
    return {
      cachedAt: parsed.cachedAt,
      events: parsed.events,
    };
  } catch {
    return null;
  }
}

function writeFFCache(week: "this" | "next", events: FFEvent[]) {
  if (typeof window === "undefined") return;
  const payload: FFCalendarCacheEntry = { cachedAt: Date.now(), events };
  localStorage.setItem(getFFCacheKey(week), JSON.stringify(payload));
}

async function fetchFFCalendarWeek(week: "this" | "next"): Promise<FFEvent[]> {
  const cooldownUntil = ffRateLimitedUntil[week] ?? 0;
  if (Date.now() < cooldownUntil) {
    throw new Error("HTTP 429");
  }

  if (!ffInFlightLoads[week]) {
    ffInFlightLoads[week] = (async () => {
      const url = isTauri
        ? `https://nfs.faireconomy.media/ff_calendar_${week}week.json`
        : `/ff-calendar/ff_calendar_${week}week.json`;
      const res = await tauriFetch(url, isTauri ? {
        headers: {
          "Referer": "https://www.forexfactory.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      } : undefined);

      if (res.status === 404 && week === "next") {
        throw new Error("Next week's calendar isn't published yet — check back closer to the weekend.");
      }
      if (res.status === 429) {
        ffRateLimitedUntil[week] = Date.now() + FF_RATE_LIMIT_COOLDOWN_MS;
        throw new Error("HTTP 429");
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      ffRateLimitedUntil[week] = 0;
      return res.json();
    })().finally(() => {
      delete ffInFlightLoads[week];
    });
  }

  return ffInFlightLoads[week]!;
}

function ForexCalendar() {
  const [events, setEvents] = useState<FFEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState<"this" | "next">("this");
  const [filterImpact, setFilterImpact] = useState<"all" | "High" | "Medium">("High");
  const [filterCountry, setFilterCountry] = useState<"all" | "USD" | "GBP">("USD");
  const [cacheStatus, setCacheStatus] = useState<"cached" | "fallback" | null>(null);

  async function load(w: "this" | "next", force = false) {
    const sessionKey = `ff_cal_${w}`;
    const persistentCache = readFFCache(w);
    let cachedEvents: FFEvent[] | null = persistentCache?.events ?? null;
    let cachedAt = persistentCache?.cachedAt ?? null;

    if (!cachedEvents) {
      const sessionCached = sessionStorage.getItem(sessionKey);
      if (sessionCached) {
        try {
          const parsed = JSON.parse(sessionCached);
          if (Array.isArray(parsed)) {
            cachedEvents = parsed;
          }
        } catch {
          // Ignore corrupted session cache and continue to network.
        }
      }
    }

    const hasCache = Array.isArray(cachedEvents) && cachedEvents.length > 0;
    const hasFreshPersistentCache =
      !force &&
      persistentCache !== null &&
      Date.now() - persistentCache.cachedAt < FF_CACHE_TTL_MS;

    if (hasCache && cachedEvents) {
      setEvents(cachedEvents);
      setError(null);
      setCacheStatus(hasFreshPersistentCache ? "cached" : "fallback");
      setLoading(false);
    }

    if (hasFreshPersistentCache) {
      return;
    }

    setLoading(!hasCache);
    setRefreshing(hasCache);
    setError(null);
    try {
      const data = await fetchFFCalendarWeek(w);
      sessionStorage.setItem(sessionKey, JSON.stringify(data));
      writeFFCache(w, data);
      setEvents(data);
      setCacheStatus(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load";
      if (hasCache) {
        setError(null);
        setCacheStatus("fallback");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(week); }, [week]);

  const filtered = useMemo(() =>
    events.filter((ev) => {
      if (ev.impact === "Non-Economic" || ev.impact === "Holiday") return false;
      if (filterImpact !== "all" && ev.impact !== filterImpact) return false;
      if (filterCountry !== "all" && ev.country !== filterCountry) return false;
      return true;
    }),
    [events, filterImpact, filterCountry]
  );

  const grouped = useMemo(() => {
    const map: Record<string, FFEvent[]> = {};
    for (const ev of filtered) {
      const key = ev.date.slice(0, 10);
      (map[key] ??= []).push(ev);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div
      className="card overflow-hidden animate-fade-up"
      style={{ animationDelay: "240ms", animationFillMode: "both" }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(var(--border-rgb),0.06)] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-tx-1">Economic Calendar</h2>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: PAGE_THEMES.market.dim, color: PAGE_THEMES.market.accent, border: `1px solid ${PAGE_THEMES.market.border}` }}
          >
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Week toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[rgba(var(--border-rgb),0.08)]">
            {(["this", "next"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium transition-colors",
                  week === w ? "bg-accent/20 text-accent" : "text-tx-4 hover:text-tx-3",
                )}
              >
                {w === "this" ? "This Week" : "Next Week"}
              </button>
            ))}
          </div>

          {/* Impact filter */}
          <div className="flex rounded-lg overflow-hidden border border-[rgba(var(--border-rgb),0.08)]">
            {(["all", "High", "Medium"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterImpact(v)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium transition-colors",
                  filterImpact === v ? "bg-[rgba(var(--border-rgb),0.10)] text-tx-1" : "text-tx-4 hover:text-tx-3",
                )}
              >
                {v === "all" ? "All" : v === "High" ? "High" : "Med"}
              </button>
            ))}
          </div>

          {/* Country filter */}
          <div className="flex rounded-lg overflow-hidden border border-[rgba(var(--border-rgb),0.08)]">
            {(["all", "USD", "GBP"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterCountry(v)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium transition-colors",
                  filterCountry === v ? "bg-[rgba(var(--border-rgb),0.10)] text-tx-1" : "text-tx-4 hover:text-tx-3",
                )}
              >
                {v === "all" ? "All" : v}
              </button>
            ))}
          </div>

          <button
            onClick={() => load(week, true)}
            className="p-1.5 rounded-lg text-tx-4 hover:text-tx-2 hover:bg-[rgba(var(--surface-rgb),0.04)] transition-all"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading || refreshing ? "animate-spin" : ""} />
          </button>
          <span className="text-[10px] text-tx-4">Forex Factory</span>
          {cacheStatus && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: "rgba(148,163,184,0.08)",
                color: "var(--tx-3)",
                border: "1px solid rgba(148,163,184,0.18)",
              }}
            >
              {cacheStatus === "cached" ? "Cached" : "Cached fallback"}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <p className="text-sm text-tx-4">Loading calendar…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 px-4 text-center">
            {error.includes("isn't published") ? (
              <>
                <Info size={20} className="text-tx-4" />
                <p className="text-sm text-tx-3 leading-relaxed">{error}</p>
              </>
            ) : (
              <>
                <WifiOff size={20} className="text-loss" />
                <p className="text-sm text-tx-3">Failed to load: {error}</p>
                <button onClick={() => load(week, true)} className="btn-ghost btn-sm">
                  <RefreshCw size={12} /> Retry
                </button>
              </>
            )}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Calendar size={20} className="text-tx-4" />
            <p className="text-sm text-tx-3">No events match your filters</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([dateKey, dayEvs]) => {
              const today = isFFToday(dayEvs[0].date);
              return (
                <div key={dateKey}>
                  {/* Day header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-xs font-bold", today ? "text-accent" : "text-tx-3")}>
                      {fmtFFDate(dayEvs[0].date)}
                    </span>
                    {today && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: PAGE_THEMES.market.dim, color: PAGE_THEMES.market.accent, border: `1px solid ${PAGE_THEMES.market.border}` }}
                      >
                        TODAY
                      </span>
                    )}
                    <div className="flex-1 h-px bg-[rgba(var(--border-rgb),0.05)]" />
                    <span className="text-[10px] text-tx-4">{dayEvs.length} events</span>
                  </div>

                  {/* Events list */}
                  <div className="rounded-xl overflow-hidden border border-[rgba(var(--border-rgb),0.06)] divide-y divide-[rgba(var(--border-rgb),0.04)]">
                    {dayEvs.map((ev, i) => {
                      const cfg = FF_IMPACT[ev.impact];
                      const hasActual = ev.actual?.trim();
                      const timeStr = extractFFTime(ev.date);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[rgba(var(--surface-rgb),0.02)] transition-colors"
                        >
                          {/* Time */}
                          <span className="text-[11px] font-mono text-tx-4 tabular-nums w-10 flex-shrink-0">
                            {timeStr}
                          </span>
                          {/* Impact badge */}
                          {cfg ? (
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0"
                              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                            >
                              {cfg.label}
                            </div>
                          ) : (
                            <div className="w-4 h-4 flex-shrink-0" />
                          )}
                          {/* Currency chip */}
                          <span
                            className="text-[10px] font-bold font-mono px-1 py-0.5 rounded flex-shrink-0 bg-[rgba(var(--surface-rgb),0.06)] text-tx-3"
                          >
                            {ev.country}
                          </span>
                          {/* Event name */}
                          <span className="text-[12px] text-tx-1 font-medium flex-1 min-w-0 truncate">
                            {ev.title}
                          </span>
                          {/* Forecast / Previous / Actual */}
                          <div className="flex items-center gap-2 flex-shrink-0 text-[10px] font-mono tabular-nums">
                            {(ev.forecast || ev.previous) && (
                              <span className="text-tx-4 hidden sm:block">
                                {ev.forecast || "—"} / {ev.previous || "—"}
                              </span>
                            )}
                            {hasActual ? (
                              <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "var(--color-profit)" }}>
                                {ev.actual}
                              </span>
                            ) : (
                              <span className="text-tx-4 w-6 text-center">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-[rgba(var(--border-rgb),0.06)] flex items-center gap-2">
        <span className="text-[10px] text-tx-4">
          {cacheStatus === "fallback"
            ? "Source: Forex Factory · showing cached data after upstream rate-limit/network failure"
            : "Source: Forex Factory · All times ET"}
        </span>
        <span className="text-[10px] text-tx-4 ml-auto">{filtered.length} events shown</span>
      </div>
    </div>
  );
}

function groupEventsByDate(events: EconomicEvent[]): { date: string; items: EconomicEvent[] }[] {
  const map: Record<string, EconomicEvent[]> = {};
  for (const ev of events) {
    if (!map[ev.date]) map[ev.date] = [];
    map[ev.date].push(ev);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: items.slice().sort((a, b) => a.time.localeCompare(b.time)),
    }));
}

function fmtEventDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function EconomicCalendar() {
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const events: EconomicEvent[] = data.economicEvents ?? [];

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: "08:30",
    name: "",
    impact: "high" as EconomicEvent["impact"],
  });
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => groupEventsByDate(events), [events]);

  function handleAdd() {
    if (!form.name.trim()) return;
    const ev: EconomicEvent = {
      id: Date.now().toString(),
      date: form.date,
      time: form.time,
      name: form.name.trim(),
      impact: form.impact,
    };
    update((prev) => ({
      ...prev,
      economicEvents: [...(prev.economicEvents ?? []), ev],
    }));
    setAddOpen(false);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      time: "08:30",
      name: "",
      impact: "high",
    });
  }

  function handleDelete(id: string) {
    update((prev) => ({
      ...prev,
      economicEvents: (prev.economicEvents ?? []).filter(
        (e: EconomicEvent) => e.id !== id,
      ),
    }));
  }

  function toggleDate(date: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <>
      <div
        className="card animate-fade-up"
        style={{ animationDelay: "300ms", animationFillMode: "both" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(var(--border-rgb),0.06)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote size={14} className="text-tx-3" />
            <h2 className="text-sm font-semibold text-tx-1">Custom Events</h2>
            <span className="text-[10px] text-tx-3 font-medium">Your personal notes &amp; reminders</span>
            {events.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-medium tabular-nums"
                style={{
                  background: PAGE_THEMES.market.dim,
                  color: PAGE_THEMES.market.accent,
                  border: `1px solid ${PAGE_THEMES.market.border}`,
                }}
              >
                {events.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="btn-primary btn-sm"
          >
            <Plus size={13} />
            Add Event
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {events.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 gap-3 rounded-xl"
              style={{
                background: `${PAGE_THEMES.market.accent}05`,
                border: `1px dashed ${PAGE_THEMES.market.accent}1a`,
              }}
            >
              <Calendar size={24} className="text-tx-4" />
              <div className="text-center">
                <p className="text-tx-2 text-sm font-medium">No events scheduled</p>
                <p className="text-tx-3 text-xs mt-1">
                  Add upcoming economic events to track
                </p>
              </div>
              <button
                onClick={() => setAddOpen(true)}
                className="btn-ghost btn-sm mt-1"
              >
                <Plus size={13} />
                Add Event
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {grouped.map(({ date, items }) => {
                const isOpen = expandedDates.has(date);
                return (
                  <div key={date} className="card overflow-hidden border-[rgba(var(--border-rgb),0.06)]">
                    <button
                      onClick={() => toggleDate(date)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgba(var(--surface-rgb),0.02)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? (
                          <ChevronUp size={13} className="text-tx-3" />
                        ) : (
                          <ChevronDown size={13} className="text-tx-3" />
                        )}
                        <span className="text-tx-1 text-sm font-medium">
                          {fmtEventDate(date)}
                        </span>
                        <span className="text-tx-3 text-xs">{items.length} event{items.length !== 1 ? "s" : ""}</span>
                      </div>
                      {/* Impact summary dots */}
                      <div className="flex items-center gap-1.5 mr-2">
                        {(["high", "medium", "low"] as const).map((imp) => {
                          const count = items.filter((i) => i.impact === imp).length;
                          if (!count) return null;
                          return (
                            <div key={imp} className="flex items-center gap-1">
                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full"
                                style={{ background: IMPACT_CONFIG[imp].color }}
                              />
                              <span
                                className="text-[10px] font-mono"
                                style={{ color: IMPACT_CONFIG[imp].color }}
                              >
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-[rgba(var(--border-rgb),0.05)] divide-y divide-[rgba(var(--border-rgb),0.04)]">
                        {items.map((ev) => {
                          const cfg = IMPACT_CONFIG[ev.impact];
                          const ImpactIcon = cfg.icon;
                          return (
                            <div
                              key={ev.id}
                              className="flex items-center gap-3 px-4 py-3 group hover:bg-[rgba(var(--surface-rgb),0.02)] transition-colors"
                            >
                              <span className="text-tx-3 text-xs font-mono tabular-nums w-12 flex-shrink-0">
                                {ev.time}
                              </span>
                              <div
                                className="p-1 rounded flex-shrink-0"
                                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                              >
                                <ImpactIcon size={11} style={{ color: cfg.color }} />
                              </div>
                              <span className="text-tx-1 text-sm flex-1 min-w-0 truncate">
                                {ev.name}
                              </span>
                              <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                                style={{
                                  background: cfg.bg,
                                  color: cfg.color,
                                  border: `1px solid ${cfg.border}`,
                                }}
                              >
                                {cfg.label}
                              </span>
                              <button
                                onClick={() => handleDelete(ev.id)}
                                className="md:opacity-0 md:group-hover:opacity-100 p-1 text-tx-3 hover:text-loss transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Economic Event" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-tx-3 text-xs block mb-1.5">Event Name</label>
            <input
              className="nx-input"
              placeholder="e.g. FOMC Rate Decision"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-tx-3 text-xs block mb-1.5">Date</label>
              <DatePicker
                value={form.date}
                onChange={(date) => setForm((p) => ({ ...p, date }))}
              />
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1.5">Time ({getEasternTimeZoneAbbreviation(new Date())})</label>
              <TimePicker
                value={form.time}
                onChange={(time) => setForm((p) => ({ ...p, time }))}
              />
            </div>
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1.5">Impact</label>
            <CustomSelect
              value={form.impact}
              onChange={(v) => setForm((p) => ({ ...p, impact: v as EconomicEvent["impact"] }))}
              options={[
                { value: "high", label: "High Impact" },
                { value: "medium", label: "Medium Impact" },
                { value: "low", label: "Low Impact" },
              ]}
              placeholder="Select impact"
            />
          </div>

          {/* Impact preview */}
          {form.impact && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                background: IMPACT_CONFIG[form.impact].bg,
                border: `1px solid ${IMPACT_CONFIG[form.impact].border}`,
                color: IMPACT_CONFIG[form.impact].color,
              }}
            >
              {(() => {
                const Ic = IMPACT_CONFIG[form.impact].icon;
                return <Ic size={12} />;
              })()}
              <span>
                {IMPACT_CONFIG[form.impact].label} impact event
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              className="btn-primary flex-1"
              onClick={handleAdd}
              disabled={!form.name.trim()}
              style={!form.name.trim() ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              <Plus size={14} />
              Add Event
            </button>
            <button className="btn-ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Native Market News Feed (RSS via rss2json proxy)
// ---------------------------------------------------------------------------

function fmtNewsAge(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function NewsFeed() {
  const [source, setSource] = useState<NewsSourceId>("forexlive");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(src: NewsSourceId) {
    setLoading(true);
    setError(null);
    const { url } = NEWS_SOURCES.find((s) => s.id === src)!;
    try {
      const res = await tauriFetch(url, isTauri ? {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/rss+xml,application/xml,*/*",
        },
      } : undefined);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const parsed: NewsItem[] = Array.from(doc.querySelectorAll("item")).slice(0, 25).map((el) => ({
        title:   el.querySelector("title")?.textContent?.trim()   ?? "",
        link:    el.querySelector("link")?.textContent?.trim()    ?? "",
        pubDate: el.querySelector("pubDate")?.textContent?.trim() ?? "",
        author:  (el.querySelector("dc\\:creator") ?? el.querySelector("creator") ?? el.querySelector("author"))?.textContent?.trim() ?? "",
      }));
      setItems(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(source); }, [source]);

  return (
    <div
      className="card overflow-hidden animate-fade-up"
      style={{ animationDelay: "280ms", animationFillMode: "both" }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(var(--border-rgb),0.06)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-tx-1">Market News</h2>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: PAGE_THEMES.market.dim, color: PAGE_THEMES.market.accent, border: `1px solid ${PAGE_THEMES.market.border}` }}
          >
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Source tabs */}
          <div className="flex rounded-lg overflow-hidden border border-[rgba(var(--border-rgb),0.08)]">
            {NEWS_SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium transition-colors",
                  source === s.id ? "bg-accent/20 text-accent" : "text-tx-4 hover:text-tx-3",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(source)}
            className="p-1.5 rounded-lg text-tx-4 hover:text-tx-2 hover:bg-[rgba(var(--surface-rgb),0.04)] transition-all"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxHeight: 500, overflowY: "auto" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <p className="text-sm text-tx-4">Loading news…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 p-5">
            <WifiOff size={20} className="text-loss" />
            <p className="text-sm text-tx-3 text-center">Failed to load: {error}</p>
            <button onClick={() => load(source)} className="btn-ghost btn-sm">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Newspaper size={20} className="text-tx-4" />
            <p className="text-sm text-tx-3">No articles found</p>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(var(--border-rgb),0.04)]">
            {items.map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 px-4 py-3 hover:bg-[rgba(var(--surface-rgb),0.03)] transition-colors group"
                style={{ textDecoration: "none" }}
                onClick={(e) => {
                  if (isTauri && item.link) {
                    e.preventDefault();
                    tauriOpen(item.link);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12px] text-tx-1 font-medium leading-snug group-hover:text-accent transition-colors"
                    style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                  >
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {item.author && (
                      <span className="text-[10px] text-tx-4 truncate" style={{ maxWidth: 120 }}>{item.author}</span>
                    )}
                    <span className="text-[10px] text-tx-4 tabular-nums">{fmtNewsAge(item.pubDate)}</span>
                  </div>
                </div>
                <ExternalLink size={11} className="text-tx-4 group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Position Sizer
// ---------------------------------------------------------------------------

function PositionSizer() {
  const [balance, setBalance] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [symbol, setSymbol] = useState("ES");

  const contract = FUTURES_CONTRACTS.find((c) => c.symbol === symbol) ?? FUTURES_CONTRACTS[0];
  const result = (entry && stop && balance && riskPct)
    ? calculateRisk(
        parseFloat(balance) || 0,
        parseFloat(riskPct) || 0,
        parseFloat(entry) || 0,
        parseFloat(stop) || 0,
        contract.tickSize,
        contract.tickValue,
      )
    : null;

  const POPULAR = ["ES", "MES", "NQ", "MNQ", "YM", "GC", "CL"];
  const popularContracts = FUTURES_CONTRACTS.filter((c) => POPULAR.includes(c.symbol));

  return (
    <div className="card p-4">
      <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
        <Target size={10} className="text-accent" />
        Position Sizer
      </p>

      {/* Contract selector */}
      <div className="mb-3">
        <label className="text-[10px] text-tx-4 uppercase tracking-wider block mb-1">Contract</label>
        <CustomSelect
          value={symbol}
          onChange={setSymbol}
          options={popularContracts.map((c) => ({ value: c.symbol, label: `${c.symbol} — ${c.name}` }))}
          placeholder="Select contract"
          small
        />
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-3">
        <div>
          <label className="text-[10px] text-tx-4 block mb-1">Balance ($)</label>
          <input type="number" className="nx-input text-xs" value={balance}
            onChange={(e) => setBalance(e.target.value)} placeholder="10000" />
        </div>
        <div>
          <label className="text-[10px] text-tx-4 block mb-1">Risk %</label>
          <input type="number" className="nx-input text-xs" value={riskPct}
            onChange={(e) => setRiskPct(e.target.value)} placeholder="1" step="0.1" min="0.1" max="10" />
        </div>
        <div>
          <label className="text-[10px] text-tx-4 block mb-1">Entry</label>
          <input type="number" className="nx-input text-xs" value={entry}
            onChange={(e) => setEntry(e.target.value)} placeholder="5000" step={contract.tickSize} />
        </div>
        <div>
          <label className="text-[10px] text-tx-4 block mb-1">Stop</label>
          <input type="number" className="nx-input text-xs" value={stop}
            onChange={(e) => setStop(e.target.value)} placeholder="4990" step={contract.tickSize} />
        </div>
      </div>

      {/* Result */}
      {result ? (
        result.maxContracts > 0 ? (
          <div className="flex flex-col gap-1.5">
            {/* Main result */}
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: PAGE_THEMES.market.dim, border: `1px solid ${PAGE_THEMES.market.border}` }}>
              <div>
                <p className="text-[10px] text-tx-4 uppercase tracking-wider">Max Contracts</p>
                <p className="text-2xl font-black text-accent-bright tabular-nums">{result.maxContracts}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-tx-4">Risk amount</p>
                <p className="text-sm font-bold text-profit tabular-nums">${result.actualRisk.toFixed(2)}</p>
                <p className="text-[10px] text-tx-4">{result.actualRiskPercent.toFixed(2)}%</p>
              </div>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {[
                { label: "Ticks at risk", value: result.ticksAtRisk.toFixed(1) },
                { label: "Loss/contract", value: `$${result.lossPerContract.toFixed(2)}` },
              ].map((s) => (
                <div key={s.label} className="rounded-lg px-2.5 py-1.5 text-center bg-[rgba(var(--surface-rgb),0.03)] border border-[rgba(var(--border-rgb),0.07)]">
                  <p className="text-[10px] text-tx-3 uppercase tracking-wider">{s.label}</p>
                  <p className="text-xs font-bold text-tx-2 tabular-nums font-mono">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl text-center text-[11px] text-loss bg-loss-subtle"
            style={{ border: "1px solid rgba(239,68,68,0.15)" }}>
            Stop too close — risk below 1 contract minimum
          </div>
        )
      ) : (
        <div className="p-3 rounded-xl text-center text-[11px] text-tx-4 bg-[rgba(var(--surface-rgb),0.03)] border border-[rgba(var(--border-rgb),0.07)]">
          Enter entry &amp; stop prices above
        </div>
      )}

      {/* Contract info */}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-tx-4 pt-2 border-t border-[rgba(var(--border-rgb),0.05)]">
        <span>tick: <span className="text-tx-3 font-mono">{contract.tickSize}</span></span>
        <span>tick$: <span className="text-tx-3 font-mono">${contract.tickValue}</span></span>
        <span>pt$: <span className="text-tx-3 font-mono">${contract.pointValue}</span></span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market Sidebar
// ---------------------------------------------------------------------------

const QUICK_REF_SYMBOLS = ["ES", "NQ", "GC", "CL"] as const;

function MarketSidebar() {
  const quickContracts = FUTURES_CONTRACTS.filter((c) =>
    QUICK_REF_SYMBOLS.includes(c.symbol as (typeof QUICK_REF_SYMBOLS)[number]),
  );

  return (
    <div className="flex flex-col gap-4 xl:sticky xl:top-6">
      {/* ── Quick Contract Reference ────────────────────────────────────────── */}
      <div className="card p-4">
        <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
          <Zap size={10} className="text-accent" />
          Quick Reference
        </p>
        <div className="flex flex-col gap-1.5">
          {quickContracts.map((c) => {
            const exColor = EXCHANGE_COLORS[c.exchange] ?? "#94a3b8";
            return (
              <div
                key={c.symbol}
                className="relative flex items-center gap-2.5 pl-3.5 pr-2.5 py-2.5 rounded-lg overflow-hidden"
                style={{
                  background: `${exColor}08`,
                  border: `1px solid ${exColor}20`,
                }}
              >
                {/* Exchange colour stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm" style={{ background: exColor }} />
                {/* Symbol */}
                <div className="w-7 text-center flex-shrink-0">
                  <span className="text-xs font-black font-mono" style={{ color: exColor }}>{c.symbol}</span>
                </div>
                {/* Name + values */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-tx-2 font-semibold truncate leading-tight">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-tx-3 font-mono">
                      tick <span className="text-tx-2 font-semibold">${c.tickValue}</span>
                    </span>
                    <span className="text-tx-3 text-[10px]">·</span>
                    <span className="text-[10px] text-tx-3 font-mono">
                      pt <span className="text-tx-2 font-semibold">${c.pointValue}</span>
                    </span>
                  </div>
                </div>
                {/* Exchange badge */}
                <span
                  className="text-[10px] font-bold font-mono shrink-0 px-1.5 py-0.5 rounded-md"
                  style={{ background: `${exColor}15`, color: exColor }}
                >
                  {c.exchange}
                </span>
              </div>
            );
          })}
          <p className="text-[10px] text-tx-3 text-center mt-0.5">
            Micro contracts = 1/10th tick & point values
          </p>
        </div>
      </div>

      {/* ── Position Sizer ─────────────────────────────────────────────────── */}
      <PositionSizer />

      {/* ── Journal shortcut ────────────────────────────────────────────────── */}
      <a href="#/journal"
        className="card p-4 flex items-center gap-3 transition-all duration-150 hover:border-accent/30 group cursor-pointer"
        style={{ textDecoration: "none" }}
      >
        <div className="p-2 rounded-lg flex-shrink-0" style={{ background: PAGE_THEMES.market.glow }}>
          <StickyNote size={14} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-tx-1 group-hover:text-accent transition-colors">Trading Journal</p>
          <p className="text-[11px] text-tx-4 mt-0.5">Session notes, daily logs &amp; trade entries</p>
        </div>
        <ChevronRight size={13} className="text-tx-4 group-hover:text-accent transition-colors shrink-0" />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Market() {
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.market, isBW);
  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Market</div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="page-title">Market Overview</h1>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: PAGE_THEMES.market.dim, border: `1px solid ${PAGE_THEMES.market.border}`, color: PAGE_THEMES.market.accent }}
            >
              <Globe size={11} />
              Live · ET
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(var(--surface-rgb),0.04)] border border-[rgba(var(--border-rgb),0.08)] text-tx-3"
            >
              <FileText size={11} />
              {FUTURES_CONTRACTS.length} Contracts
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div
          className="animate-fade-up"
          style={{ animationDelay: "60ms", animationFillMode: "both" }}
        >
          <LiveSessionTracker />
        </div>

        <ForexCalendar />
        <NewsFeed />
      </div>
    </div>
  );
}
