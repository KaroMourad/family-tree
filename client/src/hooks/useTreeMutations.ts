import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../api/client";
import { queryKeys, importTree } from "../api/queries";
import type { Person, Tree, TreeSummary } from "../types";

// Module-scoped counter for temp IDs (used during optimistic create).
// Unique across rapid clicks even within the same millisecond.
let tempCounter = 0;
function makeTempId(): string {
  return `tmp-${++tempCounter}`;
}

type PersonInput = Omit<Person, "id"> & { id?: string };

// ---- Person mutations -----------------------------------------------------

export function useCreatePerson(treeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PersonInput) =>
      api<Person>(`/trees/${treeId}/people`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.treePeople(treeId) });
      const prev = qc.getQueryData<Person[]>(queryKeys.treePeople(treeId));
      const tempId = makeTempId();
      qc.setQueryData<Person[]>(queryKeys.treePeople(treeId), (old = []) => [
        ...old,
        { ...(input as Person), id: tempId },
      ]);
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.treePeople(treeId), ctx.prev);
      toast.error(`Couldn't add person: ${(err as Error).message}`);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.treePeople(treeId) }),
  });
}

export function useUpdatePerson(treeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Person> }) =>
      api<Person>(`/trees/${treeId}/people/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.treePeople(treeId) });
      const prev = qc.getQueryData<Person[]>(queryKeys.treePeople(treeId));
      qc.setQueryData<Person[]>(queryKeys.treePeople(treeId), (old = []) =>
        old.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.treePeople(treeId), ctx.prev);
      toast.error(`Couldn't save person: ${(err as Error).message}`);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.treePeople(treeId) }),
  });
}

export function useDeletePerson(treeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/trees/${treeId}/people/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.treePeople(treeId) });
      const prev = qc.getQueryData<Person[]>(queryKeys.treePeople(treeId));
      // Server's onDelete: SetNull means orphaned children get parentId=null.
      // Mirror that locally so the optimistic state matches server post-state.
      qc.setQueryData<Person[]>(queryKeys.treePeople(treeId), (old = []) =>
        old
          .filter((p) => p.id !== id)
          .map((p) => (p.parentId === id ? { ...p, parentId: null } : p)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.treePeople(treeId), ctx.prev);
      toast.error(`Couldn't delete person: ${(err as Error).message}`);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.treePeople(treeId) }),
  });
}

// ---- Tree mutations -------------------------------------------------------

export function useCreateTree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<Tree>("/trees", { method: "POST", body: JSON.stringify({ name }) }),
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: queryKeys.trees() });
      const prev = qc.getQueryData<TreeSummary[]>(queryKeys.trees());
      const tempId = makeTempId();
      qc.setQueryData<TreeSummary[]>(queryKeys.trees(), (old = []) => [
        ...old,
        {
          id: tempId,
          name,
          ownerId: "",
          peopleCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.trees(), ctx.prev);
      toast.error(`Couldn't create tree: ${(err as Error).message}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.trees() }),
  });
}

export function useRenameTree(treeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<Tree>(`/trees/${treeId}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      }),
    onMutate: async (name) => {
      // Patch both the tree-list cache (TreeList cards) and the single-tree
      // cache (TreeContext via TreeAccessBoundary) so the new name shows
      // immediately everywhere.
      await qc.cancelQueries({ queryKey: queryKeys.trees() });
      await qc.cancelQueries({ queryKey: queryKeys.tree(treeId), exact: true });
      const prevList = qc.getQueryData<TreeSummary[]>(queryKeys.trees());
      const prevTree = qc.getQueryData<Tree>(queryKeys.tree(treeId));
      qc.setQueryData<TreeSummary[]>(queryKeys.trees(), (old = []) =>
        old.map((t) => (t.id === treeId ? { ...t, name } : t)),
      );
      qc.setQueryData<Tree>(queryKeys.tree(treeId), (old) =>
        old ? { ...old, name } : old,
      );
      return { prevList, prevTree };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevList) qc.setQueryData(queryKeys.trees(), ctx.prevList);
      if (ctx?.prevTree) qc.setQueryData(queryKeys.tree(treeId), ctx.prevTree);
      toast.error(`Couldn't rename tree: ${(err as Error).message}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trees() });
      qc.invalidateQueries({ queryKey: queryKeys.tree(treeId), exact: true });
    },
  });
}

export function useDeleteTree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (treeId: string) =>
      api<void>(`/trees/${treeId}`, { method: "DELETE" }),
    onMutate: async (treeId) => {
      // Optimistic remove from list (the user is navigating away to "/", but
      // if they come back quickly the list shouldn't briefly show the deleted
      // tree).
      await qc.cancelQueries({ queryKey: queryKeys.trees() });
      const prev = qc.getQueryData<TreeSummary[]>(queryKeys.trees());
      qc.setQueryData<TreeSummary[]>(queryKeys.trees(), (old = []) =>
        old.filter((t) => t.id !== treeId),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.trees(), ctx.prev);
      toast.error(`Couldn't delete tree: ${(err as Error).message}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.trees() }),
  });
}

// Import replaces the tree's contents and (server-side) renames the tree.
// Invalidate both people and tree caches so the editor + name refresh.
export function useImportTree(treeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: unknown) => importTree(treeId, doc),
    onError: (err) =>
      toast.error(`Couldn't import: ${(err as Error).message}`),
    onSuccess: (res) => toast.success(`Imported ${res.imported} people`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.treePeople(treeId) });
      qc.invalidateQueries({ queryKey: queryKeys.tree(treeId), exact: true });
      qc.invalidateQueries({ queryKey: queryKeys.trees() });
    },
  });
}
