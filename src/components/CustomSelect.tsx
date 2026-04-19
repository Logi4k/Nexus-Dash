import { useState, useRef, useEffect, useId } from "react";
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
   * Optional sentinel option value that should keep the select value unchanged
   * while revealing a companion custom text field.
   */
  customOptionValue?: string;
  /** Controlled custom text for sentinel-based "Other" flows. */
  customValue?: string;
  /** Change handler for controlled custom text when using customOptionValue. */
  onCustomValueChange?: (v: string) => void;
  /** Called when user clicks save on a custom value — renders a + button next to custom input. */
  onSaveCustom?: (value: string) => void;
  /** Called when user clicks delete on an option — renders an X button on matching options. */
  onDeleteOption?: (value: string) => void;
  /** Controls whether a specific option shows the delete button. If not provided, shows on all when onDeleteOption is set. */
  canDelete?: (value: string) => boolean;
  /**
   * Mobile filter mode: compact floating panel anchored to the trigger (no backdrop, no bottom sheet).
   * Ideal for inline filter dropdowns where space is limited.
   */
  inlineMobile?: boolean;
}

export default function CustomSelect({
  value, onChange, options, placeholder = "Select…", small = false,
  allowCustom = false, customLabel, customOptionValue, customValue,
  onCustomValueChange, onSaveCustom, onDeleteOption, canDelete, inlineMobile = false,
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
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  const usesSentinelCustom = !!customOptionValue;
  const isSentinelSelected = usesSentinelCustom && value === customOptionValue;
  const resolvedCustomValue = isSentinelSelected ? (customValue ?? customText) : customText;
  const shouldShowCustomInput = allowCustom && (isSentinelSelected || (!!value && !selected));
  const displayLabel = isSentinelSelected
    ? (resolvedCustomValue.trim() || selected?.label || placeholder)
    : (selected?.label || value || placeholder);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 640);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!open || !inlineMobile) return;
    function handleClick(e: PointerEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open, inlineMobile]);

  useEffect(() => {
    if (isSentinelSelected) {
      setCustomText(customValue ?? "");
      return;
    }
    if (!selected) {
      setCustomText(value || "");
    }
  }, [customValue, isSentinelSelected, selected, value]);

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

  function handleCustomInputChange(nextValue: string) {
    setCustomText(nextValue);
    if (isSentinelSelected && onCustomValueChange) {
      onCustomValueChange(nextValue);
      return;
    }
    onChange(nextValue);
  }

  const optionList = options.map((opt, index) => (
    <div
      key={opt.value}
      role="presentation"
      className="w-full flex items-center justify-between group"
      style={{
        background: opt.value === value ? "rgba(var(--surface-rgb),0.08)" : "transparent",
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
      <button
        type="button"
        id={`${listboxId}-option-${index}`}
        role="option"
        aria-selected={opt.value === value}
        onClick={() => { onChange(opt.value); setOpen(false); }}
        className="flex-1 text-left transition-colors"
        style={{
          color: opt.value === value ? "var(--tx-1)" : "var(--tx-2)",
          fontSize: small ? 11 : 13,
          whiteSpace: isMobile ? "normal" : "nowrap",
        }}
      >
        <span className={cn(
          "block",
          isMobile ? "px-4 py-3 text-sm font-medium" : "px-3 py-2"
        )}>
          {opt.label}
        </span>
      </button>
      {onDeleteOption && (!canDelete || canDelete(opt.value)) && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeleteOption(opt.value); }}
          className={cn(
            "shrink-0 text-tx-4 hover:text-loss transition-colors opacity-0 group-hover:opacity-100",
            isMobile ? "px-3 py-3 opacity-100" : "px-2 py-2"
          )}
          title={`Remove ${opt.label}`}
        >
          x
        </button>
      )}
    </div>
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
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={openDropdown}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDropdown();
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={small
          ? "text-[10px] px-2 py-0.5 rounded-full font-semibold border border-border text-tx-3 flex items-center gap-1"
          : "w-full text-left px-3 py-2 rounded-xl text-sm border border-border text-tx-1 flex items-center justify-between gap-2"
        }
        style={{ background: "rgba(var(--surface-rgb),0.04)", minWidth: small ? undefined : "100%" }}
      >
        <span style={{ color: (selected || value) ? (small ? "var(--tx-3)" : "var(--tx-1)") : "var(--tx-4)" }}>
          {displayLabel}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: "var(--tx-4)", flexShrink: 0, transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}>
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Free-text input — supports both free text values and sentinel-driven "Other" flows */}
      {shouldShowCustomInput && (
        <div className="flex items-center gap-1.5 mt-1.5 w-full">
          <input
            type="text"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm bg-[rgba(var(--surface-rgb),0.04)] border border-border text-tx-1 placeholder-tx-4 outline-none focus:border-[var(--accent)] transition-colors"
            placeholder={customLabel ?? "Type custom value…"}
            value={resolvedCustomValue}
            onChange={(e) => handleCustomInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && resolvedCustomValue.trim() && onSaveCustom) {
                onSaveCustom(resolvedCustomValue.trim());
              }
            }}
          />
          {onSaveCustom && resolvedCustomValue.trim() && (
            <button
              type="button"
              onClick={() => onSaveCustom(resolvedCustomValue.trim())}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-tx-3 hover:text-profit transition-colors border border-border hover:bg-profit-subtle"
              title={`Save "${resolvedCustomValue.trim()}" to list`}
            >
              +
            </button>
          )}
        </div>
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
            ref={portalRef}
            id={listboxId}
            role="listbox"
            className="menu-surface"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              ...dropdownWrapperStyle,
              borderRadius: 12,
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
            style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(10px)", touchAction: "none" }}
            onClick={() => setOpen(false)}
          />
          {/* Bottom sheet — separate fixed element, directly receives touch events */}
          <div
            ref={portalRef}
            className="menu-surface fixed inset-x-4 bottom-4 z-[var(--z-picker)] rounded-2xl border border-border-subtle px-4 pt-4 pb-5"
            style={{
              animation: "csSlideUp 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full" style={{ background: "rgba(var(--surface-rgb),0.12)" }} />
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-tx-4 font-semibold">
                  {placeholder}
                </p>
                <p className="text-sm font-semibold text-tx-1">
                  {displayLabel}
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
              id={listboxId}
              role="listbox"
              className="overflow-y-auto rounded-2xl border border-border-subtle bg-bg-subtle"
              style={{ maxHeight: "min(55vh, 420px)" }}
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
          ref={portalRef}
          id={listboxId}
          role="listbox"
          className="menu-surface"
          style={{
            position: "fixed",
            left: portalStyle.left as number | undefined,
            top: (portalStyle.top as number | undefined) ?? 0,
            width: portalStyle.width as number | undefined,
            borderRadius: 10,
            maxHeight: 300,
            overflowY: "auto",
            transformOrigin: "top",
            animation: "csDropIn 0.12s ease-out",
            zIndex: "var(--z-picker)",
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {optionList}
        </div>,
        document.body
      )}
    </div>
  );
}
