import { api } from "./client";
import type { Person, Tree, TreeSummary } from "../types";

export const queryKeys = {
  trees: () => ["trees"] as const,
  tree: (treeId: string) => ["tree", treeId] as const,
  treePeople: (treeId: string) => ["tree", treeId, "people"] as const,
};

export function fetchTrees(): Promise<TreeSummary[]> {
  return api<TreeSummary[]>("/trees");
}

export function fetchTree(treeId: string): Promise<Tree> {
  return api<Tree>(`/trees/${treeId}`);
}

export function fetchPeople(treeId: string): Promise<Person[]> {
  return api<Person[]>(`/trees/${treeId}/people`);
}
