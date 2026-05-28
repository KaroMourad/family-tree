import { Link, Outlet, useMatch, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, ChevronUp, Search, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useTreeContext } from "../tree/TreeContext";
import { usePeople } from "../hooks/usePeople";
import { useUIStore } from "../store/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  TreeSubHeaderSlotProvider,
  useTreeSubHeaderSlots,
} from "./TreeSubHeaderSlot";
import { MatchNavProvider, useMatchNav } from "./MatchNav";

/**
 * Shared chrome for every tree-scoped route. Renders two rows:
 *   1. Global header — back to trees, user/people info, logout, theme.
 *   2. Tree sub-header — tree title (or page-supplied override) + a shared
 *      search input + a slot for the page's view-specific controls.
 * The page itself renders via <Outlet/> below.
 *
 * Pages contribute to the sub-header via <TreeSubHeaderSlot name="...">.
 */
export function TreeLayout() {
  const { treeId } = useParams();
  const { user, logout } = useAuth();
  const tree = useTreeContext();
  const { data: people = [] } = usePeople(treeId);
  const q = useUIStore((s) => s.searchQuery);
  const setQ = useUIStore((s) => s.setSearchQuery);
  const [slots, setSlot] = useTreeSubHeaderSlots();

  // The chooser route (/tree/:treeId, no extra segment) is a landing page;
  // hide the sub-header there. All other tree routes get the sub-header.
  const isChooser = useMatch("/tree/:treeId");
  const viewLabel = useCurrentViewLabel();

  return (
    <MatchNavProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <div className="shrink-0 z-10 border-b border-border bg-background/90 backdrop-blur">
          {/* Global header */}
          <header className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3">
            <Breadcrumb
              treeId={treeId!}
              treeName={tree.name}
              viewLabel={isChooser ? null : viewLabel}
            />
            {!isChooser && <SearchField q={q} setQ={setQ} className="ml-auto" />}
            <span
              className={`hidden md:inline text-xs text-muted-foreground tracking-widest truncate ${
                isChooser ? "ml-auto" : ""
              }`}
            >
              {people.length} people
              <span className="hidden lg:inline">
                {" "}
                · {user?.email} ({user?.role})
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={logout}
              className={isChooser ? "md:ml-0 ml-auto" : ""}
            >
              Logout
            </Button>
            <ThemeToggle />
          </header>
          {/* Tree sub-header */}
          {!isChooser && (
            <TreeSubHeaderRow
              titleSlot={slots.title}
              actionsSlot={slots.actions}
              treeName={tree.name}
            />
          )}
        </div>

        <TreeSubHeaderSlotProvider onContentChange={setSlot}>
          <Outlet />
        </TreeSubHeaderSlotProvider>
      </div>
    </MatchNavProvider>
  );
}

// Map from the URL view segment to the breadcrumb label shown to the user.
// Keep in sync with the route paths in App.tsx and the cards in TreeChooser.
const VIEW_LABELS: Record<string, string> = {
  list: "Indented List",
  chart: "Genealogical Chart",
  illustrated: "Illustrated Tree",
  compact: "Compact Illustrated",
  editor: "Editor",
};

function useCurrentViewLabel(): string | null {
  const m = useMatch("/tree/:treeId/:view");
  const view = m?.params.view;
  return (view && VIEW_LABELS[view]) ?? null;
}

function Breadcrumb({
  treeId,
  treeName,
  viewLabel,
}: {
  treeId: string;
  treeName: string;
  viewLabel: string | null;
}) {
  const linkCls =
    "text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors truncate";
  const sepCls = "h-3.5 w-3.5 text-muted-foreground shrink-0";
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0">
      <Link to="/" className={linkCls}>
        Trees
      </Link>
      <ChevronRight className={sepCls} aria-hidden="true" />
      {viewLabel ? (
        <Link to={`/tree/${treeId}`} className={linkCls}>
          {treeName}
        </Link>
      ) : (
        <span
          className="text-xs uppercase tracking-widest text-foreground font-medium truncate"
          aria-current="page"
        >
          {treeName}
        </span>
      )}
      {viewLabel && (
        <>
          <ChevronRight className={sepCls} aria-hidden="true" />
          <span
            className="text-xs uppercase tracking-widest text-foreground font-medium truncate"
            aria-current="page"
          >
            {viewLabel}
          </span>
        </>
      )}
    </nav>
  );
}

function TreeSubHeaderRow({
  titleSlot,
  actionsSlot,
  treeName,
}: {
  titleSlot: React.ReactNode;
  actionsSlot: React.ReactNode;
  treeName: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 h-12 border-t border-border/60">
      {titleSlot ?? (
        <h1 className="m-0 text-lg font-semibold text-primary uppercase tracking-[0.15em] truncate min-w-0">
          ◆ {treeName}
        </h1>
      )}
      <div className="ml-auto flex items-center gap-3">{actionsSlot}</div>
    </div>
  );
}

function SearchField({
  q,
  setQ,
  className,
}: {
  q: string;
  setQ: (s: string) => void;
  className?: string;
}) {
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
