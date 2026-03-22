import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PAGE_THEMES } from "@/lib/theme";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Smile,
  Meh,
  Frown,
  Zap,
  Target,
  BarChart3,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Image as ImageIcon,
  X,
  ZoomIn,
  Trophy,
  Sigma,
  Activity,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  ResponsiveContainer, Tooltip as RechartTooltip,
  XAxis, ReferenceLine,
} from "recharts";
import { useAppData } from "@/lib/store";
import { cn, fmtUSD, generateId, FUTURES_CONTRACTS } from "@/lib/utils";
import Modal from "@/components/Modal";
import {
  saveImage,
  getImages,
  deleteImage,
  deleteImages,
  fileToDataUrl,
} from "@/lib/imageStore";
import type { JournalEntry, TradeEntry } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const INSTRUMENTS = ["ES", "NQ", "YM", "RTY", "CL", "GC", "MES", "MNQ", "MYM", "MCL", "MGC"];

// ─── Prop firm fee tables (per side, per contract) ────────────────────────────
// Source: Lucid Trading support.lucidtrading.com · Tradeify help.tradeify.co
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
    // Per-side fees verified from user trade data (exchange + NFA + platform)
    ES: 2.84,  MES: 0.87,
    NQ: 2.84,  MNQ: 0.87,
    YM: 2.84,  MYM: 0.87,
    RTY: 2.84, M2K: 0.87,
    CL: 2.84,  MCL: 1.02,
    GC: 1.02,  MGC: 1.02,
    DEFAULT: 1.74,
  },
};

function getFeePerSide(firm: string, instrument: string): number {
  const table = FIRM_FEES[firm];
  if (!table) return 0;
  return table[instrument] ?? table.DEFAULT ?? 0;
}

// Build a quick symbol → pointValue lookup from the shared FUTURES_CONTRACTS list
const POINT_VALUE: Record<string, number> = Object.fromEntries(
  FUTURES_CONTRACTS.map((c) => [c.symbol, c.pointValue])
);

// Instrument color families
const INSTRUMENT_COLOR: Record<string, string> = {
  ES: "#3b82f6", NQ: "#8b5cf6", YM: "#f97316", RTY: "#1dd4b4",
  MES: "#3b82f6", MNQ: "#8b5cf6", MYM: "#f97316",
  CL: "#f59e0b", MCL: "#f59e0b",
  GC: "#eab308", MGC: "#eab308",
};
const getInstrumentColor = (s: string) => INSTRUMENT_COLOR[s] ?? "#60a5fa";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDisplayDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function prevDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Returns the last N calendar days ending at `anchor` (inclusive)
function lastNDays(anchor: string, n: number): string[] {
  const days: string[] = [];
  const d = new Date(anchor + "T00:00:00");
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    days.push(dd.toISOString().slice(0, 10));
  }
  return days;
}

// ─── Mood & Bias config ───────────────────────────────────────────────────────

const BIAS_OPTIONS = [
  { value: "bullish",  label: "Bullish",  color: "#22c55e", Icon: TrendingUp },
  { value: "neutral",  label: "Neutral",  color: "var(--tx-3)", Icon: Minus },
  { value: "bearish",  label: "Bearish",  color: "#ef4444", Icon: TrendingDown },
] as const;

const MOOD_OPTIONS = [
  { value: "great",   label: "Great",   color: "#22c55e", Icon: Smile },
  { value: "good",    label: "Good",    color: "#4ade80", Icon: Smile },
  { value: "neutral", label: "Neutral", color: "var(--tx-3)", Icon: Meh },
  { value: "bad",     label: "Bad",     color: "#ef4444", Icon: Frown },
] as const;

// ─── Trade Form defaults ──────────────────────────────────────────────────────

function emptyTradeForm() {
  return {
    date: todayISO(),
    time: new Date().toTimeString().slice(0, 5),
    instrument: "ES",
    direction: "long" as "long" | "short",
    entryPrice: "",
    exitPrice: "",
    contracts: "1",
    pnl: "",
    fees: "",
    setup: "",
    session: "New York",
    notes: "",
    firm: "" as "" | "lucid" | "tradeify", // UI-only: used for auto-calc, not persisted
  };
}

// ─── Trade Image Gallery ──────────────────────────────────────────────────────

function TradeImageGallery({
  imageIds,
  onDelete,
  onLightbox,
}: {
  imageIds: string[];
  onDelete: (id: string) => void;
  onLightbox: (url: string) => void;
}) {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (imageIds.length === 0) return;
    getImages(imageIds).then(setImages);
  }, [imageIds]);

  if (imageIds.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3 pt-2 border-t border-white/[0.04]">
      {imageIds.map((id) =>
        images[id] ? (
          <div key={id} className="relative group/img flex-shrink-0">
            <img
              src={images[id]}
              alt="Trade screenshot"
              className="h-16 w-24 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onLightbox(images[id])}
            />
            <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none">
              <ZoomIn size={14} className="text-white drop-shadow" />
            </div>
            <button
              onClick={() => onDelete(id)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-loss text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10"
            >
              <X size={9} />
            </button>
          </div>
        ) : (
          // Skeleton while loading
          <div key={id} className="h-16 w-24 rounded-lg bg-white/[0.04] animate-pulse flex-shrink-0" />
        )
      )}
    </div>
  );
}

// ─── Pending Image Preview (in modal) ────────────────────────────────────────

function PendingImageList({
  images,
  onRemove,
}: {
  images: { id: string; url: string }[];
  onRemove: (id: string) => void;
}) {
  return (
    <>
      {images.map((img) => (
        <div key={img.id} className="relative group/img flex-shrink-0">
          <img
            src={img.url}
            alt="Pending screenshot"
            className="h-14 w-20 object-cover rounded-lg border border-white/10"
          />
          <button
            onClick={() => onRemove(img.id)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-loss text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10"
          >
            <X size={9} />
          </button>
        </div>
      ))}
    </>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <X size={16} />
      </button>
      <img
        src={src}
        alt="Trade screenshot"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Trade Row ────────────────────────────────────────────────────────────────

function TradeRow({
  trade,
  onDelete,
  onEdit,
  onDeleteImage,
  onLightbox,
}: {
  trade: TradeEntry;
  onDelete: () => void;
  onEdit: () => void;
  onDeleteImage: (imageId: string) => void;
  onLightbox: (url: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const isWin   = trade.pnl > 0;
  const isLoss  = trade.pnl < 0;
  const netPnl  = trade.pnl - (trade.fees ?? 0);
  const hasImages = (trade.imageIds?.length ?? 0) > 0;

  const accentColor  = isWin ? "#22c55e" : isLoss ? "#ef4444" : "var(--tx-3)";
  const rowBg        = isWin
    ? "rgba(34,197,94,0.035)"
    : isLoss
    ? "rgba(239,68,68,0.035)"
    : "transparent";

  return (
    <div className="relative group">
      {/* Left accent stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm"
        style={{ background: accentColor, opacity: 0.7 }}
      />

      <div
        className="hidden md:grid gap-2 pl-5 pr-3 py-2.5 items-center transition-colors"
        style={{
          gridTemplateColumns: "68px 72px 72px 52px 88px 88px 1fr 84px 52px",
          background: rowBg,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = isWin ? "rgba(34,197,94,0.06)" : isLoss ? "rgba(239,68,68,0.06)" : "rgba(var(--surface-rgb),0.03)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
      >
        {/* Time */}
        <span className="text-[11px] text-tx-4 font-mono tabular-nums">{trade.time || "—"}</span>

        {/* Instrument */}
        {(() => {
          const iCol = getInstrumentColor(trade.instrument);
          return (
            <span className="text-[10px] font-black font-mono tracking-wide px-1.5 py-0.5 rounded"
              style={{ color: iCol, background: `${iCol}15`, border: `1px solid ${iCol}30` }}>
              {trade.instrument}
            </span>
          );
        })()}

        {/* Direction */}
        <span
          className="flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: trade.direction === "long" ? "#22c55e" : "#ef4444" }}
        >
          {trade.direction === "long"
            ? <ArrowUpRight size={10} strokeWidth={2.5} />
            : <ArrowDownRight size={10} strokeWidth={2.5} />}
          {trade.direction === "long" ? "Long" : "Short"}
        </span>

        {/* Qty */}
        <span className="text-[11px] text-tx-3 font-mono tabular-nums">{trade.contracts}</span>

        {/* Entry */}
        <span className="text-[11px] text-tx-3 font-mono tabular-nums">{(trade.entryPrice ?? 0).toFixed(2)}</span>

        {/* Exit */}
        <span className="text-[11px] text-tx-3 font-mono tabular-nums">{(trade.exitPrice ?? 0).toFixed(2)}</span>

        {/* Setup + Session */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] text-tx-3 truncate">{trade.setup || trade.notes || "—"}</span>
          {trade.session && (
            <span className="text-[9px] font-medium truncate" style={{ color: "var(--tx-4)" }}>{trade.session}</span>
          )}
        </div>

        {/* Net P&L */}
        <span
          className="text-[12px] font-black tabular-nums font-mono text-right"
          style={{ color: accentColor }}
        >
          {netPnl >= 0 ? "+" : ""}{fmtUSD(netPnl)}
        </span>

        {/* Actions */}
        <div className="flex justify-end gap-0.5">
          {!confirm ? (
            <>
              {hasImages && (
                <button
                  onClick={() => setShowImages((v) => !v)}
                  className="p-1 rounded transition-all"
                  style={{ color: showImages ? "#60a5fa" : "var(--tx-4)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#60a5fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = showImages ? "#60a5fa" : "var(--tx-4)")}
                  title={`${trade.imageIds!.length} screenshot${trade.imageIds!.length !== 1 ? "s" : ""}`}
                >
                  <ImageIcon size={10} />
                </button>
              )}
              <button
                onClick={onEdit}
                className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                style={{ color: "var(--tx-4)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--tx-1)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--tx-4)")}
              >
                <Edit2 size={10} />
              </button>
              <button
                onClick={() => setConfirm(true)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                style={{ color: "var(--tx-4)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--tx-4)")}
              >
                <Trash2 size={10} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={onDelete} className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>Del</button>
              <button onClick={() => setConfirm(false)} className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: "rgba(var(--surface-rgb),0.07)", color: "var(--tx-3)" }}>No</button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 md:hidden" style={{ background: rowBg }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const iCol = getInstrumentColor(trade.instrument);
                return (
                  <span className="text-[10px] font-black font-mono tracking-wide px-1.5 py-0.5 rounded"
                    style={{ color: iCol, background: `${iCol}15`, border: `1px solid ${iCol}30` }}>
                    {trade.instrument}
                  </span>
                );
              })()}
              <span className="text-[11px] text-tx-4 font-mono tabular-nums">{trade.time || "-"}</span>
              <span className="text-[11px] font-semibold" style={{ color: trade.direction === "long" ? "#22c55e" : "#ef4444" }}>
                {trade.direction === "long" ? "Long" : "Short"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.04)" }}>
                <div className="text-tx-4 text-[9px] uppercase tracking-wider">Entry</div>
                <div className="mt-1 text-tx-2 font-mono tabular-nums text-[11px]">{(trade.entryPrice ?? 0).toFixed(2)}</div>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.04)" }}>
                <div className="text-tx-4 text-[9px] uppercase tracking-wider">Exit</div>
                <div className="mt-1 text-tx-2 font-mono tabular-nums text-[11px]">{(trade.exitPrice ?? 0).toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-[10px] text-tx-3">
              <span>{trade.contracts} contracts</span>
              {trade.setup && <span className="truncate">{trade.setup}</span>}
              {trade.session && <span>{trade.session}</span>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[13px] font-black tabular-nums font-mono" style={{ color: accentColor }}>
              {netPnl >= 0 ? "+" : ""}{fmtUSD(netPnl)}
            </div>
            <div className="mt-2 flex items-center justify-end gap-1">
              {hasImages && (
                <button onClick={() => setShowImages((v) => !v)} className="p-1 rounded text-tx-4">
                  <ImageIcon size={12} />
                </button>
              )}
              {!confirm ? (
                <>
                  <button onClick={onEdit} className="p-1 rounded text-tx-4">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => setConfirm(true)} className="p-1 rounded text-tx-4">
                    <Trash2 size={12} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={onDelete} className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>Del</button>
                  <button onClick={() => setConfirm(false)} className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: "rgba(var(--surface-rgb),0.07)", color: "var(--tx-3)" }}>No</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expandable image gallery */}
      {showImages && hasImages && (
        <TradeImageGallery
          imageIds={trade.imageIds!}
          onDelete={onDeleteImage}
          onLightbox={onLightbox}
        />
      )}
    </div>
  );
}

// ─── Main Journal Page ────────────────────────────────────────────────────────

export default function Journal() {
  const { data, update } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();
  const handledLocationAction = useRef<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [addTradeOpen, setAddTradeOpen] = useState(false);
  const [editTradeId, setEditTradeId] = useState<string | null>(null);
  const [tradeForm, setTradeForm] = useState(emptyTradeForm);
  const [autoSaveLabel, setAutoSaveLabel] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Pending images for the current modal session (before trade is saved)
  const [pendingImages, setPendingImages] = useState<{ id: string; url: string }[]>([]);
  // Image IDs that were on the trade before editing started (so we can diff for deletes)
  const [originalImageIds, setOriginalImageIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Page theme + filter state ──
  const theme = PAGE_THEMES.journal;
  const [filters, setFilters] = useState({ direction: "all", outcome: "all", sort: "date" });

  useEffect(() => {
    const action = (location.state as { action?: string } | null)?.action;
    if (!action) {
      handledLocationAction.current = null;
      return;
    }
    if (handledLocationAction.current === action) return;
    if (action === "addTrade") {
      handledLocationAction.current = action;
      setEditTradeId(null);
      setPendingImages([]);
      setOriginalImageIds([]);
      setTradeForm({ ...emptyTradeForm(), date: selectedDate });
      setAddTradeOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate, selectedDate]);

  // ── Auto-calculate P&L + fees when firm / prices / contracts / instrument / direction change ──
  useEffect(() => {
    const { firm, entryPrice, exitPrice, contracts, instrument, direction } = tradeForm;
    if (!firm || !entryPrice || !exitPrice || !contracts) return;
    const entry  = parseFloat(entryPrice);
    const exit_  = parseFloat(exitPrice);
    const qty    = parseInt(contracts, 10);
    if (isNaN(entry) || isNaN(exit_) || isNaN(qty) || qty <= 0) return;
    const pointVal   = POINT_VALUE[instrument] ?? 1;
    const priceDiff  = direction === "long" ? (exit_ - entry) : (entry - exit_);
    const grossPnl   = priceDiff * pointVal * qty;
    const feePerSide = getFeePerSide(firm, instrument);
    const totalFees  = feePerSide * 2 * qty;
    setTradeForm((prev) => ({
      ...prev,
      pnl:  grossPnl.toFixed(2),
      fees: totalFees.toFixed(2),
    }));
    // Note: intentionally NOT including tradeForm.pnl / tradeForm.fees in deps
    // so user can manually override after auto-fill without triggering a loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeForm.firm, tradeForm.entryPrice, tradeForm.exitPrice, tradeForm.contracts, tradeForm.instrument, tradeForm.direction]);

  const today = todayISO();
  const isToday = selectedDate === today;

  // ── Journal entry for selected date ──
  const entries: JournalEntry[] = data.journalEntries ?? [];
  const entry = entries.find((e) => e.date === selectedDate);

  // ── Derived values for current entry ──
  const notes     = entry?.notes ?? "";
  const bias      = entry?.bias ?? "";
  const mood      = entry?.mood ?? "";
  // ── Trades for selected date ──
  const allTrades: TradeEntry[] = data.tradeJournal ?? [];
  const dayTrades = allTrades
    .filter((t) => t.date === selectedDate)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  // ── Filtered day trades (direction + outcome filters) ──
  const filteredDayTrades = dayTrades.filter((t) => {
    if (filters.direction !== "all" && t.direction?.toLowerCase() !== filters.direction) return false;
    if (filters.outcome === "win" && t.pnl <= 0) return false;
    if (filters.outcome === "loss" && t.pnl >= 0) return false;
    return true;
  });

  // ── Stats for selected date ──
  const dayStats = useMemo(() => {
    const wins    = dayTrades.filter((t) => t.pnl > 0).length;
    const losses  = dayTrades.filter((t) => t.pnl < 0).length;
    const total   = dayTrades.length;
    const gross   = dayTrades.reduce((s, t) => s + t.pnl, 0);
    const fees    = dayTrades.reduce((s, t) => s + (t.fees ?? 0), 0);
    const net     = gross - fees;
    const winRate = total > 0 ? (wins / total) * 100 : null;
    return { wins, losses, total, gross, fees, net, winRate };
  }, [dayTrades]);

  // ── Recent dates that have entries ──
  const recentDates = useMemo(() => {
    const withEntries = new Set([
      ...entries.map((e) => e.date),
      ...allTrades.map((t) => t.date),
    ]);
    return [...withEntries].sort((a, b) => b.localeCompare(a)).slice(0, 10);
  }, [entries, allTrades]);

  // ── All-time stats ──
  const allStats = useMemo(() => {
    const total      = allTrades.length;
    const wins       = allTrades.filter((t) => t.pnl > 0).length;
    const losses     = allTrades.filter((t) => t.pnl < 0).length;
    const gross      = allTrades.reduce((s, t) => s + t.pnl, 0);
    const fees       = allTrades.reduce((s, t) => s + (t.fees ?? 0), 0);
    const net        = gross - fees;
    const winRate    = total > 0 ? (wins / total) * 100 : null;
    const tradeDays  = new Set(allTrades.map((t) => t.date)).size;
    const winPnls    = allTrades.filter((t) => t.pnl > 0).map((t) => t.pnl);
    const lossPnls   = allTrades.filter((t) => t.pnl < 0).map((t) => t.pnl);
    const avgWin     = winPnls.length  > 0 ? winPnls.reduce((a, b) => a + b, 0)  / winPnls.length  : null;
    const avgLoss    = lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : null;
    const bestTrade  = winPnls.length  > 0 ? Math.max(...winPnls)  : null;
    const worstTrade = lossPnls.length > 0 ? Math.min(...lossPnls) : null;
    const grossWins  = winPnls.reduce((a, b) => a + b, 0);
    const grossLoss  = Math.abs(lossPnls.reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossWins / grossLoss : null;
    // Equity curve: running net P&L over all trades sorted by date+time
    const sorted = [...allTrades].sort((a, b) => {
      const da = a.date + (a.time ?? "");
      const db = b.date + (b.time ?? "");
      return da.localeCompare(db);
    });
    let running = 0;
    const equityCurve = sorted.map((t, i) => {
      running += t.pnl - (t.fees ?? 0);
      return { i, value: running };
    });
    return { total, wins, losses, net, winRate, tradeDays, avgWin, avgLoss, bestTrade, worstTrade, profitFactor, equityCurve };
  }, [allTrades]);

  // ── Day-of-week performance ──
  const dowStats = useMemo(() => {
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const byDow: Record<number, { net: number; count: number }> = {};
    allTrades.forEach((t) => {
      const d = new Date(t.date + "T00:00:00");
      const dow = d.getDay(); // 0=Sun, 1=Mon...5=Fri
      if (dow === 0 || dow === 6) return;
      const idx = dow - 1; // 0-4
      if (!byDow[idx]) byDow[idx] = { net: 0, count: 0 };
      byDow[idx].net += t.pnl - (t.fees ?? 0);
      byDow[idx].count += 1;
    });
    return DAYS.map((label, i) => ({
      label,
      net: byDow[i]?.net ?? 0,
      count: byDow[i]?.count ?? 0,
      avg: byDow[i]?.count ? byDow[i].net / byDow[i].count : 0,
    }));
  }, [allTrades]);

  // ── Monthly P&L breakdown ──
  const monthlyStats = useMemo(() => {
    const byMonth: Record<string, number> = {};
    allTrades.forEach((t) => {
      const key = t.date.slice(0, 7);
      byMonth[key] = (byMonth[key] ?? 0) + (t.pnl - (t.fees ?? 0));
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, net]) => ({
        month: new Date(key + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        net,
      }));
  }, [allTrades]);

  // ── This week's day-by-day breakdown (Mon–Fri) ──
  const thisWeekStats = useMemo(() => {
    const anchor = new Date(today + "T00:00:00");
    const dow = anchor.getDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() + mondayOffset);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const trades = allTrades.filter((t) => t.date === iso);
      const net = trades.length > 0
        ? trades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0)
        : null;
      return {
        iso,
        dayLabel: ["Mon", "Tue", "Wed", "Thu", "Fri"][i],
        net,
        tradeCount: trades.length,
        isToday: iso === today,
        isFuture: iso > today,
      };
    });
  }, [allTrades, today]);

  const weekNetPnL = thisWeekStats.reduce((s, d) => s + (d.net ?? 0), 0);
  const weekHasData = thisWeekStats.some((d) => d.net !== null);

  // ── Instrument breakdown ──
  const instrStats = useMemo(() => {
    const map: Record<string, { net: number; count: number; wins: number }> = {};
    allTrades.forEach((t) => {
      const k = t.instrument || "Other";
      if (!map[k]) map[k] = { net: 0, count: 0, wins: 0 };
      map[k].net += t.pnl - (t.fees ?? 0);
      map[k].count += 1;
      if (t.pnl > 0) map[k].wins += 1;
    });
    return Object.entries(map)
      .sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))
      .slice(0, 6)
      .map(([label, v]) => ({ label, net: v.net, count: v.count, wr: v.count > 0 ? (v.wins / v.count) * 100 : 0 }));
  }, [allTrades]);

  // ── 30-day heatmap data ──
  const heatmapDays = useMemo(() => {
    const days: { date: string; net: number | null; hasTrades: boolean; hasNote: boolean; dow: number }[] = [];
    const anchor = new Date(today + "T00:00:00");
    for (let i = 29; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const trades = allTrades.filter((t) => t.date === iso);
      const hasNote = entries.some((e) => e.date === iso);
      const net = trades.length > 0
        ? trades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0)
        : null;
      days.push({ date: iso, net, hasTrades: trades.length > 0, hasNote, dow: d.getDay() });
    }
    return days;
  }, [allTrades, entries, today]);

  // ── Updater helper ──
  function patchEntry(patch: Partial<Omit<JournalEntry, "id" | "date">>) {
    update((prev) => {
      const prevEntries: JournalEntry[] = prev.journalEntries ?? [];
      const idx = prevEntries.findIndex((e) => e.date === selectedDate);
      const existing = prevEntries[idx] ?? {
        id: generateId(), date: selectedDate, notes: "", bias: "", mood: "", checklist: [],
      };
      const updated = { ...existing, ...patch };
      const newEntries = idx >= 0
        ? prevEntries.map((e, i) => (i === idx ? updated : e))
        : [...prevEntries, updated];
      return { ...prev, journalEntries: newEntries };
    });
  }

  // ── Notes auto-save with debounce ──
  useEffect(() => {
    const timer = setTimeout(() => {
      if (notes !== (entry?.notes ?? "")) return;
      setAutoSaveLabel("");
    }, 2000);
    return () => clearTimeout(timer);
  }, [notes, entry]);

  function handleNotesChange(val: string) {
    patchEntry({ notes: val });
    setAutoSaveLabel("Saving…");
    setTimeout(() => setAutoSaveLabel("Saved ✓"), 600);
  }

  // ── Image handlers ──

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newImages = await Promise.all(
      files.map(async (file) => ({ id: generateId(), url: await fileToDataUrl(file) }))
    );
    setPendingImages((prev) => [...prev, ...newImages]);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingImage(id: string) {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  }

  // ── Add / Edit trade ──

  async function handleSaveTrade() {
    const { date, time, instrument, direction, entryPrice, exitPrice, contracts, pnl, fees, setup, session, notes: tradeNotes } = tradeForm;
    if (!entryPrice || !exitPrice) return;

    // Persist any newly added images to IndexedDB
    await Promise.all(pendingImages.map((img) => saveImage(img.id, img.url)));

    const newImageIds = pendingImages.map((img) => img.id);

    const tradeData = {
      date,
      time,
      instrument,
      direction,
      entryPrice: parseFloat(entryPrice) || 0,
      exitPrice:  parseFloat(exitPrice)  || 0,
      contracts:  parseInt(contracts)    || 1,
      pnl:        parseFloat(pnl)        || 0,
      fees:       parseFloat(fees)       || 0,
      setup,
      session,
      notes: tradeNotes,
      imageIds: newImageIds,
    };

    if (editTradeId) {
      // Keep any existing images that weren't removed
      const existingTrade = allTrades.find((t) => t.id === editTradeId);
      const keptOriginalIds = (existingTrade?.imageIds ?? []).filter(
        (id) => originalImageIds.includes(id)
      );
      tradeData.imageIds = [...keptOriginalIds, ...newImageIds];

      update((prev) => ({
        ...prev,
        tradeJournal: (prev.tradeJournal ?? []).map((t) =>
          t.id === editTradeId ? { ...t, ...tradeData } : t
        ),
      }));
      setEditTradeId(null);
    } else {
      const trade: TradeEntry = { id: generateId(), ...tradeData };
      update((prev) => ({
        ...prev,
        tradeJournal: [...(prev.tradeJournal ?? []), trade],
      }));
    }

    setAddTradeOpen(false);
    setPendingImages([]);
    setOriginalImageIds([]);
    setTradeForm({ ...emptyTradeForm(), date: selectedDate });
  }

  async function handleEditTrade(trade: TradeEntry) {
    setTradeForm({
      date:       trade.date,
      time:       trade.time,
      instrument: trade.instrument,
      direction:  trade.direction,
      entryPrice: String(trade.entryPrice),
      exitPrice:  String(trade.exitPrice),
      contracts:  String(trade.contracts),
      pnl:        String(trade.pnl),
      fees:       String(trade.fees ?? ""),
      setup:      trade.setup   ?? "",
      session:    trade.session ?? "New York",
      notes:      trade.notes   ?? "",
      firm:       "" as "" | "lucid" | "tradeify",
    });

    // Load existing images as "pending" so they appear in the modal
    const existingIds = trade.imageIds ?? [];
    setOriginalImageIds(existingIds);

    if (existingIds.length > 0) {
      const loaded = await getImages(existingIds);
      const existing = existingIds
        .filter((id) => loaded[id])
        .map((id) => ({ id, url: loaded[id] }));
      setPendingImages(existing);
    } else {
      setPendingImages([]);
    }

    setEditTradeId(trade.id);
    setAddTradeOpen(true);
  }

  function handleDeleteTrade(id: string) {
    // Clean up images from IndexedDB
    const trade = allTrades.find((t) => t.id === id);
    if (trade?.imageIds?.length) {
      deleteImages(trade.imageIds).catch(() => {});
    }
    update((prev) => ({
      ...prev,
      tradeJournal: (prev.tradeJournal ?? []).filter((t) => t.id !== id),
    }));
  }

  function handleDeleteTradeImage(tradeId: string, imageId: string) {
    deleteImage(imageId).catch(() => {});
    update((prev) => ({
      ...prev,
      tradeJournal: (prev.tradeJournal ?? []).map((t) =>
        t.id === tradeId
          ? { ...t, imageIds: (t.imageIds ?? []).filter((id) => id !== imageId) }
          : t
      ),
    }));
  }

  function openNewTradeModal() {
    setEditTradeId(null);
    setPendingImages([]);
    setOriginalImageIds([]);
    setTradeForm({ ...emptyTradeForm(), date: selectedDate });
    setAddTradeOpen(true);
  }

  function closeTradeModal() {
    // If cancelling an edit, don't delete the images – they already existed
    // If cancelling a new trade, discard any pending (not yet saved to IndexedDB)
    setPendingImages([]);
    setOriginalImageIds([]);
    setEditTradeId(null);
    setAddTradeOpen(false);
  }

  return (
    <div className="space-y-5 w-full page-enter">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Journal</div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "#f8fafc", letterSpacing: "-0.02em" }}>Trade Log</h1>
          <div className="flex items-center gap-2">
          {allStats.total > 0 && (
            <>
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(var(--surface-rgb),0.06)", border: "1px solid rgba(var(--border-rgb),0.12)", color: "var(--tx-3)" }}
              >
                <BarChart3 size={11} />
                {allStats.total} trades
              </span>
              {allStats.winRate !== null && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.15)", color: "#60a5fa" }}
                >
                  <Target size={11} />
                  {allStats.winRate.toFixed(0)}% WR
                </span>
              )}
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: allStats.net >= 0 ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
                  border: `1px solid ${allStats.net >= 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  color: allStats.net >= 0 ? "#4ade80" : "#f87171",
                }}
              >
                <Trophy size={11} />
                {allStats.net >= 0 ? "+" : ""}{fmtUSD(allStats.net)}
              </span>
              {allStats.profitFactor !== null && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.15)", color: "#a78bfa" }}
                >
                  <Sigma size={11} />
                  PF {allStats.profitFactor.toFixed(2)}
                </span>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {/* ── This Week Strip ── */}
      {weekHasData && (
        <div
          className="card px-4 py-3 flex items-center gap-4"
          style={{ background: "rgba(var(--surface-rgb),0.03)" }}
        >
          <div className="flex-shrink-0">
            <p className="text-[9px] uppercase tracking-widest font-bold text-tx-4 mb-0.5">This Week</p>
            <p
              className="text-sm font-black tabular-nums leading-none"
              style={{ color: weekNetPnL >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {weekNetPnL >= 0 ? "+" : ""}{fmtUSD(weekNetPnL)}
            </p>
          </div>

          <div className="h-8 w-px flex-shrink-0" style={{ background: "rgba(var(--border-rgb),0.09)" }} />

          <div className="flex items-end gap-1.5 flex-1 min-w-0">
            {thisWeekStats.map((day) => {
              const hasData = day.net !== null;
              const isPos   = (day.net ?? 0) >= 0;
              const barColor = !hasData
                ? "rgba(var(--surface-rgb),0.1)"
                : isPos ? "#22c55e" : "#ef4444";
              const maxAbs = Math.max(...thisWeekStats.map((d) => Math.abs(d.net ?? 0)), 1);
              const barH   = hasData ? Math.max(4, (Math.abs(day.net ?? 0) / maxAbs) * 28) : 4;

              return (
                <button
                  key={day.iso}
                  onClick={() => setSelectedDate(day.iso)}
                  className="flex flex-col items-center gap-1 flex-1 group transition-opacity"
                  style={{ opacity: day.isFuture ? 0.3 : 1 }}
                  title={day.iso}
                >
                  {/* bar */}
                  <div className="flex items-end justify-center w-full" style={{ height: 32 }}>
                    <div
                      className="w-full max-w-[24px] rounded-t-sm transition-all duration-300"
                      style={{
                        height: barH,
                        background: barColor,
                        boxShadow: hasData ? `0 0 6px ${barColor}55` : "none",
                        outline: day.iso === selectedDate ? `1.5px solid ${barColor}` : day.isToday ? `1px solid rgba(var(--border-rgb),0.35)` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  </div>
                  <span
                    className="text-[9px] font-mono font-semibold"
                    style={{ color: day.isToday ? "var(--tx-1)" : "var(--tx-4)" }}
                  >{day.dayLabel}</span>
                  {hasData && (
                    <span
                      className="text-[8px] font-mono tabular-nums leading-none"
                      style={{ color: isPos ? "#4ade80" : "#f87171" }}
                    >
                      {isPos ? "+" : ""}{fmtUSD(day.net!)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="h-8 w-px flex-shrink-0" style={{ background: "rgba(var(--border-rgb),0.09)" }} />

          <div className="flex-shrink-0 flex flex-col gap-1 text-right">
            <p className="text-[9px] uppercase tracking-widest font-bold text-tx-4">Trades</p>
            <p className="text-sm font-black text-tx-1">
              {thisWeekStats.reduce((s, d) => s + d.tradeCount, 0)}
            </p>
          </div>
        </div>
      )}

      {/* ── Main 2-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5 items-start">

        {/* ── Left: Date nav + Day content ── */}
        <div className="flex flex-col gap-5">

          {/* Date navigator */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedDate(prevDay(selectedDate))}
                className="p-2 rounded-lg text-tx-3 hover:text-tx-1 hover:bg-white/[0.06] transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex flex-col items-center gap-1">
                <h2 className="text-base font-bold text-tx-1">{fmtDisplayDate(selectedDate)}</h2>
                <div className="flex items-center gap-2">
                  {isToday && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(14,184,154,0.1)", color: "#1dd4b4", border: "1px solid rgba(14,184,154,0.2)" }}
                    >TODAY</span>
                  )}
                  <button
                    onClick={() => setSelectedDate(today)}
                    className={cn("text-[10px] transition-colors", isToday ? "text-tx-4" : "text-accent hover:text-accent-bright")}
                  >
                    {isToday ? "current session" : "← back to today"}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedDate(nextDay(selectedDate))}
                disabled={selectedDate >= today}
                className="p-2 rounded-lg text-tx-3 hover:text-tx-1 hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 14-day activity strip */}
            {(() => {
              const strip = lastNDays(today, 14);
              const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];
              return (
                <div className="flex gap-1 mt-4 pt-3 border-t border-white/[0.06]">
                  {strip.map((d) => {
                    const trades  = allTrades.filter((t) => t.date === d);
                    const dayNet  = trades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0);
                    const hasNote = entries.some((e) => e.date === d);
                    const hasData = trades.length > 0 || hasNote;
                    const isSelected2 = d === selectedDate;
                    const isToday2 = d === today;
                    const dow = new Date(d + "T00:00:00").getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const chipCol = trades.length > 0 ? (dayNet >= 0 ? "#22c55e" : "#ef4444") : hasNote ? "#3b82f6" : isWeekend ? "#1f2937" : "#1f2937";
                    const borderCol = isSelected2 ? (trades.length > 0 ? (dayNet >= 0 ? "#22c55e" : "#ef4444") : "#3b82f6") : "transparent";
                    return (
                      <button
                        key={d}
                        onClick={() => setSelectedDate(d)}
                        className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all"
                        style={{
                          background: isSelected2 ? `${borderCol}15` : "transparent",
                          border: `1px solid ${isSelected2 ? borderCol + "50" : "transparent"}`,
                          opacity: isWeekend && !hasData ? 0.25 : 1,
                        }}
                        title={d}
                      >
                        <span className="text-[8px] text-tx-4">{DOW[dow]}</span>
                        <div className="w-3.5 h-3.5 rounded-sm flex items-center justify-center"
                          style={{ background: chipCol, opacity: !hasData && !isWeekend ? 0.3 : 1 }}>
                          {isToday2 && <div className="w-1 h-1 rounded-full bg-white/80" />}
                        </div>
                        <span className="text-[7px] tabular-nums text-tx-4">
                          {new Date(d + "T00:00:00").getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Day stats strip */}
            {dayStats.total > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                {[
                  { label: "Trades",   value: String(dayStats.total),                                                       color: "var(--tx-3)", icon: <BarChart3 size={10} /> },
                  { label: "Win Rate", value: dayStats.winRate !== null ? `${dayStats.winRate.toFixed(0)}%` : "—",           color: "#3b82f6", icon: <Target size={10} /> },
                  { label: "Gross",    value: fmtUSD(dayStats.gross), color: dayStats.gross >= 0 ? "#22c55e" : "#ef4444",   icon: <TrendingUp size={10} /> },
                  { label: "Net P&L",  value: fmtUSD(dayStats.net),   color: dayStats.net   >= 0 ? "#22c55e" : "#ef4444",   icon: <Activity size={10} /> },
                ].map((s) => (
                  <div key={s.label} className="text-center py-2 px-1 rounded-lg"
                    style={{ background: `${s.color}0d`, border: `1px solid ${s.color}25` }}>
                    <div className="flex justify-center mb-0.5" style={{ color: s.color }}>{s.icon}</div>
                    <p className="text-[9px] text-tx-4 uppercase tracking-wider mb-0.5">{s.label}</p>
                    <p className="text-[12px] font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trade Log */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-accent" />
                <h2 className="text-sm font-semibold text-tx-1">Trade Log</h2>
                {filteredDayTrades.length > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(14,184,154,0.08)", color: "#1dd4b4", border: "1px solid rgba(14,184,154,0.15)" }}
                  >
                    {filteredDayTrades.length} trade{filteredDayTrades.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button onClick={openNewTradeModal} className="btn-primary btn btn-sm">
                <Plus size={13} />Log Trade
              </button>
            </div>

            {filteredDayTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <BarChart3 size={24} className="text-tx-4" />
                <p className="text-sm text-tx-3 font-medium">No trades logged for this day</p>
                <p className="text-xs text-tx-4">Click "Log Trade" to record a trade</p>
              </div>
            ) : (
              <div>
                {/* Column headers */}
                <div className="hidden md:grid gap-2 pl-5 pr-3 py-2 border-b border-white/[0.04]"
                  style={{ gridTemplateColumns: "68px 72px 72px 52px 88px 88px 1fr 84px 52px" }}>
                  {["Time", "Symbol", "Dir", "Qty", "Entry", "Exit", "Setup", "Net P&L", ""].map((h) => (
                    <span key={h} className="text-[9px] uppercase tracking-[0.12em] text-tx-4 font-semibold">{h}</span>
                  ))}
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {filteredDayTrades.map((t) => (
                    <TradeRow
                      key={t.id}
                      trade={t}
                      onDelete={() => handleDeleteTrade(t.id)}
                      onEdit={() => handleEditTrade(t)}
                      onDeleteImage={(imgId) => handleDeleteTradeImage(t.id, imgId)}
                      onLightbox={setLightboxSrc}
                    />
                  ))}
                </div>
                {/* Day summary footer */}
                <div className="px-4 py-3 border-t border-white/[0.06] flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between bg-white/[0.01]">
                  <span className="text-[11px] text-tx-4">
                    {dayStats.wins}W / {dayStats.losses}L · {fmtUSD(dayStats.fees)} fees
                  </span>
                  <span className={cn("text-sm font-black tabular-nums", dayStats.net >= 0 ? "text-profit" : "text-loss")}>
                    {dayStats.net >= 0 ? "+" : ""}{fmtUSD(dayStats.net)} net
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Right sidebar ── */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-6">

          {/* All-time stats */}
          {allStats.total > 0 && (
            <div className="card p-4">
              <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                <Sigma size={10} className="text-accent" />Overall Stats
              </p>

              {/* Equity curve sparkline */}
              {allStats.equityCurve.length > 1 && (
                <div className="mb-3 rounded-lg overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.07)" }}>
                  <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                    <span className="text-[9px] text-tx-4 uppercase tracking-wider">Equity Curve</span>
                    <span className={cn("text-[10px] font-black tabular-nums", allStats.net >= 0 ? "text-profit" : "text-loss")}>
                      {allStats.net >= 0 ? "+" : ""}{fmtUSD(allStats.net)}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={52}>
                    <AreaChart data={allStats.equityCurve} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={allStats.net >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={allStats.net >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={allStats.net >= 0 ? "#22c55e" : "#ef4444"}
                        strokeWidth={1.5}
                        fill="url(#eqGrad)"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <RechartTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const v = payload[0].value as number;
                          return (
                            <div style={{ background: "var(--bg-elevated)", border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: 6, padding: "4px 8px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: v >= 0 ? "#22c55e" : "#ef4444" }}>
                                {v >= 0 ? "+" : ""}{fmtUSD(v)}
                              </span>
                            </div>
                          );
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Trades",   value: String(allStats.total),                                                             color: "var(--tx-3)" },
                  { label: "Win Rate", value: allStats.winRate !== null ? `${allStats.winRate.toFixed(0)}%` : "—",                 color: "#3b82f6" },
                  { label: "Avg Win",  value: allStats.avgWin  !== null ? fmtUSD(allStats.avgWin)  : "—",                         color: "#22c55e" },
                  { label: "Avg Loss", value: allStats.avgLoss !== null ? fmtUSD(allStats.avgLoss) : "—",                         color: "#ef4444" },
                  { label: "Best",     value: allStats.bestTrade  !== null ? `+${fmtUSD(allStats.bestTrade)}`  : "—",             color: "#4ade80" },
                  { label: "P.Factor", value: allStats.profitFactor !== null ? allStats.profitFactor.toFixed(2) : "—",            color: "#a78bfa" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg p-2 text-center"
                    style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.07)" }}
                  >
                    <p className="text-[9px] text-tx-4 uppercase tracking-wider mb-0.5">{s.label}</p>
                    <p className="text-[11px] font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* W/L bar */}
              {allStats.total > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-tx-4">{allStats.wins}W</span>
                    <span className="text-[9px] text-tx-4">{allStats.losses}L</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                    <div
                      className="h-full rounded-l-full transition-all duration-500"
                      style={{ width: `${(allStats.wins / allStats.total) * 100}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)" }}
                    />
                    <div
                      className="h-full rounded-r-full"
                      style={{ flex: 1, background: "linear-gradient(90deg,#ef4444,#b91c1c)" }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Day-of-week performance */}
          {allStats.total > 0 && (() => {
            const maxAbs = Math.max(...dowStats.map((d) => Math.abs(d.avg)), 0.01);
            return (
              <div className="card p-4">
                <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                  <Calendar size={10} className="text-accent" />By Day
                </p>
                <div className="flex flex-col gap-1.5">
                  {dowStats.map((d) => {
                    const barW = (Math.abs(d.avg) / maxAbs) * 100;
                    const isPos = d.avg >= 0;
                    const hasData = d.count > 0;
                    return (
                      <div key={d.label} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-tx-4 w-7 flex-shrink-0">{d.label}</span>
                        <div className="flex-1 h-3.5 rounded-sm overflow-hidden relative" style={{ background: "rgba(var(--surface-rgb),0.06)" }}>
                          {hasData && (
                            <div
                              className="absolute left-0 top-0 h-full rounded-sm transition-all duration-500"
                              style={{
                                width: `${barW}%`,
                                background: isPos
                                  ? "linear-gradient(90deg,#16a34a,#22c55e)"
                                  : "linear-gradient(90deg,#ef4444,#b91c1c)",
                                opacity: 0.75,
                              }}
                            />
                          )}
                        </div>
                        <span
                          className="text-[10px] font-mono font-bold tabular-nums w-16 text-right flex-shrink-0"
                          style={{ color: hasData ? (isPos ? "#4ade80" : "#f87171") : "var(--tx-4)" }}
                        >
                          {hasData ? `${isPos ? "+" : ""}${fmtUSD(d.avg)}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[9px] text-tx-4 mt-2">avg net P&amp;L per trade by weekday</p>
              </div>
            );
          })()}

          {/* Monthly P&L bar chart */}
          {monthlyStats.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <BarChart3 size={10} className="text-accent" />Monthly P&L
                </p>
                <span className={cn(
                  "text-[10px] font-bold tabular-nums",
                  monthlyStats[monthlyStats.length - 1].net >= 0 ? "text-profit" : "text-loss"
                )}>
                  {monthlyStats[monthlyStats.length - 1].net >= 0 ? "+" : ""}
                  {fmtUSD(monthlyStats[monthlyStats.length - 1].net)}
                  <span className="text-tx-4 font-normal ml-1">this mo</span>
                </span>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={monthlyStats} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barSize={10}>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "var(--tx-4)", fontSize: 8, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine y={0} stroke="rgba(var(--border-rgb),0.1)" strokeWidth={1} />
                  <RechartTooltip
                    cursor={{ fill: "rgba(var(--surface-rgb),0.04)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const v = payload[0].value as number;
                      return (
                        <div style={{ background: "var(--bg-elevated)", border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: 6, padding: "4px 8px" }}>
                          <p style={{ fontSize: 9, color: "var(--tx-4)", marginBottom: 2 }}>{label}</p>
                          <span style={{ fontSize: 11, fontWeight: 700, color: v >= 0 ? "#22c55e" : "#ef4444" }}>
                            {v >= 0 ? "+" : ""}{fmtUSD(v)}
                          </span>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="net" radius={[2, 2, 0, 0]}>
                    {monthlyStats.map((entry, i) => (
                      <Cell key={i} fill={entry.net >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 30-day heatmap */}
          {allStats.total > 0 && (
            <div className="card p-4">
              <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                <Activity size={10} className="text-accent" />30-Day Activity
              </p>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(10, 1fr)" }}>
                {heatmapDays.map((d) => {
                  const isWknd  = d.dow === 0 || d.dow === 6;
                  const isToday2 = d.date === today;
                  const isSel   = d.date === selectedDate;
                  let bg = "rgba(var(--surface-rgb),0.06)";
                  if (isWknd) bg = "rgba(var(--surface-rgb),0.03)";
                  if (d.hasNote && !d.hasTrades) bg = "rgba(59,130,246,0.25)";
                  if (d.hasTrades && d.net !== null) {
                    const intensity = Math.min(1, Math.abs(d.net) / 200);
                    if (d.net >= 0) bg = `rgba(34,197,94,${0.25 + intensity * 0.55})`;
                    else bg = `rgba(239,68,68,${0.25 + intensity * 0.55})`;
                  }
                  return (
                    <button
                      key={d.date}
                      title={`${d.date}${d.net !== null ? ` · ${d.net >= 0 ? "+" : ""}$${d.net.toFixed(0)}` : ""}`}
                      onClick={() => setSelectedDate(d.date)}
                      className="aspect-square rounded-sm transition-all duration-150"
                      style={{
                        background: bg,
                        outline: isSel ? "1.5px solid rgba(var(--border-rgb),0.55)" : isToday2 ? "1px solid rgba(var(--border-rgb),0.3)" : "none",
                        outlineOffset: "1px",
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[8px] text-tx-4">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "rgba(34,197,94,0.7)" }} />Profit
                  </span>
                  <span className="flex items-center gap-1 text-[8px] text-tx-4">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "rgba(239,68,68,0.7)" }} />Loss
                  </span>
                  <span className="flex items-center gap-1 text-[8px] text-tx-4">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "rgba(59,130,246,0.5)" }} />Note
                  </span>
                </div>
                <span className="text-[8px] text-tx-4">click to navigate</span>
              </div>
            </div>
          )}

          {/* Instrument breakdown */}
          {instrStats.length > 0 && (
            <div className="card p-4">
              <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                <BarChart3 size={10} className="text-accent" />By Instrument
              </p>
              <div className="flex flex-col gap-1.5">
                {instrStats.map((s) => {
                  const maxNet = Math.max(...instrStats.map((x) => Math.abs(x.net)), 0.01);
                  const barW   = (Math.abs(s.net) / maxNet) * 100;
                  const isPos  = s.net >= 0;
                  return (
                    <div key={s.label} className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-black font-mono w-8 flex-shrink-0"
                        style={{ color: getInstrumentColor(s.label) }}
                      >
                        {s.label}
                      </span>
                      <div className="flex-1 h-3.5 rounded-sm overflow-hidden relative" style={{ background: "rgba(var(--surface-rgb),0.06)" }}>
                        <div
                          className="absolute left-0 top-0 h-full rounded-sm transition-all duration-500"
                          style={{
                            width: `${barW}%`,
                            background: isPos
                              ? "linear-gradient(90deg,#16a34a,#22c55e)"
                              : "linear-gradient(90deg,#ef4444,#b91c1c)",
                            opacity: 0.75,
                          }}
                        />
                      </div>
                      <div className="text-right flex-shrink-0" style={{ minWidth: 60 }}>
                        <span
                          className="text-[10px] font-bold tabular-nums block"
                          style={{ color: isPos ? "#4ade80" : "#f87171" }}
                        >
                          {isPos ? "+" : ""}{fmtUSD(s.net)}
                        </span>
                        <span className="text-[8px] text-tx-4 tabular-nums">
                          {s.count}t · {s.wr.toFixed(0)}%WR
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent entries */}
          {recentDates.length > 0 && (
            <div className="card p-4">
              <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                <Clock size={10} />Recent Days
              </p>
              <div className="flex flex-col gap-1">
                {recentDates.map((date) => {
                  const e      = entries.find((en) => en.date === date);
                  const trades = allTrades.filter((t) => t.date === date);
                  const dayNet = trades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0);
                  const isSelected = date === selectedDate;
                  const rowCol = trades.length > 0 ? (dayNet >= 0 ? "#22c55e" : "#ef4444") : "#3b82f6";
                  const biasObj = BIAS_OPTIONS.find((b) => b.value === e?.bias);
                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all relative overflow-hidden"
                      style={{
                        background: isSelected ? `${rowCol}10` : "rgba(var(--surface-rgb),0.03)",
                        border: `1px solid ${isSelected ? rowCol + "30" : "rgba(var(--border-rgb),0.06)"}`,
                        borderLeft: `2px solid ${isSelected ? rowCol : rowCol + "40"}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-xs font-bold" style={{ color: isSelected ? rowCol : "var(--tx-1)" }}>
                            {fmtShortDate(date)}
                          </p>
                          {e?.bias && biasObj ? (
                            <p className="text-[9px] font-medium capitalize" style={{ color: biasObj.color + "aa" }}>
                              {e.bias}
                            </p>
                          ) : (
                            <p className="text-[9px] text-tx-4">journal</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {trades.length > 0 ? (
                          <>
                            <p className="text-xs font-bold tabular-nums" style={{ color: dayNet >= 0 ? "#22c55e" : "#ef4444" }}>
                              {dayNet >= 0 ? "+" : ""}{fmtUSD(dayNet)}
                            </p>
                            <p className="text-[9px] text-tx-4">{trades.length} trade{trades.length !== 1 ? "s" : ""}</p>
                          </>
                        ) : (
                          <p className="text-[9px] text-tx-4">{e?.notes ? "notes" : "—"}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Trade Modal ── */}
      <Modal
        open={addTradeOpen}
        onClose={closeTradeModal}
        title={editTradeId ? "Edit Trade" : "Log Trade"}
        size="md"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-tx-3 text-xs block mb-1">Date</label>
              <input
                type="date"
                className="nx-input"
                value={tradeForm.date}
                onChange={(e) => setTradeForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1">Time (ET)</label>
              <input
                type="time"
                className="nx-input"
                value={tradeForm.time}
                onChange={(e) => setTradeForm((p) => ({ ...p, time: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1">Instrument</label>
              <select
                className="nx-select"
                value={tradeForm.instrument}
                onChange={(e) => setTradeForm((p) => ({ ...p, instrument: e.target.value }))}
              >
                {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-tx-3 text-xs block mb-1">Direction</label>
              <div className="flex gap-2">
                {(["long", "short"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setTradeForm((p) => ({ ...p, direction: d }))}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-all capitalize"
                    style={{
                      background: tradeForm.direction === d
                        ? (d === "long" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)")
                        : "rgba(var(--surface-rgb),0.05)",
                      border: `1px solid ${tradeForm.direction === d ? (d === "long" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)") : "rgba(var(--border-rgb),0.09)"}`,
                      color: tradeForm.direction === d ? (d === "long" ? "#22c55e" : "#ef4444") : "var(--tx-3)",
                    }}
                  >
                    {d === "long" ? "▲ Long" : "▼ Short"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1">Contracts</label>
              <input
                type="number"
                className="nx-input"
                min="1"
                value={tradeForm.contracts}
                onChange={(e) => setTradeForm((p) => ({ ...p, contracts: e.target.value }))}
              />
            </div>
          </div>

          {/* ── Prop Firm selector (drives auto-calculation) ── */}
          <div>
            <label className="text-tx-3 text-xs block mb-1.5 flex items-center gap-1.5">
              <Zap size={10} className="text-warn" />
              Prop Firm
              <span className="text-tx-4 opacity-60 font-normal">(auto-calculates P&L &amp; fees)</span>
            </label>
            <div className="flex gap-2">
              {(["", "lucid", "tradeify"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTradeForm((p) => ({ ...p, firm: f }))}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: tradeForm.firm === f
                      ? f === "lucid"    ? "rgba(168,85,247,0.18)"
                      : f === "tradeify" ? "rgba(59,130,246,0.18)"
                      : "rgba(var(--surface-rgb),0.08)"
                      : "rgba(var(--surface-rgb),0.04)",
                    border: `1px solid ${tradeForm.firm === f
                      ? f === "lucid"    ? "rgba(168,85,247,0.45)"
                      : f === "tradeify" ? "rgba(59,130,246,0.45)"
                      : "rgba(var(--border-rgb),0.2)"
                      : "rgba(var(--border-rgb),0.09)"}`,
                    color: tradeForm.firm === f
                      ? f === "lucid"    ? "#c084fc"
                      : f === "tradeify" ? "#60a5fa"
                      : "var(--tx-2)"
                      : "var(--tx-3)",
                  }}
                >
                  {f === "" ? "Manual" : f === "lucid" ? "Lucid" : "Tradeify"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-tx-3 text-xs block mb-1">Entry Price</label>
              <input
                type="number"
                step="0.25"
                className="nx-input"
                placeholder="0.00"
                value={tradeForm.entryPrice}
                onChange={(e) => setTradeForm((p) => ({ ...p, entryPrice: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1">Exit Price</label>
              <input
                type="number"
                step="0.25"
                className="nx-input"
                placeholder="0.00"
                value={tradeForm.exitPrice}
                onChange={(e) => setTradeForm((p) => ({ ...p, exitPrice: e.target.value }))}
              />
            </div>
          </div>

          {/* ── Calculation preview ── */}
          {(() => {
            const { firm, entryPrice, exitPrice, contracts, instrument, direction } = tradeForm;
            if (!firm || !entryPrice || !exitPrice || !contracts) return null;
            const entry   = parseFloat(entryPrice);
            const exit_   = parseFloat(exitPrice);
            const qty     = parseInt(contracts, 10);
            if (isNaN(entry) || isNaN(exit_) || isNaN(qty) || qty <= 0) return null;
            const pointVal   = POINT_VALUE[instrument] ?? 1;
            const priceDiff  = direction === "long" ? (exit_ - entry) : (entry - exit_);
            const grossPnl   = priceDiff * pointVal * qty;
            const feePerSide = getFeePerSide(firm, instrument);
            const totalFees  = feePerSide * 2 * qty;
            const netPnl     = grossPnl - totalFees;
            const isProfit   = netPnl >= 0;
            return (
              <div
                className="rounded-xl px-3.5 py-2.5"
                style={{
                  background: isProfit ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                  border: `1px solid ${isProfit ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}`,
                }}
              >
                <div className="flex items-center gap-1 mb-2">
                  <Zap size={9} style={{ color: isProfit ? "#22c55e" : "#ef4444" }} />
                  <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: isProfit ? "#22c55e" : "#ef4444" }}>
                    Auto-calculated · {firm === "lucid" ? "Lucid" : "Tradeify"} · {instrument} · {Math.abs(priceDiff).toFixed(2)} pts × ${pointVal} × {qty}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-[9px] text-tx-4 mb-0.5">Gross P&L</p>
                    <p className="text-sm font-bold font-mono tabular-nums" style={{ color: grossPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                      {grossPnl >= 0 ? "+" : ""}{fmtUSD(grossPnl)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-tx-4 mb-0.5">Fees ({qty}× ${(feePerSide * 2).toFixed(2)})</p>
                    <p className="text-sm font-bold font-mono tabular-nums text-warn">
                      −{fmtUSD(totalFees)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-tx-4 mb-0.5">Net P&L</p>
                    <p className="text-sm font-bold font-mono tabular-nums" style={{ color: isProfit ? "#22c55e" : "#ef4444" }}>
                      {netPnl >= 0 ? "+" : ""}{fmtUSD(netPnl)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-tx-3 text-xs block mb-1">
                Gross P&L ($)
                {tradeForm.firm && <span className="text-[9px] text-tx-4 ml-1">(auto-filled)</span>}
              </label>
              <input
                type="number"
                step="0.01"
                className="nx-input"
                placeholder="0.00"
                value={tradeForm.pnl}
                onChange={(e) => setTradeForm((p) => ({ ...p, pnl: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1">
                Fees ($)
                {tradeForm.firm && <span className="text-[9px] text-tx-4 ml-1">(auto-filled)</span>}
              </label>
              <input
                type="number"
                step="0.01"
                className="nx-input"
                placeholder="0.00"
                value={tradeForm.fees}
                onChange={(e) => setTradeForm((p) => ({ ...p, fees: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-tx-3 text-xs block mb-1">Setup / Pattern</label>
              <input
                type="text"
                className="nx-input"
                placeholder="e.g. Break & Retest"
                value={tradeForm.setup}
                onChange={(e) => setTradeForm((p) => ({ ...p, setup: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1">Session</label>
              <select
                className="nx-select"
                value={tradeForm.session}
                onChange={(e) => setTradeForm((p) => ({ ...p, session: e.target.value }))}
              >
                {["Asia", "London", "New York", "London Close"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Screenshot / Chart upload ── */}
          <div>
            <label className="text-tx-3 text-xs block mb-2 flex items-center gap-1.5">
              <ImageIcon size={10} />
              Screenshots / Charts
              <span className="opacity-50">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              <PendingImageList images={pendingImages} onRemove={removePendingImage} />
              {/* Upload button */}
              <label className="h-14 w-20 flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer transition-all text-tx-4 hover:text-accent"
                style={{ border: "1px dashed rgba(var(--border-rgb),0.2)", background: "rgba(var(--surface-rgb),0.03)" }}
              >
                <ImageIcon size={14} />
                <span className="text-[9px] font-medium">Add</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageFileChange}
                />
              </label>
            </div>
            {pendingImages.length > 0 && (
              <p className="text-[9px] text-tx-4 mt-1">
                {pendingImages.length} image{pendingImages.length !== 1 ? "s" : ""} attached · saved to local IndexedDB
              </p>
            )}
          </div>

          {/* Market Bias + Trading Mood */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-tx-3 text-xs block mb-1.5 flex items-center gap-1.5">
                <TrendingUp size={10} />Market Bias
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {BIAS_OPTIONS.map(({ value, label, color, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchEntry({ bias: bias === value ? "" : value as JournalEntry["bias"] })}
                    className="min-w-0 px-1 flex items-center justify-center gap-1 py-2 rounded-lg text-center leading-tight whitespace-normal break-words text-[10px] md:text-[11px] font-semibold transition-all"
                    style={{
                      background: bias === value ? `${color}18` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${bias === value ? color + "40" : "rgba(255,255,255,0.09)"}`,
                      color: bias === value ? color : "var(--tx-3)",
                    }}
                  >
                    <Icon size={10} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1.5 flex items-center gap-1.5">
                <Smile size={10} />Trading Mood
              </label>
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                {MOOD_OPTIONS.map(({ value, label, color, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchEntry({ mood: mood === value ? "" : value as JournalEntry["mood"] })}
                    className="min-w-0 px-1 flex items-center justify-center gap-1 py-2 rounded-lg text-center leading-tight whitespace-normal break-words text-[10px] md:text-[11px] font-semibold transition-all"
                    style={{
                      background: mood === value ? `${color}18` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${mood === value ? color + "40" : "rgba(255,255,255,0.09)"}`,
                      color: mood === value ? color : "var(--tx-3)",
                    }}
                  >
                    <Icon size={10} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              className="btn-primary btn flex-1"
              onClick={handleSaveTrade}
              disabled={!tradeForm.entryPrice || !tradeForm.exitPrice}
              style={(!tradeForm.entryPrice || !tradeForm.exitPrice) ? { opacity: 0.5 } : undefined}
            >
              <BarChart3 size={13} />
              {editTradeId ? "Update Trade" : "Log Trade"}
            </button>
            <button className="btn-ghost btn" onClick={closeTradeModal}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}
