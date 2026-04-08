import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface SelectOption { value: string; label: string; }

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  small?: boolean;
  /** When true, shows a text input below the button if the selected value is not in options */
  allowCustom?: boolean;
  /** Label shown in the custom text input */
  customLabel?: string;
  /**
   * Mobile filter mode: compact floating panel anchored to the trigger (no backdrop, no bottom sheet).
   * Ideal for inline filter dropdowns where space is limited.
   */
  inlineMobile?: boolean;
}

export default function CustomSelect({
  value, onChange, options, placeholder = "Select…", small = false,
  allowCustom = false, customLabel, inlineMobile = false,
}: CustomSelectProps) {
  const [customText, setCustomText] = useState(value || "");
  useEffect(() => {
    if (document.getElementById("cs-dropdown-anim")) return;
    const style = document.createElement("style");
    style.id = "cs-dropdown-anim";
    style.textContent = `
      @keyframes csDropIn {
        from { opacity: 0; transform: scaleY(0.92) translateY(-4px); }
        to { opacity: 1; transform: scaleY(1) translateY(0); }
      }
      @keyframes csSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }, []);
  const [open, setOpen] = useState(false);
  const isMobile = useMemo(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  []);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);



  useEffect(() => {
    if (!open) return;
    function handleClick(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open]);

  function openDropdown() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (isMobile && !inlineMobile) {
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

  const optionList = options.map(opt => (
    <button
      key={opt.value}
      type="button"
      onClick={() => { onChange(opt.value); setOpen(false); }}
      className="w-full text-left transition-colors"
      style={{
        background: opt.value === value ? "rgba(var(--surface-rgb),0.08)" : "transparent",
        color: opt.value === value ? "var(--tx-1)" : "var(--tx-2)",
        fontSize: small ? 11 : 13,
        whiteSpace: isMobile ? "normal" : "nowrap",
      }}
      onMouseEnter={e => {
        if (isMobile) return;
        e.currentTarget.style.background = "rgba(var(--surface-rgb),0.06)";
      }}
      onMouseLeave={e => {
        if (isMobile) return;
        e.currentTarget.style.background = opt.value === value ? "rgba(var(--surface-rgb),0.08)" : "transparent";
      }}
    >
      <span className={cn(
        "block",
        isMobile ? "px-4 py-3 text-sm font-medium" : "px-3 py-2"
      )}>
        {opt.label}
      </span>
    </button>
  ));

  const dropdownWrapperStyle: React.CSSProperties = isMobile
    ? {}
    : {
        position: "fixed" as const,
        left: portalStyle.left as number | undefined,
        top: (portalStyle.top as number | undefined) ?? 0,
        width: portalStyle.width as number | undefined,
      };

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block", width: "100%" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
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

      {/* Free-text input — only shown when allowCustom is enabled AND selected value is not in the predefined options */}
      {allowCustom && !selected && (
        <input
          type="text"
          className="w-full mt-1.5 px-3 py-2 rounded-xl text-sm bg-[rgba(var(--surface-rgb),0.04)] border border-border text-tx-1 placeholder-tx-4 outline-none focus:border-[var(--accent)] transition-colors"
          placeholder={customLabel ?? "Type custom value…"}
          value={customText}
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange(e.target.value);
          }}
        />
      )}

      {/* Desktop: portal with fixed positioning */}
      {open && !isMobile && createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: "var(--z-picker-bg)" }}
          onClick={() => setOpen(false)}
        >
          {/* Click-outside blocker — passes pointer events through to content below */}
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }} />
          {/* Actual dropdown — sits above blocker with auto pointerEvents */}
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              ...dropdownWrapperStyle,
              background: "var(--bg-elevated)",
              border: "1px solid rgba(var(--border-rgb),0.12)",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              maxHeight: 300,
              overflowY: "auto",
              transformOrigin: "top",
              animation: "csDropIn 0.15s ease-out",
              zIndex: "var(--z-picker)",
            }}
          >
            {optionList}
          </div>
        </div>,
        document.body
      )}

      {/* Mobile: portal with bottom-sheet — restructured for iOS Safari pointer-events fix */}
      {open && isMobile && !inlineMobile && createPortal(
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
              borderTop: "1px solid rgba(var(--border-rgb),0.08)",
              boxShadow: "0 -18px 50px rgba(0,0,0,0.45)",
              animation: "csSlideUp 0.2s ease-out",
            }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full" style={{ background: "rgba(var(--surface-rgb),0.12)" }} />
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-tx-4 font-semibold">
                  {placeholder}
                </p>
                <p className="text-sm font-semibold text-tx-1">
                  {selected ? selected.label : placeholder}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-tx-3"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div
              className="overflow-y-auto rounded-2xl"
              style={{ maxHeight: "min(55vh, 420px)", background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}
            >
              {optionList}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Mobile inline mode: compact floating panel anchored to the trigger */}
      {open && isMobile && inlineMobile && createPortal(
        <div
          style={{
            position: "fixed",
            left: portalStyle.left as number | undefined,
            top: (portalStyle.top as number | undefined) ?? 0,
            width: portalStyle.width as number | undefined,
            background: "var(--bg-elevated)",
            border: "1px solid rgba(var(--border-rgb),0.12)",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            maxHeight: 300,
            overflowY: "auto",
            transformOrigin: "top",
            animation: "csDropIn 0.12s ease-out",
            zIndex: "var(--z-picker)",
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {optionList}
        </div>,
        document.body
      )}
    </div>
  );
}
