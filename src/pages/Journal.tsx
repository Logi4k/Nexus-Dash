import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from 'sonner';
import { useLocation } from "react-router-dom";
import { PAGE_THEMES } from "@/lib/theme";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  Calendar,
  Zap,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Image as ImageIcon,
  X,
  ZoomIn,
  Trophy,
  Sigma,
  Activity,
  NotebookPen,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  ResponsiveContainer, Tooltip as RechartTooltip,
  XAxis, ReferenceLine,
} from "recharts";
import { useAppData } from "@/lib/store";
import { getQuickActionState } from "@/lib/quickActions";
import { getPropAccountSnapshot } from "@/lib/propRules";
import {
  formatAccountOptionLabel,
  getAccountPhaseLabel,
  isActiveAccount,
  normalizeAccountStatus,
} from "@/lib/accountStatus";
import { cn, fmtUSD, generateId, FUTURES_CONTRACTS } from "@/lib/utils";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import Modal from "@/components/Modal";
import {
  saveImage,
  getImagesWithCloudFallback,
  deleteImage,
  deleteImages,
  deleteImageFromCloud,
  deleteImagesFromCloud,
  uploadImageToCloud,
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

// Instrument color families — keep in sync with --color-instr-* tokens in index.css
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


const DRAFT_KEY = "nexus_trade_draft";

// ─── Trade Form defaults ──────────────────────────────────────────────────────

function emptyTradeForm() {
  return {
    date: todayISO(),
    time: new Date().toTimeString().slice(0, 5),
    instrument: "ES",
    direction: "long" as "long" | "short",
    entryPrice: "",
    stopLoss: "",
    exitPrice: "",
    contracts: "1",
    pnl: "",
    fees: "",
    setup: "",
    session: "New York",
    notes: "",
    tags: [] as string[],
    firm: "" as "" | "lucid" | "tradeify", // UI-only: used for auto-calc, not persisted
    accountId: undefined as string | undefined,
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
    getImagesWithCloudFallback(imageIds).then(setImages);
  }, [imageIds]);

  if (imageIds.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3 pt-2 border-t" style={{ borderColor: "rgba(var(--border-rgb),0.07)" }}>
      {imageIds.map((id) =>
        images[id] ? (
          <div key={id} className="relative group/img flex-shrink-0">
            <img
              src={images[id]}
              alt="Trade screenshot"
              className="h-16 w-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              style={{ border: "1px solid rgba(var(--border-rgb),0.15)" }}
              onClick={() => onLightbox(images[id])}
            />
            <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none">
              <ZoomIn size={14} className="text-tx-1 drop-shadow" />
            </div>
            <button
              onClick={() => onDelete(id)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-loss text-tx-1 flex items-center justify-center md:opacity-0 md:group-hover/img:opacity-100 transition-opacity z-10"
            >
              <X size={9} />
            </button>
          </div>
        ) : (
          // Skeleton while loading
          <div key={id} className="h-16 w-24 rounded-lg animate-pulse flex-shrink-0"
            style={{ background: "rgba(var(--surface-rgb),0.06)" }} />
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
            className="h-14 w-20 object-cover rounded-lg border border-border"
          />
          <button
            onClick={() => onRemove(img.id)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-loss text-tx-1 flex items-center justify-center md:opacity-0 md:group-hover/img:opacity-100 transition-opacity z-10"
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
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-tx-1 flex items-center justify-center transition-colors"
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

function calcRR(trade: TradeEntry): string | null {
  if (!trade.stopLoss || trade.stopLoss <= 0) return null;
  const risk = Math.abs(trade.entryPrice - trade.stopLoss);
  if (risk === 0) return null;
  const reward = Math.abs(trade.exitPrice - trade.entryPrice);
  const rr = reward / risk;
  return rr.toFixed(1) + "R";
}

function TradeRow({
  trade,
  onDelete,
  onEdit,
  onView,
  onDeleteImage,
  onLightbox,
}: {
  trade: TradeEntry;
  onDelete: () => void;
  onEdit: () => void;
  onView: () => void;
  onDeleteImage: (imageId: string) => void;
  onLightbox: (url: string) => void;
}) {
  const bw = useBWMode();
  const [confirm, setConfirm] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const isWin   = trade.pnl > 0;
  const isLoss  = trade.pnl < 0;
  const netPnl  = trade.pnl - (trade.fees ?? 0);
  const rrLabel = calcRR(trade);
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
        className="hidden md:grid gap-2 pl-5 pr-3 py-2.5 items-center transition-colors cursor-pointer"
        style={{
          gridTemplateColumns: "68px 72px 72px 52px 88px 88px 1fr 84px 52px",
          background: rowBg,
        }}
        onClick={onView}
        onMouseEnter={(e) => (e.currentTarget.style.background = isWin ? "rgba(34,197,94,0.06)" : isLoss ? "rgba(239,68,68,0.06)" : "rgba(var(--surface-rgb),0.03)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
      >
        {/* Time */}
        <span className="text-[11px] text-tx-4 font-mono tabular-nums">{trade.time || "—"}</span>

        {/* Instrument */}
        {(() => {
          const iCol = bwColor(getInstrumentColor(trade.instrument), bw);
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

        {/* Setup + Session + Tags */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] text-tx-3 truncate">{trade.setup || trade.notes || "—"}</span>
          <div className="flex items-center gap-1 flex-wrap">
            {trade.session && (
              <span className="text-[10px] font-medium truncate" style={{ color: "var(--tx-4)" }}>{trade.session}</span>
            )}
            {trade.tags && trade.tags.length > 0 && (
              <>
                {trade.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-muted text-tx-3">#{tag}</span>
                ))}
                {trade.tags.length > 3 && (
                  <span className="text-[9px] text-tx-4">+{trade.tags.length - 3} more</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Net P&L */}
        <div className="flex flex-col items-end gap-0.5">
          <span
            className="text-[12px] font-black tabular-nums font-mono text-right"
            style={{ color: accentColor }}
          >
            {netPnl >= 0 ? "+" : ""}{fmtUSD(netPnl)}
          </span>
          {rrLabel && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent-muted text-tx-3">
              {rrLabel}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
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
                className="md:opacity-0 md:group-hover:opacity-100 p-1 rounded transition-all"
                style={{ color: "var(--tx-4)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--tx-1)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--tx-4)")}
              >
                <Edit2 size={10} />
              </button>
              <button
                onClick={() => setConfirm(true)}
                className="md:opacity-0 md:group-hover:opacity-100 p-1 rounded transition-all"
                style={{ color: "var(--tx-4)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--tx-4)")}
              >
                <Trash2 size={10} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={onDelete} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>Del</button>
              <button onClick={() => setConfirm(false)} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: "rgba(var(--surface-rgb),0.07)", color: "var(--tx-3)" }}>No</button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 md:hidden cursor-pointer" style={{ background: rowBg }} onClick={onView}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const iCol = bwColor(getInstrumentColor(trade.instrument), bw);
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
                <div className="text-tx-3 text-[10px] uppercase tracking-wider">Entry</div>
                <div className="mt-1 text-tx-2 font-mono tabular-nums text-[11px]">{(trade.entryPrice ?? 0).toFixed(2)}</div>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.04)" }}>
                <div className="text-tx-3 text-[10px] uppercase tracking-wider">Exit</div>
                <div className="mt-1 text-tx-2 font-mono tabular-nums text-[11px]">{(trade.exitPrice ?? 0).toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-[10px] text-tx-3">
              <span>{trade.contracts} contracts</span>
              {trade.setup && <span className="truncate">{trade.setup}</span>}
              {trade.session && <span>{trade.session}</span>}
              {trade.tags && trade.tags.length > 0 && (
                <>
                  {trade.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-muted text-tx-3">#{tag}</span>
                  ))}
                  {trade.tags.length > 3 && (
                    <span className="text-[9px] text-tx-4">+{trade.tags.length - 3} more</span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[13px] font-black tabular-nums font-mono" style={{ color: accentColor }}>
              {netPnl >= 0 ? "+" : ""}{fmtUSD(netPnl)}
            </div>
            {rrLabel && (
              <div className="mt-0.5 flex justify-end">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent-muted text-tx-3">
                  {rrLabel}
                </span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
                  <button onClick={onDelete} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>Del</button>
                  <button onClick={() => setConfirm(false)} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
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

// ─── Custom Select ────────────────────────────────────────────────────────────
interface SelectOption { value: string; label: string; }
function CustomSelect({
  value, onChange, options, placeholder = "Select…", small = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={small
          ? "text-[10px] px-2 py-0.5 rounded-full font-semibold border border-border text-tx-3 flex items-center gap-1"
          : "w-full text-left px-3 py-2 rounded-xl text-sm border border-border text-tx-1 flex items-center justify-between gap-2"
        }
        style={{ background: "rgba(var(--surface-rgb),0.04)", minWidth: small ? undefined : "100%" }}
      >
        <span style={{ color: selected ? (small ? "var(--tx-3)" : "var(--tx-1)") : "var(--tx-4)" }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: "var(--tx-4)", flexShrink: 0, transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}>
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            maxWidth: "min(90vw, 320px)",
            background: "var(--bg-elevated)",
            border: "1px solid rgba(var(--border-rgb),0.12)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 300,
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{
                background: opt.value === value ? "rgba(var(--surface-rgb),0.08)" : "transparent",
                color: opt.value === value ? "var(--tx-1)" : "var(--tx-2)",
                fontSize: small ? 11 : 13,
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(var(--surface-rgb),0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = opt.value === value ? "rgba(var(--surface-rgb),0.08)" : "transparent")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Journal Page ────────────────────────────────────────────────────────

function getAccountPhaseColor(status: string | undefined): string {
  const phase = normalizeAccountStatus(status);
  if (phase === "funded") return "#3b82f6";
  if (phase === "challenge") return "#eab308";
  if (phase === "breached") return "#ef4444";
  return "var(--tx-3)";
}

export default function Journal() {
  const { data, update } = useAppData();
  const location = useLocation();
  const handledLocationAction = useRef<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [addTradeOpen, setAddTradeOpen] = useState(false);
  const [editTradeId, setEditTradeId] = useState<string | null>(null);
  const [viewTradeId, setViewTradeId] = useState<string | null>(null);
  const [tradeForm, setTradeForm] = useState(emptyTradeForm);
  const [autoSaveLabel, setAutoSaveLabel] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Pending images for the current modal session (before trade is saved)
  const [pendingImages, setPendingImages] = useState<{ id: string; url: string }[]>([]);
  // Image IDs that were on the trade before editing started (so we can diff for deletes)
  const [originalImageIds, setOriginalImageIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tagInput, setTagInput] = useState("");

  // ── Page theme + filter state ──
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.journal, isBW);
  const getInstrColor = (s: string) => bwColor(getInstrumentColor(s), isBW);
  const [filters, setFilters] = useState({ direction: "all", outcome: "all", sort: "date", tag: "", accountId: undefined as string | undefined });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    const quickAction = getQuickActionState(location.state);
    const requestKey = quickAction?.quickActionId ?? null;

    if (!quickAction?.action) {
      handledLocationAction.current = null;
      return;
    }
    if (handledLocationAction.current === requestKey) return;
    if (quickAction.action === "addTrade") {
      handledLocationAction.current = requestKey;
      setEditTradeId(null);
      setPendingImages([]);
      setOriginalImageIds([]);
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setTradeForm({ ...parsed, date: selectedDate });
          toast("Draft restored", { duration: 2000 });
        } catch {
          setTradeForm({ ...emptyTradeForm(), date: selectedDate });
        }
      } else {
        setTradeForm({ ...emptyTradeForm(), date: selectedDate });
      }
      setAddTradeOpen(true);
    }
  }, [location.state, selectedDate]);

  // ── Auto-save trade form draft to localStorage (new trades only) ──
  useEffect(() => {
    if (!addTradeOpen || editTradeId) return;
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(tradeForm));
    }, 500);
    return () => clearTimeout(timer);
  }, [tradeForm, addTradeOpen, editTradeId]);

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

  // ── Trades for selected date ──
  const allTrades: TradeEntry[] = data.tradeJournal ?? [];
  const activeAccounts = useMemo(
    () => (data.accounts ?? []).filter((account) => isActiveAccount(account)),
    [data.accounts]
  );
  const journalAccountOptions = useMemo(
    () =>
      activeAccounts.map((account) => ({
        value: account.id,
        label: formatAccountOptionLabel(account, { includeFirm: false }),
      })),
    [activeAccounts]
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    allTrades.forEach(t => t.tags?.forEach(tag => set.add(tag)));
    return Array.from(set).sort();
  }, [allTrades]);

  const dayTrades = allTrades
    .filter((t) => t.date === selectedDate)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  // ── Filtered day trades (direction + outcome + account filters) ──
  const filteredDayTrades = dayTrades.filter((t) => {
    if (filters.direction !== "all" && t.direction?.toLowerCase() !== filters.direction) return false;
    if (filters.outcome === "win" && t.pnl <= 0) return false;
    if (filters.outcome === "loss" && t.pnl >= 0) return false;
    if (filters.tag && !t.tags?.includes(filters.tag)) return false;
    if (filters.accountId && t.accountId !== filters.accountId) return false;
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

  // ── P&L by account for the selected day ──
  const dayPnlByAccount = useMemo(() => {
    const byAccount: Record<string, { wins: number; losses: number; net: number; gross: number; fees: number }> = {};
    dayTrades.forEach((t) => {
      const accId = t.accountId || "Unknown";
      if (!byAccount[accId]) {
        byAccount[accId] = { wins: 0, losses: 0, net: 0, gross: 0, fees: 0 };
      }
      byAccount[accId].gross += t.pnl;
      byAccount[accId].fees += t.fees ?? 0;
      byAccount[accId].net = byAccount[accId].gross - byAccount[accId].fees;
      if (t.pnl > 0) byAccount[accId].wins += 1;
      else if (t.pnl < 0) byAccount[accId].losses += 1;
    });
    return Object.entries(byAccount)
      .map(([accId, stats]) => {
        const matchedAcc = data.accounts?.find((a) => a.id === accId);
        return {
          accId,
          accountName: matchedAcc?.name || matchedAcc?.type || accId,
          ...stats,
        };
      })
      .sort((a, b) => b.net - a.net);
  }, [dayTrades, data.accounts]);


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

  // ── Per-account stats ──
  const accountStats = useMemo(() => {
    return activeAccounts.map(acc => {
      const accTrades = allTrades.filter(t => t.accountId === acc.id);
      const wins = accTrades.filter(t => t.pnl > 0).length;
      const losses = accTrades.filter(t => t.pnl < 0).length;
      const total = accTrades.length;
      const gross = accTrades.reduce((s, t) => s + t.pnl, 0);
      const fees = accTrades.reduce((s, t) => s + (t.fees ?? 0), 0);
      const net = gross - fees;
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      const winPnls = accTrades.filter(t => t.pnl > 0).map(t => t.pnl);
      const lossPnls = accTrades.filter(t => t.pnl < 0).map(t => t.pnl);
      const bestWin = winPnls.length > 0 ? Math.max(...winPnls) : null;
      const worstLoss = lossPnls.length > 0 ? Math.min(...lossPnls) : null;
      const grossWins = winPnls.reduce((sum, value) => sum + value, 0);
      const grossLoss = Math.abs(lossPnls.reduce((sum, value) => sum + value, 0));
      const profitFactor = grossLoss > 0 ? grossWins / grossLoss : (grossWins > 0 ? Number.POSITIVE_INFINITY : null);
      const avgNet = total > 0 ? net / total : null;
      const avgWin = winPnls.length > 0 ? grossWins / winPnls.length : null;
      const avgLoss = lossPnls.length > 0 ? lossPnls.reduce((sum, value) => sum + value, 0) / lossPnls.length : null;
      const recentTrades = [...accTrades]
        .sort((a, b) => `${b.date}${b.time ?? ""}`.localeCompare(`${a.date}${a.time ?? ""}`))
        .slice(0, 5);
      const recentNet = recentTrades.reduce((sum, trade) => sum + trade.pnl - (trade.fees ?? 0), 0);
      return { acc, wins, losses, total, net, winRate, bestWin, worstLoss, profitFactor, avgNet, avgWin, avgLoss, recentNet, trades: accTrades };
    }).sort((a, b) => {
      const phaseDelta =
        Number(normalizeAccountStatus(a.acc.status) !== "funded") -
        Number(normalizeAccountStatus(b.acc.status) !== "funded");
      return phaseDelta || b.total - a.total || b.net - a.net;
    });
  }, [activeAccounts, allTrades]);

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

  // Reset tag filter when selected date changes so stale selections don't hide trades
  useEffect(() => {
    setFilters(f => ({ ...f, tag: "" }));
  }, [selectedDate]);

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

  // ── Tag helpers ──

  function addTag(raw: string) {
    const tag = raw.replace(/,/g, "").trim();
    if (!tag || tradeForm.tags.includes(tag) || tradeForm.tags.length >= 10) return;
    setTradeForm((p) => ({ ...p, tags: [...p.tags, tag] }));
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTradeForm((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
  }

  // ── Add / Edit trade ──

  async function handleSaveTrade() {
    const { date, time, instrument, direction, entryPrice, stopLoss, exitPrice, contracts, pnl, fees, setup, session, notes: tradeNotes, tags, accountId } = tradeForm;
    if (!entryPrice || !exitPrice) return;

    // Persist any newly added images to IndexedDB
    await Promise.all(pendingImages.map((img) => saveImage(img.id, img.url)));

    // Upload to Supabase Storage in background for cross-device sync
    pendingImages.forEach((img) => {
      uploadImageToCloud(img.id, img.url).catch(() => {});
    });

    const newImageIds = pendingImages.map((img) => img.id);

    const stopLossVal = stopLoss ? parseFloat(stopLoss) : undefined;
    const tradeData = {
      date,
      time,
      instrument,
      direction,
      entryPrice: parseFloat(entryPrice) || 0,
      stopLoss: (stopLossVal !== undefined && stopLossVal > 0) ? stopLossVal : undefined,
      exitPrice:  parseFloat(exitPrice)  || 0,
      contracts:  parseInt(contracts)    || 1,
      pnl:        parseFloat(pnl)        || 0,
      fees:       parseFloat(fees)       || 0,
      setup,
      session,
      notes: tradeNotes,
      tags: tags.length > 0 ? tags : undefined,
      imageIds: newImageIds,
      accountId: accountId || undefined,
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
      toast.success('Trade updated');
    } else {
      const trade: TradeEntry = { id: generateId(), ...tradeData };
      update((prev) => ({
        ...prev,
        tradeJournal: [...(prev.tradeJournal ?? []), trade],
      }));
      toast.success('Trade logged');
    }

    localStorage.removeItem(DRAFT_KEY);
    setAddTradeOpen(false);
    setPendingImages([]);
    setOriginalImageIds([]);
    setTagInput("");
    setTradeForm({ ...emptyTradeForm(), date: selectedDate });
  }

  async function handleEditTrade(trade: TradeEntry) {
    setTradeForm({
      date:       trade.date,
      time:       trade.time,
      instrument: trade.instrument,
      direction:  trade.direction,
      entryPrice: String(trade.entryPrice),
      stopLoss:   trade.stopLoss ? String(trade.stopLoss) : "",
      exitPrice:  String(trade.exitPrice),
      contracts:  String(trade.contracts),
      pnl:        String(trade.pnl),
      fees:       String(trade.fees ?? ""),
      setup:      trade.setup   ?? "",
      session:    trade.session ?? "New York",
      notes:      trade.notes   ?? "",
      tags:       trade.tags    ?? [],
      firm:       "" as "" | "lucid" | "tradeify",
      accountId:  trade.accountId ?? undefined,
    });
    setTagInput("");

    // Load existing images as "pending" so they appear in the modal
    const existingIds = trade.imageIds ?? [];
    setOriginalImageIds(existingIds);

    if (existingIds.length > 0) {
      const loaded = await getImagesWithCloudFallback(existingIds);
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
      deleteImagesFromCloud(trade.imageIds).catch(() => {});
    }
    update((prev) => ({
      ...prev,
      tradeJournal: (prev.tradeJournal ?? []).filter((t) => t.id !== id),
    }));
    if (trade) {
      toast('Trade deleted', {
        description: 'Images cannot be recovered',
        action: { label: 'Undo', onClick: () => update((prev) => ({ ...prev, tradeJournal: [...(prev.tradeJournal ?? []), trade] })) },
        duration: 5000,
      });
    }
  }

  function handleDeleteTradeImage(tradeId: string, imageId: string) {
    deleteImage(imageId).catch(() => {});
    deleteImageFromCloud(imageId).catch(() => {});
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
    setTagInput("");
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setTradeForm({ ...parsed, date: selectedDate });
        toast("Draft restored", { duration: 2000 });
      } catch {
        setTradeForm({ ...emptyTradeForm(), date: selectedDate });
      }
    } else {
      setTradeForm({ ...emptyTradeForm(), date: selectedDate });
    }
    setAddTradeOpen(true);
  }

  function closeTradeModal() {
    // If cancelling an edit, don't delete the images – they already existed
    // If cancelling a new trade, discard any pending (not yet saved to IndexedDB)
    localStorage.removeItem(DRAFT_KEY);
    setPendingImages([]);
    setOriginalImageIds([]);
    setTagInput("");
    setEditTradeId(null);
    setAddTradeOpen(false);
  }

  return (
    <div className="space-y-5 w-full">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Journal</div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="page-title">Trade Log</h1>
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
                  style={{ background: bwColor("rgba(59,130,246,0.07)", isBW), border: `1px solid ${bwColor("rgba(59,130,246,0.15)", isBW)}`, color: bwColor("#60a5fa", isBW) }}
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
                  style={{ background: bwColor("rgba(167,139,250,0.07)", isBW), border: `1px solid ${bwColor("rgba(167,139,250,0.15)", isBW)}`, color: bwColor("#a78bfa", isBW) }}
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

      {/* ── Monthly P&L Calendar ── */}
      {(() => {
        const year = calendarMonth.year;
        const month = calendarMonth.month;
        const monthName = new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        const firstDay = new Date(year, month, 1);
        // Start from Monday of the week containing the 1st
        const startDow = firstDay.getDay(); // 0=Sun
        const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
        const calStart = new Date(firstDay);
        calStart.setDate(firstDay.getDate() + mondayOffset);

        const weeks: string[][] = [];
        let current = new Date(calStart);
        while (current.getMonth() <= month || weeks.length === 0) {
          if (current.getFullYear() > year) break;
          const week: string[] = [];
          for (let d = 0; d < 5; d++) { // Mon-Fri only
            const iso = current.toISOString().slice(0, 10);
            week.push(iso);
            current.setDate(current.getDate() + 1);
          }
          current.setDate(current.getDate() + 2); // skip Sat+Sun
          weeks.push(week);
          if (weeks.length > 6) break;
        }

        const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

        return (
          <div className="card px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-tx-4">P&L Calendar</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalendarMonth(prev => {
                    const d = new Date(prev.year, prev.month - 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-tx-3 hover:text-tx-1 transition-colors"
                  style={{ background: "rgba(var(--surface-rgb),0.04)" }}
                >
                  <ChevronLeft size={12} />
                </button>
                <p className="text-xs font-semibold text-tx-2 min-w-[100px] text-center">{monthName}</p>
                <button
                  onClick={() => setCalendarMonth(prev => {
                    const d = new Date(prev.year, prev.month + 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                  disabled={calendarMonth.year === new Date(today + "T00:00:00").getFullYear() && calendarMonth.month === new Date(today + "T00:00:00").getMonth()}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-tx-3 hover:text-tx-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "rgba(var(--surface-rgb),0.04)" }}
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-5 gap-1 mb-1">
              {DAY_LABELS.map(d => (
                <div key={d} className="text-center text-[9px] font-bold uppercase tracking-wider text-tx-4">{d}</div>
              ))}
            </div>
            {/* Weeks */}
            <div className="flex flex-col gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-5 gap-1">
                  {week.map((iso) => {
                    const trades = allTrades.filter(t => t.date === iso);
                    const net = trades.length > 0 ? trades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0) : null;
                    const isCurrentMonth = new Date(iso + "T00:00:00").getMonth() === month;
                    const isFuture = iso > today;
                    const isSelected3 = iso === selectedDate;
                    const isToday3 = iso === today;
                    let bg = "rgba(var(--surface-rgb),0.04)";
                    let textCol = "var(--tx-4)";
                    if (!isFuture && isCurrentMonth && net !== null) {
                      bg = net >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
                      textCol = net >= 0 ? "#4ade80" : "#f87171";
                    }
                    return (
                      <button
                        key={iso}
                        onClick={() => setSelectedDate(iso)}
                        disabled={isFuture}
                        className="flex flex-col items-center justify-center rounded-lg py-1.5 px-1 transition-all disabled:cursor-not-allowed"
                        style={{
                          background: isSelected3 ? (net !== null && net >= 0 ? "rgba(34,197,94,0.2)" : net !== null ? "rgba(239,68,68,0.2)" : "rgba(var(--surface-rgb),0.1)") : bg,
                          border: isToday3 ? "1px solid rgba(var(--border-rgb),0.35)" : isSelected3 ? "1px solid rgba(var(--surface-rgb),0.4)" : "1px solid transparent",
                          opacity: (!isCurrentMonth || isFuture) ? 0.35 : 1,
                        }}
                      >
                        <span className="text-[9px] text-tx-4 tabular-nums">{new Date(iso + "T00:00:00").getDate()}</span>
                        {net !== null && !isFuture && (
                          <span className="text-[8px] font-bold tabular-nums leading-none mt-0.5" style={{ color: textCol }}>
                            {net >= 0 ? "+" : ""}{net >= 1000 || net <= -1000 ? `${(net/1000).toFixed(1)}k` : net.toFixed(0)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Empty state / Main layout (mutually exclusive) ── */}
      {allTrades.length === 0 && entries.length === 0 ? (
        <div className="task-empty">
          <div className="task-empty-copy">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-tx-4">
              <NotebookPen size={12} />
              Journal Setup
            </div>
            <div>
              <p className="text-base font-semibold text-tx-1">Start the journal with one recorded trade.</p>
              <p className="mt-1 text-sm text-tx-3">
                The first entry unlocks W/L, profit factor, recent-session stats, and account-level performance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                "Tag setups and sessions",
                "Link trades to funded or challenge accounts",
                "Attach screenshots for review",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-tx-3"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="task-empty-actions mt-4">
            <button className="btn-primary btn-sm" onClick={openNewTradeModal}>
              <Plus size={14} /> Log First Trade
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setSelectedDate(today)}>
              <Calendar size={13} /> Focus Today
            </button>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5 items-start">

        {/* ── Left: Date nav + Day content ── */}
        <div className="flex flex-col gap-5">

          {/* Date navigator */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedDate(prevDay(selectedDate))}
                className="p-2 rounded-lg text-tx-3 hover:text-tx-1 hover:bg-accent-subtle transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex flex-col items-center gap-1">
                <h2 className="text-base font-bold text-tx-1">{fmtDisplayDate(selectedDate)}</h2>
                <div className="flex items-center gap-2">
                  {isToday && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: bwColor("rgba(14,184,154,0.1)", isBW), color: bwColor("#1dd4b4", isBW), border: `1px solid ${bwColor("rgba(14,184,154,0.2)", isBW)}` }}
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
                className="p-2 rounded-lg text-tx-3 hover:text-tx-1 hover:bg-accent-subtle transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 14-day activity strip (weekdays only) */}
            {(() => {
              const strip = lastNDays(today, 14).filter(d => {
                const dow = new Date(d + "T00:00:00").getDay();
                return dow !== 0 && dow !== 6;
              });
              const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];
              return (
                <div className="flex gap-1 mt-4 pt-3 border-t border-border">
                  {strip.map((d) => {
                    const trades  = allTrades.filter((t) => t.date === d);
                    const dayNet  = trades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0);
                    const hasNote = entries.some((e) => e.date === d);
                    const hasData = trades.length > 0 || hasNote;
                    const isSelected2 = d === selectedDate;
                    const isToday2 = d === today;
                    const dow = new Date(d + "T00:00:00").getDay();
                    const noteBlue = bwColor("#3b82f6", isBW);
                    const chipCol = trades.length > 0 ? (dayNet >= 0 ? "#22c55e" : "#ef4444") : hasNote ? noteBlue : "#1f2937";
                    const borderCol = isSelected2 ? (trades.length > 0 ? (dayNet >= 0 ? "#22c55e" : "#ef4444") : noteBlue) : "transparent";
                    return (
                      <button
                        key={d}
                        onClick={() => setSelectedDate(d)}
                        className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all"
                        style={{
                          background: isSelected2 ? `${borderCol}15` : "transparent",
                          border: `1px solid ${isSelected2 ? borderCol + "50" : "transparent"}`,
                          opacity: !hasData ? 0.4 : 1,
                        }}
                        title={d}
                      >
                        <span className="text-[10px] text-tx-3">{DOW[dow]}</span>
                        <div className="w-3.5 h-3.5 rounded-sm flex items-center justify-center"
                          style={{ background: chipCol, opacity: !hasData ? 0.3 : 1 }}>
                          {isToday2 && <div className="w-1 h-1 rounded-full bg-tx-3" />}
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
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border">
                {[
                  { label: "Trades",   value: String(dayStats.total),                                                       color: "var(--tx-3)", icon: <BarChart3 size={10} /> },
                  { label: "Win Rate", value: dayStats.winRate !== null ? `${dayStats.winRate.toFixed(0)}%` : "—",           color: bwColor("#3b82f6", isBW), icon: <Target size={10} /> },
                  { label: "Gross",    value: fmtUSD(dayStats.gross), color: dayStats.gross >= 0 ? "#22c55e" : "#ef4444",   icon: <TrendingUp size={10} /> },
                  { label: "Net P&L",  value: fmtUSD(dayStats.net),   color: dayStats.net   >= 0 ? "#22c55e" : "#ef4444",   icon: <Activity size={10} /> },
                ].map((s) => (
                  <div key={s.label} className="text-center py-2 px-1 rounded-lg"
                    style={{ background: `${s.color}0d`, border: `1px solid ${s.color}25` }}>
                    <div className="flex justify-center mb-0.5" style={{ color: s.color }}>{s.icon}</div>
                    <p className="text-[10px] text-tx-3 uppercase tracking-wider mb-0.5">{s.label}</p>
                    <p className="text-[12px] font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trade Log */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-accent" />
                <h2 className="text-sm font-semibold text-tx-1">Trade Log</h2>
                {filteredDayTrades.length > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: bwColor("rgba(14,184,154,0.08)", isBW), color: bwColor("#1dd4b4", isBW), border: `1px solid ${bwColor("rgba(14,184,154,0.15)", isBW)}` }}
                  >
                    {filteredDayTrades.length} trade{filteredDayTrades.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button onClick={openNewTradeModal} className="btn-primary btn btn-sm">
                <Plus size={13} />Log Trade
              </button>
            </div>

            {/* Filters row */}
            {dayTrades.length > 0 && (
              <div className="px-5 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-tx-4 font-semibold mr-1">Filter</span>
                {/* Direction filter */}
                {(["all", "long", "short"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setFilters((f) => ({ ...f, direction: d }))}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors border",
                      filters.direction === d
                        ? "bg-accent-muted border-accent text-accent"
                        : "border-border text-tx-4 hover:text-tx-2"
                    )}
                  >
                    {d === "all" ? "All" : d === "long" ? "Long" : "Short"}
                  </button>
                ))}
                <span className="w-px h-3 bg-border mx-1" />
                {/* Outcome filter */}
                {(["all", "win", "loss"] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setFilters((f) => ({ ...f, outcome: o }))}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors border",
                      filters.outcome === o
                        ? "bg-accent-muted border-accent text-accent"
                        : "border-border text-tx-4 hover:text-tx-2"
                    )}
                  >
                    {o === "all" ? "All" : o === "win" ? "Wins" : "Losses"}
                  </button>
                ))}
                {/* Tag filter */}
                {allTags.length > 0 && (
                  <>
                    <span className="w-px h-3 bg-border mx-1" />
                    <select
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-border bg-transparent text-tx-3 appearance-none cursor-pointer"
                      value={filters.tag}
                      onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}
                    >
                      <option value="">All Tags</option>
                      {allTags.map((tag) => (
                        <option key={tag} value={tag}>#{tag}</option>
                      ))}
                    </select>
                  </>
                )}
                {/* Account filter */}
                {journalAccountOptions.length > 0 && (
                  <>
                    <span className="w-px h-3 bg-border mx-1" />
                    <CustomSelect
                      small
                      value={filters.accountId ?? ""}
                      onChange={v => setFilters(f => ({ ...f, accountId: v || undefined }))}
                      placeholder="All Accounts"
                      options={[
                        { value: "", label: "All Accounts" },
                        ...journalAccountOptions
                      ]}
                    />
                  </>
                )}
                {/* Clear filters button */}
                {(filters.direction !== "all" || filters.outcome !== "all" || filters.tag !== "" || filters.accountId !== undefined) && (
                  <>
                    <span className="w-px h-3 bg-border mx-1" />
                    <button
                      onClick={() => setFilters({ direction: "all", outcome: "all", sort: "date", tag: "", accountId: undefined })}
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-border text-tx-4 hover:text-tx-2 transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            )}

            {filteredDayTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <BarChart3 size={24} className="text-tx-4" />
                <p className="text-sm text-tx-3 font-medium">No trades logged for this day</p>
                <p className="text-xs text-tx-4">Click "Log Trade" to record a trade</p>
              </div>
            ) : (
              <div>
                {/* Column headers */}
                <div className="hidden md:grid gap-2 pl-5 pr-3 py-2 border-b border-border"
                  style={{ gridTemplateColumns: "68px 72px 72px 52px 88px 88px 1fr 84px 52px" }}>
                  {["Time", "Symbol", "Dir", "Qty", "Entry", "Exit", "Setup", "Net P&L", ""].map((h) => (
                    <span key={h} className="text-[10px] uppercase tracking-[0.12em] text-tx-4 font-semibold">{h}</span>
                  ))}
                </div>
                <div className="divide-y divide-border">
                  {filteredDayTrades.map((t) => (
                    <TradeRow
                      key={t.id}
                      trade={t}
                      onDelete={() => handleDeleteTrade(t.id)}
                      onEdit={() => handleEditTrade(t)}
                      onView={() => setViewTradeId(t.id)}
                      onDeleteImage={(imgId) => handleDeleteTradeImage(t.id, imgId)}
                      onLightbox={setLightboxSrc}
                    />
                  ))}
                </div>
                {/* P&L by account breakdown */}
                {dayPnlByAccount.length > 1 && (
                  <div className="px-4 py-3 bg-surface-subtle border-t border-border">
                    <p className="text-[10px] text-tx-4 uppercase tracking-wider font-semibold mb-2">P&L by Account</p>
                    <div className="flex flex-col gap-1.5">
                      {dayPnlByAccount.map((acc) => (
                        <div key={acc.accId} className="flex items-center justify-between">
                          <span className="text-[10px] text-tx-3">{acc.accountName}</span>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-tx-4">{acc.wins}W/{acc.losses}L</span>
                            <span className={cn("font-bold tabular-nums", acc.net >= 0 ? "text-profit" : "text-loss")}>
                              {acc.net >= 0 ? "+" : ""}{fmtUSD(acc.net)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Active Accounts (below trade log) ── */}
          {accountStats.length > 0 && (
            <div className="card p-5">
              <p className="text-[10px] text-tx-4 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                <Trophy size={10} className="text-accent" />Active Accounts
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {accountStats.map((stat) => {
                  const { acc, wins, losses, total, winRate, bestWin, worstLoss, profitFactor, avgNet, avgWin, avgLoss, recentNet } = stat;
                  const phase = normalizeAccountStatus(acc.status);
                  const phaseLabel = getAccountPhaseLabel(acc.status);
                  const ruleSnapshot = getPropAccountSnapshot(acc);
                  const phaseColor = getAccountPhaseColor(acc.status);
                  const lowBuffer = ruleSnapshot && phase === "funded"
                    ? ruleSnapshot.distanceToMll <= Math.max(ruleSnapshot.initialBalance * 0.02, 500)
                    : false;
                  const statusColor = lowBuffer ? "#ef4444" : phaseColor;
                  const pfLabel = profitFactor === null
                    ? "—"
                    : Number.isFinite(profitFactor)
                      ? profitFactor.toFixed(2)
                      : "∞";
                  const avgNetLabel = avgNet !== null ? `${avgNet >= 0 ? "+" : ""}${fmtUSD(avgNet)}` : "—";
                  const recentNetLabel = `${recentNet >= 0 ? "+" : ""}${fmtUSD(recentNet)}`;
                  const bestLabel = bestWin !== null ? fmtUSD(bestWin) : "—";
                  const worstLabel = worstLoss !== null ? fmtUSD(worstLoss) : "—";
                  
                  return (
                    <div key={acc.id} className="rounded-xl p-3" style={{ background: "rgba(var(--surface-rgb),0.04)", border: `1px solid rgba(var(--border-rgb),0.08)`, borderLeft: `3px solid ${statusColor}` }}>
                      <div className="sm:hidden space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold truncate" style={{ color: statusColor }}>
                                {acc.name || acc.type}
                              </p>
                              <span
                                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]"
                                style={{
                                  background: `${statusColor}18`,
                                  border: `1px solid ${statusColor}30`,
                                  color: statusColor,
                                }}
                              >
                                {phaseLabel}
                              </span>
                            </div>
                            <p className="text-[10px] text-tx-4 truncate">{acc.firm} · {total} trades</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4">Last 5</p>
                            <p className={cn("text-sm font-bold tabular-nums", recentNet >= 0 ? "text-profit" : "text-loss")}>
                              {recentNetLabel}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            <p className="text-tx-4 uppercase tracking-[0.14em] mb-1">W / L</p>
                            <p className="text-sm font-bold tabular-nums text-tx-1">{wins}/{losses}</p>
                          </div>
                          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            <p className="text-tx-4 uppercase tracking-[0.14em] mb-1">WR</p>
                            <p className="text-sm font-bold tabular-nums text-tx-1">{winRate.toFixed(0)}%</p>
                          </div>
                          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            <p className="text-tx-4 uppercase tracking-[0.14em] mb-1">PF</p>
                            <p className="text-sm font-bold tabular-nums text-tx-1">{pfLabel}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <span className={cn("rounded-full px-2 py-1 font-medium", (avgNet ?? 0) >= 0 ? "text-profit" : "text-loss")} style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            Avg {avgNetLabel}
                          </span>
                          <span className="rounded-full px-2 py-1 font-medium text-profit" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            Best {bestLabel}
                          </span>
                          <span className="rounded-full px-2 py-1 font-medium text-loss" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            Worst {worstLabel}
                          </span>
                        </div>

                        {ruleSnapshot && phase === "challenge" && ruleSnapshot.amountToPass !== null && (
                          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] text-tx-4 truncate">Need {fmtUSD(ruleSnapshot.amountToPass)} to pass</span>
                              <span className="text-[10px] font-bold shrink-0">{(ruleSnapshot.progressPct ?? 0).toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.1)" }}>
                              <div
                                className="h-full transition-all duration-300"
                                style={{
                                  width: `${ruleSnapshot.progressPct ?? 0}%`,
                                  background: "linear-gradient(90deg,#f59e0b,#fbbf24)",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {ruleSnapshot && phase === "funded" && (
                          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-tx-4">MLL buffer</span>
                              <span className={cn("text-[10px] font-bold shrink-0", lowBuffer ? "text-loss" : "text-profit")}>
                                {fmtUSD(ruleSnapshot.distanceToMll)}
                              </span>
                            </div>
                            <p className="text-[10px] text-tx-4 mt-1 truncate">
                              Lock {fmtUSD(ruleSnapshot.lockFloor)} · peak {fmtUSD(ruleSnapshot.peakBalance)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="hidden sm:block">
                        <div className="mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold" style={{ color: statusColor }}>
                              {acc.name || acc.type}
                            </p>
                            <span
                              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]"
                              style={{
                                background: `${statusColor}18`,
                                border: `1px solid ${statusColor}30`,
                                color: statusColor,
                              }}
                            >
                              {phaseLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-tx-4">{acc.firm}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            <p className="text-tx-4 uppercase tracking-[0.14em] mb-1">W / L</p>
                            <p className="text-sm font-bold tabular-nums text-tx-1">{wins} / {losses}</p>
                          </div>
                          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            <p className="text-tx-4 uppercase tracking-[0.14em] mb-1">Win Rate</p>
                            <p className="text-sm font-bold tabular-nums text-tx-1">{winRate.toFixed(0)}%</p>
                          </div>
                          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            <p className="text-tx-4 uppercase tracking-[0.14em] mb-1">PF</p>
                            <p className="text-sm font-bold tabular-nums text-tx-1">{pfLabel}</p>
                          </div>
                          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                            <p className="text-tx-4 uppercase tracking-[0.14em] mb-1">Avg Net</p>
                            <p className={cn("text-sm font-bold tabular-nums", (avgNet ?? 0) >= 0 ? "text-profit" : "text-loss")}>
                              {avgNetLabel}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-tx-4">{total} trades logged</span>
                            <span className={cn("font-semibold", recentNet >= 0 ? "text-profit" : "text-loss")}>
                              Last 5: {recentNetLabel}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-profit">{bestWin !== null ? `Best ${fmtUSD(bestWin)}` : "Best —"}</span>
                            <span className="text-loss">{worstLoss !== null ? `Worst ${fmtUSD(worstLoss)}` : "Worst —"}</span>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-tx-4">Avg win {avgWin !== null ? fmtUSD(avgWin) : "—"}</span>
                            <span className="text-tx-4">Avg loss {avgLoss !== null ? fmtUSD(avgLoss) : "—"}</span>
                          </div>

                          {ruleSnapshot && phase === "challenge" && ruleSnapshot.amountToPass !== null && (
                            <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-tx-4">Pass target</span>
                                <span className="text-[10px] font-bold">{(ruleSnapshot.progressPct ?? 0).toFixed(0)}%</span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.1)" }}>
                                <div
                                  className="h-full transition-all duration-300"
                                  style={{
                                    width: `${ruleSnapshot.progressPct ?? 0}%`,
                                    background: "linear-gradient(90deg,#f59e0b,#fbbf24)",
                                  }}
                                />
                              </div>
                              <p className="text-[10px] text-tx-4 mt-1">Need {fmtUSD(ruleSnapshot.amountToPass)} to pass</p>
                            </div>
                          )}

                          {ruleSnapshot && phase === "funded" && (
                            <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-tx-4">MLL buffer</span>
                                <span className={cn("text-[10px] font-bold", lowBuffer ? "text-loss" : "text-profit")}>
                                  {fmtUSD(ruleSnapshot.distanceToMll)}
                                </span>
                              </div>
                              <p className="text-[10px] text-tx-4 mt-1">
                                Lock {fmtUSD(ruleSnapshot.lockFloor)} · peak {fmtUSD(ruleSnapshot.peakBalance)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                    <span className="text-[10px] text-tx-3 uppercase tracking-wider">Equity Curve</span>
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
                  { label: "Win Rate", value: allStats.winRate !== null ? `${allStats.winRate.toFixed(0)}%` : "—",                 color: bwColor("#3b82f6", isBW) },
                  { label: "Avg Win",  value: allStats.avgWin  !== null ? fmtUSD(allStats.avgWin)  : "—",                         color: "#22c55e" },
                  { label: "Avg Loss", value: allStats.avgLoss !== null ? fmtUSD(allStats.avgLoss) : "—",                         color: "#ef4444" },
                  { label: "Best",     value: allStats.bestTrade  !== null ? `+${fmtUSD(allStats.bestTrade)}`  : "—",             color: "#4ade80" },
                  { label: "P.Factor", value: allStats.profitFactor !== null ? allStats.profitFactor.toFixed(2) : "—",            color: bwColor("#a78bfa", isBW) },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg p-2 text-center"
                    style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.07)" }}
                  >
                    <p className="text-[10px] text-tx-3 uppercase tracking-wider mb-0.5">{s.label}</p>
                    <p className="text-[11px] font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* W/L bar */}
              {allStats.total > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-tx-3">{allStats.wins}W</span>
                    <span className="text-[10px] text-tx-3">{allStats.losses}L</span>
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
                <p className="text-[10px] text-tx-3 mt-2">avg net P&amp;L per trade by weekday</p>
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
                        style={{ color: getInstrColor(s.label) }}
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
                        <span className="text-[10px] text-tx-3 tabular-nums">
                          {s.count}t · {s.wr.toFixed(0)}%WR
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


        </div>
      </div>
      )}

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
                style={{ background: "rgba(var(--surface-rgb),0.04)", colorScheme: "dark" }}
              />
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1">Time (ET)</label>
              <input
                type="time"
                className="nx-input"
                value={tradeForm.time}
                onChange={(e) => setTradeForm((p) => ({ ...p, time: e.target.value }))}
                style={{ background: "rgba(var(--surface-rgb),0.04)", colorScheme: "dark" }}
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

          {/* ── Account selector ── */}
          {journalAccountOptions.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-tx-3 uppercase tracking-wider">Account</label>
              <div className="mt-1 w-full">
                <CustomSelect
                  value={tradeForm.accountId ?? ""}
                  onChange={v => setTradeForm(p => ({ ...p, accountId: v || undefined }))}
                  placeholder="No account"
                  options={[
                    { value: "", label: "No account" },
                    ...journalAccountOptions
                  ]}
                />
              </div>
            </div>
          )}

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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
              <label className="text-tx-3 text-xs block mb-1">Stop (opt.)</label>
              <input
                type="number"
                step="0.25"
                className="nx-input"
                placeholder="0.00"
                value={tradeForm.stopLoss}
                onChange={(e) => setTradeForm((p) => ({ ...p, stopLoss: e.target.value }))}
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
                  <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: isProfit ? "#22c55e" : "#ef4444" }}>
                    Auto-calculated · {firm === "lucid" ? "Lucid" : "Tradeify"} · {instrument} · {Math.abs(priceDiff).toFixed(2)} pts × ${pointVal} × {qty}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-[10px] text-tx-3 mb-0.5">Gross P&L</p>
                    <p className="text-sm font-bold font-mono tabular-nums" style={{ color: grossPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                      {grossPnl >= 0 ? "+" : ""}{fmtUSD(grossPnl)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-tx-3 mb-0.5">Fees ({qty}× ${(feePerSide * 2).toFixed(2)})</p>
                    <p className="text-sm font-bold font-mono tabular-nums text-warn">
                      −{fmtUSD(totalFees)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-tx-3 mb-0.5">Net P&L</p>
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
                {tradeForm.firm && <span className="text-[10px] text-tx-3 ml-1">(auto-filled)</span>}
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
                {tradeForm.firm && <span className="text-[10px] text-tx-3 ml-1">(auto-filled)</span>}
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

          {/* ── Tags ── */}
          <div>
            <label className="text-tx-3 text-[10px] block mb-1.5">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {tradeForm.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-muted border border-border text-tx-2">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-tx-4 hover:text-tx-1 transition-colors">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              className="nx-input"
              placeholder="Add tag (press Enter or comma)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(tagInput);
                }
                if (e.key === "Backspace" && tagInput === "" && tradeForm.tags.length > 0) {
                  e.preventDefault();
                  setTradeForm(p => ({ ...p, tags: p.tags.slice(0, -1) }));
                }
              }}
            />
            {tradeForm.tags.length >= 10 && (
              <p className="text-[10px] text-tx-4 mt-1">Maximum 10 tags reached</p>
            )}
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
                <span className="text-[10px] font-medium">Add</span>
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
              <p className="text-[10px] text-tx-3 mt-1">
                {pendingImages.length} image{pendingImages.length !== 1 ? "s" : ""} attached · saved to local IndexedDB
              </p>
            )}
          </div>

          <div className="modal-action-bar">
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

      {/* ── Trade Detail Modal ── */}
      {viewTradeId && (() => {
        const vt = (data.tradeJournal ?? []).find((t) => t.id === viewTradeId);
        if (!vt) return null;
        const netPnl = vt.pnl - (vt.fees ?? 0);
        const accentColor = netPnl > 0 ? "#22c55e" : netPnl < 0 ? "#ef4444" : "var(--tx-3)";
        const iCol = getInstrColor(vt.instrument);
        return (
          <Modal
            open={true}
            onClose={() => setViewTradeId(null)}
            title="Trade Detail"
            size="md"
          >
            <div className="flex flex-col gap-4">
              {/* Header row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-black font-mono tracking-wide px-2 py-1 rounded-lg"
                  style={{ color: iCol, background: `${iCol}15`, border: `1px solid ${iCol}30` }}>
                  {vt.instrument}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold"
                  style={{ color: vt.direction === "long" ? "#22c55e" : "#ef4444" }}>
                  {vt.direction === "long"
                    ? <ArrowUpRight size={14} strokeWidth={2.5} />
                    : <ArrowDownRight size={14} strokeWidth={2.5} />}
                  {vt.direction === "long" ? "Long" : "Short"}
                </span>
                <span className="text-xs text-tx-4 font-mono">{vt.date} · {vt.time || "—"}</span>
                {vt.session && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-tx-3"
                    style={{ background: "rgba(var(--surface-rgb),0.06)", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
                    {vt.session}
                  </span>
                )}
              </div>

              {/* P&L row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Gross P&L", value: `${vt.pnl >= 0 ? "+" : ""}${fmtUSD(vt.pnl)}`, color: vt.pnl >= 0 ? "#22c55e" : "#ef4444" },
                  { label: "Fees", value: `−${fmtUSD(vt.fees ?? 0)}`, color: "var(--tx-3)" },
                  { label: "Net P&L", value: `${netPnl >= 0 ? "+" : ""}${fmtUSD(netPnl)}`, color: accentColor },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
                    <p className="text-[10px] text-tx-4 uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm font-black tabular-nums font-mono" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Trade details */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Entry", value: (vt.entryPrice ?? 0).toFixed(2) },
                  { label: "Exit", value: (vt.exitPrice ?? 0).toFixed(2) },
                  { label: "Contracts", value: String(vt.contracts) },
                  { label: "Setup", value: vt.setup || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg px-3 py-2.5"
                    style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.07)" }}>
                    <p className="text-[10px] text-tx-4 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-xs font-semibold text-tx-1 font-mono">{value}</p>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {vt.notes && (
                <div className="rounded-lg px-3 py-2.5"
                  style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.07)" }}>
                  <p className="text-[10px] text-tx-4 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-xs text-tx-2 leading-relaxed">{vt.notes}</p>
                </div>
              )}

              {/* Tags */}
              {vt.tags && vt.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {vt.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-muted border border-border text-tx-3">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Images */}
              {(vt.imageIds?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] text-tx-4 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ImageIcon size={10} />{vt.imageIds!.length} Screenshot{vt.imageIds!.length !== 1 ? "s" : ""}
                  </p>
                  <TradeImageGallery
                    imageIds={vt.imageIds!}
                    onDelete={(imgId) => handleDeleteTradeImage(vt.id, imgId)}
                    onLightbox={(url) => { setViewTradeId(null); setTimeout(() => setLightboxSrc(url), 50); }}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button className="btn-ghost btn-sm flex-1" onClick={() => setViewTradeId(null)}>Close</button>
                <button className="btn-primary btn-sm flex-1" onClick={() => {
                  setViewTradeId(null);
                  handleEditTrade(vt);
                }}>
                  <Edit2 size={12} />Edit Trade
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
