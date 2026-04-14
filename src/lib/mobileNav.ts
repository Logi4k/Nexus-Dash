import type { MobileNavItemId } from "@/types";

export const DEFAULT_MOBILE_NAV_ITEMS: MobileNavItemId[] = [
  "dashboard",
  "market",
  "ideas",
  "journal",
];

export const MOBILE_NAV_OPTIONS: {
  id: MobileNavItemId;
  label: string;
  path: string;
  themeKey:
    | "dashboard"
    | "market"
    | "journal"
    | "prop"
    | "expenses"
    | "debt"
    | "tax"
    | "investments"
    | "ideas";
}[] = [
  { id: "dashboard", label: "Home", path: "/", themeKey: "dashboard" },
  { id: "market", label: "Market", path: "/market", themeKey: "market" },
  { id: "journal", label: "Journal", path: "/journal", themeKey: "journal" },
  { id: "ideas", label: "Ideas", path: "/ideas", themeKey: "ideas" },
  { id: "prop", label: "Prop", path: "/prop", themeKey: "prop" },
  { id: "expenses", label: "Expenses", path: "/expenses", themeKey: "expenses" },
  { id: "debt", label: "Debt", path: "/debt", themeKey: "debt" },
  { id: "tax", label: "Tax", path: "/tax", themeKey: "tax" },
  { id: "investments", label: "Investments", path: "/investments", themeKey: "investments" },
];

export function sanitizeMobileNavItems(items?: MobileNavItemId[] | null): MobileNavItemId[] {
  const allowed = new Set(MOBILE_NAV_OPTIONS.map((item) => item.id));
  const picked = (items ?? []).filter((item, index, arr) => allowed.has(item) && arr.indexOf(item) === index);
  return picked.slice(0, 4);
}
