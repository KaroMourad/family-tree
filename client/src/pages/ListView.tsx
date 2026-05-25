import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { allRoots, flattenTree, useTree } from "../hooks/useTree";
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
  collapsedAll: number;
  match: Set<string>;
  onSelect: (id: string) => void;
};

function ListNode({ node, collapsedAll, match, onSelect }: NodeProps) {
  const [open, setOpen] = useState(true);
  const isOpen = collapsedAll > 0 ? false : collapsedAll < 0 ? true : open;
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
            setOpen((v) => !v);
          }}
        >
          {hasKids ? (isOpen ? "−" : "+") : "·"}
        </span>
        <span className="name">{node.name}</span>
        {dateRange(node) && <span className="meta">{dateRange(node)}</span>}
        <span className="id-tag">#{node.id}</span>
      </span>
      {hasKids && (
        <ul>
          {node.children.map((c) => (
            <ListNode key={c.id} node={c} collapsedAll={collapsedAll} match={match} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ListView() {
  const { treeId } = useParams();
  const { tree, loading, error } = useTree(treeId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [collapsedAll, setCollapsedAll] = useState(-1); // -1 = all open, 1 = all closed, 0 = per-node

  const byId = useMemo(() => flattenTree(tree), [tree]);
  const roots = useMemo(() => allRoots(tree), [tree]);

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
  if (error) return <div className="p-10 text-destructive">Error: {error}</div>;
  if (Array.isArray(tree) && tree.length === 0) {
    return (
      <div className="p-10">
        <p>This tree is empty.</p>
        <p><Link to={`/tree/${treeId}/editor`} className="text-primary hover:underline">Open the editor to add people.</Link></p>
      </div>
    );
  }

  const selected = selectedId ? byId[selectedId] ?? null : null;
  const peopleCount = Object.keys(byId).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border bg-background/90 backdrop-blur">
        <h1 className="m-0 text-lg font-semibold text-primary uppercase tracking-[0.15em]">
          ◆ Family Tree
        </h1>
        <Button asChild variant="outline" size="sm" className="uppercase tracking-widest">
          <Link to={`/tree/${treeId}`}>← Views</Link>
        </Button>
        <Input
          type="search"
          placeholder="Search by name or ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
        <Button variant="outline" size="sm" onClick={() => setCollapsedAll(-1)} className="uppercase tracking-widest">
          Expand all
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCollapsedAll(1)} className="uppercase tracking-widest">
          Collapse all
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tracking-widest">
          {peopleCount} people · {roots.length} root line{roots.length === 1 ? "" : "s"}
        </span>
        <ThemeToggle />
      </header>

      <div className="p-6 overflow-auto">
        <ul className="tree-list">
          {roots.map((r) => (
            <ListNode key={r.id} node={r} collapsedAll={collapsedAll} match={matches} onSelect={setSelectedId} />
          ))}
        </ul>
      </div>

      <DetailPanel person={selected as TreeNode | null} byId={byId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
