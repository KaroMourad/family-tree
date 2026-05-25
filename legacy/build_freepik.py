import sys, io, json, math, random
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SRC = Path(r"c:/Users/user/family tree/family_tree.json")
OUT = Path(r"c:/Users/user/family tree/family_freepik.html")

# Load nested JSON and flatten to {id: {..., children: [child_ids]}}
tree_root = json.loads(SRC.read_text(encoding="utf-8"))
roots_list = tree_root if isinstance(tree_root, list) else [tree_root]

people = {}
def flatten(node):
    rec = {k: v for k, v in node.items() if k != "children"}
    rec["children"] = [c["id"] for c in node.get("children", [])]
    people[rec["id"]] = rec
    for c in node.get("children", []):
        flatten(c)
for r in roots_list:
    flatten(r)

ROOT_ID = roots_list[0]["id"]

# Geometry: line-art recursive tree (single-stroke curving branches)
random.seed(11)
TRUNK_LENGTH = 240
LENGTH_DECAY = 0.74
MAX_SPREAD = math.radians(140)
MIN_SPREAD = math.radians(45)
SPREAD_DECAY = 0.83
WIGGLE_DEG = 8

# Track lines and label positions
segments = []   # {x0,y0,cx,cy,x1,y1,depth,id,parent_id}
nodes    = {}   # id -> {x,y,angle,depth}

def weight(pid, memo={}):
    if pid in memo: return memo[pid]
    w = 1
    for c in people[pid]["children"]:
        w += weight(c)
    memo[pid] = w
    return w

def grow(pid, x, y, angle, length, depth, parent_id=None):
    tip_x = x + math.sin(angle) * length
    tip_y = y - math.cos(angle) * length
    # Curve perpendicular for organic curl
    perp_x = math.cos(angle)
    perp_y = math.sin(angle)
    bend = (random.random() - 0.5) * length * 0.30 + (length * 0.08 * (1 if random.random()>0.5 else -1))
    cx = (x + tip_x)/2 + perp_x * bend
    cy = (y + tip_y)/2 + perp_y * bend
    segments.append({
        "id": pid, "parent_id": parent_id,
        "x0": x, "y0": y, "cx": cx, "cy": cy, "x1": tip_x, "y1": tip_y,
        "depth": depth, "length": length,
    })
    nodes[pid] = {"x": tip_x, "y": tip_y, "angle": angle, "depth": depth,
                  "terminal": len(people[pid]["children"]) == 0}
    kids = people[pid]["children"]
    if not kids:
        return
    spread = max(MIN_SPREAD, MAX_SPREAD * (SPREAD_DECAY ** depth))
    weights = [weight(c) for c in kids]
    total = sum(weights) or 1
    cursor = -spread/2
    new_length = length * LENGTH_DECAY
    for c, w in zip(kids, weights):
        share = (w/total) * spread
        rel = cursor + share/2
        cursor += share
        jitter = math.radians((random.random()-0.5)*WIGGLE_DEG*2)
        len_jit = 1.0 + (random.random()-0.5)*0.20
        grow(c, tip_x, tip_y, angle + rel + jitter, new_length * len_jit, depth+1, pid)

grow(ROOT_ID, 0, 0, 0, TRUNK_LENGTH, 0, None)

# Decorative scatter leaves around tips (not all tips — random ~half)
deco_leaves = []
random.seed(99)
for pid, n in nodes.items():
    if not n["terminal"]:
        continue
    for _ in range(random.randint(2, 5)):
        r = 20 + random.random()*45
        ang = random.random() * math.pi*2
        deco_leaves.append({
            "x": n["x"] + math.cos(ang)*r,
            "y": n["y"] + math.sin(ang)*r,
            "rot": random.random()*360,
            "scale": 0.6 + random.random()*0.9,
            "color": random.choice(["olive", "teal", "coral"]),
        })

# Also a few scattered leaves along upper canopy
ys = [n["y"] for n in nodes.values()]
top_y = min(ys) if ys else -800
for _ in range(120):
    deco_leaves.append({
        "x": (random.random()-0.5)*1400,
        "y": top_y - random.random()*120 + random.random()*40,
        "rot": random.random()*360,
        "scale": 0.5 + random.random()*1.0,
        "color": random.choice(["olive","olive","teal","coral"]),
    })

print(f"Segments: {len(segments)} | People: {len(people)} | Deco leaves: {len(deco_leaves)}")

payload = {
    "people": {pid: {
        "id": pid, "name": p["name"], "gender": p["gender"],
        "deceased": p["deceased"], "birth_year": p["birth_year"],
        "death_year": p["death_year"], "profession": p["profession"],
        "bio": p["bio"], "children": p["children"],
    } for pid, p in people.items()},
    "segments": segments,
    "nodes": nodes,
    "leaves": deco_leaves,
    "root": ROOT_ID,
}
data_json = json.dumps(payload, ensure_ascii=False)

html_doc = r"""<!doctype html>
<html lang="hy">
<head>
<meta charset="utf-8">
<title>Family Tree</title>
<style>
  :root {
    --bg: #303435;
    --ink: #F6F6F6;
    --olive: #C2CC3E;
    --teal-light: #75C6B8;
    --teal-dark: #6AA89C;
    --coral: #CC6658;
    --shadow: #2F2F2E;
  }
  html, body { margin:0; padding:0; height:100%; overflow:hidden;
    font-family: "Oswald","Bebas Neue","Impact","Noto Sans Armenian","Sylfaen",system-ui,sans-serif;
    background: var(--bg); color: var(--ink);
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
  .name-tag rect.bg { fill: var(--bg); stroke:none; }
  .name-tag .frame { fill:none; stroke:var(--ink); stroke-width:1.2; }
  .name-tag text {
    fill:var(--ink); font-family:"Oswald","Bebas Neue","Impact","Noto Sans Armenian",sans-serif;
    font-size:14px; font-weight:600; text-anchor:middle; letter-spacing:1.5px;
    text-transform:uppercase; pointer-events:none;
  }
  .name-tag.female .frame { stroke:var(--coral); }
  .name-tag.female text   { fill:var(--coral); }
  .name-tag.male   .frame { stroke:var(--teal-light); }
  .name-tag.male   text   { fill:var(--teal-light); }
  .name-tag.deceased .frame { stroke-dasharray:3 2; opacity:0.75; }
  .name-tag:hover .frame { stroke-width:2; }
  .name-tag.match .frame { stroke:var(--olive); stroke-width:2.5; }
  .name-tag.match text   { fill:var(--olive); }

  .root-badge {
    fill:none; stroke:var(--olive); stroke-width:2;
  }
  .root-label {
    fill:var(--olive); font-family:"Oswald","Bebas Neue","Impact",sans-serif;
    font-size:22px; font-weight:700; text-anchor:middle; letter-spacing:3px; text-transform:uppercase;
  }

  .banner-bg { fill:var(--olive); }
  .banner-text {
    fill:var(--bg); font-family:"Oswald","Bebas Neue","Impact",sans-serif;
    font-size:42px; font-weight:700; letter-spacing:6px; text-transform:uppercase; text-anchor:middle;
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
    margin:0 0 12px; color:var(--olive); font-family:"Oswald","Bebas Neue","Impact",sans-serif;
    font-size:24px; font-weight:600; letter-spacing:2px; text-transform:uppercase;
    border-bottom:1px solid #4a4e4f; padding-bottom:8px;
  }
  #detail .close {
    position:absolute; right:12px; top:10px; border:none; background:transparent;
    font-size:26px; color:#888; cursor:pointer;
  }
  #detail .close:hover { color:var(--olive); }
  #detail dt { font-size:10px; color:var(--teal-light); margin-top:12px; letter-spacing:2px; text-transform:uppercase; }
  #detail dd { margin:3px 0 0; font-size:14px; color:var(--ink); letter-spacing:0.5px; }
</style>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
<header>
  <h1>◆ Family Tree</h1>
  <input id="search" type="search" placeholder="Search...">
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
const DATA = JSON.parse(document.getElementById('data').textContent);
const PEOPLE = DATA.people;
const SEGS = DATA.segments;
const NODES = DATA.nodes;
const LEAVES = DATA.leaves;
document.getElementById('status').textContent = Object.keys(PEOPLE).length + ' MEMBERS';

const svg = d3.select('#svg');
const gRoot = svg.append('g');

function genderClass(g){
  if(!g) return 'unknown';
  const s = String(g).toLowerCase();
  if(s.startsWith('m')) return 'male';
  if(s.startsWith('f') || s.startsWith('w')) return 'female';
  return 'unknown';
}
function deceased(p){
  const d=p.deceased; if(!d) return false;
  const s=String(d).toLowerCase();
  return !(s==='no'||s==='0'||s==='false');
}

// Stroke width by depth (trunk thick, twigs thin)
function strokeFor(depth){
  return Math.max(1.2, 9 - depth*1.3);
}

// === Background curls (decorative tendrils behind tree) ===
const tendrils = gRoot.append('g').attr('opacity', 0.18);
const rndT = (function(){ let s=3; return ()=>{s=(s*9301+49297)%233280; return s/233280;}; })();
for (let i = 0; i < 8; i++) {
  const cx = (rndT()-0.5)*1600;
  const cy = -200 - rndT()*600;
  const r = 30 + rndT()*60;
  let d = `M${cx},${cy}`;
  for (let a = 0; a < Math.PI*3; a += 0.3) {
    const rr = r * (1 - a/(Math.PI*3));
    d += ` L${cx + Math.cos(a)*rr},${cy + Math.sin(a)*rr}`;
  }
  tendrils.append('path').attr('d', d).attr('class','branch').attr('stroke-width', 1.2);
}

// === Branches (single curved stroke each) ===
const branchG = gRoot.append('g');

// Draw thicker (trunk) first so they appear behind thinner branches
const sorted = SEGS.slice().sort((a,b)=>b.length - a.length);
branchG.selectAll('path.branch')
  .data(sorted)
  .join('path')
  .attr('class','branch')
  .attr('d', d => `M${d.x0},${d.y0} Q${d.cx},${d.cy} ${d.x1},${d.y1}`)
  .attr('stroke-width', d => strokeFor(d.depth));

// === Little curls/tendrils at major forks (organic flourishes) ===
const flourishG = gRoot.append('g');
SEGS.forEach(s => {
  if (s.depth > 2) return;
  const nKids = (PEOPLE[s.id]?.children||[]).length;
  if (nKids < 2) return;
  const ax = s.x1, ay = s.y1;
  const baseAngle = Math.atan2(s.y1 - s.cy, s.x1 - s.cx);
  for (let k = 0; k < 2; k++) {
    const dir = k===0 ? -1 : 1;
    const ang = baseAngle + dir*1.2;
    const len = 22 + Math.random()*20;
    const tx = ax + Math.cos(ang)*len;
    const ty = ay + Math.sin(ang)*len;
    const ccx = ax + Math.cos(baseAngle + dir*0.5)*len*0.5;
    const ccy = ay + Math.sin(baseAngle + dir*0.5)*len*0.5;
    flourishG.append('path').attr('class','branch')
      .attr('d', `M${ax},${ay} Q${ccx},${ccy} ${tx},${ty}`)
      .attr('stroke-width', 1.3);
  }
});

// === Decorative leaves: small ellipses in olive/teal/coral ===
const leafG = gRoot.append('g');
leafG.selectAll('ellipse.leaf-deco')
  .data(LEAVES)
  .join('ellipse')
  .attr('class', d => `leaf-deco ${d.color}`)
  .attr('cx', 0).attr('cy', 0).attr('rx', 7).attr('ry', 3)
  .attr('transform', d => `translate(${d.x},${d.y}) rotate(${d.rot}) scale(${d.scale})`);

// === Root: special badge for the patriarch at the base of the trunk ===
const rootSeg = SEGS.find(s => s.id === DATA.root);
if (rootSeg) {
  const rg = gRoot.append('g').attr('transform', `translate(${rootSeg.x0},${rootSeg.y0 + 30})`);
  rg.append('circle').attr('class','root-badge').attr('r', 32);
  rg.append('circle').attr('class','root-badge').attr('r', 26).attr('opacity',0.6);
  rg.append('text').attr('class','root-label').attr('y', 7).text(PEOPLE[DATA.root].name);
}

// === Name tags at each person's node ===
const tagG = gRoot.append('g');
const tagW = 110, tagH = 26;

const tagData = Object.keys(PEOPLE).filter(id => id !== DATA.root).map(id => ({
  id, p: PEOPLE[id], pos: NODES[id]
}));

const tag = tagG.selectAll('g.name-tag')
  .data(tagData)
  .join('g')
  .attr('class', d => {
    const cls = ['name-tag', genderClass(d.p.gender)];
    if (deceased(d.p)) cls.push('deceased');
    return cls.join(' ');
  })
  .attr('data-id', d => d.id)
  .attr('transform', d => `translate(${d.pos.x},${d.pos.y})`)
  .on('click', (e,d) => { showDetail(d.id); e.stopPropagation(); });

// Width per tag scales with name length
function tagWidth(name){
  return Math.max(70, Math.min(190, 12 + name.length * 9));
}

tag.append('rect').attr('class','bg')
  .attr('x', d => -tagWidth(d.p.name)/2).attr('y', -tagH/2)
  .attr('width', d => tagWidth(d.p.name)).attr('height', tagH);

tag.append('rect').attr('class','frame')
  .attr('x', d => -tagWidth(d.p.name)/2).attr('y', -tagH/2)
  .attr('width', d => tagWidth(d.p.name)).attr('height', tagH)
  .attr('rx', 3);

tag.append('text').attr('y', 5).text(d => d.p.name);

// Small dates line below
tag.append('text').attr('y', tagH/2 + 12)
  .attr('font-size', 9).attr('letter-spacing', 1.5)
  .attr('fill', '#aaa')
  .text(d => {
    const b = d.p.birth_year || '', x = d.p.death_year || '';
    if (!b && !x) return '';
    return `${b}${(b||x)?' – ':''}${x}`;
  });

// === Bottom banner (like the example's "Family Tree" sash) ===
const ys = Object.values(NODES).map(n=>n.y);
const bottomY = 60;
const bannerW = 340, bannerH = 56;
const banner = gRoot.append('g').attr('transform', `translate(0,${bottomY})`);
banner.append('polygon')
  .attr('class','banner-bg')
  .attr('points', `${-bannerW/2},0 ${bannerW/2},5 ${bannerW/2-30},${bannerH/2} ${bannerW/2},${bannerH} ${-bannerW/2},${bannerH-5} ${-bannerW/2+30},${bannerH/2}`);
banner.append('text').attr('class','banner-text').attr('x',0).attr('y', bannerH*0.7).text('Family Tree');

// === Zoom ===
const zoom = d3.zoom().scaleExtent([0.05,4]).on('zoom', e => gRoot.attr('transform', e.transform));
svg.call(zoom);

function fitView(){
  const bb = gRoot.node().getBBox();
  const w = svg.node().clientWidth, h = svg.node().clientHeight;
  const pad = 60;
  const scale = Math.min((w-pad*2)/bb.width, (h-pad*2)/bb.height, 1);
  const tx = w/2 - scale*(bb.x + bb.width/2);
  const ty = h/2 - scale*(bb.y + bb.height/2);
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
  let first=null;
  d3.selectAll('g.name-tag').each(function(d){
    const hay = (d.p.name + ' ' + d.id).toLowerCase();
    if (hay.includes(q)) {
      d3.select(this).classed('match', true);
      if (!first) first = d.pos;
    }
  });
  if (first) {
    const w=svg.node().clientWidth, h=svg.node().clientHeight;
    const t=d3.zoomTransform(svg.node());
    const scale=Math.max(t.k,1.2);
    svg.transition().duration(500).call(zoom.transform,
      d3.zoomIdentity.translate(w/2-scale*first.x,h/2-scale*first.y).scale(scale));
  }
});

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function row(k,v){ if(!v) return ''; return `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`; }
function showDetail(id){
  const p=PEOPLE[id]; if(!p) return;
  document.getElementById('body').innerHTML =
    `<h2>${esc(p.name)}</h2><dl>` +
    row('ID',p.id) + row('Gender',p.gender) +
    row('Born',p.birth_year) + row('Died',p.death_year) +
    row('Profession',p.profession) + row('Notes',p.bio) +
    row('Children', (p.children||[]).map(c=>PEOPLE[c]?PEOPLE[c].name:c).join(', ')) +
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
