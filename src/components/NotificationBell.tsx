import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, X, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { useAppData } from "@/lib/store";
import { fmtGBP } from "@/lib/utils";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtRenewalDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { data } = useAppData();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });

  const leadDays = data.userSettings?.subscriptionRenewalDays ?? 7;

  const upcoming = (data.subscriptions ?? [])
    .map((sub) => ({ ...sub, daysLeft: daysUntil(sub.nextRenewal) }))
    .filter((sub) => sub.daysLeft >= 0 && sub.daysLeft <= leadDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const count = upcoming.length;

  const computePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    // Panel appears to the right of the sidebar button (when collapsed)
    // or above the button (when expanded, enough room to the right)
    const panelWidth = 288; // w-72
    const leftPos = collapsed
      ? rect.right + 8
      : rect.right - panelWidth;
    const topPos = rect.top - 8; // align top edge near button, panel grows down
    // Clamp so it doesn't go off-screen bottom
    const panelHeight = 340;
    const clampedTop = Math.min(topPos, window.innerHeight - panelHeight - 8);
    setPanelPos({ top: Math.max(8, clampedTop), left: Math.max(8, leftPos) });
  }, [collapsed]);

  function handleToggle() {
    if (!open) computePos();
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleScroll() { computePos(); }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", computePos);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", computePos);
    };
  }, [open, computePos]);

  const panel = open ? (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: panelPos.top,
        left: panelPos.left,
        width: 288,
        zIndex: 9999,
        background: "#0d111c",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={12} style={{ color: "#fbbf24" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Notifications</span>
          {count > 0 && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 999,
                background: "rgba(245,158,11,0.15)",
                color: "#fbbf24",
                border: "1px solid rgba(245,158,11,0.25)",
              }}
            >
              {count} pending
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            color: "#4b5563",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#fff")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#4b5563")}
        >
          <X size={11} />
        </button>
      </div>

      {/* List */}
      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {upcoming.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "32px 16px",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              <Check size={14} style={{ color: "#22c55e" }} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#4b5563", margin: 0 }}>All clear</p>
            <p style={{ fontSize: 10, color: "#374151", textAlign: "center", margin: 0 }}>
              No renewals in the next {leadDays} day{leadDays !== 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <div style={{ padding: "4px 0" }}>
            {upcoming.map((sub) => {
              const isUrgent  = sub.daysLeft <= 2;
              const isWarning = sub.daysLeft <= 5;
              const dotColor  = isUrgent ? "#ef4444" : isWarning ? "#f59e0b" : "#3b82f6";
              const amount    = typeof sub.amount === "number" ? sub.amount : parseFloat(String(sub.amount)) || 0;

              return (
                <div
                  key={sub.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 16px",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                      background: `${dotColor}18`,
                      border: `1px solid ${dotColor}30`,
                    }}
                  >
                    {isUrgent
                      ? <AlertTriangle size={10} style={{ color: dotColor }} />
                      : <RefreshCw size={10} style={{ color: dotColor }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sub.name}
                    </p>
                    <p style={{ fontSize: 10, color: "#4b5563", margin: 0 }}>
                      {fmtGBP(amount)}/{sub.frequency === "monthly" ? "mo" : sub.frequency === "yearly" ? "yr" : "wk"}
                      {" · "}
                      {fmtRenewalDate(sub.nextRenewal)}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <p style={{ fontSize: 11, fontWeight: 900, color: dotColor, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                      {sub.daysLeft === 0 ? "Today" : sub.daysLeft === 1 ? "Tomorrow" : `${sub.daysLeft}d`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 9, color: "#374151" }}>Alerting {leadDays}d ahead</span>
        <span style={{ fontSize: 9, color: "#374151" }}>Change in Settings ⚙</span>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Notifications"
        className="relative flex items-center justify-center w-7 h-7 rounded-lg transition-all"
        style={{
          color: count > 0 ? "#fbbf24" : "#4b5563",
          background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${open ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLElement).style.color = count > 0 ? "#fbbf24" : "#e2e8f0";
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
            (e.currentTarget as HTMLElement).style.color = count > 0 ? "#fbbf24" : "#4b5563";
          }
        }}
      >
        <Bell size={13} />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[14px] h-3.5 rounded-full text-[8px] font-black text-white flex items-center justify-center px-0.5"
            style={{ background: "#f59e0b", boxShadow: "0 0 6px rgba(245,158,11,0.5)" }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {createPortal(panel, document.body)}
    </>
  );
}
