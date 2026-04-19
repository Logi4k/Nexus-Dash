import { lazy, useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { MotionConfig } from "framer-motion";
import Layout from "@/components/Layout";
import { useAppData } from "@/lib/store";
import type { AppData } from "@/types";
import { getSession } from "@/lib/supabase";
import { initSupabaseSync } from "@/lib/store";
import LoginScreen from "@/components/LoginScreen";
import ErrorBoundary from "@/components/ErrorBoundary";

const OFFLINE_MODE_KEY = "nexus.offlineMode";
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Market = lazy(() => import("@/pages/Market"));
const PropAccounts = lazy(() => import("@/pages/PropAccounts"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Debt = lazy(() => import("@/pages/Debt"));
const Tax = lazy(() => import("@/pages/Tax"));
const Investments = lazy(() => import("@/pages/Investments"));
const Journal = lazy(() => import("@/pages/Journal"));
const Ideas = lazy(() => import("@/pages/Ideas"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function readOfflineMode(): boolean {
  try {
    return localStorage.getItem(OFFLINE_MODE_KEY) === "true" || localStorage.getItem(OFFLINE_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOfflineMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(OFFLINE_MODE_KEY, "true");
    } else {
      localStorage.removeItem(OFFLINE_MODE_KEY);
    }
  } catch {}
}

function BootScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-base">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="h-10 w-10 rounded-2xl animate-pulse"
          style={{ background: "rgba(var(--surface-rgb),0.14)", border: "1px solid rgba(var(--border-rgb),0.12)" }}
        />
        <div>
          <p className="text-sm font-semibold text-tx-1">Opening Nexus</p>
          <p className="mt-1 text-xs text-tx-4">Restoring session and workspace state.</p>
        </div>
      </div>
    </div>
  );
}

function CloudSyncBlockedScreen({
  message,
  retrying,
  onRetry,
  onContinueOffline,
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
  onContinueOffline: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-base">
      <div className="w-full max-w-md rounded-2xl p-6 bg-[rgba(var(--border-rgb),0.03)] border border-[rgba(var(--border-rgb),0.08)]">
        <p className="text-sm font-semibold text-tx-1">Could not sync workspace</p>
        <p className="mt-2 text-xs text-tx-3 leading-relaxed">{message}</p>
        <p className="mt-3 text-[11px] text-tx-4 leading-relaxed">
          Check your connection and that Supabase is reachable, then retry. You can also continue in offline mode; turn offline mode off later when you want to try cloud sync again.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={retrying}
            onClick={() => void onRetry()}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-accent-glow border border-border-accent text-tx-1 disabled:opacity-50"
          >
            {retrying ? "Retrying…" : "Retry sync"}
          </button>
          <button
            type="button"
            disabled={retrying}
            onClick={() => void onContinueOffline()}
            className="w-full py-2.5 rounded-xl text-xs font-medium border border-[rgba(var(--border-rgb),0.12)] text-tx-2 hover:bg-[rgba(var(--surface-rgb),0.06)] disabled:opacity-50"
          >
            Continue offline
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeApplier() {
  const { data: _data } = useAppData();
  const data = _data ?? ({} as AppData);
  useEffect(() => {
    const isBW = data.userSettings?.theme === "bw";
    document.documentElement.classList.toggle("theme-bw", isBW);
    document.documentElement.setAttribute("data-theme", isBW ? "bw" : "dark");
    document.documentElement.setAttribute(
      "data-density",
      data.userSettings?.density ?? "comfortable"
    );
  }, [data.userSettings?.density, data.userSettings?.theme]);
  return null;
}

function AppRoutes() {
  return (
    // reducedMotion="user" makes all Framer Motion animations in the app
    // automatically respect the OS prefers-reduced-motion preference.
    <MotionConfig reducedMotion="user">
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeApplier />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ErrorBoundary route="Dashboard"><Dashboard /></ErrorBoundary>} />
          <Route path="market" element={<ErrorBoundary route="Market"><Market /></ErrorBoundary>} />
          <Route path="prop" element={<ErrorBoundary route="Prop Accounts"><PropAccounts /></ErrorBoundary>} />
          <Route path="expenses" element={<ErrorBoundary route="Expenses"><Expenses /></ErrorBoundary>} />
          <Route path="debt" element={<ErrorBoundary route="Debt"><Debt /></ErrorBoundary>} />
          <Route path="tax" element={<ErrorBoundary route="Tax"><Tax /></ErrorBoundary>} />
          <Route path="investments" element={<ErrorBoundary route="Investments"><Investments /></ErrorBoundary>} />
          <Route path="journal" element={<ErrorBoundary route="Journal"><Journal /></ErrorBoundary>} />
          <Route path="ideas" element={<ErrorBoundary route="Ideas"><Ideas /></ErrorBoundary>} />
          <Route path="*" element={<ErrorBoundary route="Not Found"><NotFound /></ErrorBoundary>} />
        </Route>
      </Routes>
      <Toaster
        position="bottom-center"
        duration={2000}
        toastOptions={{
          style: {
            background: 'rgba(var(--bg-card-rgb), 0.97)',
            border: '1px solid rgba(var(--border-rgb), 0.12)',
            color: 'var(--tx-1)',
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
          },
        }}
        offset="5.5rem"
      />
    </HashRouter>
    </MotionConfig>
  );
}

export default function App() {
  const [authReady, setAuthReady]   = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [offlineMode, setOfflineMode] = useState(() => readOfflineMode());
  /** When set, the user has a cloud session but initial sync failed; main routes stay gated. */
  const [cloudSyncBlockError, setCloudSyncBlockError] = useState<string | null>(null);
  const [cloudSyncRetrying, setCloudSyncRetrying] = useState(false);

  // Warn when localStorage is running low
  useEffect(() => {
    if (!("storage" in navigator) || !("estimate" in navigator.storage)) return;
    void (async () => {
      try {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        if (quota > 0 && usage / quota > 0.8) {
          toast.warning("Storage nearly full", {
            description: "Consider syncing to cloud or exporting a backup to avoid data loss.",
            duration: 10000,
          });
        }
      } catch {
        // storage.estimate not available — ignore
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const session = await getSession();
        if (!active) return;

        const offline = readOfflineMode();
        setHasSession(!!session);
        setOfflineMode(offline);
        setCloudSyncBlockError(null);

        if (session && !offline) {
          try {
            await initSupabaseSync();
          } catch (error) {
            console.error("[app] initSupabaseSync during bootstrap failed:", error);
            setCloudSyncBlockError(
              error instanceof Error ? error.message : "Could not sync with the cloud."
            );
          }
        }
      } catch (error) {
        console.error("[app] bootstrap failed:", error);
        if (active) setHasSession(false);
      } finally {
        if (active) setAuthReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!authReady) return <BootScreen />;

  if (hasSession && !offlineMode && cloudSyncBlockError) {
    return (
      <CloudSyncBlockedScreen
        message={cloudSyncBlockError}
        retrying={cloudSyncRetrying}
        onRetry={async () => {
          setCloudSyncRetrying(true);
          setCloudSyncBlockError(null);
          try {
            writeOfflineMode(false);
            setOfflineMode(false);
            await initSupabaseSync();
          } catch (error) {
            console.error("[app] initSupabaseSync retry failed:", error);
            setCloudSyncBlockError(
              error instanceof Error ? error.message : "Could not sync with the cloud."
            );
          } finally {
            setCloudSyncRetrying(false);
          }
        }}
        onContinueOffline={async () => {
          setCloudSyncRetrying(true);
          try {
            writeOfflineMode(true);
            setOfflineMode(true);
            setCloudSyncBlockError(null);
            await initSupabaseSync();
          } catch (error) {
            console.error("[app] initSupabaseSync after switching offline failed:", error);
          } finally {
            setCloudSyncRetrying(false);
          }
        }}
      />
    );
  }

  if (!hasSession && !offlineMode) {
    return (
      <LoginScreen
        onSignIn={async () => {
          writeOfflineMode(false);
          setOfflineMode(false);
          await initSupabaseSync();
          setHasSession(true);
        }}
        onUseOffline={() => {
          writeOfflineMode(true);
          setOfflineMode(true);
        }}
      />
    );
  }

  return <AppRoutes />;
}
