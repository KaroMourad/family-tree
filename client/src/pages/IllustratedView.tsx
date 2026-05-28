import { useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import * as d3 from "d3";
import { usePeople } from "../hooks/usePeople";
import { firstRoot, flattenTree, nestPeople } from "../api/nest";
import { useUIStore } from "../store/ui";
import { DetailPanel } from "../components/DetailPanel";
import { TreeSubHeaderSlot } from "../components/TreeSubHeaderSlot";
import { useRegisterMatchNav } from "../components/MatchNav";
import type { TreeNode } from "../types";
import { Button } from "@/components/ui/button";
import "../styles/views.css";

// Recursive line-art tree (port of build_freepik.py)
const TRUNK_LENGTH = 240;
const LENGTH_DECAY = 0.74;
const MAX_SPREAD = (140 * Math.PI) / 180;
const MIN_SPREAD = (45 * Math.PI) / 180;
const SPREAD_DECAY = 0.83;
const WIGGLE_DEG = 8;

function genderClass(g?: string | null) {
  if (!g) return "unknown";
  const s = String(g).toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f") || s.startsWith("w")) return "female";
  return "unknown";
}
function deceased(p: { deceased?: string | null }) {
  if (!p.deceased) return false;
  const s = String(p.deceased).toLowerCase();
  return !(s === "no" || s === "0" || s === "false");
}

type Seg = { id: string; x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; depth: number; length: number };
type Pos = { x: number; y: number; depth: number; terminal: boolean; angle: number };

function computeLayout(root: TreeNode) {
  const segments: Seg[] = [];
  const nodes: Record<string, Pos> = {};

  // Seeded RNG for stable layout
  let s = 11;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const weightMemo: Record<string, number> = {};
  const weight = (n: TreeNode): number => {
    if (weightMemo[n.id] != null) return weightMemo[n.id];
    let w = 1;
    for (const c of n.children) w += weight(c);
    weightMemo[n.id] = w;
    return w;
  };

  const grow = (node: TreeNode, x: number, y: number, angle: number, length: number, depth: number) => {
    const tipX = x + Math.sin(angle) * length;
    const tipY = y - Math.cos(angle) * length;
    const perpX = Math.cos(angle);
    const perpY = Math.sin(angle);
    const bend = (rnd() - 0.5) * length * 0.3 + length * 0.08 * (rnd() > 0.5 ? 1 : -1);
    const cx = (x + tipX) / 2 + perpX * bend;
    const cy = (y + tipY) / 2 + perpY * bend;
    segments.push({ id: node.id, x0: x, y0: y, cx, cy, x1: tipX, y1: tipY, depth, length });
    nodes[node.id] = { x: tipX, y: tipY, depth, terminal: node.children.length === 0, angle };
    if (node.children.length === 0) return;
    const spread = Math.max(MIN_SPREAD, MAX_SPREAD * Math.pow(SPREAD_DECAY, depth));
    const weights = node.children.map(weight);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let cursor = -spread / 2;
    const newLen = length * LENGTH_DECAY;
    node.children.forEach((c, i) => {
      const share = (weights[i] / total) * spread;
      const rel = cursor + share / 2;
      cursor += share;
      const jitter = ((rnd() - 0.5) * WIGGLE_DEG * 2 * Math.PI) / 180;
      const lenJit = 1.0 + (rnd() - 0.5) * 0.2;
      grow(c, tipX, tipY, angle + rel + jitter, newLen * lenJit, depth + 1);
    });
  };

  grow(root, 0, 0, 0, TRUNK_LENGTH, 0);
  return { segments, nodes };
}

export function IllustratedView() {
  const { treeId } = useParams();
  const { data: people, isPending: loading, error } = usePeople(treeId);
  const tree = useMemo(() => (people ? nestPeople(people) : null), [people]);
  const root = firstRoot(tree);
  const byId = useMemo(() => flattenTree(tree), [tree]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const setSelectedId = useUIStore((s) => s.setSelectedPerson);
  const q = useUIStore((s) => s.searchQuery);

  // Match ids in pre-order traversal (display order). Match rule mirrors
  // ListView/Editor so the counter agrees across views.
  const matchedIds = useMemo(() => {
    const out: string[] = [];
    const term = q.trim().toLowerCase();
    if (!term || !root) return out;
    const walk = (n: TreeNode) => {
      const hay = `${n.name} ${n.nickname ?? ""} ${n.id} ${n.surnameNow ?? ""} ${n.surnameBirth ?? ""}`.toLowerCase();
      if (hay.includes(term)) out.push(n.id);
      n.children?.forEach(walk);
    };
    walk(root);
    return out;
  }, [q, root]);
  // Phase A: register matched ids; SVG pan/zoom focus comes in Phase B.
  useRegisterMatchNav({ matchedIds });

  useEffect(() => {
    setSelectedId(null);
  }, [treeId, setSelectedId]);

  const layout = useMemo(() => (root ? computeLayout(root) : null), [root]);

  useEffect(() => {
    if (!root || !layout || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("g.root").remove();
    const gRoot = svg.append("g").attr("class", "root");
    gRef.current = gRoot.node();

    // branches
    const branchG = gRoot.append("g");
    const strokeFor = (depth: number) => Math.max(1.2, 9 - depth * 1.4);
    branchG
      .selectAll("path.branch")
      .data(layout.segments)
      .join("path")
      .attr("class", "branch")
      .attr("d", (d) => `M${d.x0},${d.y0} Q${d.cx},${d.cy} ${d.x1},${d.y1}`)
      .attr("stroke-width", (d) => strokeFor(d.depth));

    // scattered leaves around terminals
    const COLORS = ["olive", "teal", "coral"];
    let seedL = 7;
    const rndL = () => { seedL = (seedL * 9301 + 49297) % 233280; return seedL / 233280; };
    const leafG = gRoot.append("g");
    Object.entries(layout.nodes).forEach(([id, p]) => {
      if (!p.terminal) return;
      for (let i = 0; i < 3 + Math.floor(rndL() * 3); i++) {
        const r = 10 + rndL() * 35;
        const a = rndL() * Math.PI * 2;
        const x = p.x + Math.cos(a) * r;
        const y = p.y + Math.sin(a) * r;
        leafG
          .append("ellipse")
          .attr("class", "leaf-deco " + COLORS[Math.floor(rndL() * COLORS.length)])
          .attr("rx", 4.5 + rndL() * 2)
          .attr("ry", 2 + rndL())
          .attr("transform", `translate(${x},${y}) rotate(${rndL() * 360})`);
      }
    });

    // name tags
    const TAG_H = 22;
    const tagWidth = (name: string) => Math.max(50, Math.min(180, 20 + name.length * 7));
    const tagNodes = Object.entries(layout.nodes).filter(([id]) => id !== root.id);
    const tagG = gRoot.append("g");
    const tag = tagG
      .selectAll<SVGGElement, [string, Pos]>("g.name-tag")
      .data(tagNodes)
      .join("g")
      .attr("class", ([id]) => {
        const p = byId[id];
        const cls = ["name-tag", genderClass(p?.gender)];
        if (deceased(p ?? {})) cls.push("deceased");
        return cls.join(" ");
      })
      .attr("data-id", ([id]) => id)
      .attr("transform", ([, p]) => `translate(${p.x},${p.y})`)
      .on("click", (e, [id]) => { setSelectedId(id); e.stopPropagation(); });

    tag.each(function ([id]) {
      const p = byId[id];
      if (!p) return;
      const w = tagWidth(p.name);
      const sel = d3.select(this);
      sel.append("rect").attr("class", "bg").attr("x", -w / 2).attr("y", -TAG_H / 2).attr("width", w).attr("height", TAG_H);
      sel.append("rect").attr("class", "frame").attr("x", -w / 2).attr("y", -TAG_H / 2).attr("width", w).attr("height", TAG_H).attr("rx", 2.5);
      sel.append("text").attr("class", "name").attr("y", 4).attr("font-size", 11).text(p.name);
      const b = p.birthYear || "", x = p.deathYear || "";
      if (b || x) sel.append("text").attr("class", "dates").attr("y", TAG_H / 2 + 9).text(`${b}${b || x ? " – " : ""}${x}`);
    });

    // Root badge
    const rootG = gRoot.append("g").attr("transform", `translate(0,0)`);
    const rootR = Math.max(40, tagWidth(root.name) / 2 + 14);
    rootG.append("circle").attr("class", "root-badge").attr("r", rootR);
    rootG.append("circle").attr("class", "root-badge-inner").attr("r", rootR - 7);
    rootG.append("text").attr("class", "root-label").attr("y", 8).text(root.name);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 4])
      .on("zoom", (e) => gRoot.attr("transform", e.transform.toString()));
    svg.call(zoom);
    zoomRef.current = zoom;

    const bb = (gRoot.node() as SVGGraphicsElement).getBBox();
    const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
    const pad = 40;
    const scale = Math.min((w - pad * 2) / bb.width, (h - pad * 2) / bb.height, 1);
    const tx = w / 2 - scale * (bb.x + bb.width / 2);
    const ty = h / 2 - scale * (bb.y + bb.height / 2);
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, [root, layout, byId]);

  useEffect(() => {
    if (!gRef.current) return;
    const term = q.trim().toLowerCase();
    d3.select(gRef.current).selectAll<SVGGElement, [string, Pos]>("g.name-tag").classed("match", false);
    if (!term) return;
    d3.select(gRef.current)
      .selectAll<SVGGElement, [string, Pos]>("g.name-tag")
      .each(function ([id]) {
        const p = byId[id];
        if (!p) return;
        const hay = `${p.name} ${id}`.toLowerCase();
        if (hay.includes(term)) d3.select(this).classed("match", true);
      });
  }, [q, byId]);

  function fit() {
    if (!gRef.current || !svgRef.current || !zoomRef.current) return;
    const bb = (gRef.current as SVGGraphicsElement).getBBox();
    const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
    const pad = 40;
    const scale = Math.min((w - pad * 2) / bb.width, (h - pad * 2) / bb.height, 1);
    const tx = w / 2 - scale * (bb.x + bb.width / 2);
    const ty = h / 2 - scale * (bb.y + bb.height / 2);
    d3.select(svgRef.current).transition().duration(400).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  }

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
  if (!root) return <div className="p-10">No data.</div>;


  return (
    <>
      <TreeSubHeaderSlot name="actions">
        <Button
          variant="outline"
          size="sm"
          onClick={fit}
          className="uppercase tracking-widest"
        >
          Fit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            zoomRef.current &&
            d3
              .select(svgRef.current!)
              .transition()
              .call(zoomRef.current.scaleBy as any, 1.3)
          }
        >
          +
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            zoomRef.current &&
            d3
              .select(svgRef.current!)
              .transition()
              .call(zoomRef.current.scaleBy as any, 1 / 1.3)
          }
        >
          −
        </Button>
      </TreeSubHeaderSlot>
      <div className="compact flex-1 min-h-0 relative overflow-hidden">
        <svg
          ref={svgRef}
          className="block w-full h-full cursor-grab active:cursor-grabbing bg-background"
        />
      </div>
      <DetailPanel />
    </>
  );
}
