import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
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

function ThemeApplier() {
  const { data } = useAppData();
  useEffect(() => {
    const isBW = data.userSettings?.theme === "bw";
    document.documentElement.classList.toggle("theme-bw", isBW);
  }, [data.userSettings?.theme]);
  return null;
}

export default function App() {
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
    </HashRouter>
  );
}
