import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Maximize2 } from "lucide-react";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function TitleBar() {
  // Only render window controls on Tauri desktop app, not in web browser
  if (!isTauri) return null;
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial maximize state
    const checkMaximized = async () => {
      try {
        const win = getCurrentWindow();
        setIsMaximized(await win.isMaximized());
      } catch {
        // not in tauri
      }
    };
    checkMaximized();

    // Listen for resize events to update maximize state
    const handleResize = () => checkMaximized();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function handleMinimize() {
    try {
      await getCurrentWindow().minimize();
    } catch { /* not in tauri */ }
  }

  async function handleMaximize() {
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      setIsMaximized(await win.isMaximized());
    } catch { /* not in tauri */ }
  }

  async function handleClose() {
    try {
      await getCurrentWindow().close();
    } catch { /* not in tauri */ }
  }

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-9 px-3 select-none flex-shrink-0"
      style={{
        background: "var(--bg-base)",
        borderBottom: "1px solid rgba(var(--border-rgb),0.06)",
      }}
    >
      {/* App title */}
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: "var(--accent)" }}
        />
        <span
          className="text-[11px] font-semibold tracking-[-0.01em]"
          style={{ color: "var(--tx-3)" }}
          data-tauri-drag-region
        >
          Nexus
        </span>
      </div>

      {/* Window controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 active:scale-90 hover:bg-[rgba(var(--surface-rgb),0.1)]"
          aria-label="Minimize"
        >
          <Minus size={12} style={{ color: "var(--tx-3)" }} />
        </button>
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 active:scale-90 hover:bg-[rgba(var(--surface-rgb),0.1)]"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Square size={10} style={{ color: "var(--tx-3)" }} />
          ) : (
            <Maximize2 size={11} style={{ color: "var(--tx-3)" }} />
          )}
        </button>
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 active:scale-90 hover:bg-red-500/80"
          aria-label="Close"
        >
          <X size={12} className="text-white" />
        </button>
      </div>
    </div>
  );
}
