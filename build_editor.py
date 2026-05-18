"""Embed family_tree.json into family_editor.html so it loads on double-click."""
import sys, io, json, re
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).parent
JSON_PATH = ROOT / "family_tree.json"
HTML_PATH = ROOT / "family_editor.html"

data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
data_text = json.dumps(data, ensure_ascii=False)

html = HTML_PATH.read_text(encoding="utf-8")
pattern = r'(<script id="embedded-data" type="application/json">)(.*?)(</script>)'
if not re.search(pattern, html, flags=re.DOTALL):
    print("WARN: embedded-data tag not found in family_editor.html.")
    sys.exit(1)
new_html = re.sub(
    pattern,
    lambda m: m.group(1) + data_text + m.group(3),
    html,
    count=1,
    flags=re.DOTALL,
)
HTML_PATH.write_text(new_html, encoding="utf-8")
def count(n): return 1 + sum(count(c) for c in n.get("children", []))
n = count(data) if isinstance(data, dict) else sum(count(r) for r in data)
print(f"Embedded {n} people into {HTML_PATH.name}")
