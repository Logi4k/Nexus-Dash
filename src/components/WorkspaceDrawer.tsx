import { Clock3, Download, FolderOpen, LayoutPanelTop, Layers3, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { RecentEntry, SavedView } from "@/types";
import type { RegisteredPageView } from "@/lib/viewIntents";

export default function WorkspaceDrawer({
  open,
  onClose,
  currentView,
  savedViews,
  recentEntries,
  syncLabel,
  onOpenSavedView,
  onOpenRecentEntry,
  onOpenExportCenter,
}: {
  open: boolean;
  onClose: () => void;
  currentView: RegisteredPageView | null;
  savedViews: SavedView[];
  recentEntries: RecentEntry[];
  syncLabel: string;
  onOpenSavedView: (view: SavedView) => void;
  onOpenRecentEntry: (entry: RecentEntry) => void;
  onOpenExportCenter: () => void;
}) {
  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tx-4">Workspace</div>
          <div className="mt-1 text-sm font-semibold text-tx-1">Control center</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-tx-4">{syncLabel}</span>
          <button
            type="button"
            className="rounded-lg p-1.5 text-tx-4 hover:text-tx-1 hover:bg-bg-hover transition-colors"
            onClick={onClose}
            aria-label="Close workspace drawer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {currentView && (
          <section className="rounded-2xl border border-border-subtle bg-bg-hover px-4 py-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-tx-4">
              <LayoutPanelTop size={12} />
              Current view
            </div>
            <div className="mt-3 text-sm font-semibold text-tx-1">{currentView.title}</div>
            {currentView.description && (
              <div className="mt-1 text-xs text-tx-4">{currentView.description}</div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-border-subtle bg-bg-hover px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-tx-4">
              <Layers3 size={12} />
              Saved views
            </div>
            <span className="text-[10px] text-tx-4">{savedViews.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {savedViews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle px-3 py-3 text-xs text-tx-4">
                Save views from any page to quickly switch contexts.
              </div>
            ) : (
              savedViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => onOpenSavedView(view)}
                  className="w-full rounded-xl border border-border-subtle bg-bg-base px-3 py-3 text-left transition-[background] hover:bg-bg-hover"
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen size={13} className="text-[var(--accent)] shrink-0" />
                    <div className="text-sm font-semibold text-tx-1 truncate">{view.name}</div>
                  </div>
                  {view.description && (
                    <div className="mt-1 text-[11px] text-tx-4 truncate">{view.description}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border-subtle bg-bg-hover px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-tx-4">
              <Clock3 size={12} />
              Recent
            </div>
            <span className="text-[10px] text-tx-4">{recentEntries.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {recentEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle px-3 py-3 text-xs text-tx-4">
                Recent navigation and actions will appear here.
              </div>
            ) : (
              recentEntries.slice(0, 8).map((entry) => (
                <button
                  key={`${entry.id}-${entry.visitedAt}`}
                  type="button"
                  onClick={() => onOpenRecentEntry(entry)}
                  className="w-full rounded-xl border border-border-subtle bg-bg-base px-3 py-3 text-left transition-[background] hover:bg-bg-hover"
                >
                  <div className="text-sm font-semibold text-tx-1">{entry.label}</div>
                  <div className="mt-1 text-[11px] text-tx-4">
                    {entry.description || new Date(entry.visitedAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="border-t border-border-subtle px-5 py-4">
        <button type="button" className="btn-primary w-full" onClick={onOpenExportCenter}>
          <Download size={14} />
          Open Export Center
        </button>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay — always visible */}
          <motion.button
            type="button"
            aria-label="Close workspace drawer"
            className="fixed inset-0 z-[var(--z-drawer)] bg-[rgba(var(--bg-base-rgb),0.45)] backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Mobile: full-screen sheet */}
          <motion.aside
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[calc(var(--z-drawer)+1)] flex flex-col md:hidden bg-bg-card"
          >
            {content}
          </motion.aside>

          {/* Desktop: side drawer */}
          <motion.aside
            initial={{ x: 420, opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0.96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-[calc(var(--z-drawer)+1)] hidden md:flex md:flex-col w-[380px] border-l border-border bg-bg-card shadow-2xl"
          >
            {content}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}