import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import type { TradeEntry } from "@/types";
import { fmtUSD } from "@/lib/utils";
import { useBWMode, bwColor } from "@/lib/useBWMode";
import { getImagesWithCloudFallback } from "@/lib/imageStore";
import { TradeImageGallery } from "@/components/journal/TradeImageGallery";

// ─── Local constants ──────────────────────────────────────────────────────────

const PROFIT = "#22c55e";
const LOSS   = "#f87171";

// Instrument color families — keep in sync with --color-instr-* tokens in index.css
const INSTRUMENT_COLOR: Record<string, string> = {
  ES: "#5b7fa3", NQ: "#8b7da3", YM: "#c49060", RTY: "#5aadaa",
  MES: "#5b7fa3", MNQ: "#8b7da3", MYM: "#c49060",
  CL: "#d4a84a", MCL: "#d4a84a",
  GC: "#b8a040", MGC: "#b8a040",
};
const getInstrumentColor = (s: string) => INSTRUMENT_COLOR[s] ?? "#60a5fa";

// ─── Trade-phase label helpers ────────────────────────────────────────────────

function getTradePhaseLabel(phase: "challenge" | "funded" | undefined | null): string | null {
  if (!phase) return null;
  return phase === "funded" ? "Funded" : "Challenge";
}

function getTradePhaseColors(phase: "challenge" | "funded" | undefined | null, bw: boolean) {
  const text = phase === "funded" ? bwColor("#22c55e", bw) : bwColor("#d4a84a", bw);
  const background = phase === "funded"
    ? bwColor("rgba(var(--color-profit-rgb), 0.10)", bw)
    : bwColor("rgba(var(--color-orange-rgb), 0.14)", bw);
  const border = phase === "funded"
    ? bwColor("rgba(var(--color-profit-rgb), 0.22)", bw)
    : bwColor("rgba(var(--color-orange-rgb), 0.28)", bw);
  return { text, background, border };
}

// ─── calcRR ──────────────────────────────────────────────────────────────────

export function calcRR(trade: TradeEntry): string | null {
  if (!trade.stopLoss || trade.stopLoss <= 0) return null;
  const risk = Math.abs(trade.entryPrice - trade.stopLoss);
  if (risk === 0) return null;
  const reward = Math.abs(trade.exitPrice - trade.entryPrice);
  const rr = reward / risk;
  return rr.toFixed(1) + "R";
}

// ─── openTradeImages ─────────────────────────────────────────────────────────

export async function openTradeImages(
  imageIds: string[],
  onLightbox: (images: string[], index: number) => void,
  initialImageId?: string,
): Promise<boolean> {
  if (imageIds.length === 0) return false;

  try {
    const images = await getImagesWithCloudFallback(imageIds);
    const resolvedImages = imageIds
      .map((id) => ({ id, url: images[id] }))
      .filter((image): image is { id: string; url: string } => !!image.url);
    if (resolvedImages.length === 0) return false;

    const initialIndex = initialImageId
      ? Math.max(0, resolvedImages.findIndex((image) => image.id === initialImageId))
      : 0;

    onLightbox(
      resolvedImages.map((image) => image.url),
      initialIndex,
    );
    return true;
  } catch (error) {
    console.error("[journal] Failed to open trade image:", error);
    return false;
  }
}

// ─── TradeRow ────────────────────────────────────────────────────────────────

export function TradeRow({
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
  onLightbox: (images: string[], index: number) => void;
}) {
  const bw = useBWMode();
  const [confirm, setConfirm] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  const [openingImage, setOpeningImage] = useState(false);
  const isWin   = trade.pnl > 0;
  const isLoss  = trade.pnl < 0;
  const netPnl  = trade.pnl - (trade.fees ?? 0);
  const rrLabel = calcRR(trade);
  const hasImages = (trade.imageIds?.length ?? 0) > 0;
  const tradePhaseLabel = getTradePhaseLabel(trade.accountPhase);
  const tradePhaseColors = getTradePhaseColors(trade.accountPhase, bw);
  const tradeEdgeLabel = `${(trade.entryPrice ?? 0).toFixed(2)} → ${(trade.exitPrice ?? 0).toFixed(2)}`;
  const primaryLabel = trade.setup || trade.notes || "No setup noted";
  const imageCount = trade.imageIds?.length ?? 0;

  const accentColor  = isWin ? bwColor(PROFIT, bw) : isLoss ? bwColor(LOSS, bw) : "var(--tx-3)";
  const rowBg        = isWin
    ? bwColor("rgba(var(--color-profit-rgb), 0.035)", bw)
    : isLoss
    ? bwColor("rgba(var(--color-loss-rgb), 0.035)", bw)
    : "transparent";

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 640);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function handleImageAction(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!hasImages) return;

    if (!isMobile) {
      setShowImages((v) => !v);
      return;
    }

    if (openingImage) return;
    setOpeningImage(true);
    try {
      const opened = await openTradeImages(trade.imageIds ?? [], onLightbox);
      if (!opened) {
        toast.error("Couldn't load the screenshot on this device.");
      }
    } finally {
      setOpeningImage(false);
    }
  }

  return (
    <div className="relative group">
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm"
        style={{ background: accentColor, opacity: 0.7 }}
      />

      <div
        className="pl-5 pr-3 py-3 transition-colors cursor-pointer"
        style={{ background: rowBg }}
        onClick={onView}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const iCol = bwColor(getInstrumentColor(trade.instrument), bw);
                return (
                  <span
                    className="text-[10px] font-black font-mono tracking-wide px-1.5 py-0.5 rounded"
                    style={{ color: iCol, background: `${iCol}15`, border: `1px solid ${iCol}30` }}
                  >
                    {trade.instrument}
                  </span>
                );
              })()}
              <span className="text-[11px] text-tx-4 font-mono tabular-nums">{trade.time || "—"}</span>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: trade.direction === "long" ? bwColor(PROFIT, bw) : bwColor(LOSS, bw) }}
              >
                {trade.direction === "long"
                  ? <ArrowUpRight size={10} strokeWidth={2.5} />
                  : <ArrowDownRight size={10} strokeWidth={2.5} />}
                {trade.direction === "long" ? "Long" : "Short"}
              </span>
              {tradePhaseLabel && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-[0.14em]"
                  style={{
                    background: tradePhaseColors.background,
                    border: `1px solid ${tradePhaseColors.border}`,
                    color: tradePhaseColors.text,
                  }}
                >
                  {tradePhaseLabel}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-tx-2 truncate">{primaryLabel}</p>
                <div className="mt-1 flex items-center gap-x-2 gap-y-1 flex-wrap text-[10px] text-tx-4">
                  <span className="font-mono tabular-nums">{tradeEdgeLabel}</span>
                  <span>{trade.contracts} ctr</span>
                  {trade.session && <span>{trade.session}</span>}
                  {trade.fees ? <span>Fees {fmtUSD(trade.fees)}</span> : null}
                  {rrLabel && <span>{rrLabel}</span>}
                  {hasImages && <span>{imageCount} shot{imageCount !== 1 ? "s" : ""}</span>}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-tx-4" onClick={(e) => e.stopPropagation()}>
                {hasImages && (
                  <button
                    onClick={handleImageAction}
                    className="p-1 rounded transition-colors hover:text-sky-400"
                    style={{ color: showImages ? "#60a5fa" : "var(--tx-4)" }}
                    title={`${imageCount} screenshot${imageCount !== 1 ? "s" : ""}`}
                  >
                    <ImageIcon size={12} />
                  </button>
                )}
                {!confirm ? (
                  <>
                    <button onClick={onEdit} className="p-1 rounded transition-colors hover:text-tx-1">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setConfirm(true)} className="p-1 rounded transition-colors hover:text-loss">
                      <Trash2 size={12} />
                    </button>
                    <span className="pl-1 text-tx-4 group-hover:text-tx-2 transition-colors">
                      <ChevronRight size={14} />
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={onDelete}
                      className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: bwColor("rgba(var(--color-loss-rgb), 0.15)", bw), color: bwColor(LOSS, bw) }}
                    >
                      Del
                    </button>
                    <button
                      onClick={() => setConfirm(false)}
                      className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: "rgba(var(--surface-rgb),0.07)", color: "var(--tx-3)" }}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            </div>

            </div>

          <div className="shrink-0 text-right">
            <div
              className="text-sm sm:text-base font-black tabular-nums font-mono"
              style={{ color: accentColor }}
            >
              {netPnl >= 0 ? "+" : ""}{fmtUSD(netPnl)}
            </div>
            <div className="mt-0.5 text-[10px] text-tx-4 tabular-nums">
              gross {trade.pnl >= 0 ? "+" : ""}{fmtUSD(trade.pnl)}
            </div>
            <div className="mt-2 flex items-center justify-end gap-1 sm:hidden text-tx-4" onClick={(e) => e.stopPropagation()}>
              {hasImages && (
                <button onClick={handleImageAction} className="p-1 rounded" disabled={openingImage}>
                  <ImageIcon size={12} />
                </button>
              )}
              {!confirm ? (
                <>
                  <button onClick={onEdit} className="p-1 rounded">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => setConfirm(true)} className="p-1 rounded">
                    <Trash2 size={12} />
                  </button>
                  <span className="pl-1 text-tx-4">
                    <ChevronRight size={14} />
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onDelete}
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: "rgba(var(--color-loss-rgb), 0.15)", color: "#f87171" }}
                  >
                    Del
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: "rgba(var(--surface-rgb),0.07)", color: "var(--tx-3)" }}
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isMobile && showImages && hasImages && (
        <TradeImageGallery
          imageIds={trade.imageIds!}
          onDelete={onDeleteImage}
          onLightbox={onLightbox}
        />
      )}
    </div>
  );
}
