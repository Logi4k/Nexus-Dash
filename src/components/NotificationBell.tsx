import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Bell, X, RefreshCw, AlertTriangle, Check, Landmark, PiggyBank, Briefcase } from "lucide-react";
import { useAppData } from "@/lib/store";
import { buildAppNotifications, buildRawAppNotifications, getNotificationCount } from "@/lib/notifications";

export default function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { data, update } = useAppData();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const notifications = useMemo(() => buildAppNotifications(data), [data]);
  const dismissedCount = data.userSettings?.dismissedNotificationIds?.length ?? 0;
  const count = notifications.length;

  function dismissNotification(id: string) {
    update((prev) => {
      const existing = prev.userSettings?.dismissedNotificationIds ?? [];
      if (existing.includes(id)) return prev;
      return {
        ...prev,
        userSettings: {
          ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }),
          dismissedNotificationIds: [...existing, id],
        },
      };
    });
  }

  function resetDismissedNotifications() {
    update((prev) => {
      if (!prev.userSettings?.dismissedNotificationIds?.length) return prev;
      return {
        ...prev,
        userSettings: {
          ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }),
          dismissedNotificationIds: [],
        },
      };
    });
  }

  function dismissAllNotifications() {
    const allIds = buildRawAppNotifications(data).map((notification) => notification.id);
    update((prev) => ({
      ...prev,
      userSettings: {
        ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }),
        dismissedNotificationIds: allIds,
      },
    }));
  }

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
        background: "var(--bg-base)",
        border: "1px solid rgba(var(--border-rgb),0.1)",
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
          borderBottom: "1px solid rgba(var(--border-rgb),0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={12} style={{ color: "var(--color-warn)" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-1)" }}>Notifications</span>
          {count > 0 && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 999,
                background: "rgba(245,158,11,0.15)",
                color: "var(--color-warn)",
                border: "1px solid rgba(245,158,11,0.25)",
              }}
            >
              {count} pending
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {count > 0 && (
            <button
              onClick={dismissAllNotifications}
              style={{
                padding: "3px 7px",
                borderRadius: 999,
                color: "var(--tx-3)",
                background: "rgba(var(--surface-rgb),0.04)",
                border: "1px solid rgba(var(--border-rgb),0.08)",
                cursor: "pointer",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              Dismiss all
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            style={{
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              color: "var(--tx-4)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--tx-1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--tx-4)")}
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {notifications.length === 0 ? (
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
              <Check size={14} style={{ color: "var(--color-profit)" }} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--tx-3)", margin: 0 }}>All clear</p>
            <p style={{ fontSize: 10, color: "var(--tx-4)", textAlign: "center", margin: 0 }}>
              No urgent alerts across subscriptions, prop risk, debt, or tax.
            </p>
          </div>
        ) : (
          <div style={{ padding: "4px 0" }}>
            {notifications.map((item) => {
              const dotColor =
                item.severity === "critical"
                  ? "var(--color-loss)"
                  : item.severity === "warn"
                    ? "var(--color-warn)"
                    : "var(--color-blue)";

              const Icon =
                item.category === "subscription"
                  ? RefreshCw
                  : item.category === "prop"
                    ? Briefcase
                    : item.category === "debt"
                      ? Landmark
                      : PiggyBank;

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 16px",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(var(--surface-rgb),0.03)")}
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
                    {item.severity === "critical"
                      ? <AlertTriangle size={10} style={{ color: dotColor }} />
                      : <Icon size={10} style={{ color: dotColor }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--tx-1)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--tx-4)", margin: 0 }}>
                      {item.detail}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <p style={{ fontSize: 11, fontWeight: 900, color: dotColor, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                      {item.sideLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Dismiss ${item.title}`}
                    onClick={() => dismissNotification(item.id)}
                    style={{
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 6,
                      border: "1px solid rgba(var(--border-rgb),0.08)",
                      background: "rgba(var(--surface-rgb),0.04)",
                      color: "var(--tx-4)",
                      cursor: "pointer",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "var(--tx-1)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(var(--surface-rgb),0.08)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "var(--tx-4)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(var(--surface-rgb),0.04)";
                    }}
                  >
                    <X size={10} />
                  </button>
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
          borderTop: "1px solid rgba(var(--border-rgb),0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 9, color: "var(--tx-4)" }}>
          {dismissedCount > 0 ? `${dismissedCount} dismissed` : "Operational alerts"}
        </span>
        {dismissedCount > 0 ? (
          <button
            type="button"
            onClick={resetDismissedNotifications}
            style={{
              fontSize: 9,
              color: "var(--tx-3)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Reset dismissed
          </button>
        ) : (
          <span style={{ fontSize: 9, color: "var(--tx-4)" }}>Sync + settings aware</span>
        )}
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
          color: count > 0 ? "var(--color-warn)" : "var(--tx-4)",
          background: open ? "rgba(var(--surface-rgb),0.08)" : "rgba(var(--surface-rgb),0.03)",
          border: `1px solid ${open ? "rgba(var(--border-rgb),0.12)" : "rgba(var(--border-rgb),0.07)"}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(var(--surface-rgb),0.08)";
          (e.currentTarget as HTMLElement).style.color = count > 0 ? "var(--color-warn)" : "var(--tx-2)";
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = "rgba(var(--surface-rgb),0.03)";
            (e.currentTarget as HTMLElement).style.color = count > 0 ? "var(--color-warn)" : "var(--tx-4)";
          }
        }}
      >
        <Bell size={13} />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[14px] h-3.5 rounded-full text-[9px] font-black flex items-center justify-center px-0.5"
            style={{ background: "var(--color-warn)", color: "#000", boxShadow: "0 0 6px rgba(245,158,11,0.5)" }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {createPortal(panel, document.body)}
    </>
  );
}
