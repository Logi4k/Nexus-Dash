import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RegisteredPageView } from "@/lib/viewIntents";

interface PageViewContextValue {
  currentView: RegisteredPageView | null;
  registerView: (view: RegisteredPageView | null) => void;
}

const PageViewContext = createContext<PageViewContextValue | null>(null);

export function PageViewProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<RegisteredPageView | null>(null);

  const value = useMemo<PageViewContextValue>(
    () => ({
      currentView,
      registerView: setCurrentView,
    }),
    [currentView]
  );

  return (
    <PageViewContext.Provider value={value}>{children}</PageViewContext.Provider>
  );
}

export function useCurrentPageView() {
  const context = useContext(PageViewContext);
  if (!context) {
    throw new Error("useCurrentPageView must be used within PageViewProvider");
  }
  return context;
}

export function useRegisterPageView(view: RegisteredPageView | null) {
  const { registerView } = useCurrentPageView();

  useEffect(() => {
    registerView(view);
    return () => {
      registerView(null);
    };
  }, [registerView, view]);
}
