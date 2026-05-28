import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePeople } from "../hooks/usePeople";
import { allRoots, flattenTree, nestPeople } from "../api/nest";
import { useUIStore } from "../store/ui";
import { DetailPanel } from "../components/DetailPanel";
import type { TreeNode } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import "../styles/views.css";

function genderClass(g?: string | null) {
  if (!g) return "";
  const s = g.toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f") || s.startsWith("w")) return "female";
  return "";
}

function isDeceased(d?: string | null) {
  if (!d) return false;
  const s = String(d).toLowerCase();
  return !(s === "no" || s === "0" || s === "false");
}

function dateRange(p: TreeNode) {
  const b = p.birthYear || "";
  const d = p.deathYear || (isDeceased(p.deceased) ? "?" : "");
  if (!b && !d) return "";
  return `(${b}${b || d ? " – " : ""}${d})`;
}

type NodeProps = {
  node: TreeNode;
  isOpen: boolean;
  match: Set<string>;
  isOpenFor: (id: string) => boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
};

function ListNode({ node, isOpen, match, isOpenFor, onSelect, onToggle }: NodeProps) {
  const hasKids = node.children.length > 0;
  const cls = ["card", genderClass(node.gender)];
  if (isDeceased(node.deceased)) cls.push("deceased");
  return (
    <li className={`node${!isOpen && hasKids ? " collapsed" : ""}${match.has(node.id) ? " match" : ""}`}>
      <span className={cls.join(" ")} onClick={() => onSelect(node.id)}>
        <span
          className={`toggle${hasKids ? "" : " empty"}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasKids) return;
            onToggle(node.id);
          }}
        >
          {hasKids ? (isOpen ? "−" : "+") : "·"}
        </span>
        <span className="name">{node.name}</span>
        {dateRange(node) && <span className="meta">{dateRange(node)}</span>}
      </span>
      {hasKids && (
        <ul>
          {node.children.map((c) => (
            <ListNode
              key={c.id}
              node={c}
              isOpen={isOpenFor(c.id)}
              match={match}
              isOpenFor={isOpenFor}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ListView() {
  const { treeId } = useParams();
  const { data: people, isPending: loading, error } = usePeople(treeId);
  const tree = useMemo(() => (people ? nestPeople(people) : null), [people]);
  const setSelectedId = useUIStore((s) => s.setSelectedPerson);
  const q = useUIStore((s) => s.searchQuery);
  const setQ = useUIStore((s) => s.setSearchQuery);

  useEffect(() => {
    setSelectedId(null);
  }, [treeId, setSelectedId]);
  // Set of node IDs that are explicitly open. Default behaviour (when an id is
  // NOT in the set) is controlled by `defaultOpen`. Expand-all → defaultOpen=true,
  // open set cleared. Collapse-all → defaultOpen=false, open set cleared. Per-node
  // clicks add/remove individual ids and flip defaultOpen so the clicked node's
  // membership in `openIds` always means "the opposite of defaultOpen".
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [defaultOpen, setDefaultOpen] = useState(true);

  const byId = useMemo(() => flattenTree(tree), [tree]);
  const roots = useMemo(() => allRoots(tree), [tree]);

  const isOpenFor = useCallback(
    (id: string) => (openIds.has(id) ? !defaultOpen : defaultOpen),
    [openIds, defaultOpen],
  );

  const toggleId = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function expandAll() {
    setDefaultOpen(true);
    setOpenIds(new Set());
  }
  function collapseAll() {
    setDefaultOpen(false);
    setOpenIds(new Set());
  }

  const matches = useMemo(() => {
    const set = new Set<string>();
    const term = q.trim().toLowerCase();
    if (!term) return set;
    for (const p of Object.values(byId)) {
      const hay = `${p.name} ${p.nickname ?? ""} ${p.id} ${p.surnameNow ?? ""} ${p.surnameBirth ?? ""}`.toLowerCase();
      if (hay.includes(term)) set.add(p.id);
    }
    return set;
  }, [q, byId]);

  if (loading) return <div className="p-10">Loading…</div>;
  if (error) return <div className="p-10 text-destructive">Error: {error.message}</div>;
  if (Array.isArray(tree) && tree.length === 0) {
    return (
      <div className="p-10">
        <p>This tree is empty.</p>
        <p><Link to={`/tree/${treeId}/editor`} className="text-primary hover:underline">Open the editor to add people.</Link></p>
      </div>
    );
  }

  const peopleCount = Object.keys(byId).length;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="shrink-0 z-10 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border bg-background/90 backdrop-blur">
        <Button asChild variant="outline" size="sm" className="uppercase tracking-widest">
          <Link to={`/tree/${treeId}`}>← Views</Link>
        </Button>
        <h1 className="m-0 text-lg font-semibold text-primary uppercase tracking-[0.15em]">
          ◆ Family Tree
        </h1>
        <Input
          type="search"
          placeholder="Search by name or ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
        <Button variant="outline" size="sm" onClick={expandAll} className="uppercase tracking-widest">
          Expand all
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll} className="uppercase tracking-widest">
          Collapse all
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tracking-widest">
          {peopleCount} people · {roots.length} root line{roots.length === 1 ? "" : "s"}
        </span>
        <ThemeToggle />
      </header>

      <div className="flex-1 min-h-0 p-6 overflow-auto">
        <ul className="tree-list">
          {roots.map((r) => (
            <ListNode
              key={r.id}
              node={r}
              isOpen={isOpenFor(r.id)}
              match={matches}
              isOpenFor={isOpenFor}
              onSelect={setSelectedId}
              onToggle={toggleId}
            />
          ))}
        </ul>
      </div>

      <DetailPanel />
    </div>
  );
}
