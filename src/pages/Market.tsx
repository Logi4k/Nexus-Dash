import { useState, useEffect, useMemo } from "react";
import { PAGE_THEMES } from "@/lib/theme";
import {
  Globe,
  Clock,
  Calendar,
  FileText,
  Info,
  RefreshCw,
  WifiOff,
  Newspaper,
  ExternalLink,
} from "lucide-react";
import { useBWMode, bwPageTheme, bwColor } from "@/lib/useBWMode";
import {
  cn,
  formatMinutesAsLabel,
  FUTURES_CONTRACTS,
  MARKET_SESSIONS,
  getActiveSession,
  getETMinutes,
  getEasternTimeZoneAbbreviation,
  getNextMarketSession,
  minutesUntilNextOpen,
} from "@/lib/utils";
import type { MarketSession } from "@/types";
import { tauriFetch } from "@/lib/tauriFetch";
import { open as tauriOpen } from "@tauri-apps/plugin-shell";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  Medium: { color: "#c4a06b", bg: "rgba(196,160,107,0.08)", border: "rgba(196,160,107,0.2)", label: "M" },
  Low:    { color: "#7c8798", bg: "rgba(124,135,152,0.06)", border: "rgba(124,135,152,0.15)", label: "L" },
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
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.market, isBW);

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
            style={{ background: theme.dim, border: `1px solid ${theme.border}` }}
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
          const sessionHue = bwColor(session["color"], isBW);

          return (
            <div
              key={session.name}
              className={cn("card p-4 transition-[background-color,border-color,box-shadow,opacity] duration-300 relative overflow-hidden", isActive ? "accent-top" : "")}
              style={
                isActive
                  ? {
                      border: `1px solid ${sessionHue}35`,
                      borderLeft: 0,
                      boxShadow: `0 0 28px ${sessionHue}0d, var(--shadow-drop-md)`,
                      background: `linear-gradient(160deg, ${sessionHue}09 0%, var(--bg-base) 60%)`,
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
                  style={{ background: `linear-gradient(90deg, ${sessionHue}40, transparent)` }}
                />
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: sessionHue,
                        boxShadow: `0 0 8px ${sessionHue}cc`,
                        animation: "pulseDot 2s ease-in-out infinite",
                      }}
                    />
                  ) : (
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: sessionHue,
                        opacity: isNext ? 0.5 : 0.22,
                      }}
                    />
                  )}
                  <span
                    className="font-semibold text-sm"
                    style={{ color: isActive ? sessionHue : "var(--tx-4)" }}
                  >
                    {session.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isActive && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                      style={{
                        background: `${sessionHue}18`,
                        color: sessionHue,
                        border: `1px solid ${sessionHue}35`,
                      }}
                    >
                      Active
                    </span>
                  )}
                  {isNext && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                      style={{
                        background: `${sessionHue}12`,
                        color: `${sessionHue}cc`,
                        border: `1px solid ${sessionHue}28`,
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
                    className="progress-fill transition-[width,background,transform] duration-1000"
                    style={{
                      width: `${isActive ? progress : 0}%`,
                      background: isActive
                        ? `linear-gradient(90deg, ${sessionHue}60, ${sessionHue})`
                        : "transparent",
                    }}
                  />
                </div>
                {isActive && (
                  <div className="flex justify-between">
                    <span className="text-tx-4 text-[10px] font-mono">{session.startET}</span>
                    <span className="text-[10px] font-mono tabular-nums" style={{ color: sessionHue }}>
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
  const isBW = useBWMode();
  const mTheme = bwPageTheme(PAGE_THEMES.market, isBW);
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
      className={cn("card overflow-hidden", isBW && "card--parchment-panel")}
      style={{ animationDelay: "240ms", animationFillMode: "both" }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(var(--border-rgb),0.06)] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-tx-1">Economic Calendar</h2>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: mTheme.dim, color: mTheme.accent, border: `1px solid ${mTheme.border}` }}
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
            className="p-1.5 rounded-lg text-tx-4 hover:text-tx-2 hover:bg-[rgba(var(--surface-rgb),0.04)] transition-colors"
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
                        style={{ background: mTheme.dim, color: mTheme.accent, border: `1px solid ${mTheme.border}` }}
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
  const isBW = useBWMode();
  const mTheme = bwPageTheme(PAGE_THEMES.market, isBW);
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
      className={cn("card overflow-hidden", isBW && "card--parchment-panel")}
      style={{ animationDelay: "280ms", animationFillMode: "both" }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(var(--border-rgb),0.06)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-tx-1">Market News</h2>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: mTheme.dim, color: mTheme.accent, border: `1px solid ${mTheme.border}` }}
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
            className="p-1.5 rounded-lg text-tx-4 hover:text-tx-2 hover:bg-[rgba(var(--surface-rgb),0.04)] transition-colors"
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
// Main Page
// ---------------------------------------------------------------------------

export default function Market() {
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.market, isBW);
  return (
    <div className="space-y-6 xl:space-y-7 w-full">
      {/* Header */}
      <div className="mb-7 xl:mb-8">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Market</div>
        <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-start lg:justify-between">
          <h1 className="page-title">Market Overview</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}
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

      <div className="space-y-6 xl:space-y-7">
        <LiveSessionTracker />

        <ForexCalendar />
        <NewsFeed />
      </div>
    </div>
  );
}

