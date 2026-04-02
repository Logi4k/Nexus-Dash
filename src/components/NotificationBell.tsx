import { useState, useMemo } from "react";
import { Bell, X, RefreshCw, AlertTriangle, Check, Landmark, PiggyBank, Briefcase } from "lucide-react";
import { useAppData } from "@/lib/store";
import { buildAppNotifications, buildRawAppNotifications, getNotificationCount } from "@/lib/notifications";
import Modal from "@/components/Modal";

export default function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { data, update } = useAppData();
  const [notificationOpen, setNotificationOpen] = useState(false);
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

  const notificationList = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Bell size={12} className="text-warn" />
          <span className="text-xs font-bold text-tx-1">Notifications</span>
          {count > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warn/10 text-warn border border-warn/20">
              {count} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {count > 0 && (
            <button
              onClick={dismissAllNotifications}
              className="text-[9px] font-bold px-2 py-1 rounded-full text-tx-3 bg-surface-1/4 border border-border-subtle hover:text-tx-1 transition-colors"
            >
              Dismiss all
            </button>
          )}
          <button
            onClick={() => setNotificationOpen(false)}
            className="w-5 h-5 flex items-center justify-center rounded text-tx-4 hover:text-tx-1 hover:bg-bg-hover transition-all"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-profit/10 border border-profit/20">
              <Check size={14} className="text-profit" />
            </div>
            <p className="text-xs font-medium text-tx-3 m-0">All clear</p>
            <p className="text-[10px] text-tx-4 text-center m-0">
              No urgent alerts across subscriptions, prop risk, debt, or tax.
            </p>
          </div>
        ) : (
          <div className="py-1">
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
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-1/3 transition-colors"
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${dotColor}18`, border: `1px solid ${dotColor}30` }}
                  >
                    {item.severity === "critical"
                      ? <AlertTriangle size={10} style={{ color: dotColor }} />
                      : <Icon size={10} style={{ color: dotColor }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-tx-1 m-0 truncate">{item.title}</p>
                    <p className="text-[10px] text-tx-4 m-0">{item.detail}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[11px] font-black tabular-nums m-0" style={{ color: dotColor }}>
                      {item.sideLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Dismiss ${item.title}`}
                    onClick={() => dismissNotification(item.id)}
                    className="w-5 h-5 flex items-center justify-center rounded-md border border-border-subtle bg-surface-1/4 text-tx-4 hover:text-tx-1 hover:bg-surface-1/8 transition-colors flex-shrink-0 mt-0.5"
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
      <div className="px-4 py-2 border-t border-border-subtle/60 flex items-center justify-between">
        <span className="text-[9px] text-tx-4">
          {dismissedCount > 0 ? `${dismissedCount} dismissed` : "Operational alerts"}
        </span>
        {dismissedCount > 0 ? (
          <button
            type="button"
            onClick={resetDismissedNotifications}
            className="text-[9px] text-tx-3 bg-transparent border-none cursor-pointer p-0 hover:text-tx-1 transition-colors"
          >
            Reset dismissed
          </button>
        ) : (
          <span className="text-[9px] text-tx-4">Sync + settings aware</span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setNotificationOpen(true)}
        title="Notifications"
        className="relative flex items-center justify-center w-7 h-7 rounded-lg transition-all"
        style={{
          color: count > 0 ? "var(--color-warn)" : "var(--tx-4)",
          background: notificationOpen ? "rgba(var(--surface-rgb),0.08)" : "rgba(var(--surface-rgb),0.03)",
          border: `1px solid ${notificationOpen ? "rgba(var(--border-rgb),0.12)" : "rgba(var(--border-rgb),0.07)"}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(var(--surface-rgb),0.08)";
          (e.currentTarget as HTMLElement).style.color = count > 0 ? "var(--color-warn)" : "var(--tx-2)";
        }}
        onMouseLeave={(e) => {
          if (!notificationOpen) {
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

      <Modal
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
        title="Notifications"
        size="md"
      >
        {notificationList}
      </Modal>
    </>
  );
}
