# TanStack Query + Zustand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client's bespoke per-route data fetching with **TanStack Query v5** for all server state, and a small **Zustand v5** store for shared UI state. Edits in the Editor reflect immediately in the four view pages via the shared query cache.

**Architecture:** A single `QueryClient` (30-second `staleTime`) sits above the router. All `/api/trees` and `/api/trees/:id/people` reads go through `useTrees()` and `usePeople()`. Mutations are colocated in `useTreeMutations.ts` and follow the v5 optimistic pattern (`onMutate` snapshots + patches, `onError` rolls back + toasts, `onSettled` invalidates). The flat `Person[]` is the canonical shape; views derive their nested tree via `nestPeople()`. A tiny Zustand `useUIStore` holds `selectedPersonId` + `searchQuery`. Sonner toasts surface mutation errors.

**Tech Stack:** React 18, Vite 5, TypeScript 6.0, TanStack Query v5, Zustand v5, sonner (via shadcn wrapper). pnpm workspaces — always use `pnpm`, never `npm`/`yarn`. Build command: `pnpm --filter @family-tree/client build`.

**Spec:** `docs/superpowers/specs/2026-05-26-zustand-tanstack-query-design.md`

**Testing approach:** No unit test suite exists in this repo (per CLAUDE.md). Each task ends with `pnpm --filter @family-tree/client build` to catch type errors and a manual smoke check where relevant. The final task is full route walk-through in light/dark with a deliberate API-error scenario to verify rollback + toast.

---

## File Map

**New files (all in `client/`):**

| Path | Responsibility |
|---|---|
| `client/src/api/queries.ts` | `queryKeys` factory + `fetchTrees` / `fetchPeople` |
| `client/src/api/nest.ts` | `nestPeople()` + `flattenTree` / `firstRoot` / `allRoots` (moved from `useTree.ts`) |
| `client/src/hooks/useTrees.ts` | `useTrees()` query hook |
| `client/src/hooks/usePeople.ts` | `usePeople(treeId)` query hook |
| `client/src/hooks/useTreeMutations.ts` | 6 mutation hooks: `useCreatePerson`, `useUpdatePerson`, `useDeletePerson`, `useCreateTree`, `useDeleteTree`, `useRenameTree` |
| `client/src/store/ui.ts` | Zustand `useUIStore` (`selectedPersonId`, `searchQuery`) |
| `client/src/components/ui/sonner.tsx` | shadcn-generated Sonner wrapper |

**Modified files:**

| Path | Change |
|---|---|
| `client/package.json` | Add `@tanstack/react-query`, `zustand`, `sonner`; dev: `@tanstack/react-query-devtools` |
| `client/src/main.tsx` | Wrap in `<QueryClientProvider>`, mount `<Toaster />`, mount devtools in dev |
| `client/src/pages/TreeList.tsx` | `useTrees()` + `useCreateTree()`; drop local fetch/state |
| `client/src/pages/TreeChooser.tsx` | `usePeople(tree.id)` for footer counts |
| `client/src/pages/ListView.tsx` | `usePeople()` + `nestPeople()`; `useUIStore` for selected + search |
| `client/src/pages/ChartView.tsx` | same |
| `client/src/pages/IllustratedView.tsx` | same |
| `client/src/pages/CompactView.tsx` | same |
| `client/src/pages/Editor.tsx` | `usePeople()` + mutation hooks; drop local `people` state + `refresh()` |
| `client/src/components/DetailPanel.tsx` | Read `selectedPersonId` from `useUIStore`; build `byId` internally from `usePeople()` |

**Deleted files:**

| Path | Reason |
|---|---|
| `client/src/hooks/useTree.ts` | Replaced by `usePeople` + `nest.ts` |
| `client/src/hooks/useTreeList.ts` | Replaced by `useTrees` |

---

## Task 1: Install dependencies

**Files:**
- Modify: `client/package.json`
- Modify: `pnpm-lock.yaml` (root)

- [ ] **Step 1.1: Install runtime deps**

From repo root:

```bash
pnpm --filter @family-tree/client add @tanstack/react-query zustand sonner
```

Expected: `client/package.json` `dependencies` now include `@tanstack/react-query`, `zustand`, `sonner` at latest stable versions. Root `pnpm-lock.yaml` updated.

- [ ] **Step 1.2: Install dev deps**

```bash
pnpm --filter @family-tree/client add -D @tanstack/react-query-devtools
```

- [ ] **Step 1.3: Verify install + build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS. New deps are not yet imported anywhere; this just confirms nothing broke.

- [ ] **Step 1.4: Commit**

```bash
git add client/package.json pnpm-lock.yaml
git commit -m "chore(client): install TanStack Query, Zustand, Sonner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add shadcn Sonner wrapper

**Files:**
- Create: `client/src/components/ui/sonner.tsx`

- [ ] **Step 2.1: Generate the wrapper via shadcn CLI**

From `client/`:

```bash
npx shadcn@latest add sonner --yes
```

Expected: creates `client/src/components/ui/sonner.tsx`. If the CLI tries to also bump deps, accept (it should not — `sonner` was installed in Task 1).

- [ ] **Step 2.2: Confirm the file exists and re-uses our theme**

Open `client/src/components/ui/sonner.tsx`. It should be ~25 lines, import from `sonner` and from `@/components/ui/...`, and read theme via `useTheme()` from `next-themes` OR from our `next-themes`-compatible API. **shadcn ships with `next-themes` integration; our `ThemeProvider` does NOT use next-themes.** Replace the `useTheme()` import to use our provider:

```tsx
// at top, replace:
// import { useTheme } from "next-themes"
// with:
import { useTheme } from "@/theme/ThemeProvider";
```

And inside the component, replace `const { theme = "system" } = useTheme()` (or similar) with our shape:

```tsx
const { resolvedTheme } = useTheme();
// then pass theme={resolvedTheme as "light" | "dark"} to Toaster
```

The full final file should look like:

```tsx
"use client";

import { useTheme } from "@/theme/ThemeProvider";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
```

- [ ] **Step 2.3: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 2.4: Commit**

```bash
git add client/src/components/ui/sonner.tsx
git commit -m "feat(client): add shadcn Sonner wrapper bound to our ThemeProvider

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create `api/queries.ts` and `api/nest.ts`

**Files:**
- Create: `client/src/api/queries.ts`
- Create: `client/src/api/nest.ts`

These are pure utility modules; nothing imports them yet, so the build only verifies type-correctness.

- [ ] **Step 3.1: Create `client/src/api/queries.ts`**

```ts
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
```

- [ ] **Step 3.2: Create `client/src/api/nest.ts`**

This file consolidates the four shape helpers. Three of them (`flattenTree`, `firstRoot`, `allRoots`) move verbatim from `client/src/hooks/useTree.ts`. The new one is `nestPeople()` which builds a `TreeNode | TreeNode[]` from a flat `Person[]` — matching the server's existing logic in `server/src/routes/trees.ts` (the `/tree` endpoint).

```ts
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
```

- [ ] **Step 3.3: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS. Nothing imports these yet.

- [ ] **Step 3.4: Commit**

```bash
git add client/src/api/queries.ts client/src/api/nest.ts
git commit -m "feat(client): add queryKeys, fetchers, and nestPeople helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Create `useTrees` and `usePeople` query hooks

**Files:**
- Create: `client/src/hooks/useTrees.ts`
- Create: `client/src/hooks/usePeople.ts`

- [ ] **Step 4.1: Create `client/src/hooks/useTrees.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchTrees, queryKeys } from "../api/queries";

export function useTrees() {
  return useQuery({
    queryKey: queryKeys.trees(),
    queryFn: fetchTrees,
  });
}
```

- [ ] **Step 4.2: Create `client/src/hooks/usePeople.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchPeople, queryKeys } from "../api/queries";

export function usePeople(treeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.treePeople(treeId ?? ""),
    queryFn: () => fetchPeople(treeId!),
    enabled: !!treeId,
  });
}
```

- [ ] **Step 4.3: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS. These hooks are not yet consumed but compile fine because TanStack Query is now installed.

- [ ] **Step 4.4: Commit**

```bash
git add client/src/hooks/useTrees.ts client/src/hooks/usePeople.ts
git commit -m "feat(client): add useTrees and usePeople query hooks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create `useTreeMutations.ts` (all 6 mutations)

**Files:**
- Create: `client/src/hooks/useTreeMutations.ts`

This is the largest single file in this plan. Each mutation follows the same `onMutate → onError → onSettled` v5 shape.

- [ ] **Step 5.1: Create the file**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../api/client";
import { queryKeys } from "../api/queries";
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
      await qc.cancelQueries({ queryKey: queryKeys.trees() });
      const prev = qc.getQueryData<TreeSummary[]>(queryKeys.trees());
      qc.setQueryData<TreeSummary[]>(queryKeys.trees(), (old = []) =>
        old.map((t) => (t.id === treeId ? { ...t, name } : t)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.trees(), ctx.prev);
      toast.error(`Couldn't rename tree: ${(err as Error).message}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.trees() }),
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
```

- [ ] **Step 5.2: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS. No consumers yet.

- [ ] **Step 5.3: Commit**

```bash
git add client/src/hooks/useTreeMutations.ts
git commit -m "feat(client): add 6 mutation hooks with optimistic updates + toasts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Create Zustand UI store

**Files:**
- Create: `client/src/store/ui.ts`

- [ ] **Step 6.1: Create the file**

```ts
import { create } from "zustand";

type UIState = {
  selectedPersonId: string | null;
  setSelectedPerson: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

export const useUIStore = create<UIState>((set) => ({
  selectedPersonId: null,
  setSelectedPerson: (id) => set({ selectedPersonId: id }),
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
```

- [ ] **Step 6.2: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 6.3: Commit**

```bash
git add client/src/store/ui.ts
git commit -m "feat(client): add Zustand UI store for selectedPersonId + searchQuery

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire `QueryClientProvider` + `<Toaster />` into `main.tsx`

**Files:**
- Modify: `client/src/main.tsx`

- [ ] **Step 7.1: Replace `client/src/main.tsx` with:**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
```

`<Toaster />` and `<ReactQueryDevtools />` sit inside `<QueryClientProvider>` but outside `<BrowserRouter>` — both should be reachable from any route.

- [ ] **Step 7.2: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 7.3: Manual smoke check**

```bash
pnpm dev
```

Open http://localhost:5173/. Expected:
- App loads normally
- No console errors
- In the bottom-left corner: a small floating React Query Devtools button (dev only)
- Click the devtools button → panel opens, shows no queries yet (none of the pages consume the new hooks at this point)

Stop dev server.

- [ ] **Step 7.4: Commit**

```bash
git add client/src/main.tsx
git commit -m "feat(client): wire QueryClientProvider, Toaster, and devtools

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Migrate `TreeList.tsx` to `useTrees` + `useCreateTree`

**Files:**
- Modify: `client/src/pages/TreeList.tsx`

The current file uses `useTreeList()` (local fetch) + an inline `api("POST", "/trees")` for creation. Replace both with the new hooks.

- [ ] **Step 8.1: Update imports**

Replace:

```tsx
import { api } from "../api/client";
import { useTreeList } from "../hooks/useTreeList";
import type { Tree } from "../types";
```

with:

```tsx
import { useTrees } from "../hooks/useTrees";
import { useCreateTree } from "../hooks/useTreeMutations";
```

- [ ] **Step 8.2: Replace local fetch state**

Find the line:

```tsx
const { trees, loading, error, refresh } = useTreeList();
```

Replace with:

```tsx
const { data: trees, isPending: loading, error } = useTrees();
const createTreeMutation = useCreateTree();
```

- [ ] **Step 8.3: Replace `handleCreate` to use the mutation**

Find the current `handleCreate` function (around lines 18–37). Replace its entire body with:

```tsx
async function handleCreate() {
  const trimmed = name.trim();
  if (!trimmed) {
    setCreateError("Name is required");
    return;
  }
  setSubmitting(true);
  setCreateError(null);
  try {
    const created = await createTreeMutation.mutateAsync(trimmed);
    setName("");
    setCreating(false);
    navigate(`/tree/${created.id}/editor`);
  } catch (e) {
    setCreateError(String((e as Error).message));
  } finally {
    setSubmitting(false);
  }
}
```

- [ ] **Step 8.4: Adjust the error display**

`error` is now an `Error` object (from TanStack), not a string. Replace any `{error}` rendering with `{error.message}`. The existing block is:

```tsx
{error && (
  <Alert variant="destructive" className="mb-6">
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

becomes:

```tsx
{error && (
  <Alert variant="destructive" className="mb-6">
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}
```

- [ ] **Step 8.5: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS. If TS errors point to a stale reference to `refresh`, remove that line — TanStack handles invalidation automatically via the mutation's `onSettled`.

- [ ] **Step 8.6: Manual smoke check**

```bash
pnpm dev
```

- Navigate to `/`
- Tree cards render
- Click "+ New Tree", type a name, Create
- New tree appears optimistically in the list, then nav happens to its editor
- Open the React Query Devtools — you should see the `["trees"]` query

Stop dev server.

- [ ] **Step 8.7: Commit**

```bash
git add client/src/pages/TreeList.tsx
git commit -m "feat(client): migrate TreeList to useTrees + useCreateTree

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Migrate `TreeChooser.tsx` to `usePeople`

**Files:**
- Modify: `client/src/pages/TreeChooser.tsx`

TreeChooser currently uses `useTree(tree.id)` from the old `useTree.ts` hook to derive `peopleCount` and `rootName` for its footer text. Swap that for `usePeople(tree.id)` + `nestPeople()`.

- [ ] **Step 9.1: Update imports**

Replace:

```tsx
import { useTree, allRoots, flattenTree } from "../hooks/useTree";
```

with:

```tsx
import { usePeople } from "../hooks/usePeople";
import { allRoots, nestPeople } from "../api/nest";
```

- [ ] **Step 9.2: Replace the data lookups**

Find:

```tsx
const { tree: nestedTree } = useTree(tree.id);
const peopleCount = Object.keys(flattenTree(nestedTree)).length;
const rootName = allRoots(nestedTree)[0]?.name ?? "";
```

Replace with:

```tsx
const { data: people } = usePeople(tree.id);
const peopleCount = people?.length ?? 0;
const rootName = people ? (allRoots(nestPeople(people))[0]?.name ?? "") : "";
```

- [ ] **Step 9.3: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 9.4: Manual smoke check**

```bash
pnpm dev
```

- Navigate to `/`
- Click any tree → `/tree/:id`
- Footer shows `N members · descended from <name>` (same as before)

Stop dev server.

- [ ] **Step 9.5: Commit**

```bash
git add client/src/pages/TreeChooser.tsx
git commit -m "feat(client): migrate TreeChooser to usePeople + nestPeople

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Migrate `ListView.tsx` to `usePeople` + UI store

**Files:**
- Modify: `client/src/pages/ListView.tsx`

ListView is the most-used view page; it consumes the nested tree heavily AND owns search + selected person state. After this task it reads people via `usePeople`, derives the nested tree via `nestPeople`, and pulls search + selection from `useUIStore`.

- [ ] **Step 10.1: Update imports at the top**

Replace:

```tsx
import { allRoots, flattenTree, useTree } from "../hooks/useTree";
```

with:

```tsx
import { usePeople } from "../hooks/usePeople";
import { allRoots, flattenTree, nestPeople } from "../api/nest";
import { useUIStore } from "../store/ui";
```

- [ ] **Step 10.2: Replace data fetching**

Find:

```tsx
const { tree, loading, error } = useTree(treeId);
```

Replace with:

```tsx
const { data: people, isPending: loading, error } = usePeople(treeId);
const tree = useMemo(() => (people ? nestPeople(people) : null), [people]);
```

- [ ] **Step 10.3: Replace local state with UI store**

Find:

```tsx
const [selectedId, setSelectedId] = useState<string | null>(null);
const [q, setQ] = useState("");
```

Replace with:

```tsx
const selectedId = useUIStore((s) => s.selectedPersonId);
const setSelectedId = useUIStore((s) => s.setSelectedPerson);
const q = useUIStore((s) => s.searchQuery);
const setQ = useUIStore((s) => s.setSearchQuery);
```

- [ ] **Step 10.4: Reset selection on treeId change**

Right after the `setSelectedId` selector lines above, add an effect to clear stale selection when the user switches trees:

```tsx
useEffect(() => {
  setSelectedId(null);
}, [treeId, setSelectedId]);
```

Add `useEffect` to the React import at the top of the file if not already present.

- [ ] **Step 10.5: Adjust the error guard**

The current line is:

```tsx
if (error) return <div className="p-10 text-destructive">Error: {error}</div>;
```

`error` is now an `Error` object — replace with:

```tsx
if (error) return <div className="p-10 text-destructive">Error: {error.message}</div>;
```

- [ ] **Step 10.6: Update the DetailPanel call site**

For now, DetailPanel still takes the prop form. After Task 13 it'll be propless; for this task keep the existing call:

```tsx
<DetailPanel person={selected as TreeNode | null} byId={byId} onClose={() => setSelectedId(null)} />
```

No change yet.

- [ ] **Step 10.7: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 10.8: Manual smoke check**

```bash
pnpm dev
```

- Navigate to `/tree/:id/list`
- Tree renders identically to before
- Click a node → DetailPanel opens with that person's data
- Type in search → matches highlight (search persists if you nav away and back)
- Switch to ChartView and back → list still renders without a flicker (cached)

Stop dev server.

- [ ] **Step 10.9: Commit**

```bash
git add client/src/pages/ListView.tsx
git commit -m "feat(client): migrate ListView to usePeople + UI store

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Migrate ChartView, IllustratedView, CompactView

**Files:**
- Modify: `client/src/pages/ChartView.tsx`
- Modify: `client/src/pages/IllustratedView.tsx`
- Modify: `client/src/pages/CompactView.tsx`

Same pattern as Task 10 — repeat the steps below for each file. The three files have slightly different inner logic for d3 rendering, but the data-fetching boundary is identical.

For EACH of the three files, perform Steps 11.1–11.4 individually.

- [ ] **Step 11.1: Update imports**

Replace:

```tsx
import { ..., useTree } from "../hooks/useTree";
```

(and any other helpers from useTree like `flattenTree`, `allRoots`)

with:

```tsx
import { usePeople } from "../hooks/usePeople";
import { flattenTree, allRoots, nestPeople } from "../api/nest";
import { useUIStore } from "../store/ui";
```

Add `useMemo` to React imports if needed.

- [ ] **Step 11.2: Replace data fetch**

```tsx
const { data: people, isPending: loading, error } = usePeople(treeId);
const tree = useMemo(() => (people ? nestPeople(people) : null), [people]);
```

- [ ] **Step 11.3: Replace local selected/search state with UI store**

```tsx
const selectedId = useUIStore((s) => s.selectedPersonId);
const setSelectedId = useUIStore((s) => s.setSelectedPerson);
const q = useUIStore((s) => s.searchQuery);
const setQ = useUIStore((s) => s.setSearchQuery);

useEffect(() => {
  setSelectedId(null);
}, [treeId, setSelectedId]);
```

If the file's current code calls these state setters by different names (e.g. `setSearchTerm`, `setSelected`), rename the references inline rather than reinstate the old names.

- [ ] **Step 11.4: Adjust the error guard**

`{error}` → `{error.message}`.

- [ ] **Step 11.5: Build all three after editing**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 11.6: Manual smoke check**

```bash
pnpm dev
```

For each of `/tree/:id/{chart,illustrated,compact}`:
- Renders identical to before
- Clicking a node opens DetailPanel
- Theme toggle still works in headers
- Navigating between the three uses cached data (no flash)

Stop dev server.

- [ ] **Step 11.7: Commit**

```bash
git add client/src/pages/ChartView.tsx client/src/pages/IllustratedView.tsx client/src/pages/CompactView.tsx
git commit -m "feat(client): migrate ChartView/IllustratedView/CompactView to usePeople

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Migrate `Editor.tsx` to `usePeople` + mutation hooks

**Files:**
- Modify: `client/src/pages/Editor.tsx`

Editor is the biggest migration. It currently:
- Fetches `people` via a local `refresh()` + `useEffect`
- Posts/puts/deletes via direct `api(...)` calls inside `handleSave`/`handleDelete`/`deleteThisTree`/`saveTreeName`
- Tracks `loading` and various `*Busy` / `*Error` flags

After this task all four operations go through mutation hooks; busy state comes from `mutation.isPending`; errors surface via the global toast OR via the existing inline Alert in the form Dialog (mutations propagate errors via `mutateAsync`).

- [ ] **Step 12.1: Update imports**

Add:

```tsx
import { usePeople } from "../hooks/usePeople";
import {
  useCreatePerson,
  useUpdatePerson,
  useDeletePerson,
  useDeleteTree,
  useRenameTree,
} from "../hooks/useTreeMutations";
```

Remove the `api` import if no longer needed (`grep` confirms — direct API calls all go through mutations after this task).

- [ ] **Step 12.2: Replace people fetching**

Find the block (around lines 233–284 in the current file):

```tsx
const [people, setPeople] = useState<Person[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
...
const refresh = useCallback(async () => {
  setLoading(true);
  try {
    const list = await api<Person[]>(`/trees/${treeId}/people`);
    setPeople(list);
  } catch (e) {
    setError(String((e as Error).message));
  } finally {
    setLoading(false);
  }
}, [treeId]);

useEffect(() => {
  refresh();
}, [refresh]);
```

Replace the whole block with:

```tsx
const { data: people = [], isPending: loading, error } = usePeople(treeId);
```

Remove the now-unused `useCallback` import if nothing else uses it.

- [ ] **Step 12.3: Instantiate mutation hooks near the other hooks**

After the `usePeople` line add:

```tsx
const createPersonMutation = useCreatePerson(treeId!);
const updatePersonMutation = useUpdatePerson(treeId!);
const deletePersonMutation = useDeletePerson(treeId!);
const renameTreeMutation = useRenameTree(treeId!);
const deleteTreeMutation = useDeleteTree();
```

Use `treeId!` (non-null assert) — the `TreeAccessBoundary` guarantees we have a real treeId by the time Editor renders.

- [ ] **Step 12.4: Replace `handleSave`**

Find the current `handleSave` (around lines 297–310). Replace its body with:

```tsx
async function handleSave(data: FormState) {
  const { id: _omit, ...rest } = data as Record<string, unknown> as any;
  if (editorState?.mode === "edit") {
    await updatePersonMutation.mutateAsync({ id: editorState.id!, patch: rest });
  } else {
    await createPersonMutation.mutateAsync(rest);
  }
  setEditorState(null);
}
```

Note: no manual `refresh()` afterward — the mutation's `onSettled` invalidates the query, TanStack refetches automatically, and `usePeople` returns the new list.

- [ ] **Step 12.5: Replace the per-person `confirmDelete` action**

Find the existing `confirmDelete` function (it lives inside the AlertDialog flow, around line 340). It currently does:

```tsx
await api(`/trees/${treeId}/people/${deleteTarget.id}`, { method: "DELETE" });
await refresh();
```

Replace with:

```tsx
await deletePersonMutation.mutateAsync(deleteTarget.id);
```

The closing `setDeleteTarget(null)` and busy-state handling stay as-is; the only change is the API call.

- [ ] **Step 12.6: Replace `deleteThisTree`**

Find:

```tsx
async function deleteThisTree() {
  if (deleteTreeName !== treeName) {
    setDeleteTreeError("Type the tree name exactly to confirm.");
    return;
  }
  setDeleteTreeBusy(true);
  setDeleteTreeError(null);
  try {
    await api(`/trees/${treeId}`, { method: "DELETE" });
    navigate("/");
  } catch (e) {
    setDeleteTreeError(String((e as Error).message));
    setDeleteTreeBusy(false);
  }
}
```

Replace with:

```tsx
async function deleteThisTree() {
  if (deleteTreeName !== treeName) {
    setDeleteTreeError("Type the tree name exactly to confirm.");
    return;
  }
  setDeleteTreeBusy(true);
  setDeleteTreeError(null);
  try {
    await deleteTreeMutation.mutateAsync(treeId!);
    navigate("/");
  } catch (e) {
    setDeleteTreeError(String((e as Error).message));
    setDeleteTreeBusy(false);
  }
}
```

- [ ] **Step 12.7: Replace `saveTreeName`**

Find:

```tsx
async function saveTreeName() {
  const next = renameDraft.trim();
  if (!next) {
    setRenameError("Name cannot be empty");
    return;
  }
  if (next === treeName) {
    setRenaming(false);
    return;
  }
  setRenameBusy(true);
  setRenameError(null);
  try {
    const updated = await api<Tree>(`/trees/${treeId}`, {
      method: "PUT",
      body: JSON.stringify({ name: next }),
    });
    setTreeName(updated.name);
    setRenaming(false);
  } catch (e) {
    setRenameError(String((e as Error).message));
  } finally {
    setRenameBusy(false);
  }
}
```

Replace with:

```tsx
async function saveTreeName() {
  const next = renameDraft.trim();
  if (!next) {
    setRenameError("Name cannot be empty");
    return;
  }
  if (next === treeName) {
    setRenaming(false);
    return;
  }
  setRenameBusy(true);
  setRenameError(null);
  try {
    const updated = await renameTreeMutation.mutateAsync(next);
    setTreeName(updated.name);
    setRenaming(false);
  } catch (e) {
    setRenameError(String((e as Error).message));
  } finally {
    setRenameBusy(false);
  }
}
```

Note: the `Tree` import may no longer be needed if it was only used here; let TypeScript tell you on the build.

- [ ] **Step 12.8: Update error display**

The `error` from `usePeople` is an `Error` object. Find:

```tsx
if (error) return <div className="p-10 text-destructive">Error: {error}</div>;
```

Replace with:

```tsx
if (error) return <div className="p-10 text-destructive">Error: {error.message}</div>;
```

- [ ] **Step 12.9: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS. TypeScript may complain about unused `api` / `Tree` imports — remove them.

- [ ] **Step 12.10: Manual smoke check (the big one)**

```bash
pnpm dev
```

For a tree with at least 3 people:

1. **Edit:** click Edit on a row → change the name → Save. Row updates immediately.
2. **Add child:** click + Child on a row → fill Name and Gender → Save. New child appears immediately.
3. **Delete:** click Delete → confirm in AlertDialog. Row disappears immediately.
4. **Rename tree:** click the title → change → Save. Header updates.
5. **Cross-view sync:** in the Editor, edit a person. Without reloading, navigate to `/tree/:id/list` → the edit is visible (no fetch flicker — cached & up-to-date).
6. **Optimistic + error:** stop the server (`docker compose stop` or Ctrl-C the dev script). Click Edit on a row, change the name, Save. The UI updates immediately, then a few seconds later a red toast appears ("Couldn't save person: …") and the row reverts. Restart the server.
7. **Toast position:** confirm the toast appears bottom-right with our theme colors (dark text on parchment in light mode, light text on charcoal in dark mode).

Stop dev server.

- [ ] **Step 12.11: Commit**

```bash
git add client/src/pages/Editor.tsx
git commit -m "feat(client): migrate Editor to usePeople + mutation hooks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Simplify `DetailPanel.tsx` to read directly from the UI store

**Files:**
- Modify: `client/src/components/DetailPanel.tsx`
- Modify: `client/src/pages/ListView.tsx` (update call site)
- Modify: `client/src/pages/ChartView.tsx` (update call site)
- Modify: `client/src/pages/IllustratedView.tsx` (update call site)
- Modify: `client/src/pages/CompactView.tsx` (update call site)

Currently DetailPanel takes `{ person, byId, onClose }`. After this task it's `<DetailPanel />` with no props — it reads `selectedPersonId` from the UI store, builds `byId` internally from `usePeople`, and resolves `person`.

- [ ] **Step 13.1: Rewrite `client/src/components/DetailPanel.tsx`**

```tsx
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { usePeople } from "../hooks/usePeople";
import { useUIStore } from "../store/ui";
import { flattenTree, nestPeople } from "../api/nest";
import type { TreeNode } from "../types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

function Row({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null;
  return (
    <div className="mt-3 first:mt-0">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-secondary">{label}</dt>
      <dd className="text-sm text-foreground m-0 mt-0.5">{String(value)}</dd>
    </div>
  );
}

export function DetailPanel() {
  const { treeId } = useParams();
  const { data: people } = usePeople(treeId);
  const selectedId = useUIStore((s) => s.selectedPersonId);
  const setSelectedId = useUIStore((s) => s.setSelectedPerson);

  const byId = useMemo(
    () => (people ? flattenTree(nestPeople(people)) : {}),
    [people],
  );
  const person = selectedId ? (byId[selectedId] as TreeNode | undefined) ?? null : null;
  const open = !!person;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[360px]">
        {person && (
          <>
            <SheetHeader>
              <SheetTitle className="text-2xl uppercase tracking-[0.15em] text-primary font-semibold">
                {person.name}
              </SheetTitle>
            </SheetHeader>
            <Separator />
            <dl className="m-0 p-4 overflow-y-auto">
              <Row label="ID" value={person.id} />
              <Row label="Nickname" value={person.nickname} />
              <Row label="Gender" value={person.gender} />
              <Row label="Surname (birth)" value={person.surnameBirth} />
              <Row label="Surname (now)" value={person.surnameNow} />
              <Row
                label="Born"
                value={[person.birthDay, person.birthMonth, person.birthYear].filter(Boolean).join(" ")}
              />
              <Row label="Birth place" value={person.birthPlace} />
              <Row label="Died" value={person.deathYear} />
              <Row label="Death place" value={person.deathPlace} />
              <Row
                label="Father"
                value={
                  (person.fatherId && byId[person.fatherId]?.name) ||
                  person.fatherName ||
                  ""
                }
              />
              <Row
                label="Mother"
                value={
                  (person.motherId && byId[person.motherId]?.name) ||
                  person.motherName ||
                  ""
                }
              />
              <Row
                label="Partner"
                value={
                  (person.partnerId && byId[person.partnerId]?.name) ||
                  person.partnerName ||
                  ""
                }
              />
              <Row
                label="Children"
                value={
                  person.children?.map((c) => c.name).join(", ") ?? ""
                }
              />
              <Row label="Profession" value={person.profession} />
              <Row label="Notes" value={person.bio} />
            </dl>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 13.2: Update call sites in the four view files**

In each of `ListView.tsx`, `ChartView.tsx`, `IllustratedView.tsx`, `CompactView.tsx`:

Replace:

```tsx
<DetailPanel person={selected as TreeNode | null} byId={byId} onClose={() => setSelectedId(null)} />
```

with:

```tsx
<DetailPanel />
```

Also remove now-dead local variables: the line(s) that compute `byId` and `selected` for the DetailPanel prop. In ListView, that's:

```tsx
const byId = useMemo(() => flattenTree(tree), [tree]);
// ...
const selected = selectedId ? byId[selectedId] ?? null : null;
```

These can stay if other parts of the file use them (search-match logic uses `byId`). Build will tell you.

- [ ] **Step 13.3: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS. Remove any unused imports/vars TS complains about.

- [ ] **Step 13.4: Manual smoke check**

```bash
pnpm dev
```

- Open each view (`list`, `chart`, `illustrated`, `compact`)
- Click various nodes → DetailPanel slides in with their data
- Press Escape → closes
- Switch between views with a person already selected → panel re-renders correctly on the new view (because `selectedPersonId` is in the global store)

Stop dev server.

- [ ] **Step 13.5: Commit**

```bash
git add client/src/components/DetailPanel.tsx client/src/pages/ListView.tsx client/src/pages/ChartView.tsx client/src/pages/IllustratedView.tsx client/src/pages/CompactView.tsx
git commit -m "feat(client): DetailPanel reads from UI store directly

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Delete dead code

**Files:**
- Delete: `client/src/hooks/useTree.ts`
- Delete: `client/src/hooks/useTreeList.ts`

- [ ] **Step 14.1: Confirm no remaining imports**

```bash
grep -rn "from.*hooks/useTree" client/src/ || echo "no matches"
```

Expected: `no matches`.

- [ ] **Step 14.2: Delete the files**

```bash
git rm client/src/hooks/useTree.ts client/src/hooks/useTreeList.ts
```

- [ ] **Step 14.3: Build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 14.4: Commit**

```bash
git commit -m "chore(client): remove dead useTree and useTreeList hooks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Final verification + PR

- [ ] **Step 15.1: Clean install + build**

```bash
rm -rf client/node_modules
pnpm install
pnpm --filter @family-tree/client build
```

Expected: clean install + build succeeds; `client/dist/` produced.

- [ ] **Step 15.2: Full app end-to-end walk-through**

Start Postgres + dev server:

```bash
docker compose up -d
pnpm dev
```

Verify every route in BOTH light and dark mode:

| Route | What to check |
|---|---|
| `/login`, `/register` | Auth still works |
| `/` (TreeList) | List loads, "+ New Tree" creates optimistically + navs to editor |
| `/tree/:id` (TreeChooser) | Footer member count + root name display correctly |
| `/tree/:id/list` | List renders, click → DetailPanel, search persists across views |
| `/tree/:id/chart` | d3 chart renders, click node → DetailPanel |
| `/tree/:id/illustrated` | d3 renders, click → DetailPanel |
| `/tree/:id/compact` | d3 renders, click → DetailPanel |
| `/tree/:id/editor` | Add / Edit / Delete person all work, Delete tree works |

- [ ] **Step 15.3: Cross-view sync test**

In the Editor, change a person's name and Save. Without reloading, navigate to `/tree/:id/list` → the name change is visible on the card (no fetch flicker — cached from the mutation's optimistic update).

- [ ] **Step 15.4: Error / rollback test**

In the Editor, stop the server (`docker compose stop postgres` or kill the server process). Edit a person and Save. Observe:
1. UI updates immediately (optimistic)
2. After ~1–2 seconds, the mutation fails
3. The row reverts to its previous state
4. A red toast appears bottom-right with the error message

Restart the server.

- [ ] **Step 15.5: Stale-while-revalidate test**

With the server running:
1. Open `/tree/:id/list`
2. Navigate to `/tree/:id/chart`
3. Navigate back to `/tree/:id/list`

Both transitions should be instant (cached). After the second `list` view, watch the React Query Devtools — the `["tree", treeId, "people"]` query should NOT show a fresh fetch (because the data is still within the 30s `staleTime` window).

- [ ] **Step 15.6: Confirm no stray references to deleted files**

```bash
grep -rn "useTree\|useTreeList" client/src/ | grep -v "useTrees\b\|useTreeMutations" || echo "no matches"
```

Expected: `no matches` (only `useTrees` from `hooks/useTrees.ts` and `useTreeMutations` should remain).

- [ ] **Step 15.7: Push and create PR**

```bash
git push -u origin feat/zustand-tanstack-query
gh pr create --title "feat(client): TanStack Query + Zustand for data layer" --body-file - <<'EOF'
## Summary
- Replace bespoke per-route data fetching with TanStack Query v5 (`useTrees`, `usePeople`) and 6 mutation hooks with optimistic updates + Sonner toast rollback.
- Add a small Zustand store for `selectedPersonId` + `searchQuery` (shared across view pages).
- Edits in the Editor reflect immediately in the four view pages via the shared query cache.
- d3 SVG views and theme/auth providers unchanged.

## Test plan
- [x] `pnpm --filter @family-tree/client build` succeeds clean
- [ ] All routes render in light and dark mode
- [ ] Add / Edit / Delete person reflect immediately in views without manual reload
- [ ] Optimistic mutation + simulated server error → rollback + toast
- [ ] Stale-while-revalidate: same-tree nav within 30s uses cached data

Spec: `docs/superpowers/specs/2026-05-26-zustand-tanstack-query-design.md`
Plan: `docs/superpowers/plans/2026-05-26-zustand-tanstack-query.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

---

## Self-review notes

**Spec coverage:**
- Stack deps → Task 1 + Task 2.
- `queries.ts` / `nest.ts` → Task 3.
- `QueryClient` config + provider → Task 7.
- `useTrees` / `usePeople` → Task 4.
- 6 mutation hooks → Task 5.
- Zustand UI store → Task 6.
- Sonner wrapper bound to our `ThemeProvider` → Task 2.
- TreeList migration → Task 8.
- TreeChooser migration → Task 9.
- ListView migration → Task 10.
- ChartView / IllustratedView / CompactView → Task 11.
- Editor migration → Task 12.
- DetailPanel store-reads → Task 13.
- Delete `useTree.ts` / `useTreeList.ts` → Task 14.
- Verification → Task 15.

**Type consistency:**
- `useCreatePerson` takes `PersonInput` (`Omit<Person, "id"> & { id?: string }`); Editor's `handleSave` strips `id` then calls `mutateAsync(rest)` — matches.
- `useUpdatePerson` takes `{ id: string; patch: Partial<Person> }`; Editor calls `mutateAsync({ id, patch })` — matches.
- `useDeletePerson` takes `id: string`; called with `deleteTarget.id` — matches.
- `useCreateTree` takes `name: string`; TreeList calls `mutateAsync(trimmed)` — matches.
- `useDeleteTree` takes `treeId: string` (NOT bound at hook construction since the deleting page knows the ID); Editor's `deleteThisTree` calls `mutateAsync(treeId!)` — matches.
- `useRenameTree(treeId)` is bound at construction; mutation takes `name: string` and returns `Tree` — matches Editor's usage of `updated.name`.

**No placeholders.** Every step has the actual code to write or the actual edit to make.

**Cache mental model is consistent across tasks:** Person mutations target `treePeople(treeId)`. Tree-list mutations target `trees()`. Tree rename also touches `trees()` (the TreeList card name). All mutations invalidate in `onSettled` regardless of success/error.
