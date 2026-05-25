import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { TreeNode } from "../types";

export function useTree(treeId: string | undefined) {
  const [tree, setTree] = useState<TreeNode | TreeNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!treeId) {
      setTree(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api<TreeNode | TreeNode[]>(`/trees/${treeId}/tree`)
      .then((data) => setTree(Array.isArray(data) && data.length === 0 ? [] : data))
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [treeId]);

  return { tree, error, loading };
}

export function flattenTree(root: TreeNode | TreeNode[] | null): Record<string, TreeNode & { childIds: string[] }> {
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
