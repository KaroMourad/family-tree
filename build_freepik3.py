import sys, io, json, math
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SRC = Path(r"c:/Users/user/family tree/family_tree.json")
OUT = Path(r"c:/Users/user/family tree/family_freepik3.html")

root_data = json.loads(SRC.read_text(encoding="utf-8"))
data_json = json.dumps(root_data, ensure_ascii=False)

def count(n): return 1 + sum(count(c) for c in n.get("children", []))
print(f"People: {count(root_data)}")

html_doc = r"""<!doctype html>
<html lang="hy">
<head>
<meta charset="utf-8">
<title>Family Tree</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #303435;
    --ink: #F6F6F6;
    --olive: #C2CC3E;
    --teal-light: #75C6B8;
    --teal-dark: #6AA89C;
    --coral: #CC6658;
  }
  html, body { margin:0; padding:0; height:100%; overflow:hidden;
    font-family:"Oswald","Noto Sans Armenian","Sylfaen",system-ui,sans-serif;
    background:var(--bg); color:var(--ink);
  }
  header {
    position:fixed; top:0; left:0; right:0; z-index:10;
    background:rgba(48,52,53,0.92); border-bottom:1px solid #4a4e4f;
    padding:10px 18px; display:flex; gap:12px; align-items:center; flex-wrap:wrap;
    backdrop-filter:blur(6px);
  }
  header h1 { font-size:20px; margin:0; color:var(--olive); font-weight:600;
    letter-spacing:2px; text-transform:uppercase; }
  header input {
    padding:7px 12px; border:1px solid #4a4e4f; border-radius:4px; min-width:240px;
    background:rgba(255,255,255,0.06); color:var(--ink);
    font-family:inherit; font-size:14px; letter-spacing:1px;
  }
  header input::placeholder { color:#888; }
  header button {
    padding:7px 14px; border:1px solid #4a4e4f; border-radius:4px;
    background:rgba(255,255,255,0.05); color:var(--ink); cursor:pointer;
    font-family:inherit; letter-spacing:1px; text-transform:uppercase; font-size:12px;
  }
  header button:hover { background:rgba(194,204,62,0.18); border-color:var(--olive); }
  #status { font-size:12px; color:#888; letter-spacing:1px; }
  #wrap { position:absolute; inset:0; }
  svg { width:100%; height:100%; display:block; cursor:grab; }
  svg:active { cursor:grabbing; }

  .branch { fill:none; stroke:var(--ink); stroke-linecap:round; stroke-linejoin:round; }
  .leaf-deco { pointer-events:none; }
  .leaf-deco.olive  { fill: var(--olive); }
  .leaf-deco.teal   { fill: var(--teal-light); }
  .leaf-deco.coral  { fill: var(--coral); }

  .name-tag { cursor:pointer; }
  .name-tag rect.bg    { fill: var(--bg); stroke:none; }
  .name-tag .frame     { fill: var(--bg); stroke:var(--ink); stroke-width:1.1; }
  .name-tag text.name  {
    fill:var(--ink); font-family:"Oswald","Noto Sans Armenian",sans-serif;
    font-weight:600; text-anchor:middle; letter-spacing:0.8px;
    text-transform:uppercase; pointer-events:none;
  }
  .name-tag text.dates {
    fill:#9aa0a2; font-family:"Oswald",sans-serif; font-size:8px;
    text-anchor:middle; letter-spacing:1px; pointer-events:none;
  }
  .name-tag.female .frame { stroke:var(--coral); }
  .name-tag.female text.name  { fill:var(--coral); }
  .name-tag.male   .frame { stroke:var(--teal-light); }
  .name-tag.male   text.name  { fill:var(--teal-light); }
  .name-tag.unknown .frame { stroke:#aaa; }
  .name-tag.deceased .frame { stroke-dasharray:3 2; opacity:0.85; }
  .name-tag:hover .frame { stroke-width:2.2; }
  .name-tag.match .frame { stroke:var(--olive); stroke-width:2.5; }
  .name-tag.match text.name { fill:var(--olive); }

  .root-badge { fill:var(--bg); stroke:var(--olive); stroke-width:2.5; }
  .root-badge-inner { fill:none; stroke:var(--olive); stroke-width:1.2; opacity:0.6; }
  .root-label {
    fill:var(--olive); font-family:"Oswald",sans-serif;
    font-size:22px; font-weight:700; text-anchor:middle; letter-spacing:2.5px; text-transform:uppercase;
    pointer-events:none;
  }

  .banner-bg { fill:var(--olive); }
  .banner-text {
    fill:var(--bg); font-family:"Oswald",sans-serif;
    font-size:36px; font-weight:700; letter-spacing:6px; text-transform:uppercase; text-anchor:middle;
    pointer-events:none;
  }

  #detail {
    position:fixed; right:0; top:0; bottom:0; width:340px;
    background:#2a2d2e; border-left:1px solid #4a4e4f; color:var(--ink);
    padding:24px; overflow-y:auto;
    transform:translateX(100%); transition:transform .25s ease; z-index:20;
    box-shadow:-6px 0 24px rgba(0,0,0,0.4);
  }
  #detail.open { transform:translateX(0); }
  #detail h2 {
    margin:0 0 12px; color:var(--olive); font-family:"Oswald",sans-serif;
    font-size:24px; font-weight:600; letter-spacing:2px; text-transform:uppercase;
    border-bottom:1px solid #4a4e4f; padding-bottom:8px;
  }
  #detail .close {
    position:absolute; right:12px; top:10px; border:none; background:transparent;
    font-size:26px; color:#888; cursor:pointer;
  }
  #detail .close:hover { color:var(--olive); }
  #detail dt { font-size:10px; color:var(--teal-light); margin-top:12px; letter-spacing:2px; text-transform:uppercase; }
  #detail dd { margin:3px 0 0; font-size:14px; color:var(--ink); letter-spacing:0.3px; }
</style>
</head>
<body>
<header>
  <h1>◆ Family Tree</h1>
  <input id="search" type="search" placeholder="Search by name...">
  <button id="zoomFit">Fit</button>
  <button id="zoomIn">+</button>
  <button id="zoomOut">−</button>
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

const MAP = {};
(function w(n){ MAP[n.id]=n; (n.children||[]).forEach(w); })(RAW);
document.getElementById('status').textContent = Object.keys(MAP).length + ' MEMBERS';

const svg = d3.select('#svg');
const gRoot = svg.append('g');

function genderClass(g){
  if(!g) return 'unknown';
  const s=String(g).toLowerCase();
  if(s.startsWith('m')) return 'male';
  if(s.startsWith('f') || s.startsWith('w')) return 'female';
  return 'unknown';
}
function deceased(p){
  const d=p.deceased; if(!d) return false;
  const s=String(d).toLowerCase();
  return !(s==='no'||s==='0'||s==='false');
}

// === COMPACT TAG SIZING ===
const TAG_H = 22;
const FONT_SIZE = 11;
const CHAR_W = 7.0;        // tighter than before
const TAG_PAD_X = 10;
const TAG_GAP = 8;         // minimum horizontal gap between two adjacent tags
function tagWidth(name){
  return Math.max(48, Math.min(170, TAG_PAD_X*2 + name.length * CHAR_W));
}

// === Tight layout ===
const hier = d3.hierarchy(RAW);
const UNIT_X = 1;          // arbitrary unit; we'll resolve to pixels via separation
const GEN_H = 90;          // shorter vertical spacing too

const tree = d3.tree()
  .nodeSize([UNIT_X, GEN_H])
  .separation((a,b) => {
    // Required pixel gap between centers = (wA + wB)/2 + TAG_GAP
    const wa = tagWidth(a.data.name);
    const wb = tagWidth(b.data.name);
    const needed = (wa + wb)/2 + TAG_GAP;
    // Slightly more gap if different parents
    const extra = (a.parent === b.parent) ? 0 : 8;
    return needed + extra;
  });

tree(hier);

// Flip Y so trunk is at bottom
hier.each(d => { d.X = d.x; d.Y = -d.y; });

const all = hier.descendants();
const xs = all.map(d=>d.X), ys = all.map(d=>d.Y);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);

// === Tendrils (very subtle background) ===
const tendrils = gRoot.append('g').attr('opacity', 0.08);
const rndT = (function(){ let s=3; return ()=>{s=(s*9301+49297)%233280; return s/233280;}; })();
for (let i = 0; i < 8; i++) {
  const cx = minX + rndT()*(maxX-minX);
  const cy = minY + rndT()*(maxY-minY) - 50;
  const r = 25 + rndT()*55;
  let d = `M${cx},${cy}`;
  for (let a = 0; a < Math.PI*3; a += 0.25) {
    const rr = r * (1 - a/(Math.PI*3));
    d += ` L${cx + Math.cos(a)*rr},${cy + Math.sin(a)*rr}`;
  }
  tendrils.append('path').attr('d', d).attr('class','branch').attr('stroke-width', 0.9);
}

// === Branches: curved organic strokes parent -> child ===
const branchG = gRoot.append('g');
const rndB = (function(){ let s=42; return ()=>{s=(s*9301+49297)%233280; return s/233280;}; })();

function strokeFor(depth){ return Math.max(1.1, 8 - depth*1.25); }

function curvedPath(s, t, randSeed){
  const sx = s.X, sy = s.Y;
  const tx = t.X, ty = t.Y;
  const dx = tx - sx, dy = ty - sy;
  const len = Math.hypot(dx,dy) || 1;
  const nx = -dy/len, ny = dx/len;
  // Smaller bend so curves don't wander into tags
  const bend1 = (randSeed - 0.5) * 18 + (sx < tx ? -6 : 6);
  const bend2 = (randSeed - 0.5) * 12;
  const c1x = sx + dx*0.3 + nx*bend1;
  const c1y = sy + dy*0.3 + ny*bend1;
  const c2x = sx + dx*0.7 + nx*bend2;
  const c2y = sy + dy*0.7 + ny*bend2;
  return `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
}

const links = hier.links();
links.sort((a,b) => (a.source.depth || 0) - (b.source.depth || 0));
branchG.selectAll('path.branch')
  .data(links)
  .join('path')
  .attr('class','branch')
  .attr('d', d => curvedPath(d.source, d.target, rndB()))
  .attr('stroke-width', d => strokeFor(d.source.depth));

// === Small curl flourishes only at top 2 levels of forks ===
const flourishG = gRoot.append('g');
hier.each(d => {
  if (d.depth > 1 || !d.children || d.children.length < 2) return;
  for (let k = 0; k < 2; k++) {
    const dir = k===0 ? -1 : 1;
    const ang = -Math.PI/2 + dir*1.2;
    const r = 14 + rndB()*10;
    const tx = d.X + Math.cos(ang)*r;
    const ty = d.Y + Math.sin(ang)*r;
    const ccx = d.X + Math.cos(ang)*r*0.4 + dir*6;
    const ccy = d.Y + Math.sin(ang)*r*0.4;
    flourishG.append('path').attr('class','branch')
      .attr('d', `M${d.X},${d.Y} Q${ccx},${ccy} ${tx},${ty}`)
      .attr('stroke-width', 1);
  }
});

// === Decorative tiny leaves around the canopy edge only (not inside tag area) ===
const leafG = gRoot.append('g');
const COLORS = ['olive','teal','coral'];
const rndL = (function(){ let s=99; return ()=>{s=(s*9301+49297)%233280; return s/233280;}; })();

const terminals = hier.descendants().filter(d => !d.children || d.children.length === 0);
terminals.forEach(d => {
  const w = tagWidth(d.data.name);
  // Place leaves above each terminal tag, not on the sides where they could overlap neighbors
  for (let i = 0; i < 2 + Math.floor(rndL()*2); i++) {
    const x = d.X + (rndL()-0.5) * w * 0.5;
    const y = d.Y - TAG_H/2 - 8 - rndL()*22;
    leafG.append('ellipse')
      .attr('class', 'leaf-deco ' + COLORS[Math.floor(rndL()*COLORS.length)])
      .attr('rx', 4.5).attr('ry', 2)
      .attr('transform', `translate(${x},${y}) rotate(${rndL()*360}) scale(${0.7+rndL()*0.7})`);
  }
});

// Sprinkles above the canopy
for (let i = 0; i < 60; i++) {
  const x = minX + rndL()*(maxX-minX);
  const y = minY - 40 - rndL()*120;
  leafG.append('ellipse')
    .attr('class','leaf-deco ' + COLORS[Math.floor(rndL()*COLORS.length)])
    .attr('rx', 5).attr('ry', 2.2)
    .attr('transform', `translate(${x},${y}) rotate(${rndL()*360}) scale(${0.6+rndL()*0.7})`);
}

// === Name tags ===
const tagG = gRoot.append('g');
const tagNodes = hier.descendants().filter(d => d !== hier);

const tag = tagG.selectAll('g.name-tag')
  .data(tagNodes)
  .join('g')
  .attr('class', d => {
    const cls = ['name-tag', genderClass(d.data.gender)];
    if (deceased(d.data)) cls.push('deceased');
    return cls.join(' ');
  })
  .attr('data-id', d => d.data.id)
  .attr('transform', d => `translate(${d.X},${d.Y})`)
  .on('click', (e,d) => { showDetail(d.data.id); e.stopPropagation(); });

tag.each(function(d){
  const w = tagWidth(d.data.name);
  const sel = d3.select(this);
  sel.append('rect').attr('class','bg')
    .attr('x', -w/2).attr('y', -TAG_H/2).attr('width', w).attr('height', TAG_H);
  sel.append('rect').attr('class','frame')
    .attr('x', -w/2).attr('y', -TAG_H/2).attr('width', w).attr('height', TAG_H)
    .attr('rx', 2.5);
  sel.append('text').attr('class','name').attr('y', 4).attr('font-size', FONT_SIZE)
    .text(d.data.name);
  const b = d.data.birth_year || '', x = d.data.death_year || '';
  if (b || x) {
    sel.append('text').attr('class','dates').attr('y', TAG_H/2 + 9)
      .text(`${b}${(b||x)?' – ':''}${x}`);
  }
});

// === Root: patriarch badge ===
const rootG = gRoot.append('g').attr('transform', `translate(${hier.X},${hier.Y})`);
const rootName = hier.data.name;
const rootR = Math.max(40, tagWidth(rootName)/2 + 14);
rootG.append('circle').attr('class','root-badge').attr('r', rootR);
rootG.append('circle').attr('class','root-badge-inner').attr('r', rootR - 7);
rootG.append('text').attr('class','root-label').attr('y', 8).text(rootName);

// === Bottom banner ===
const banner = gRoot.append('g').attr('transform', `translate(0,${hier.Y + rootR + 50})`);
const bw = 320, bh = 50;
banner.append('polygon').attr('class','banner-bg')
  .attr('points', `${-bw/2},0 ${bw/2},5 ${bw/2-28},${bh/2} ${bw/2},${bh} ${-bw/2},${bh-5} ${-bw/2+28},${bh/2}`);
banner.append('text').attr('class','banner-text').attr('x',0).attr('y', bh*0.72).text('Family Tree');

// === Zoom ===
const zoom = d3.zoom().scaleExtent([0.05, 4]).on('zoom', e => gRoot.attr('transform', e.transform));
svg.call(zoom);

function fitView(){
  const bb = gRoot.node().getBBox();
  const w = svg.node().clientWidth, h = svg.node().clientHeight - 60;
  const pad = 30;
  const scale = Math.min((w-pad*2)/bb.width, (h-pad*2)/bb.height, 1);
  const tx = w/2 - scale*(bb.x + bb.width/2);
  const ty = (h/2 + 60) - scale*(bb.y + bb.height/2);
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx,ty).scale(scale));
}
fitView();
window.addEventListener('resize', fitView);

document.getElementById('zoomFit').onclick = fitView;
document.getElementById('zoomIn').onclick = ()=>svg.transition().call(zoom.scaleBy,1.3);
document.getElementById('zoomOut').onclick = ()=>svg.transition().call(zoom.scaleBy,1/1.3);

// Search
document.getElementById('search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  d3.selectAll('g.name-tag').classed('match', false);
  if (!q) return;
  let first = null;
  d3.selectAll('g.name-tag').each(function(d){
    const hay = (d.data.name + ' ' + d.data.id).toLowerCase();
    if (hay.includes(q)) {
      d3.select(this).classed('match', true);
      if (!first) first = {x:d.X, y:d.Y};
    }
  });
  if (first) {
    const w=svg.node().clientWidth, h=svg.node().clientHeight;
    const t=d3.zoomTransform(svg.node());
    const scale=Math.max(t.k, 1.2);
    svg.transition().duration(500).call(zoom.transform,
      d3.zoomIdentity.translate(w/2 - scale*first.x, h/2 - scale*first.y).scale(scale));
  }
});

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function row(k,v){ if(!v) return ''; return `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`; }
function showDetail(id){
  const p=MAP[id]; if(!p) return;
  document.getElementById('body').innerHTML =
    `<h2>${esc(p.name)}</h2><dl>` +
    row('ID',p.id) + row('Gender',p.gender) +
    row('Born',p.birth_year) + row('Died',p.death_year) +
    row('Profession',p.profession) + row('Notes',p.bio) +
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
