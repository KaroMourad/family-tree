# Design: TanStack Query + Zustand for client data layer

**Date:** 2026-05-26
**Status:** Approved
**Scope:** `client/` only — no server changes.

## Goal

Replace the bespoke per-route data fetching (`useTree`, `useTreeList`, Editor's local `useEffect`) with **TanStack Query** for all server state and **Zustand** for the small amount of shared UI state. Edits made in the Editor are reflected immediately in the four view pages (ListView, ChartView, IllustratedView, CompactView) without a manual reload, via optimistic cache updates + background revalidation.

## Non-goals

- No server changes, no new API endpoints, no Prisma schema changes.
- No d3 layout-algorithm or SVG markup changes.
- No persisted query cache across page reloads.
- No migration of Theme or Auth into the new stores — `ThemeProvider` and `AuthContext` stay as-is.
- No `useInfiniteQuery`, no scroll-based pagination.

## Stack additions

- **`@tanstack/react-query`** v5 — server-state cache, useQuery, useMutation, optimistic updates, stale-while-revalidate.
- **`@tanstack/react-query-devtools`** (devDependencies only) — small dev-time panel.
- **`zustand`** v5 — UI-state store.
- **`sonner`** + shadcn wrapper (`client/src/components/ui/sonner.tsx`) — toast notifications for mutation errors.

Verified against current Context7 docs for TanStack Query v5 (the `onMutate → onError → onSettled` optimistic pattern below matches the v5 reference exactly).

## Architecture

```
                                  ┌──────────────────────┐
                                  │  React component     │
                                  │  (page or DetailPanel)│
                                  └────────┬────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
   ┌─────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
   │ useTrees / usePeople│   │  use*Mutation hooks  │   │  useUIStore (Zustand)│
   │ (TanStack useQuery) │   │  (TanStack useMutation)│ │  selectedPersonId,    │
   │  server state       │   │  optimistic + toast   │  │  searchQuery          │
   └─────────────────────┘   └──────────────────────┘   └──────────────────────┘
              │                            │
              └────────────┬───────────────┘
                           ▼
                   ┌──────────────────┐
                   │  api() (existing)│
                   │  /api/...        │
                   └──────────────────┘
```

## Server-state layer — TanStack Query

### Query keys & fetchers

`client/src/api/queries.ts` is the single source of truth for query keys and fetchers — avoids stringly-typed keys scattered across files.

```ts
export const queryKeys = {
  trees: () => ["trees"] as const,
  treePeople: (treeId: string) => ["tree", treeId, "people"] as const,
};

export function fetchTrees() {
  return api<TreeSummary[]>("/trees");
}
export function fetchPeople(treeId: string) {
  return api<Person[]>(`/trees/${treeId}/people`);
}
```

### Nesting helper

`client/src/api/nest.ts` extracts the flat → nested transformation that the server's `/tree` endpoint used to do. The client now does this in the browser from the flat `/people` response — meaning a single cache entry feeds both the Editor (flat) and the views (nested via memoized selector).

```ts
export function nestPeople(people: Person[]): TreeNode | TreeNode[];
export function flattenTree(root: TreeNode | TreeNode[] | null): ...;
export function firstRoot(root: TreeNode | TreeNode[] | null): TreeNode | null;
export function allRoots(root: TreeNode | TreeNode[] | null): TreeNode[];
```

The last three helpers move from `hooks/useTree.ts` (which gets deleted) into `api/nest.ts`.

### QueryClient configuration

`client/src/main.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,         // 30s SWR window
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

`<QueryClientProvider client={queryClient}>` wraps the app between `<ThemeProvider>` and `<BrowserRouter>`. `<ReactQueryDevtools initialIsOpen={false} />` mounted only in dev (gate via `import.meta.env.DEV`).

### Query hooks

`client/src/hooks/useTrees.ts`:

```ts
export function useTrees() {
  return useQuery({
    queryKey: queryKeys.trees(),
    queryFn: fetchTrees,
  });
}
```

`client/src/hooks/usePeople.ts`:

```ts
export function usePeople(treeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.treePeople(treeId!),
    queryFn: () => fetchPeople(treeId!),
    enabled: !!treeId,
  });
}
```

Consumers do `const { data, isPending, error } = useTrees()` — no bespoke loading/error state in components.

### Mutation hooks

`client/src/hooks/useTreeMutations.ts` exports six mutations: `useCreatePerson`, `useUpdatePerson`, `useDeletePerson`, `useCreateTree`, `useDeleteTree`, `useRenameTree`.

Every mutation follows the v5 optimistic pattern (verified against Context7):

```ts
export function useCreatePerson(treeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Person, "id">) =>
      api<Person>(`/trees/${treeId}/people`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.treePeople(treeId) });
      const prev = qc.getQueryData<Person[]>(queryKeys.treePeople(treeId));
      const tempId = `tmp-${Date.now()}`;
      qc.setQueryData<Person[]>(queryKeys.treePeople(treeId),
        (old = []) => [...old, { ...input, id: tempId } as Person]);
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
```

Notes:

- The temp ID uses a module-scoped counter (`tmp-${++counter}`) rather than `Date.now()` so rapid successive clicks produce unique IDs. The temp ID is replaced when `onSettled` invalidates → refetches → the real ID arrives from the server. UI keyed by `Person.id` may briefly render with `tmp-...` then re-render — acceptable.
- `useRenameTree` and `useDeleteTree` ALSO invalidate `queryKeys.trees()` so the TreeList card name/list updates.
- `useDeleteTree` does NOT optimistically remove the tree from `trees` because the user is navigating away (Editor → `/`) at the same moment; let `onSettled` refetch on landing.
- Successful mutations do NOT toast; the cache update is the visible feedback. Errors toast via `sonner`.

## Client-state layer — Zustand

`client/src/store/ui.ts` is intentionally small:

```ts
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

Centralizing `selectedPersonId` lets `DetailPanel` read it directly instead of receiving it as a prop from every view page. Centralizing `searchQuery` is a small UX improvement: the search term persists when the user switches between view tabs of the same tree.

**Deliberately kept OUT of the Zustand store:**

- `openIds` / `defaultOpen` (collapse state) — local to ListView and Editor, different trees of nodes, no value globalizing.
- Theme — `ThemeProvider` is fine.
- Auth user — `AuthContext` is fine.

When the route's `treeId` changes, a `useEffect` in the wrapping view resets `selectedPersonId` to `null` (we don't want a stale ID across trees).

## Toast notifications

shadcn ships a Sonner wrapper. After `npx shadcn@latest add sonner` it creates `client/src/components/ui/sonner.tsx` and adds `sonner` to deps. We mount `<Toaster />` once in `main.tsx` alongside the providers.

All mutation `onError` handlers call `toast.error(...)`. Success paths don't toast — the cache update IS the feedback.

## File layout after this work

```
client/src/
  main.tsx                    # wraps QueryClientProvider + Toaster
  api/
    client.ts                 # existing — unchanged
    queries.ts                # NEW: queryKeys + fetchers
    nest.ts                   # NEW: nestPeople + helpers moved from useTree.ts
  hooks/
    useTrees.ts               # NEW
    usePeople.ts              # NEW
    useTreeMutations.ts       # NEW: 6 mutation hooks
    useTree.ts                # DELETED
    useTreeList.ts            # DELETED
  store/
    ui.ts                     # NEW: Zustand UI store
  components/
    ui/sonner.tsx             # NEW (shadcn-generated)
    DetailPanel.tsx           # MODIFIED: reads selectedPersonId from store
  theme/ThemeProvider.tsx     # unchanged
  auth/AuthContext.tsx        # unchanged
  pages/
    TreeList.tsx              # MODIFIED: useTrees() + useCreateTree()
    TreeChooser.tsx           # MODIFIED: swap useTree → usePeople for peopleCount
    ListView.tsx              # MODIFIED: usePeople() + nestPeople()
    ChartView.tsx             # MODIFIED: same
    IllustratedView.tsx       # MODIFIED: same
    CompactView.tsx           # MODIFIED: same
    Editor.tsx                # MODIFIED: usePeople() + mutation hooks
    Login.tsx                 # unchanged
    Register.tsx              # unchanged
```

## Cache strategy

- Global `staleTime: 30_000` — within 30s, navigating between view pages of the same tree shows cached data instantly; older queries refetch silently.
- Mutations invalidate their relevant query in `onSettled`. Person mutations invalidate `treePeople(treeId)`. Tree mutations also invalidate `trees()`.
- React Query handles concurrent-call deduplication, retry-on-network-failure (1 retry), and stale-while-revalidate automatically.
- No `persistQueryClient` — query cache resets on page reload, which is fine for this app.

## Behavior preserved

- All routes, route guards, auth flow, tree access semantics — unchanged.
- The visible result of every existing user action stays the same; the diff is that the network layer and stale-data handling become declarative.
- d3 SVG rendering and layout — unchanged.

## Verification (manual — no test suite per CLAUDE.md)

1. `pnpm install` — clean install with new deps.
2. `pnpm --filter @family-tree/client build` succeeds.
3. `pnpm dev` — walk all routes:
   - `/login`, `/register` (no data layer change expected)
   - `/` — TreeList renders, "+ New Tree" creates with optimistic insert + nav
   - `/tree/:id` — TreeChooser still loads
   - `/tree/:id/{list,chart,illustrated,compact}` — render correctly in both themes
   - `/tree/:id/editor` — Add / Edit / Delete a person; observe ListView in another tab show the change after navigating back (it should be already there via cache)
4. With Editor open in one window and ListView in another (same tree), edit a person → the change is in the cache → when you nav from Editor back to ListView, the new state is visible without a refetch flicker (cached) — refetch happens silently in background.
5. Simulate API error (stop server briefly during a mutation) → optimistic update happens → request fails → state rolls back → toast appears.
6. d3 SVG views (Chart, Illustrated, Compact) render correctly in light + dark.

## Out-of-scope follow-ups

- Optimistic insert with proper temp-to-real ID swap that survives an Editor render-by-id (current plan: brief tmp ID, replaced on refetch).
- `persistQueryClient` for cache survival across reload.
- React Query Devtools production gate / config tuning.
- Migrating Theme and Auth into the new store (not worth the churn).
