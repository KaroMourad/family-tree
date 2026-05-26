import type { Person, TreeNode } from "../types";

export function nestPeople(people: Person[]): TreeNode | TreeNode[] {
  if (people.length === 0) return [];

  const byId = new Map<string, TreeNode>();
  for (const p of people) {
    byId.set(p.id, { ...p, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const p of people) {
    const node = byId.get(p.id)!;
    if (p.parentId && byId.has(p.parentId)) {
      byId.get(p.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by sortOrder (asc) then name, matching server behaviour.
  const sortRecursive = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const ao = a.sortOrder ?? 0;
      const bo = b.sortOrder ?? 0;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) sortRecursive(n.children);
  };
  sortRecursive(roots);

  return roots.length === 1 ? roots[0] : roots;
}

export function flattenTree(
  root: TreeNode | TreeNode[] | null,
): Record<string, TreeNode & { childIds: string[] }> {
  const out: Record<string, TreeNode & { childIds: string[] }> = {};
  if (!root) return out;
  const roots = Array.isArray(root) ? root : [root];
  const walk = (n: TreeNode) => {
    out[n.id] = { ...n, childIds: (n.children ?? []).map((c) => c.id) };
    (n.children ?? []).forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

export function firstRoot(root: TreeNode | TreeNode[] | null): TreeNode | null {
  if (!root) return null;
  return Array.isArray(root) ? root[0] ?? null : root;
}

export function allRoots(root: TreeNode | TreeNode[] | null): TreeNode[] {
  if (!root) return [];
  return Array.isArray(root) ? root : [root];
}
