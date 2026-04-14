import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  value: string; // "HH:MM" in 24h
  onChange: (time: string) => void;
  className?: string;
}

export default function TimePicker({ value, onChange, className }: Props) {
  useEffect(() => {
    if (document.getElementById("tp-dropdown-anim")) return;
    const style = document.createElement("style");
    style.id = "tp-dropdown-anim";
    style.textContent = `
      @keyframes tpDropIn {
        from { opacity: 0; transform: scaleY(0.92) translateY(-4px); }
        to { opacity: 1; transform: scaleY(1) translateY(0); }
      }
      @keyframes tpSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }, []);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [hour, setHour] = useState(() => value ? parseInt(value.split(":")[0]) : 12);
  const [minute, setMinute] = useState(() => value ? parseInt(value.split(":")[1]) : 0);
  const [ampm, setAmpm] = useState<"am" | "pm">(() => {
    if (!value) return "pm";
    const h = parseInt(value.split(":")[0]);
    return h >= 12 ? "pm" : "am";
  });
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function applyAndClose() {
    let h = hour;
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    const result = `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    onChange(result);
    setOpen(false);
  }

  function fmtDisplay() {
    if (!value) return "Set time";
    let h = parseInt(value.split(":")[0]);
    const m = value.split(":")[1];
    const ap = h >= 12 ? "pm" : "am";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${ap.toUpperCase()}`;
  }

  const hours = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  function openDropdown() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (isMobile) {
        setPortalStyle({});
      } else {
        setPortalStyle({
          position: "fixed",
          left: rect.left,
          top: rect.bottom + 4,
          width: rect.width,
        });
      }
    }
    setOpen(true);
  }

  function renderPicker() {
    const wrapperStyle: React.CSSProperties = isMobile
      ? {}
      : {
          position: "fixed",
          left: portalStyle.left as number | undefined,
          top: (portalStyle.top as number | undefined) ?? 0,
          width: portalStyle.width as number | undefined,
        };

    return (
      <div
        className="rounded-2xl overflow-hidden shadow-xl"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid rgba(var(--border-rgb),0.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
          transformOrigin: "top",
          animation: isMobile ? "tpSlideUp 0.2s ease-out" : "tpDropIn 0.15s ease-out",
          minWidth: isMobile ? "100%" : undefined,
          maxWidth: isMobile ? "100%" : 260,
          ...wrapperStyle,
        }}
      >
        {/* Header with current selection */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(var(--border-rgb),0.08)]">
          <button
            type="button"
            onClick={() => {
              let h = hour === 0 ? 23 : hour - 1;
              setHour(h);
            }}
            className="p-1.5 rounded-lg hover:bg-[rgba(var(--surface-rgb),0.1)] transition-colors"
          >
            <ChevronLeft size={14} style={{ color: "var(--tx-3)" }} />
          </button>
          <span className="text-[15px] font-black tabular-nums text-[var(--tx-1)]">
            {hour}:{String(minute).padStart(2, "0")}
            <span className="text-[10px] ml-1 font-semibold" style={{ color: "var(--accent)" }}>
              {ampm.toUpperCase()}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              let h = hour === 23 ? 0 : hour + 1;
              setHour(h);
            }}
            className="p-1.5 rounded-lg hover:bg-[rgba(var(--surface-rgb),0.1)] transition-colors"
          >
            <ChevronRight size={14} style={{ color: "var(--tx-3)" }} />
          </button>
        </div>

        {/* AM/PM Toggle */}
        <div className="flex border-b border-[rgba(var(--border-rgb),0.06)]">
          {(["am", "pm"] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setAmpm(p)}
              className="flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors"
              style={{
                background: ampm === p ? "rgba(var(--surface-rgb),0.12)" : "transparent",
                color: ampm === p ? "var(--accent)" : "var(--tx-3)",
                borderBottom: ampm === p ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {p === "am" ? "AM" : "PM"}
            </button>
          ))}
        </div>

        {/* Scrollable hour/minute wheels */}
        <div className="flex max-h-[180px] overflow-y-auto">
          {/* Hours */}
          <div className="flex-1 border-r border-[rgba(var(--border-rgb),0.06)] py-1">
            {hours.map(h => {
              const displayH = ampm === "pm" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
              const isSelected = displayH === hour;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHour(displayH)}
                  className={cn(
                    "w-full py-1.5 text-[13px] font-medium transition-colors",
                    isSelected ? "text-[var(--bg-base)]" : "text-[var(--tx-2)]"
                  )}
                  style={isSelected ? { background: "var(--accent)", color: "var(--bg-base)" } : {}}
                >
                  {h}
                </button>
              );
            })}
          </div>

          {/* Minutes */}
          <div className="flex-1 py-1">
            {minuteOptions.map(m => {
              const isSelected = m === minute;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinute(m)}
                  className="w-full py-1.5 text-[13px] font-medium transition-colors"
                  style={
                    isSelected
                      ? { background: "var(--accent)", color: "var(--bg-base)" }
                      : { color: "var(--tx-2)" }
                  }
                >
                  {String(m).padStart(2, "0")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Confirm button */}
        <div className="px-3 pb-3 pt-2">
          <button
            type="button"
            onClick={applyAndClose}
            className="w-full rounded-xl py-2 text-[12px] font-bold transition-colors"
            style={{ background: "var(--accent)", color: "var(--bg-base)" }}
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className={cn(
          "w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] transition-colors",
          "border border-transparent hover:border-[rgba(var(--border-rgb),0.15)]",
          "bg-[rgba(var(--surface-rgb),0.04)] hover:bg-[rgba(var(--surface-rgb),0.07)]",
          "text-[var(--tx-1)]"
        )}
      >
        <Clock size={13} style={{ color: "var(--accent)" }} />
        <span className="font-medium">{fmtDisplay() === "Set time" ? "Set time…" : fmtDisplay()}</span>
      </button>

      {/* Desktop: portal with fixed positioning */}
      {open && !isMobile && createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: "var(--z-picker-bg)" }}
          onClick={() => setOpen(false)}
        >
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }} />
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ position: "relative", zIndex: "var(--z-picker)" }}
          >
            {renderPicker()}
          </div>
        </div>,
        document.body
      )}

      {/* Mobile: portal with bottom-sheet — restructured for iOS Safari pointer-events fix */}
      {open && isMobile && createPortal(
        <>
          {/* Backdrop — standalone fixed overlay, no pointer-events parent */}
          <div
            className="fixed inset-0 z-[var(--z-picker-bg)]"
            style={{ background: "rgba(2,6,23,0.72)", backdropFilter: "blur(10px)", touchAction: "none" }}
            onClick={() => setOpen(false)}
          />
          {/* Bottom sheet — separate fixed element, directly receives touch events */}
          <div
            className="fixed inset-x-4 bottom-4 z-[var(--z-picker)] rounded-2xl px-4 pt-4 pb-5"
            style={{
              background: "var(--bg-elevated)",
              boxShadow: "0 -18px 50px rgba(0,0,0,0.45)",
              animation: "tpSlideUp 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full" style={{ background: "rgba(var(--surface-rgb),0.12)" }} />
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-tx-4 font-semibold">Time</p>
                <p className="text-sm font-semibold text-tx-1">{fmtDisplay()}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-tx-3"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div style={{ maxHeight: "min(55vh, 440px)", overflowY: "auto" }}>
              {renderPicker()}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
