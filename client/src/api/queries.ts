import { api } from "./client";
import type { Person, TreeSummary } from "../types";

export const queryKeys = {
  trees: () => ["trees"] as const,
  treePeople: (treeId: string) => ["tree", treeId, "people"] as const,
};

export function fetchTrees(): Promise<TreeSummary[]> {
  return api<TreeSummary[]>("/trees");
}

export function fetchPeople(treeId: string): Promise<Person[]> {
  return api<Person[]>(`/trees/${treeId}/people`);
}
