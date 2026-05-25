import sys, io, json
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SRC = Path(r"c:/Users/user/family tree/family_tree.json")
OUT = Path(r"c:/Users/user/family tree/family_chart.html")

# JSON is already a nested d3.hierarchy-compatible tree
root_data = json.loads(SRC.read_text(encoding="utf-8"))

def count(node):
    return 1 + sum(count(c) for c in node.get("children", []))

print(f"Total: {count(root_data)}, root: {root_data['name']}")

data_json = json.dumps(root_data, ensure_ascii=False)

html_doc = r"""<!doctype html>
<html lang="hy">
<head>
<meta charset="utf-8">
<title>Family Tree — Chart</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#303435; --panel:#2a2d2e; --ink:#F6F6F6;
    --olive:#C2CC3E; --teal:#75C6B8; --coral:#CC6658;
    --border:#4a4e4f; --muted:#9aa0a2;
  }
  html, body { margin:0; padding:0; height:100%; background:var(--bg); color:var(--ink);
    font-family:"Oswald","Noto Sans Armenian","Sylfaen",system-ui,sans-serif; }
  header {
    position:fixed; top:0; left:0; right:0; z-index:10;
    background:rgba(48,52,53,0.92); border-bottom:1px solid var(--border);
    padding:10px 18px; display:flex; gap:12px; align-items:center; flex-wrap:wrap;
    backdrop-filter:blur(6px);
  }
  header h1 { font-size:18px; margin:0; color:var(--olive); font-weight:600;
    letter-spacing:2px; text-transform:uppercase; }
  header input {
    padding:7px 12px; border:1px solid var(--border); border-radius:4px; min-width:220px;
    background:rgba(255,255,255,0.06); color:var(--ink);
    font-family:inherit; font-size:14px; letter-spacing:1px;
  }
  header input::placeholder { color:#888; }
  header button {
    padding:7px 14px; border:1px solid var(--border); border-radius:4px;
    background:rgba(255,255,255,0.05); color:var(--ink); cursor:pointer;
    font-family:inherit; letter-spacing:1px; text-transform:uppercase; font-size:12px;
  }
  header button:hover { background:rgba(194,204,62,0.18); border-color:var(--olive); }
  #status { font-size:12px; color:var(--muted); letter-spacing:1px; }
  #wrap { position:absolute; top:54px; left:0; right:0; bottom:0; overflow:hidden; }
  svg { display:block; width:100%; height:100%; cursor:grab; }
  svg:active { cursor:grabbing; }
  .link { fill:none; stroke:var(--ink); stroke-width:1.4px; opacity:0.7; }
  .node rect {
    stroke:var(--ink); stroke-width:1.2px; rx:3; ry:3;
    fill: var(--bg);
  }
  .node.male rect   { stroke:var(--teal); }
  .node.female rect { stroke:var(--coral); }
  .node.unknown rect{ stroke:var(--ink); }
  .node text {
    font-family:"Oswald","Noto Sans Armenian",sans-serif;
    font-size:11px; fill:var(--ink); pointer-events:none;
    font-weight:600; letter-spacing:1px; text-transform:uppercase;
  }
  .node.male   text { fill:var(--teal); }
  .node.female text { fill:var(--coral); }
  .node text.dates { font-size:9px; fill:var(--muted); letter-spacing:1px; text-transform:none; font-weight:400; }
  .node.deceased rect { stroke-dasharray: 3 2; opacity:0.85; }
  .node.match rect { stroke:var(--olive); stroke-width:2.5px; }
  .node.match text { fill:var(--olive); }
  .node { cursor:pointer; }

  #detail {
    position:fixed; right:0; top:54px; bottom:0; width:340px;
    background:var(--panel); border-left:1px solid var(--border);
    padding:24px; overflow-y:auto; color:var(--ink);
    transform:translateX(100%); transition:transform .25s ease; z-index:20;
    box-shadow:-6px 0 24px rgba(0,0,0,0.4);
  }
  #detail.open { transform:translateX(0); }
  #detail h2 { margin:0 0 12px; color:var(--olive); font-family:"Oswald",sans-serif;
    font-size:24px; font-weight:600; letter-spacing:2px; text-transform:uppercase;
    border-bottom:1px solid var(--border); padding-bottom:8px; }
  #detail .close { position:absolute; right:12px; top:10px; border:none; background:transparent; font-size:26px; color:#888; cursor:pointer; }
  #detail .close:hover { color:var(--olive); }
  #detail dt { font-size:10px; color:var(--teal); margin-top:12px; letter-spacing:2px; text-transform:uppercase; }
  #detail dd { margin:3px 0 0; font-size:14px; color:var(--ink); }
</style>
</head>
<body>
<header>
  <h1>◆ Family Tree</h1>
  <input id="search" type="search" placeholder="Search name or ID...">
  <button id="zoomFit">Fit</button>
  <button id="zoomIn">+</button>
  <button id="zoomOut">−</button>
  <button id="orientation">Rotate</button>
  <span id="status"></span>
</header>
<div id="wrap"><svg id="svg"></svg></div>
<aside id="detail">
  <button class="close" onclick="document.getElementById('detail').classList.remove('open')">×</button>
  <div id="body"></div>
</aside>

<script src="https://d3js.org/d3.v7.min.js"></script>
<script id="data" type="application/json">__DATA__</script>
<script>
const RAW = JSON.parse(document.getElementById('data').textContent);

// Flatten map for search
const MAP = {};
(function walk(n){ MAP[n.id]=n; (n.children||[]).forEach(walk); })(RAW);
document.getElementById('status').textContent = Object.keys(MAP).length + ' people';

const svg = d3.select('#svg');
const gRoot = svg.append('g');
let orientation = 'vertical'; // 'vertical' = top-down (parents top, children below); 'horizontal' = left-right

const NODE_W = 110;
const NODE_H = 38;

function genderClass(g) {
  if (!g) return 'unknown';
  const s = String(g).toLowerCase();
  if (s.startsWith('m')) return 'male';
  if (s.startsWith('f') || s.startsWith('w')) return 'female';
  return 'unknown';
}

function deceasedFlag(p) {
  const d = p.deceased;
  if (!d) return false;
  const s = String(d).toLowerCase();
  return !(s === 'no' || s === '0' || s === 'false');
}

let zoom;

function render() {
  gRoot.selectAll('*').remove();
  const root = d3.hierarchy(RAW);

  const isVert = orientation === 'vertical';
  // nodeSize: [a, b] -> a is sibling spacing, b is generation spacing
  const layout = d3.tree().nodeSize(isVert ? [NODE_W + 18, NODE_H + 60] : [NODE_H + 18, NODE_W + 80]);
  layout(root);

  // Coordinate mapping
  root.each(d => {
    if (isVert) { d.X = d.x; d.Y = d.y; }
    else        { d.X = d.y; d.Y = d.x; }
  });

  // Links
  gRoot.append('g').selectAll('path')
    .data(root.links())
    .join('path')
    .attr('class', 'link')
    .attr('d', d => {
      const sx = d.source.X, sy = d.source.Y;
      const tx = d.target.X, ty = d.target.Y;
      if (isVert) {
        const my = (sy + ty) / 2;
        return `M${sx},${sy + NODE_H/2} V${my} H${tx} V${ty - NODE_H/2}`;
      } else {
        const mx = (sx + tx) / 2;
        return `M${sx + NODE_W/2},${sy} H${mx} V${ty} H${tx - NODE_W/2}`;
      }
    });

  // Nodes
  const nodes = gRoot.append('g').selectAll('g.node')
    .data(root.descendants())
    .join('g')
    .attr('class', d => {
      const cls = ['node', genderClass(d.data.gender)];
      if (deceasedFlag(d.data)) cls.push('deceased');
      return cls.join(' ');
    })
    .attr('data-id', d => d.data.id)
    .attr('transform', d => `translate(${d.X},${d.Y})`)
    .on('click', (event, d) => { showDetail(d.data.id); event.stopPropagation(); });

  nodes.append('rect')
    .attr('x', -NODE_W/2).attr('y', -NODE_H/2)
    .attr('width', NODE_W).attr('height', NODE_H);

  nodes.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', d => d.data.birth_year || d.data.death_year ? -3 : 5)
    .text(d => {
      const n = d.data.name + (deceasedFlag(d.data) ? ' ✝' : '');
      return n.length > 16 ? n.slice(0,15)+'…' : n;
    });

  nodes.append('text')
    .attr('class', 'dates')
    .attr('text-anchor', 'middle')
    .attr('y', 12)
    .text(d => {
      const b = d.data.birth_year || '';
      const x = d.data.death_year || '';
      if (!b && !x) return '';
      return `${b}${(b||x)?' – ':''}${x}`;
    });

  // Fit on first render
  fitView();
}

function fitView() {
  const bbox = gRoot.node().getBBox();
  const svgEl = svg.node();
  const w = svgEl.clientWidth, h = svgEl.clientHeight;
  const pad = 40;
  const scale = Math.min((w - pad*2) / bbox.width, (h - pad*2) / bbox.height, 1.2);
  const tx = w/2 - scale * (bbox.x + bbox.width/2);
  const ty = h/2 - scale * (bbox.y + bbox.height/2);
  svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

zoom = d3.zoom()
  .scaleExtent([0.1, 4])
  .on('zoom', e => gRoot.attr('transform', e.transform));
svg.call(zoom);

render();

document.getElementById('zoomFit').onclick = fitView;
document.getElementById('zoomIn').onclick = () => svg.transition().call(zoom.scaleBy, 1.3);
document.getElementById('zoomOut').onclick = () => svg.transition().call(zoom.scaleBy, 1/1.3);
document.getElementById('orientation').onclick = () => {
  orientation = orientation === 'vertical' ? 'horizontal' : 'vertical';
  render();
};
window.addEventListener('resize', fitView);

// Search
document.getElementById('search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  d3.selectAll('g.node').classed('match', false);
  if (!q) return;
  let firstMatch = null;
  d3.selectAll('g.node').each(function(d){
    const hay = (d.data.name + ' ' + d.data.id).toLowerCase();
    if (hay.includes(q)) {
      d3.select(this).classed('match', true);
      if (!firstMatch) firstMatch = {x:d.X, y:d.Y};
    }
  });
  if (firstMatch) {
    const svgEl = svg.node();
    const w = svgEl.clientWidth, h = svgEl.clientHeight;
    const t = d3.zoomTransform(svgEl);
    const scale = Math.max(t.k, 0.8);
    svg.transition().duration(400).call(zoom.transform,
      d3.zoomIdentity.translate(w/2 - scale*firstMatch.x, h/2 - scale*firstMatch.y).scale(scale));
  }
});

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function row(k,v){ if(!v) return ''; return `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`; }
function showDetail(id){
  const p = MAP[id]; if(!p) return;
  document.getElementById('body').innerHTML =
    `<h2>${esc(p.name)}</h2><dl>` +
    row('ID', p.id) +
    row('Gender', p.gender) +
    row('Born', p.birth_year) +
    row('Died', p.death_year) +
    row('Profession', p.profession) +
    row('Notes', p.bio) +
    row('Children', (p.children||[]).map(c=>c.name).join(', ')) +
    `</dl>`;
  document.getElementById('detail').classList.add('open');
}
</script>
</body>
</html>
"""

html_doc = html_doc.replace("__DATA__", data_json)
OUT.write_text(html_doc, encoding="utf-8")
print(f"Wrote: {OUT}")
