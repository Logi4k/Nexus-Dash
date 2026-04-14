import { SlidersHorizontal } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import { cn } from "@/lib/utils";

export type TradeLogFiltersState = {
  direction: "all" | "long" | "short";
  outcome: "all" | "win" | "loss";
  phase: "all" | "challenge" | "funded";
  sort: string;
  accountId?: string;
};

type AccountOption = {
  value: string;
  label: string;
};

type TradeLogFiltersProps = {
  filters: TradeLogFiltersState;
  journalAccountOptions: AccountOption[];
  showMobileFilters: boolean;
  onToggleMobileFilters: () => void;
  onFiltersChange: (next: TradeLogFiltersState) => void;
  onAccountChange: (accountId?: string) => void;
  onClear: () => void;
};

export function TradeLogFilters({
  filters,
  journalAccountOptions,
  showMobileFilters,
  onToggleMobileFilters,
  onFiltersChange,
  onAccountChange,
  onClear,
}: TradeLogFiltersProps) {
  const hasActiveFilters =
    filters.direction !== "all" ||
    filters.outcome !== "all" ||
    filters.phase !== "all" ||
    filters.accountId !== undefined;

  const filterContent = (
    <div
      className={cn(
        "px-5 py-2.5 border-b border-border flex items-center gap-2 flex-wrap",
        "sm:flex",
        showMobileFilters ? "flex" : "hidden sm:flex"
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-tx-4 font-semibold mr-1 hidden sm:inline">Filter</span>

      {(["all", "long", "short"] as const).map((direction) => (
        <button
          key={direction}
          onClick={() => onFiltersChange({ ...filters, direction })}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors border",
            filters.direction === direction
              ? "bg-accent-muted border-accent text-accent"
              : "border-border text-tx-4 hover:text-tx-2"
          )}
        >
          {direction === "all" ? "All" : direction === "long" ? "Long" : "Short"}
        </button>
      ))}

      <span className="w-px h-3 bg-border mx-1" />

      {(["all", "win", "loss"] as const).map((outcome) => (
        <button
          key={outcome}
          onClick={() => onFiltersChange({ ...filters, outcome })}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors border",
            filters.outcome === outcome
              ? "bg-accent-muted border-accent text-accent"
              : "border-border text-tx-4 hover:text-tx-2"
          )}
        >
          {outcome === "all" ? "All" : outcome === "win" ? "Wins" : "Losses"}
        </button>
      ))}

      <span className="w-px h-3 bg-border mx-1" />

      {(["all", "challenge", "funded"] as const).map((phase) => (
        <button
          key={phase}
          onClick={() => onFiltersChange({ ...filters, phase })}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors border",
            filters.phase === phase
              ? "bg-accent-muted border-accent text-accent"
              : "border-border text-tx-4 hover:text-tx-2"
          )}
        >
          {phase === "all" ? "All Phases" : phase === "challenge" ? "Challenge" : "Funded"}
        </button>
      ))}

      {journalAccountOptions.length > 0 && (
        <>
          <span className="w-px h-3 bg-border mx-1" />
          <CustomSelect
            small
            value={filters.accountId ?? ""}
            onChange={(value) => onAccountChange(value || undefined)}
            placeholder="All Accounts"
            options={[{ value: "", label: "All Accounts" }, ...journalAccountOptions]}
            inlineMobile
          />
        </>
      )}

      {hasActiveFilters && (
        <>
          <span className="w-px h-3 bg-border mx-1" />
          <button
            onClick={onClear}
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-border text-tx-4 hover:text-tx-2 transition-colors"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="sm:hidden px-5 py-2 border-b border-border flex items-center justify-between">
        <button
          onClick={onToggleMobileFilters}
          className={cn(
            "text-[10px] px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 transition-colors",
            hasActiveFilters || showMobileFilters
              ? "bg-accent-muted border-accent text-accent"
              : "border-border text-tx-4 hover:text-tx-2"
          )}
        >
          <SlidersHorizontal size={10} />
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
        </button>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-border text-tx-4 hover:text-tx-2 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      {filterContent}
    </>
  );
}
