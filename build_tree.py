import sys, io, json
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SRC = Path(r"c:/Users/user/family tree/family_tree.json")
OUT = Path(r"c:/Users/user/family tree/family_tree.html")

# Load nested tree JSON and flatten into {people: {id->rec}, roots: [ids]}
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

roots = [r["id"] for r in roots_list]

print(f"Total people: {len(people)}")
print(f"Roots: {len(roots)}")

data_json = json.dumps({"people": people, "roots": roots}, ensure_ascii=False)

html_doc = """<!doctype html>
<html lang="hy">
<head>
<meta charset="utf-8">
<title>Family Tree</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #303435;
    --panel: #2a2d2e;
    --ink: #F6F6F6;
    --olive: #C2CC3E;
    --teal-light: #75C6B8;
    --teal-dark: #6AA89C;
    --coral: #CC6658;
    --border: #4a4e4f;
    --muted: #9aa0a2;
  }
  body {
    margin: 0;
    font-family: "Oswald", "Noto Sans Armenian", "Sylfaen", system-ui, sans-serif;
    background: var(--bg);
    color: var(--ink);
  }
  header {
    padding: 12px 22px;
    background: rgba(48,52,53,0.92);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 10;
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
    backdrop-filter: blur(6px);
  }
  header h1 {
    font-size: 18px; margin: 0; color: var(--olive);
    font-weight: 600; letter-spacing: 2px; text-transform: uppercase;
  }
  header input {
    padding: 7px 12px; border: 1px solid var(--border); border-radius: 4px;
    background: rgba(255,255,255,0.06); color: var(--ink);
    font-family: inherit; font-size: 14px; letter-spacing: 1px; min-width: 220px;
  }
  header input::placeholder { color: #888; }
  header button {
    padding: 7px 14px; border: 1px solid var(--border); border-radius: 4px;
    background: rgba(255,255,255,0.05); color: var(--ink); cursor: pointer;
    font-family: inherit; letter-spacing: 1px; text-transform: uppercase; font-size: 12px;
  }
  header button:hover { background: rgba(194,204,62,0.18); border-color: var(--olive); }
  #stats { font-size: 12px; color: var(--muted); letter-spacing: 1px; }

  .tree { padding: 24px; overflow: auto; }
  ul.tree-list { list-style: none; padding-left: 0; margin: 0; }
  ul.tree-list ul {
    list-style: none; padding-left: 28px; margin: 6px 0 6px 14px;
    border-left: 1px solid var(--border);
  }
  li.node { position: relative; margin: 6px 0; padding-left: 14px; }
  li.node::before {
    content: ""; position: absolute; left: -1px; top: 18px;
    width: 14px; height: 1px; background: var(--border);
  }
  .card {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 5px 12px; border-radius: 3px;
    background: var(--bg);
    border: 1px solid var(--ink);
    cursor: pointer;
    transition: transform .12s ease, box-shadow .12s ease;
  }
  .card:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.4); }
  .card.male   { border-color: var(--teal-light); }
  .card.male .name { color: var(--teal-light); }
  .card.female { border-color: var(--coral); }
  .card.female .name { color: var(--coral); }
  .card.deceased { border-style: dashed; opacity: 0.85; }
  .toggle {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--bg); border: 1px solid var(--border);
    font-size: 12px; font-weight: bold; color: var(--olive);
    margin-right: 2px; user-select: none;
  }
  .toggle.empty { visibility: hidden; }
  .name {
    font-weight: 600; color: var(--ink);
    letter-spacing: 1px; text-transform: uppercase; font-size: 13px;
  }
  .meta { font-size: 11px; color: var(--muted); letter-spacing: 1px; }
  .id-tag { font-size: 10px; color: #666; letter-spacing: 1px; }
  li.node.collapsed > ul { display: none; }
  li.node.match > .card {
    border-color: var(--olive); box-shadow: 0 0 0 2px rgba(194,204,62,0.25);
  }
  li.node.match > .card .name { color: var(--olive); }

  #detail {
    position: fixed; right: 0; top: 0; bottom: 0; width: 360px;
    background: var(--panel); border-left: 1px solid var(--border);
    padding: 24px; overflow-y: auto;
    transform: translateX(100%); transition: transform .25s ease;
    z-index: 20; box-shadow: -6px 0 24px rgba(0,0,0,0.4);
    color: var(--ink);
  }
  #detail.open { transform: translateX(0); }
  #detail h2 {
    margin: 0 0 12px; color: var(--olive); font-family: "Oswald", sans-serif;
    font-size: 24px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;
    border-bottom: 1px solid var(--border); padding-bottom: 8px;
  }
  #detail dl { margin: 0; }
  #detail dt {
    font-size: 10px; color: var(--teal-light); margin-top: 12px;
    letter-spacing: 2px; text-transform: uppercase;
  }
  #detail dd { margin: 3px 0 0; font-size: 14px; color: var(--ink); }
  #detail .close {
    position: absolute; right: 12px; top: 10px;
    border: none; background: transparent; font-size: 26px;
    cursor: pointer; color: #888;
  }
  #detail .close:hover { color: var(--olive); }
</style>
</head>
<body>
<header>
  <h1>◆ Family Tree</h1>
  <input id="search" type="search" placeholder="Search by name or ID...">
  <button id="expandAll">Expand all</button>
  <button id="collapseAll">Collapse all</button>
  <span id="stats"></span>
</header>
<div class="tree"><ul id="root" class="tree-list"></ul></div>

<aside id="detail">
  <button class="close" onclick="document.getElementById('detail').classList.remove('open')">&times;</button>
  <div id="detail-body"></div>
</aside>

<script id="data" type="application/json">__DATA__</script>
<script>
const DATA = JSON.parse(document.getElementById('data').textContent);
const P = DATA.people;
const ROOTS = DATA.roots;

function dates(p) {
  const b = p.birth_year || '';
  const d = p.death_year || (p.deceased ? '?' : '');
  if (!b && !d) return '';
  return `(${b}${(b || d) ? ' – ' : ''}${d})`;
}

function genderClass(g) {
  if (!g) return '';
  const s = g.toLowerCase();
  if (s.startsWith('m')) return 'male';
  if (s.startsWith('f') || s.startsWith('w')) return 'female';
  return '';
}

function renderNode(id) {
  const p = P[id];
  if (!p) return '';
  const kids = p.children || [];
  const cls = ['node'];
  if (kids.length) cls.push('has-children');
  const cardCls = ['card', genderClass(p.gender)];
  if (p.deceased && String(p.deceased).toLowerCase() !== 'no' && String(p.deceased) !== '0') {
    cardCls.push('deceased');
  }
  const tog = kids.length
    ? `<span class="toggle" data-toggle>−</span>`
    : `<span class="toggle empty">·</span>`;
  let html = `<li class="${cls.join(' ')}" data-id="${p.id}">`;
  html += `<span class="${cardCls.join(' ')}" data-card>`;
  html += tog;
  html += `<span class="name">${escape(p.name)}</span>`;
  const d = dates(p);
  if (d) html += ` <span class="meta">${escape(d)}</span>`;
  html += ` <span class="id-tag">#${escape(p.id)}</span>`;
  html += `</span>`;
  if (kids.length) {
    html += '<ul>';
    for (const k of kids) html += renderNode(k);
    html += '</ul>';
  }
  html += '</li>';
  return html;
}

function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

document.getElementById('root').innerHTML = ROOTS.map(renderNode).join('');
document.getElementById('stats').textContent =
  Object.keys(P).length + ' people · ' + ROOTS.length + ' root line(s)';

document.addEventListener('click', e => {
  const tog = e.target.closest('[data-toggle]');
  if (tog) {
    e.stopPropagation();
    const li = tog.closest('li.node');
    li.classList.toggle('collapsed');
    tog.textContent = li.classList.contains('collapsed') ? '+' : '−';
    return;
  }
  const card = e.target.closest('[data-card]');
  if (card) {
    const id = card.closest('li.node').dataset.id;
    showDetail(id);
  }
});

document.getElementById('expandAll').onclick = () => {
  document.querySelectorAll('li.node.collapsed').forEach(li => {
    li.classList.remove('collapsed');
    const t = li.querySelector(':scope > .card > [data-toggle]');
    if (t) t.textContent = '−';
  });
};
document.getElementById('collapseAll').onclick = () => {
  document.querySelectorAll('li.node.has-children').forEach(li => {
    li.classList.add('collapsed');
    const t = li.querySelector(':scope > .card > [data-toggle]');
    if (t) t.textContent = '+';
  });
};

document.getElementById('search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('li.node').forEach(li => li.classList.remove('match'));
  if (!q) return;
  for (const id in P) {
    const p = P[id];
    const hay = `${p.name} ${p.nickname||''} ${p.id} ${p.surname_now||''} ${p.surname_birth||''}`.toLowerCase();
    if (hay.includes(q)) {
      const li = document.querySelector(`li.node[data-id="${CSS.escape(id)}"]`);
      if (li) {
        li.classList.add('match');
        let cur = li.parentElement;
        while (cur && cur !== document.body) {
          if (cur.tagName === 'LI' && cur.classList.contains('collapsed')) {
            cur.classList.remove('collapsed');
            const t = cur.querySelector(':scope > .card > [data-toggle]');
            if (t) t.textContent = '−';
          }
          cur = cur.parentElement;
        }
      }
    }
  }
  const first = document.querySelector('li.node.match');
  if (first) first.scrollIntoView({behavior:'smooth', block:'center'});
});

function row(label, val) {
  if (!val) return '';
  return `<dt>${escape(label)}</dt><dd>${escape(val)}</dd>`;
}

function showDetail(id) {
  const p = P[id]; if (!p) return;
  const father = p.father_id && P[p.father_id] ? P[p.father_id].name : (p.father_name || '');
  const mother = p.mother_id && P[p.mother_id] ? P[p.mother_id].name : (p.mother_name || '');
  const partner = p.partner_id && P[p.partner_id] ? P[p.partner_id].name : (p.partner_name || '');
  const kids = (p.children||[]).map(k => P[k] ? P[k].name : k).join(', ');
  const body =
    `<h2>${escape(p.name)}</h2>` +
    `<dl>` +
    row('ID', p.id) +
    row('Nickname', p.nickname) +
    row('Gender', p.gender) +
    row('Surname (birth)', p.surname_birth) +
    row('Surname (now)', p.surname_now) +
    row('Born', [p.birth_day, p.birth_month, p.birth_year].filter(Boolean).join(' ')) +
    row('Birth place', p.birth_place) +
    row('Died', p.death_year) +
    row('Death place', p.death_place) +
    row('Father', father) +
    row('Mother', mother) +
    row('Partner', partner) +
    row('Children', kids) +
    row('Profession', p.profession) +
    row('Notes', p.bio) +
    `</dl>`;
  document.getElementById('detail-body').innerHTML = body;
  document.getElementById('detail').classList.add('open');
}
</script>
</body>
</html>
"""

html_doc = html_doc.replace("__DATA__", data_json)
OUT.write_text(html_doc, encoding="utf-8")
print(f"Wrote: {OUT}")
