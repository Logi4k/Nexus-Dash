import { useState } from "react";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";
import type { PageTheme } from "@/lib/theme";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PillGroupOption = { label: string; value: string };

export type FilterDef =
  | { type: "pills";    key: string; options: PillGroupOption[] }
  | { type: "dropdown"; key: string; label: string; options: PillGroupOption[] }
  | { type: "search";   key: string; placeholder?: string }
  | { type: "sort";     key: string; options: PillGroupOption[] };

export type FilterState = Record<string, string>;

interface FilterBarProps {
  filters: FilterDef[];
  values: FilterState;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  theme: PageTheme;
  summary?: string;   // e.g. "Showing 14 of 42 trades · Win rate: 71%"
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilterBar({ filters, values, onChange, onClear, theme, summary }: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = Object.values(values).filter(v => v && v !== "all" && v !== "").length;
  const hasActive   = activeCount > 0;

  return (
    <>
      {/* ── Desktop filter bar ─────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map(f => {
            if (f.type === "search") return (
              <SearchFilter key={f.key} def={f} value={values[f.key] || ""} onChange={v => onChange(f.key, v)} theme={theme} />
            );
            if (f.type === "pills") return (
              <PillGroup key={f.key} def={f} value={values[f.key] || "all"} onChange={v => onChange(f.key, v)} theme={theme} />
            );
            if (f.type === "dropdown") return (
              <DropdownFilter key={f.key} def={f} value={values[f.key] || "all"} onChange={v => onChange(f.key, v)} theme={theme} />
            );
            if (f.type === "sort") return (
              <SortFilter key={f.key} def={f} value={values[f.key] || f.options[0]?.value || ""} onChange={v => onChange(f.key, v)} theme={theme} />
            );
            return null;
          })}
          {hasActive && (
            <button onClick={onClear} className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              Clear
            </button>
          )}
        </div>
        {summary && hasActive && (
          <div className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium"
            style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}>
            {summary}
          </div>
        )}
      </div>

      {/* ── Mobile filter trigger ──────────────────────────────────────────── */}
      <div className="flex md:hidden items-center gap-2">
        <button onClick={() => setMobileOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold"
          style={hasActive
            ? { background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }
            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
          }>
          <SlidersHorizontal size={13} />
          Filter
          {hasActive && (
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
              style={{ background: theme.accent, color: "#070810" }}>
              {activeCount}
            </span>
          )}
        </button>
        {summary && hasActive && (
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{summary}</span>
        )}
      </div>

      {/* ── Mobile bottom sheet ────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setMobileOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-5 space-y-4"
            style={{ background: "#0a0c18", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm" style={{ color: "#f8fafc" }}>Filters</span>
              <button onClick={() => setMobileOpen(false)}>
                <X size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
              </button>
            </div>
            {filters.map(f => {
              if (f.type === "search") return (
                <SearchFilter key={f.key} def={f} value={values[f.key] || ""} onChange={v => onChange(f.key, v)} theme={theme} />
              );
              if (f.type === "pills") return (
                <div key={f.key} className="space-y-1.5">
                  <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {f.key.charAt(0).toUpperCase() + f.key.slice(1)}
                  </div>
                  <PillGroup def={f} value={values[f.key] || "all"} onChange={v => onChange(f.key, v)} theme={theme} />
                </div>
              );
              if (f.type === "dropdown") return (
                <div key={f.key} className="space-y-1.5">
                  <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</div>
                  <PillGroup
                    def={{ options: [{ label: "All", value: "all" }, ...f.options] }}
                    value={values[f.key] || "all"}
                    onChange={v => onChange(f.key, v)}
                    theme={theme}
                  />
                </div>
              );
              if (f.type === "sort") return (
                <div key={f.key} className="space-y-1.5">
                  <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Sort by</div>
                  <PillGroup
                    def={{ options: f.options }}
                    value={values[f.key] || f.options[0]?.value || ""}
                    onChange={v => onChange(f.key, v)}
                    theme={theme}
                  />
                </div>
              );
              return null;
            })}
            {hasActive && (
              <button onClick={() => { onClear(); setMobileOpen(false); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PillGroup({ def, value, onChange, theme }: { def: { options: PillGroupOption[] }; value: string; onChange: (v: string) => void; theme: PageTheme }) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      {def.options.map(opt => {
        const isActive = value === opt.value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
            style={isActive
              ? { background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }
              : { color: "rgba(255,255,255,0.4)", border: "1px solid transparent" }
            }>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SearchFilter({ def, value, onChange, theme }: { def: FilterDef & { type: "search" }; value: string; onChange: (v: string) => void; theme: PageTheme }) {
  return (
    <div className="relative flex items-center">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={def.placeholder || "Search..."}
        className="pl-8 pr-3 py-2 rounded-xl text-[12px] font-medium outline-none w-40 md:w-48"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: value ? `1px solid ${theme.border}` : "1px solid rgba(255,255,255,0.08)",
          color: "#f8fafc",
        }}
      />
      <svg className="absolute left-2.5 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        style={{ color: "rgba(255,255,255,0.3)" }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  );
}

function DropdownFilter({ def, value, onChange, theme }: { def: FilterDef & { type: "dropdown" }; value: string; onChange: (v: string) => void; theme: PageTheme }) {
  const [open, setOpen] = useState(false);
  const selected = def.options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold"
        style={value && value !== "all"
          ? { background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }
          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
        }
      >
        {def.label}{selected && value !== "all" ? `: ${selected.label}` : ""}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 rounded-xl overflow-hidden"
          style={{ background: "#0a0c18", border: "1px solid rgba(255,255,255,0.1)", minWidth: 140 }}>
          <button
            onClick={() => { onChange("all"); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-white/5"
            style={{ color: value === "all" ? theme.accent : "rgba(255,255,255,0.6)" }}>
            All
          </button>
          {def.options.map(opt => (
            <button key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-white/5"
              style={{ color: value === opt.value ? theme.accent : "rgba(255,255,255,0.6)" }}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortFilter({ def, value, onChange, theme }: { def: FilterDef & { type: "sort" }; value: string; onChange: (v: string) => void; theme: PageTheme }) {
  const [open, setOpen] = useState(false);
  const selected = def.options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
      >
        Sort: {selected?.label || def.options[0]?.label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-20 rounded-xl overflow-hidden"
          style={{ background: "#0a0c18", border: "1px solid rgba(255,255,255,0.1)", minWidth: 140 }}>
          {def.options.map(opt => (
            <button key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-white/5"
              style={{ color: value === opt.value ? theme.accent : "rgba(255,255,255,0.6)" }}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
