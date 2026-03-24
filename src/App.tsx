import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
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
  );
}

export default function App() {
  const [authReady, setAuthReady]   = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    getSession().then(async (session) => {
      if (session) {
        await initSupabaseSync();
        setHasSession(true);
      }
      setAuthReady(true);
    });
  }, []);

  // Brief invisible wait while we check session (avoids login flash for returning users)
  if (!authReady) return null;

  if (!hasSession) {
    return (
      <LoginScreen
        onSignIn={async () => {
          await initSupabaseSync();
          setHasSession(true);
        }}
      />
    );
  }

  return <AppRoutes />;
}
