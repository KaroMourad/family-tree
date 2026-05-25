import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { allRoots, flattenTree, useTree } from "../hooks/useTree";
import { DetailPanel } from "../components/DetailPanel";
import type { TreeNode } from "../types";
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

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (error) return <div style={{ padding: 40, color: "var(--coral)" }}>Error: {error}</div>;
  if (Array.isArray(tree) && tree.length === 0) {
    return (
      <div style={{ padding: 40 }}>
        <p>This tree is empty.</p>
        <p><Link to={`/tree/${treeId}/editor`}>Open the editor to add people.</Link></p>
      </div>
    );
  }

  const selected = selectedId ? byId[selectedId] ?? null : null;
  const peopleCount = Object.keys(byId).length;

  return (
    <div className="view-shell">
      <header className="view-header">
        <h1>◆ Family Tree</h1>
        <Link className="btn" to={`/tree/${treeId}`}>← Views</Link>
        <input
          type="search"
          placeholder="Search by name or ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={() => setCollapsedAll(-1)}>Expand all</button>
        <button onClick={() => setCollapsedAll(1)}>Collapse all</button>
        <span className="stats">
          {peopleCount} people · {roots.length} root line{roots.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="tree-list-wrap">
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
