"""Regenerate all visualization HTMLs from the current family_tree.json."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
SCRIPTS = [
    "build_tree.py",
    "build_chart.py",
    "build_freepik.py",
    "build_freepik3.py",
    "build_editor.py",
]

print(f"Rebuilding from {ROOT / 'family_tree.json'}\n")
failed = []
for s in SCRIPTS:
    print(f"--- {s} ---")
    r = subprocess.run([sys.executable, str(ROOT / s)])
    if r.returncode != 0:
        failed.append(s)
    print()

if failed:
    print(f"Failed: {failed}")
    sys.exit(1)
print("All HTMLs regenerated.")
