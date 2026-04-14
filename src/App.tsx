import { Suspense, lazy, useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
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

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg-card px-4 py-3 text-sm text-tx-3 shadow-soft">
        <div
          className="h-2.5 w-2.5 rounded-full animate-pulse"
          style={{ background: "rgba(var(--accent-rgb),0.78)" }}
        />
        Loading page…
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
      <Suspense fallback={<RouteFallback />}>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
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

        setHasSession(!!session);
        if (session) {
          writeOfflineMode(false);
          setOfflineMode(false);
        }

        if (session) {
          try {
            await initSupabaseSync();
          } catch (error) {
            console.error("[app] initSupabaseSync during bootstrap failed:", error);
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

  if (!hasSession && !offlineMode) {
    return (
      <LoginScreen
        onSignIn={async () => {
          writeOfflineMode(false);
          setOfflineMode(false);
          setHasSession(true);
          try {
            await initSupabaseSync();
          } catch (error) {
            console.error("[app] initSupabaseSync after sign-in failed:", error);
          }
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
