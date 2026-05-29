import { useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import * as d3 from "d3";
import { usePeople } from "../hooks/usePeople";
import { firstRoot, flattenTree, nestPeople } from "../api/nest";
import { useUIStore } from "../store/ui";
import { DetailPanel } from "../components/DetailPanel";
import { TreeSubHeaderSlot } from "../components/TreeSubHeaderSlot";
import { useRegisterMatchNav } from "../components/MatchNav";
import { SearchField } from "../components/SearchField";
import type { TreeNode } from "../types";
import { Button } from "@/components/ui/button";
import "../styles/views.css";

const TAG_H = 22;
const FONT_SIZE = 11;
const CHAR_W = 7.0;
const TAG_PAD_X = 10;
const TAG_GAP = 8;
const GEN_H = 90;

function tagWidth(name: string) {
  return Math.max(48, Math.min(170, TAG_PAD_X * 2 + name.length * CHAR_W));
}
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

export function CompactView() {
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
  // Pan/zoom the SVG to center the matched name-tag. Looks up the rendered
  // element by data-id, reads layout coordinates from its datum (.X / .Y),
  // and applies a centering transform. Bails silently if not in the DOM yet.
  const focusMatch = useCallback((id: string) => {
    const svgEl = svgRef.current;
    const gEl = gRef.current;
    const zoom = zoomRef.current;
    if (!svgEl || !gEl || !zoom) return;
    const nodeEl = gEl.querySelector<SVGGElement>(
      `g.name-tag[data-id="${CSS.escape(id)}"]`,
    );
    if (!nodeEl) return;
    const datum = d3.select(nodeEl).datum() as { X?: number; Y?: number };
    if (typeof datum?.X !== "number" || typeof datum?.Y !== "number") return;
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    const cur = d3.zoomTransform(svgEl);
    const scale = Math.max(cur.k, 1.2);
    d3.select(svgEl)
      .transition()
      .duration(500)
      .call(
        zoom.transform,
        d3.zoomIdentity
          .translate(w / 2 - scale * datum.X, h / 2 - scale * datum.Y)
          .scale(scale),
      );
  }, []);
  useRegisterMatchNav({ matchedIds, focusMatch });

  useEffect(() => {
    setSelectedId(null);
  }, [treeId, setSelectedId]);

  useEffect(() => {
    if (!root || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("g.root").remove();
    const gRoot = svg.append("g").attr("class", "root");
    gRef.current = gRoot.node();

    const hier = d3.hierarchy<TreeNode>(root);
    const tree = d3.tree<TreeNode>()
      .nodeSize([1, GEN_H])
      .separation((a, b) => {
        const wa = tagWidth(a.data.name);
        const wb = tagWidth(b.data.name);
        const needed = (wa + wb) / 2 + TAG_GAP;
        const extra = a.parent === b.parent ? 0 : 8;
        return needed + extra;
      });
    tree(hier);

    hier.each((d: any) => { d.X = d.x; d.Y = -d.y; });

    const all = hier.descendants();
    const xs = all.map((d: any) => d.X);
    const ys = all.map((d: any) => d.Y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    // tendrils
    const tendrils = gRoot.append("g").attr("opacity", 0.08);
    let seedT = 3;
    const rndT = () => { seedT = (seedT * 9301 + 49297) % 233280; return seedT / 233280; };
    for (let i = 0; i < 8; i++) {
      const cx = minX + rndT() * (maxX - minX);
      const cy = minY + rndT() * (maxY - minY) - 50;
      const r = 25 + rndT() * 55;
      let d = `M${cx},${cy}`;
      for (let a = 0; a < Math.PI * 3; a += 0.25) {
        const rr = r * (1 - a / (Math.PI * 3));
        d += ` L${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
      }
      tendrils.append("path").attr("d", d).attr("class", "branch").attr("stroke-width", 0.9);
    }

    // branches
    const branchG = gRoot.append("g");
    let seedB = 42;
    const rndB = () => { seedB = (seedB * 9301 + 49297) % 233280; return seedB / 233280; };
    const strokeFor = (depth: number) => Math.max(1.1, 8 - depth * 1.25);
    const curvedPath = (s: any, t: any, seed: number) => {
      const sx = s.X, sy = s.Y, tx = t.X, ty = t.Y;
      const dx = tx - sx, dy = ty - sy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const bend1 = (seed - 0.5) * 18 + (sx < tx ? -6 : 6);
      const bend2 = (seed - 0.5) * 12;
      const c1x = sx + dx * 0.3 + nx * bend1;
      const c1y = sy + dy * 0.3 + ny * bend1;
      const c2x = sx + dx * 0.7 + nx * bend2;
      const c2y = sy + dy * 0.7 + ny * bend2;
      return `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
    };
    const links = hier.links();
    links.sort((a, b) => (a.source.depth || 0) - (b.source.depth || 0));
    branchG
      .selectAll("path.branch")
      .data(links)
      .join("path")
      .attr("class", "branch")
      .attr("d", (d) => curvedPath(d.source, d.target, rndB()))
      .attr("stroke-width", (d) => strokeFor(d.source.depth));

    // leaves
    const leafG = gRoot.append("g");
    const COLORS = ["olive", "teal", "coral"];
    let seedL = 99;
    const rndL = () => { seedL = (seedL * 9301 + 49297) % 233280; return seedL / 233280; };
    const terminals = hier.descendants().filter((d) => !d.children || d.children.length === 0);
    terminals.forEach((d: any) => {
      const w = tagWidth(d.data.name);
      for (let i = 0; i < 2 + Math.floor(rndL() * 2); i++) {
        const x = d.X + (rndL() - 0.5) * w * 0.5;
        const y = d.Y - TAG_H / 2 - 8 - rndL() * 22;
        leafG
          .append("ellipse")
          .attr("class", "leaf-deco " + COLORS[Math.floor(rndL() * COLORS.length)])
          .attr("rx", 4.5)
          .attr("ry", 2)
          .attr("transform", `translate(${x},${y}) rotate(${rndL() * 360}) scale(${0.7 + rndL() * 0.7})`);
      }
    });
    for (let i = 0; i < 60; i++) {
      const x = minX + rndL() * (maxX - minX);
      const y = minY - 40 - rndL() * 120;
      leafG
        .append("ellipse")
        .attr("class", "leaf-deco " + COLORS[Math.floor(rndL() * COLORS.length)])
        .attr("rx", 5)
        .attr("ry", 2.2)
        .attr("transform", `translate(${x},${y}) rotate(${rndL() * 360}) scale(${0.6 + rndL() * 0.7})`);
    }

    // name tags (skip root)
    const tagG = gRoot.append("g");
    const tagNodes = hier.descendants().filter((d) => d !== hier);
    const tag = tagG
      .selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>("g.name-tag")
      .data(tagNodes)
      .join("g")
      .attr("class", (d) => {
        const cls = ["name-tag", genderClass(d.data.gender)];
        if (deceased(d.data)) cls.push("deceased");
        return cls.join(" ");
      })
      .attr("data-id", (d) => d.data.id)
      .attr("transform", (d: any) => `translate(${d.X},${d.Y})`)
      .on("click", (e, d) => { setSelectedId(d.data.id); e.stopPropagation(); });

    tag.each(function (d) {
      const w = tagWidth(d.data.name);
      const sel = d3.select(this);
      sel.append("rect").attr("class", "bg").attr("x", -w / 2).attr("y", -TAG_H / 2).attr("width", w).attr("height", TAG_H);
      sel.append("rect").attr("class", "frame").attr("x", -w / 2).attr("y", -TAG_H / 2).attr("width", w).attr("height", TAG_H).attr("rx", 2.5);
      sel.append("text").attr("class", "name").attr("y", 4).attr("font-size", FONT_SIZE).text(d.data.name);
      const b = d.data.birthYear || "";
      const x = d.data.deathYear || "";
      if (b || x) sel.append("text").attr("class", "dates").attr("y", TAG_H / 2 + 9).text(`${b}${b || x ? " – " : ""}${x}`);
    });

    // Root badge
    const rootG = gRoot.append("g").attr("transform", `translate(${(hier as any).X},${(hier as any).Y})`);
    const rootR = Math.max(40, tagWidth(hier.data.name) / 2 + 14);
    rootG.append("circle").attr("class", "root-badge").attr("r", rootR);
    rootG.append("circle").attr("class", "root-badge-inner").attr("r", rootR - 7);
    rootG.append("text").attr("class", "root-label").attr("y", 8).text(hier.data.name);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 4])
      .on("zoom", (e) => gRoot.attr("transform", e.transform.toString()));
    svg.call(zoom);
    zoomRef.current = zoom;

    // fit
    const bb = (gRoot.node() as SVGGraphicsElement).getBBox();
    const w2 = svgRef.current.clientWidth, h2 = svgRef.current.clientHeight - 60;
    const pad = 30;
    const scale = Math.min((w2 - pad * 2) / bb.width, (h2 - pad * 2) / bb.height, 1);
    const tx = w2 / 2 - scale * (bb.x + bb.width / 2);
    const ty = h2 / 2 + 60 - scale * (bb.y + bb.height / 2);
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, [root]);

  // Drive .match class on g.name-tag from the canonical matchedIds set so the
  // highlighted tags match the counter exactly. Pan-to-current-match is
  // handled by MatchNav via focusMatch.
  useEffect(() => {
    if (!gRef.current) return;
    const matchSet = new Set(matchedIds);
    d3.select(gRef.current)
      .selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>("g.name-tag")
      .classed("match", (d) => matchSet.has(d.data.id));
  }, [matchedIds]);

  function fit() {
    if (!gRef.current || !svgRef.current || !zoomRef.current) return;
    const bb = (gRef.current as SVGGraphicsElement).getBBox();
    const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
    const pad = 30;
    const scale = Math.min((w - pad * 2) / bb.width, (h - pad * 2) / bb.height, 1);
    const tx = w / 2 - scale * (bb.x + bb.width / 2);
    const ty = h / 2 - scale * (bb.y + bb.height / 2);
    d3.select(svgRef.current).transition().duration(500).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  }

  // When the search query is cleared (non-empty -> empty), restore the default
  // fit-to-screen view so the viewport isn't stranded on a now-irrelevant match.
  const wasSearchingRef = useRef(false);
  useEffect(() => {
    const hasQuery = q.trim().length > 0;
    if (wasSearchingRef.current && !hasQuery) fit();
    wasSearchingRef.current = hasQuery;
  }, [q]);

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
        <SearchField />
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
