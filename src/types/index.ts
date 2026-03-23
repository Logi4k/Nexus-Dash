export interface Expense {
  id: string;
  date: string;
  description: string;
  cat: string;
  amount: number | string;
  notes?: string;
}

export interface Withdrawal {
  id: string;
  date: string;
  firm: string;
  gross: number;
  notes?: string;
}

export interface Investment {
  id: string;
  ticker: string;
  name: string;
  type: "etf" | "stock";
  units: number;
  buy: number;
  cur: number;
}

export interface WealthTarget {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  target: number;
  saved: number;
  monthly: number;
  color?: string;
}

export type AccountStatus = "funded" | "Funded" | "Challenge" | "Breached" | "breached";

export interface AccountPnlEntry {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface Account {
  id: string;
  firm: string;
  type: string;
  name?: string;
  status: AccountStatus;
  balance: number;
  initialBalance?: number;
  sodBalance?: number;
  mll?: number;
  ddResetTime?: number;
  notes?: string;
  pnlHistory?: number[];
  pnlEntries?: AccountPnlEntry[];
  linkedExpenseId?: string;
}

export interface PassedChallenge {
  id: string;
  firm: string;
  type: string;
  name?: string;
  passedDate: string;
  finalBalance: number;
  initialBalance: number;
  profitTarget: number;
}

export interface Debt {
  id: string;
  name: string;
  creditLimit: number;
  currentBalance: number;
  rate: number;
  monthly: number;
  nextPayment: string;
  network?: string;
  lastFour?: string;
  payments?: DebtPayment[];
}

export interface DebtPayment {
  id: string;
  date: string;
  amount: number;
  notes?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  balance: number;
  limit: number;
  apr: number;
  minPayment: number;
  network: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: "monthly" | "yearly" | "weekly";
  startDate: string;
  nextRenewal: string;
  notes?: string;
}

export interface T212 {
  last_sync: number;
  free_cash: number;
  total_value: number;
  invested: number;
  ppl: number;
  result: number;
}

export interface TaxProfile {
  country: string;
  employmentStatus: string;
  annualIncome: number;
  ukSpecific: {
    studentLoan: string;
    pensionPercentage: number;
    taxCode: string;
    isScottish: boolean;
  };
  otherSpecific: {
    effectiveTaxRate: number;
  };
}

export interface MarketTicker {
  name: string;
  ticker: string;
}

// Futures market types

export interface FuturesContract {
  symbol: string;
  name: string;
  exchange: string;
  tickSize: number;
  tickValue: number;
  pointValue: number;
  contractMonths: string;
  tradingHours: string;
  microSymbol?: string;
}

export interface MarketSession {
  name: string;
  startET: string;
  endET: string;
  color: string;
}

export interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  name: string;
  impact: "high" | "medium" | "low";
  previous?: string;
  forecast?: string;
  actual?: string;
}

export interface TradeEntry {
  id: string;
  date: string;
  time: string;
  instrument: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  contracts: number;
  pnl: number;
  fees: number;
  setup?: string;
  session?: string;
  notes?: string;
  tags?: string[];
  imageIds?: string[];   // keys into IndexedDB image store
}

export interface JournalEntry {
  id: string;
  date: string;           // "YYYY-MM-DD"
  notes: string;          // free-form session notes
  bias: "bullish" | "bearish" | "neutral" | "";
  mood: "great" | "good" | "neutral" | "bad" | "";
  checklist: string[];    // completed checklist items
}

export interface UserProfile {
  username: string;
  avatarColor: string;
  avatarUrl?: string;
}

export type MobileNavItemId =
  | "dashboard"
  | "market"
  | "journal"
  | "ideas"
  | "prop"
  | "expenses"
  | "debt"
  | "tax"
  | "investments";

export interface UserSettings {
  subscriptionRenewalDays: number;  // notify this many days before renewal
  theme?: "dark" | "bw";
  mobileNavItems?: MobileNavItemId[];
  t212ApiKey?: string;
}

export interface AppData {
  expenses: Expense[];
  genExpenses: Expense[];
  withdrawals: Withdrawal[];
  investments: Investment[];
  wealthTargets: WealthTarget[];
  accounts: Account[];
  debts: Debt[];
  creditCards: CreditCard[];
  subscriptions: Subscription[];
  t212: T212;
  t212History: { ts: number; v: number }[];
  taxProfile: TaxProfile;
  marketTickers: MarketTicker[];
  otherDebts: Debt[];
  savingsAccounts: unknown[];
  tradeJournal?: TradeEntry[];
  economicEvents?: EconomicEvent[];
  journalEntries?: JournalEntry[];
  sessionChecklist?: string[];
  userProfile?: UserProfile;
  userSettings?: UserSettings;
  passedChallenges?: PassedChallenge[];
  ideaPageMeta?: IdeaPageMeta;
  ideaTopics?: IdeaTopic[];
  ideaNotes?: IdeaNote[];
  taxSettings?: {
    salary: number;
    savedSoFar: number;
    savingsGoalOverride: number | null;
  };
}

export type NavItem = {
  id: string;
  label: string;
  path: string;
  icon: string;
};

// ── Ideas & Research page types ─────────────────────────────────────────────

export type NoteBlockType =
  | "text" | "h1" | "h2" | "h3"
  | "bullet" | "numbered" | "todo"
  | "quote" | "callout" | "code"
  | "divider" | "image" | "link-bookmark"
  | "columns";

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  content: string;          // plain text, or JSON string for columns/link-bookmark
  checked?: boolean;        // todo blocks
  language?: string;        // code blocks
  emoji?: string;           // callout blocks
  meta?: {                  // link-bookmark: { title, description, favicon }
    title?: string;
    description?: string;
    favicon?: string;
    url?: string;
  };
}

export interface IdeaTopic {
  id: string;
  name: string;
  emoji: string;
}

export interface IdeaPageMeta {
  tagline?: string;
}

export interface IdeaNote {
  id: string;
  topicId: string;
  title: string;
  blocks: NoteBlock[];
  tags: string[];
  createdAt: string;   // ISO string
  updatedAt: string;   // ISO string
}
