import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as d3 from "d3";
import { firstRoot, flattenTree, useTree } from "../hooks/useTree";
import { DetailPanel } from "../components/DetailPanel";
import type { TreeNode } from "../types";
import "../styles/views.css";

const NODE_W = 110;
const NODE_H = 38;

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

export function ChartView() {
  const { treeId } = useParams();
  const { tree, loading, error } = useTree(treeId);
  const root = firstRoot(tree);
  const byId = useMemo(() => flattenTree(tree), [tree]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!root || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("g.root").remove();
    const gRoot = svg.append("g").attr("class", "root");
    gRef.current = gRoot.node();

    const hier = d3.hierarchy<TreeNode>(root);
    const isVert = orientation === "vertical";
    const layout = d3.tree<TreeNode>().nodeSize(isVert ? [NODE_W + 18, NODE_H + 60] : [NODE_H + 18, NODE_W + 80]);
    layout(hier);

    hier.each((d: any) => {
      if (isVert) { d.X = d.x; d.Y = d.y; }
      else { d.X = d.y; d.Y = d.x; }
    });

    gRoot
      .append("g")
      .selectAll("path")
      .data(hier.links())
      .join("path")
      .attr("class", "link")
      .attr("d", (d: any) => {
        const sx = d.source.X, sy = d.source.Y, tx = d.target.X, ty = d.target.Y;
        if (isVert) {
          const my = (sy + ty) / 2;
          return `M${sx},${sy + NODE_H / 2} V${my} H${tx} V${ty - NODE_H / 2}`;
        }
        const mx = (sx + tx) / 2;
        return `M${sx + NODE_W / 2},${sy} H${mx} V${ty} H${tx - NODE_W / 2}`;
      });

    const nodes = gRoot
      .append("g")
      .selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>("g.node")
      .data(hier.descendants())
      .join("g")
      .attr("class", (d) => {
        const cls = ["node", genderClass(d.data.gender)];
        if (deceased(d.data)) cls.push("deceased");
        return cls.join(" ");
      })
      .attr("data-id", (d) => d.data.id)
      .attr("transform", (d: any) => `translate(${d.X},${d.Y})`)
      .on("click", (event, d) => {
        setSelectedId(d.data.id);
        event.stopPropagation();
      });

    nodes.append("rect")
      .attr("x", -NODE_W / 2)
      .attr("y", -NODE_H / 2)
      .attr("width", NODE_W)
      .attr("height", NODE_H);

    nodes.append("text")
      .attr("text-anchor", "middle")
      .attr("y", (d) => (d.data.birthYear || d.data.deathYear ? -3 : 5))
      .text((d) => {
        const n = d.data.name + (deceased(d.data) ? " ✝" : "");
        return n.length > 16 ? n.slice(0, 15) + "…" : n;
      });

    nodes.append("text")
      .attr("class", "dates")
      .attr("text-anchor", "middle")
      .attr("y", 12)
      .text((d) => {
        const b = d.data.birthYear || "";
        const x = d.data.deathYear || "";
        if (!b && !x) return "";
        return `${b}${b || x ? " – " : ""}${x}`;
      });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (e) => gRoot.attr("transform", e.transform.toString()));
    svg.call(zoom);
    zoomRef.current = zoom;

    // fit
    const bbox = (gRoot.node() as SVGGraphicsElement).getBBox();
    const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
    const pad = 40;
    const scale = Math.min((w - pad * 2) / bbox.width, (h - pad * 2) / bbox.height, 1.2);
    const tx = w / 2 - scale * (bbox.x + bbox.width / 2);
    const ty = h / 2 - scale * (bbox.y + bbox.height / 2);
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, [root, orientation]);

  // Search highlight
  useEffect(() => {
    if (!gRef.current) return;
    const term = q.trim().toLowerCase();
    d3.select(gRef.current).selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>("g.node").classed("match", false);
    if (!term) return;
    let first: { x: number; y: number } | null = null;
    d3.select(gRef.current)
      .selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>("g.node")
      .each(function (d: any) {
        const hay = (d.data.name + " " + d.data.id).toLowerCase();
        if (hay.includes(term)) {
          d3.select(this).classed("match", true);
          if (!first) first = { x: d.X, y: d.Y };
        }
      });
    if (first && svgRef.current && zoomRef.current) {
      const f = first as { x: number; y: number };
      const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
      const cur = d3.zoomTransform(svgRef.current);
      const scale = Math.max(cur.k, 0.8);
      d3.select(svgRef.current).transition().duration(400).call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(w / 2 - scale * f.x, h / 2 - scale * f.y).scale(scale),
      );
    }
  }, [q]);

  function fit() {
    if (!gRef.current || !svgRef.current || !zoomRef.current) return;
    const bbox = (gRef.current as SVGGraphicsElement).getBBox();
    const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
    const pad = 40;
    const scale = Math.min((w - pad * 2) / bbox.width, (h - pad * 2) / bbox.height, 1.2);
    const tx = w / 2 - scale * (bbox.x + bbox.width / 2);
    const ty = h / 2 - scale * (bbox.y + bbox.height / 2);
    d3.select(svgRef.current).transition().duration(300).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  }

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
  if (!root) return <div style={{ padding: 40 }}>No data.</div>;

  const selected = selectedId ? byId[selectedId] ?? null : null;

  return (
    <div className="view-shell chart" style={{ height: "100vh", overflow: "hidden" }}>
      <header className="view-header">
        <h1>◆ Family Tree</h1>
        <Link className="btn" to={`/tree/${treeId}`}>← Views</Link>
        <input type="search" placeholder="Search name or ID..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={fit}>Fit</button>
        <button onClick={() => zoomRef.current && d3.select(svgRef.current!).transition().call(zoomRef.current.scaleBy as any, 1.3)}>+</button>
        <button onClick={() => zoomRef.current && d3.select(svgRef.current!).transition().call(zoomRef.current.scaleBy as any, 1 / 1.3)}>−</button>
        <button onClick={() => setOrientation((o) => (o === "vertical" ? "horizontal" : "vertical"))}>Rotate</button>
        <span className="stats">{Object.keys(byId).length} people</span>
      </header>
      <div className="svg-wrap">
        <svg ref={svgRef} />
      </div>
      <DetailPanel person={selected as TreeNode | null} byId={byId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
