import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { Search } from "lucide-react";

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  group: string;
  keywords?: string[];
  Icon: ElementType;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
}

export default function CommandPalette({ open, onClose, items }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter((item) => {
      const haystack = [
        item.label,
        item.description ?? "",
        item.group,
        ...(item.keywords ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, query]);

  useEffect(() => {
    if (selectedIndex > filteredItems.length - 1) {
      setSelectedIndex(0);
    }
  }, [filteredItems.length, selectedIndex]);

  if (!open) return null;

  const grouped = filteredItems.reduce<Record<string, CommandPaletteItem[]>>((acc, item) => {
    acc[item.group] = acc[item.group] ?? [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-[80] px-4 py-10 md:px-6"
      style={{ background: "rgba(5,7,12,0.72)", backdropFilter: "blur(16px)" }}
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-2xl overflow-hidden rounded-[28px]"
        style={{
          background: "rgba(10,12,20,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 90px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((current) => (filteredItems.length ? (current + 1) % filteredItems.length : 0));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((current) => (filteredItems.length ? (current - 1 + filteredItems.length) % filteredItems.length : 0));
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            filteredItems[selectedIndex]?.run();
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
            <Search size={16} style={{ color: "rgba(255,255,255,0.55)" }} />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Jump to a page or run a quick action..."
            className="flex-1 bg-transparent outline-none text-[15px]"
            style={{ color: "#f8fafc" }}
          />
          <div className="hidden md:flex items-center gap-1 text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>Ctrl</span>
            <span className="px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>K</span>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <div className="text-sm font-semibold text-white">No matches found</div>
              <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                Try a page name, feature, or action like new note.
              </div>
            </div>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => {
              const firstIndex = filteredItems.findIndex((item) => item.id === groupItems[0]?.id);
              return (
                <div key={group} className="mb-4 last:mb-0">
                  <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.28)" }}>
                    {group}
                  </div>
                  <div className="space-y-1">
                    {groupItems.map((item, offset) => {
                      const absoluteIndex = firstIndex + offset;
                      const isSelected = absoluteIndex === selectedIndex;
                      const Icon = item.Icon;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                          onClick={() => {
                            item.run();
                            onClose();
                          }}
                          className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all"
                          style={
                            isSelected
                              ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }
                              : { background: "transparent", border: "1px solid transparent" }
                          }
                        >
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)" }}
                          >
                            <Icon size={16} style={{ color: isSelected ? "#f8fafc" : "rgba(255,255,255,0.6)" }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold truncate" style={{ color: "#f8fafc" }}>
                              {item.label}
                            </div>
                            {item.description && (
                              <div className="mt-0.5 text-[11px] truncate" style={{ color: "rgba(255,255,255,0.42)" }}>
                                {item.description}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
