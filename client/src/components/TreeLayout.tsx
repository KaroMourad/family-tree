import { Link, Outlet, useMatch, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useTreeContext } from "../tree/TreeContext";
import { usePeople } from "../hooks/usePeople";
import { useUIStore } from "../store/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  TreeSubHeaderSlotProvider,
  useTreeSubHeaderSlots,
} from "./TreeSubHeaderSlot";

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

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="shrink-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        {/* Global header */}
        <header className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="uppercase tracking-widest"
          >
            <Link to="/">← Trees</Link>
          </Button>
          <span className="ml-auto text-xs text-muted-foreground tracking-widest truncate">
            {people.length} people
            <span className="hidden sm:inline">
              {" "}
              · {user?.email} ({user?.role})
            </span>
          </span>
          <Button size="sm" variant="outline" onClick={logout}>
            Logout
          </Button>
          <ThemeToggle />
        </header>
        {/* Tree sub-header */}
        {!isChooser && (
          <TreeSubHeaderRow
            tree={tree}
            q={q}
            setQ={setQ}
            titleSlot={slots.title}
            actionsSlot={slots.actions}
          />
        )}
      </div>

      <TreeSubHeaderSlotProvider onContentChange={setSlot}>
        <Outlet />
      </TreeSubHeaderSlotProvider>
    </div>
  );
}

function TreeSubHeaderRow({
  tree,
  q,
  setQ,
  titleSlot,
  actionsSlot,
}: {
  tree: { name: string };
  q: string;
  setQ: (s: string) => void;
  titleSlot: React.ReactNode;
  actionsSlot: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 h-12 border-t border-border/60">
      {titleSlot ?? (
        <h1 className="m-0 text-lg font-semibold text-primary uppercase tracking-[0.15em] truncate min-w-0">
          ◆ {tree.name}
        </h1>
      )}
      <div className="ml-auto relative flex-1 max-w-sm min-w-0">
        <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name or ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && q) {
              e.preventDefault();
              setQ("");
            }
          }}
          className={`pl-8 h-8 ${q ? "pr-8" : "pr-3"}`}
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQ("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {actionsSlot}
    </div>
  );
}
