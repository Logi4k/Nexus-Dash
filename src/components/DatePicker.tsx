import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface Props {
  value: string; // ISO date string "YYYY-MM-DD"
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  className?: string;
}

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoToDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function DatePicker({ value, onChange, min, max, className }: Props) {
  useEffect(() => {
    if (document.getElementById("dp-dropdown-anim")) return;
    const style = document.createElement("style");
    style.id = "dp-dropdown-anim";
    style.textContent = `
      @keyframes dpDropIn {
        from { opacity: 0; transform: scaleY(0.92) translateY(-4px); }
        to { opacity: 1; transform: scaleY(1) translateY(0); }
      }
      @keyframes dpSlideUp {
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
  const [viewYear, setViewYear] = useState(() => {
    if (value) { const [y] = value.split("-").map(Number); return y; }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) { const [, m] = value.split("-").map(Number); return m - 1; }
    return new Date().getMonth();
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

  // Sync view when value changes externally
  useEffect(() => {
    if (!value) return;
    const [y, m] = value.split("-").map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
  }, [value]);

  function selectDate(day: number) {
    const result = isoToDate(viewYear, viewMonth, day);
    onChange(result);
    setOpen(false);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const firstDay = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  function isDisabled(day: number) {
    if (!day) return false;
    const iso = isoToDate(viewYear, viewMonth, day);
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  function fmtDisplay(iso: string) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  }

  function openDropdown() {
    // Calculate position based on trigger button
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

  function renderCalendar() {
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
          animation: isMobile ? "dpSlideUp 0.2s ease-out" : "dpDropIn 0.15s ease-out",
          minWidth: isMobile ? "100%" : undefined,
          maxWidth: isMobile ? "100%" : 320,
          ...wrapperStyle,
        }}
      >
        {/* Month navigation */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[rgba(var(--border-rgb),0.08)]">
          <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[rgba(var(--surface-rgb),0.1)] transition-colors">
            <ChevronLeft size={14} style={{ color: "var(--tx-3)" }} />
          </button>
          <span className="text-[12px] font-semibold text-[var(--tx-1)]">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[rgba(var(--surface-rgb),0.1)] transition-colors">
            <ChevronRight size={14} style={{ color: "var(--tx-3)" }} />
          </button>
        </div>

        {/* Day headers — use explicit equal fractions so they align with day numbers */}
        <div className="grid px-2 pt-2 pb-1" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "0px" }}>
          {DAYS.map(d => (
            <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-wider pb-1" style={{ color: "var(--tx-4)", minWidth: 0 }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid — same explicit column widths as header for perfect alignment */}
        <div className="grid px-2 pb-2" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "2px" }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const iso = isoToDate(viewYear, viewMonth, day);
            const isSelected = iso === value;
            const disabled = isDisabled(day);
            const isToday = iso === new Date().toLocaleDateString('en-CA');
            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                onClick={() => selectDate(day)}
                className={cn(
                  "aspect-square rounded-lg text-[12px] font-medium transition-colors",
                  isSelected && "text-[var(--bg-base)]",
                  !isSelected && disabled && "opacity-30 cursor-not-allowed",
                  !isSelected && !disabled && "hover:bg-[rgba(var(--surface-rgb),0.1)]",
                )}
                style={
                  isSelected
                    ? { background: "var(--accent)", color: "var(--bg-base)" }
                    : isToday && !disabled
                    ? { border: "1px solid rgba(var(--accent),0.5)", color: "var(--accent)" }
                    : { color: disabled ? "var(--tx-4)" : "var(--tx-2)" }
                }
              >
                {day}
              </button>
            );
          })}
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
        style={{ minWidth: "100%" }}
      >
        <Calendar size={13} style={{ color: "var(--accent)" }} />
        <span className="font-medium">{fmtDisplay(value) || "Select date…"}</span>
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
            style={{
              position: "fixed",
              left: portalStyle.left as number | undefined,
              top: (portalStyle.top as number | undefined) ?? 0,
              width: portalStyle.width as number | undefined,
              zIndex: "var(--z-picker)",
            }}
          >
            {renderCalendar()}
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
              animation: "dpSlideUp 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full" style={{ background: "rgba(var(--surface-rgb),0.12)" }} />
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-tx-4 font-semibold">Date</p>
                <p className="text-sm font-semibold text-tx-1">{fmtDisplay(value) || "Select date…"}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-tx-3"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div style={{ maxHeight: "min(60vh, 480px)", overflowY: "auto" }}>
              {renderCalendar()}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
