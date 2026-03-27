import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Market from "@/pages/Market";
import PropAccounts from "@/pages/PropAccounts";
import Expenses from "@/pages/Expenses";
import Debt from "@/pages/Debt";
import Tax from "@/pages/Tax";
import Investments from "@/pages/Investments";
import Journal from "@/pages/Journal";
import Ideas from "@/pages/Ideas";
import { useAppData } from "@/lib/store";
import { getSession } from "@/lib/supabase";
import { initSupabaseSync } from "@/lib/store";
import LoginScreen from "@/components/LoginScreen";

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

function ThemeApplier() {
  const { data } = useAppData();
  useEffect(() => {
    const isBW = data.userSettings?.theme === "bw";
    document.documentElement.classList.toggle("theme-bw", isBW);
  }, [data.userSettings?.theme]);
  return null;
}

function AppRoutes() {
  return (
    // reducedMotion="user" makes all Framer Motion animations in the app
    // automatically respect the OS prefers-reduced-motion preference.
    <MotionConfig reducedMotion="user">
    <HashRouter>
      <ThemeApplier />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="market" element={<Market />} />
          <Route path="prop" element={<PropAccounts />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="debt" element={<Debt />} />
          <Route path="tax" element={<Tax />} />
          <Route path="investments" element={<Investments />} />
          <Route path="journal" element={<Journal />} />
          <Route path="ideas" element={<Ideas />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster
        position="bottom-center"
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

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const session = await getSession();
        if (!active) return;

        setHasSession(!!session);

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

  if (!hasSession) {
    return (
      <LoginScreen
        onSignIn={async () => {
          setHasSession(true);
          try {
            await initSupabaseSync();
          } catch (error) {
            console.error("[app] initSupabaseSync after sign-in failed:", error);
          }
        }}
      />
    );
  }

  return <AppRoutes />;
}
