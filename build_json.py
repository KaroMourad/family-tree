"""Generate family_tree.json from the xlsx — the single source of truth for all HTML builders."""
import sys, io, json
from pathlib import Path
import openpyxl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SRC = Path(r"c:/Users/user/family tree/family_tree.xlsx")
OUT = Path(r"c:/Users/user/family tree/family_tree.json")

wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
headers = [str(h) if h is not None else "" for h in rows[0]]
idx = {h: i for i, h in enumerate(headers)}

def g(row, key):
    i = idx.get(key)
    if i is None: return None
    v = row[i]
    if v is None: return None
    s = str(v).strip()
    return s if s else None

FIELDS = [
    ("id", "ID"),
    ("name", "Full name"),
    ("nickname", "Nickname"),
    ("surname_now", "Surname now"),
    ("surname_birth", "Surname at birth"),
    ("gender", "Gender"),
    ("deceased", "Deceased"),
    ("father_id", "Father ID"),
    ("father_name", "Father name"),
    ("mother_id", "Mother ID"),
    ("mother_name", "Mother name"),
    ("birth_year", "Birth year"),
    ("birth_month", "Birth month"),
    ("birth_day", "Birth day"),
    ("death_year", "Death year"),
    ("birth_place", "Birth place"),
    ("death_place", "Death place"),
    ("partner_id", "Partner ID"),
    ("partner_name", "Partner name"),
    ("profession", "Profession"),
    ("bio", "Bio notes"),
]

people = {}
for row in rows[1:]:
    pid = g(row, "ID")
    if not pid: continue
    rec = {out_key: g(row, src_key) for out_key, src_key in FIELDS}
    if not rec["name"]:
        rec["name"] = "?"
    rec["_kids"] = []
    people[pid] = rec

roots = []
for pid, p in people.items():
    fid = p["father_id"]
    if fid and fid in people:
        people[fid]["_kids"].append(pid)
    else:
        roots.append(pid)

def by_birth(pid):
    by = people[pid]["birth_year"]
    try: return (0, int(by))
    except (TypeError, ValueError): return (1, 0)

for p in people.values():
    p["_kids"].sort(key=by_birth)
roots.sort(key=by_birth)

def to_node(pid):
    p = people[pid]
    out = {k: p[k] for k, _ in FIELDS}
    out["children"] = [to_node(c) for c in p["_kids"]]
    return out

if len(roots) == 1:
    tree = to_node(roots[0])
else:
    tree = [to_node(r) for r in roots]

OUT.write_text(json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote: {OUT}")
print(f"People: {len(people)} | Roots: {len(roots)}")
