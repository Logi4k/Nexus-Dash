import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
  dynamicItems?: CommandPaletteItem[];
}

export default function CommandPalette({ open, onClose, items, dynamicItems }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = "command-palette-title";
  const descriptionId = "command-palette-description";
  const inputId = "command-palette-input";

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const staticFiltered = !normalized
      ? items
      : items.filter((item) => {
          const haystack = [
            item.label,
            item.description ?? "",
            item.group,
            ...(item.keywords ?? []),
          ].join(" ").toLowerCase();
          return haystack.includes(normalized);
        });

    if (!normalized || normalized.length < 2 || !dynamicItems?.length) {
      return staticFiltered;
    }

    const dynamicFiltered = dynamicItems
      .filter((item) => {
        const haystack = [
          item.label,
          item.description ?? "",
          ...(item.keywords ?? []),
        ].join(" ").toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 8);

    return [...staticFiltered, ...dynamicFiltered];
  }, [items, dynamicItems, query]);

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
      className="fixed inset-0 z-[var(--z-cmd-palette)] px-4 py-10 md:px-6 backdrop-blur-[16px]"
      style={{ background: "rgba(var(--bg-base-rgb),0.72)" }}
      onClick={onClose}
    >
      <div
        role="dialog" aria-label="Command palette"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="mx-auto w-full max-w-2xl overflow-hidden rounded-[28px] bg-bg-base border border-border shadow-modal"
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
        <div className="sr-only">
          <h2 id={titleId}>Command palette</h2>
          <p id={descriptionId}>Search for pages, actions, or commands and navigate the app without leaving the current screen.</p>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-accent-muted">
            <Search size={16} className="text-tx-3" />
          </div>
          <label htmlFor={inputId} className="sr-only">
            Search commands
          </label>
          <input
            id={inputId}
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Jump to a page or run a quick action..."
            aria-label="Search commands"
            className="flex-1 bg-transparent text-[15px] text-tx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.3)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(var(--bg-base-rgb),1)] rounded-xl"
          />
          <div className="hidden md:flex items-center gap-1 text-[10px] font-semibold text-tx-4">
            <span className="px-2 py-1 rounded-lg bg-accent-muted">Ctrl</span>
            <span className="px-2 py-1 rounded-lg bg-accent-muted">K</span>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <div className="text-sm font-semibold text-tx-1">No matches found</div>
              <div className="mt-1 text-xs text-tx-4">
                Try a page name, feature, or action like new note.
              </div>
            </div>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => {
              const firstIndex = filteredItems.findIndex((item) => item.id === groupItems[0]?.id);
              return (
                <div key={group} className="mb-4 last:mb-0">
                  <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-tx-4">
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
                          className={cn(
                            "w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all border",
                            isSelected ? "bg-accent-muted border-border" : "bg-transparent border-transparent"
                          )}
                        >
                          <div
                            className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0",
                              isSelected ? "bg-accent-glow" : "bg-accent-muted"
                            )}
                          >
                            <Icon size={16} className={isSelected ? "text-tx-1" : "text-tx-3"} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold truncate text-tx-1">
                              {item.label}
                            </div>
                            {item.description && (
                              <div className="mt-0.5 text-[11px] truncate text-tx-4">
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
