import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUIStore } from "../store/ui";
import { useMatchNav } from "./MatchNav";

/**
 * Shared search input for tree views. Reads/writes useUIStore.searchQuery
 * so all views share one term. Inside the input, on the right side, it
 * renders a counter + up/down/clear buttons wired to the active view's
 * MatchNav registration (see useRegisterMatchNav).
 *
 * Keyboard: Enter → next match, Shift+Enter → previous, Esc → clear.
 */
export function SearchField({ className }: { className?: string }) {
  const q = useUIStore((s) => s.searchQuery);
  const setQ = useUIStore((s) => s.setSearchQuery);
  const { total, currentIndex, goPrev, goNext } = useMatchNav();
  return (
    <div className={`relative flex-1 max-w-sm min-w-0 ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search by name or ID…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) goPrev();
            else goNext();
          } else if (e.key === "Escape" && q) {
            e.preventDefault();
            setQ("");
          }
        }}
        className={`pl-8 h-8 ${q ? "pr-28" : "pr-3"}`}
      />
      {q && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <span className="px-1 text-[10px] tabular-nums text-muted-foreground tracking-widest">
            {total === 0 ? "no match" : `${currentIndex + 1} / ${total}`}
          </span>
          <button
            type="button"
            aria-label="Previous match"
            onClick={goPrev}
            disabled={total === 0}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next match"
            onClick={goNext}
            disabled={total === 0}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQ("")}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
