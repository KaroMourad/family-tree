# Free Deploy + JSON Export/Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app JSON export/import for a tree and make the app deployable for free on Render (static site + Express web service) + Neon Postgres.

**Architecture:** A new shared server module flattens a nested camelCase tree document into rows and inserts them BFS-by-layer; both a new `import` route and the migrated `import-json` CLI use it. An `export` route serializes a tree to the same nested camelCase shape. The client gets Export/Import buttons in the editor and an `import.meta.env.VITE_API_URL` base so it can talk to a backend on a different origin. Deploy is described by a repo-root `render.yaml`.

**Tech Stack:** Express 4, Prisma 5 (Postgres), Zod, React 18 + TanStack Query, Vite, Render, Neon.

**Spec:** `docs/superpowers/specs/2026-05-27-deploy-and-json-export-import-design.md`

**Repo notes (read before starting):**
- pnpm workspaces monorepo. Always `pnpm`, never npm/yarn.
- **No test suite, linter, or formatter exists.** Do NOT invent test commands. Verification steps below are manual (run the app / a script and observe output), plus `pnpm build` for typecheck.
- Server is ESM (`"type": "module"`); server-internal imports use `.js` extensions (e.g. `import { prisma } from "../prisma.js"`). Match this exactly.
- On Windows, the Bash tool may defer to background. Prefer the PowerShell tool for shell verification steps; both are acceptable.

---

## File Structure

**Server (create):**
- `server/src/lib/treeIO.ts` — canonical types + Zod schema for the export/import document, plus `flattenDocument()` (nested→rows) and `replaceTreePeople()` (transactional wipe + BFS insert). Single source of truth used by both the route and the CLI.

**Server (modify):**
- `server/src/routes/trees.ts` — add `GET /:treeId/export` and `POST /:treeId/import`.
- `server/scripts/import-json.ts` — switch from inline snake_case flatten to `treeIO.ts`; read the migrated camelCase `legacy/family_tree.json`.

**Client (modify):**
- `client/src/api/client.ts` — prepend `import.meta.env.VITE_API_URL` to fetch URL.
- `client/src/api/queries.ts` — add `exportTree()` + `importTree()` API calls.
- `client/src/hooks/useTreeMutations.ts` — add `useImportTree(treeId)`.
- `client/src/pages/Editor.tsx` — add Export/Import buttons + confirm dialog + file input.

**Data (modify):**
- `legacy/family_tree.json` — convert snake_case keys → camelCase (one-time, via script).

**Deploy (create):**
- `render.yaml` — Render blueprint (static site + web service).
- `server/.env.example` — add note; client `.env.example` — new, documents `VITE_API_URL`.

**Docs (modify):**
- `CLAUDE.md` — document export/import endpoints, the camelCase format, and the deploy story.

---

## Task 1: Shared tree-IO module (types + schema)

**Files:**
- Create: `server/src/lib/treeIO.ts`

- [ ] **Step 1: Create the module with the canonical document schema**

```ts
// server/src/lib/treeIO.ts
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

// One person node in an export/import document. camelCase, nested via `children`.
// Mirrors the Person fields the API already returns from GET /:treeId/tree.
const personNodeBase = {
  id: z.string().min(1),
  name: z.string().min(1),
  nickname: z.string().nullable().optional(),
  surnameNow: z.string().nullable().optional(),
  surnameBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  deceased: z.string().nullable().optional(),
  fatherId: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  motherId: z.string().nullable().optional(),
  motherName: z.string().nullable().optional(),
  birthYear: z.number().int().nullable().optional(),
  birthMonth: z.number().int().nullable().optional(),
  birthDay: z.number().int().nullable().optional(),
  deathYear: z.number().int().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  deathPlace: z.string().nullable().optional(),
  partnerId: z.string().nullable().optional(),
  partnerName: z.string().nullable().optional(),
  profession: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
};

export type PersonNode = PersonNodeShape;
export const personNodeSchema: z.ZodType<PersonNodeShape> = z.lazy(() =>
  z.object({
    ...personNodeBase,
    children: z.array(personNodeSchema).optional(),
  }),
);

type PersonNodeShape = {
  id: string;
  name: string;
  nickname?: string | null;
  surnameNow?: string | null;
  surnameBirth?: string | null;
  gender?: string | null;
  deceased?: string | null;
  fatherId?: string | null;
  fatherName?: string | null;
  motherId?: string | null;
  motherName?: string | null;
  birthYear?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  deathYear?: number | null;
  birthPlace?: string | null;
  deathPlace?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  profession?: string | null;
  bio?: string | null;
  children?: PersonNodeShape[];
};

export const treeDocumentSchema = z.object({
  formatVersion: z.literal(1),
  tree: z.object({ name: z.string().min(1).max(100) }),
  people: z.array(personNodeSchema),
});
export type TreeDocument = z.infer<typeof treeDocumentSchema>;
```

- [ ] **Step 2: Typecheck the new file compiles**

Run (PowerShell): `pnpm --filter @family-tree/server build`
Expected: exits 0, no type errors. (`server/dist/lib/treeIO.js` is emitted.)

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/treeIO.ts
git commit -m "feat(server): canonical tree-IO document schema"
```

---

## Task 2: flattenDocument + replaceTreePeople

**Files:**
- Modify: `server/src/lib/treeIO.ts`

- [ ] **Step 1: Add the flatten + transactional replace helpers**

Append to `server/src/lib/treeIO.ts`:

```ts
type PersonCreate = Prisma.PersonCreateManyInput;

/**
 * Flatten a document's nested people into rows ready for createMany,
 * preserving the file's ids. Throws on duplicate ids within the document.
 */
export function flattenDocument(doc: TreeDocument, treeId: string): PersonCreate[] {
  const rows: PersonCreate[] = [];
  const seen = new Set<string>();

  function walk(node: PersonNodeShape, parentId: string | null, sortOrder: number) {
    if (seen.has(node.id)) {
      throw new Error(`Duplicate person id in document: ${node.id}`);
    }
    seen.add(node.id);
    rows.push({
      treeId,
      id: node.id,
      name: node.name,
      nickname: node.nickname ?? null,
      surnameNow: node.surnameNow ?? null,
      surnameBirth: node.surnameBirth ?? null,
      gender: node.gender ?? null,
      deceased: node.deceased ?? null,
      fatherId: node.fatherId ?? null,
      fatherName: node.fatherName ?? null,
      motherId: node.motherId ?? null,
      motherName: node.motherName ?? null,
      birthYear: node.birthYear ?? null,
      birthMonth: node.birthMonth ?? null,
      birthDay: node.birthDay ?? null,
      deathYear: node.deathYear ?? null,
      birthPlace: node.birthPlace ?? null,
      deathPlace: node.deathPlace ?? null,
      partnerId: node.partnerId ?? null,
      partnerName: node.partnerName ?? null,
      profession: node.profession ?? null,
      bio: node.bio ?? null,
      parentId,
      parentTreeId: parentId == null ? null : treeId,
      sortOrder,
    });
    (node.children ?? []).forEach((c, i) => walk(c, node.id, i));
  }

  doc.people.forEach((root, i) => walk(root, null, i));
  return rows;
}

/**
 * Atomically replace all Person rows of a tree with `rows`, and set the tree
 * name. Inserts BFS-by-layer so parent FKs resolve before children.
 * Runs inside a single transaction: any failure rolls back the whole replace.
 */
export async function replaceTreePeople(
  treeId: string,
  treeName: string,
  rows: PersonCreate[],
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.tree.update({ where: { id: treeId }, data: { name: treeName } });
    await tx.person.deleteMany({ where: { treeId } });

    const byParent = new Map<string | null, PersonCreate[]>();
    for (const r of rows) {
      const list = byParent.get(r.parentId ?? null) ?? [];
      list.push(r);
      byParent.set(r.parentId ?? null, list);
    }
    const queue: (string | null)[] = [null];
    let inserted = 0;
    while (queue.length) {
      const pid = queue.shift()!;
      const layer = byParent.get(pid) ?? [];
      if (layer.length) {
        await tx.person.createMany({ data: layer });
        inserted += layer.length;
        for (const child of layer) queue.push(child.id);
      }
    }
    return inserted;
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @family-tree/server build`
Expected: exits 0, no type errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/treeIO.ts
git commit -m "feat(server): flattenDocument + transactional replaceTreePeople"
```

---

## Task 3: Export route

**Files:**
- Modify: `server/src/routes/trees.ts`

- [ ] **Step 1: Import the tree-IO module and TreeDocument type**

At the top of `server/src/routes/trees.ts`, after the existing imports, add:

```ts
import {
  treeDocumentSchema,
  flattenDocument,
  replaceTreePeople,
  type TreeDocument,
  type PersonNode,
} from "../lib/treeIO.js";
```

- [ ] **Step 2: Add the export route**

Insert this block in `server/src/routes/trees.ts` immediately before the
`// --- /api/trees/:treeId/tree (nested-tree render) ---` comment:

```ts
// --- /api/trees/:treeId/export ---------------------------------------------

router.get("/:treeId/export", requireTreeAccess, async (req, res) => {
  const treeId = req.tree!.id;
  const all = await prisma.person.findMany({
    where: { treeId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const nodes = new Map<string, PersonNode>();
  for (const p of all) {
    nodes.set(p.id, {
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      surnameNow: p.surnameNow,
      surnameBirth: p.surnameBirth,
      gender: p.gender,
      deceased: p.deceased,
      fatherId: p.fatherId,
      fatherName: p.fatherName,
      motherId: p.motherId,
      motherName: p.motherName,
      birthYear: p.birthYear,
      birthMonth: p.birthMonth,
      birthDay: p.birthDay,
      deathYear: p.deathYear,
      birthPlace: p.birthPlace,
      deathPlace: p.deathPlace,
      partnerId: p.partnerId,
      partnerName: p.partnerName,
      profession: p.profession,
      bio: p.bio,
      children: [],
    });
  }
  const roots: PersonNode[] = [];
  for (const p of all) {
    const node = nodes.get(p.id)!;
    if (p.parentId && nodes.has(p.parentId)) {
      nodes.get(p.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  const doc: TreeDocument = {
    formatVersion: 1,
    tree: { name: req.tree!.name },
    people: roots,
  };

  const safeName = req.tree!.name.replace(/[^\w.-]+/g, "_").slice(0, 60) || "tree";
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.json"`);
  res.send(JSON.stringify(doc, null, 2));
});
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @family-tree/server build`
Expected: exits 0.

- [ ] **Step 4: Manual verification (requires local DB + a seeded tree)**

Start the server: `pnpm --filter @family-tree/server dev` (in one terminal).
In another terminal, authenticate and hit the route. Example (PowerShell), replacing TOKEN and TREEID:

```powershell
curl.exe -H "Authorization: Bearer TOKEN" http://localhost:4000/api/trees/TREEID/export
```

Expected: JSON document with `formatVersion: 1`, `tree.name`, and nested `people` (camelCase keys, `children` arrays). Response has a `Content-Disposition: attachment` header.

If no local DB is running, skip the live call; rely on the typecheck and the round-trip test in Task 5.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/trees.ts
git commit -m "feat(server): GET /trees/:treeId/export (camelCase JSON document)"
```

---

## Task 4: Import route

**Files:**
- Modify: `server/src/routes/trees.ts`

- [ ] **Step 1: Add the import route**

Insert immediately after the export route added in Task 3:

```ts
// --- /api/trees/:treeId/import ---------------------------------------------

router.post("/:treeId/import", requireTreeAccess, async (req, res) => {
  const parsed = treeDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const doc = parsed.data;
  const treeId = req.tree!.id;

  let rows;
  try {
    rows = flattenDocument(doc, treeId);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }

  const inserted = await replaceTreePeople(treeId, doc.tree.name, rows);
  res.json({ imported: inserted, name: doc.tree.name });
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @family-tree/server build`
Expected: exits 0.

- [ ] **Step 3: Manual verification — atomic replace + rejection**

With the dev server running and a seeded tree (TREEID, TOKEN):

Valid import (replaces tree contents):
```powershell
curl.exe -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" `
  -d '{"formatVersion":1,"tree":{"name":"Imported"},"people":[{"id":"AAAAA","name":"Root","children":[{"id":"BBBBB","name":"Child"}]}]}' `
  http://localhost:4000/api/trees/TREEID/import
```
Expected: `{"imported":2,"name":"Imported"}`. Re-fetching `/export` returns those two people.

Invalid import (duplicate id) leaves tree untouched:
```powershell
curl.exe -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" `
  -d '{"formatVersion":1,"tree":{"name":"Bad"},"people":[{"id":"DUP","name":"A"},{"id":"DUP","name":"B"}]}' `
  http://localhost:4000/api/trees/TREEID/import
```
Expected: HTTP 400 `{"error":"Duplicate person id in document: DUP"}`. Re-fetching `/export` still returns the previous (valid) two people — proving the transaction rolled back.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/trees.ts
git commit -m "feat(server): POST /trees/:treeId/import (atomic replace, ids preserved)"
```

---

## Task 5: Migrate legacy JSON + import-json CLI to camelCase

**Files:**
- Modify: `legacy/family_tree.json`
- Modify: `server/scripts/import-json.ts`

- [ ] **Step 1: Write a one-time key-rename script**

Create `server/scripts/_migrate-legacy-json.mjs` (temporary helper):

```js
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const map = {
  surname_now: "surnameNow",
  surname_birth: "surnameBirth",
  father_id: "fatherId",
  father_name: "fatherName",
  mother_id: "motherId",
  mother_name: "motherName",
  birth_year: "birthYear",
  birth_month: "birthMonth",
  birth_day: "birthDay",
  death_year: "deathYear",
  birth_place: "birthPlace",
  death_place: "deathPlace",
  partner_id: "partnerId",
  partner_name: "partnerName",
};

function rename(node) {
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "children") continue;
    out[map[k] ?? k] = v;
  }
  if (node.children) out.children = node.children.map(rename);
  return out;
}

const p = resolve(process.cwd(), "..", "legacy", "family_tree.json");
const raw = JSON.parse(readFileSync(p, "utf-8"));
const migrated = Array.isArray(raw) ? raw.map(rename) : rename(raw);
writeFileSync(p, JSON.stringify(migrated, null, 2) + "\n");
console.log("Migrated legacy/family_tree.json to camelCase");
```

- [ ] **Step 2: Run it (from the server workspace, so the `..` path resolves)**

Run (PowerShell): `pnpm --filter @family-tree/server exec node scripts/_migrate-legacy-json.mjs`
Expected: prints "Migrated legacy/family_tree.json to camelCase".

- [ ] **Step 3: Verify the JSON now uses camelCase**

Open `legacy/family_tree.json`. Expected: top object has `surnameNow`, `fatherId`, `birthYear`, etc. — no underscores in keys. `children` arrays preserved.

- [ ] **Step 4: Delete the temporary migration script**

```bash
git rm -f --ignore-unmatch server/scripts/_migrate-legacy-json.mjs
```
(If it was never staged, just delete the file from disk.)

- [ ] **Step 5: Rewrite import-json.ts to use the shared module**

Replace the entire contents of `server/scripts/import-json.ts` with:

```ts
/**
 * Import a hierarchical JSON tree (camelCase document) into a specific Tree.
 *
 * Reads ../legacy/family_tree.json — a bare nested array/object of people
 * (the legacy seed). Destructive within the target tree only.
 *
 * Usage (one of):
 *   pnpm import-json --tree <treeId>
 *   pnpm import-json --owner <email> --name "<tree name>"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/prisma.js";
import {
  treeDocumentSchema,
  flattenDocument,
  replaceTreePeople,
} from "../src/lib/treeIO.js";

function parseArgs(argv: string[]): { tree?: string; owner?: string; name?: string } {
  const out: { tree?: string; owner?: string; name?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tree" && argv[i + 1]) out.tree = argv[++i];
    else if (argv[i] === "--owner" && argv[i + 1]) out.owner = argv[++i];
    else if (argv[i] === "--name" && argv[i + 1]) out.name = argv[++i];
  }
  return out;
}

function usageAndExit(): never {
  console.error(
    "Usage:\n" +
      "  pnpm import-json --tree <treeId>\n" +
      '  pnpm import-json --owner <email> --name "<tree name>"',
  );
  process.exit(1);
}

async function resolveTree(
  args: ReturnType<typeof parseArgs>,
): Promise<{ id: string; name: string }> {
  if (args.tree) {
    const t = await prisma.tree.findUnique({ where: { id: args.tree } });
    if (!t) {
      console.error(`No tree with id=${args.tree}`);
      process.exit(1);
    }
    return { id: t.id, name: t.name };
  }
  if (args.owner && args.name) {
    const owner = await prisma.user.findUnique({
      where: { email: args.owner.toLowerCase() },
    });
    if (!owner) {
      console.error(`No user with email=${args.owner}`);
      process.exit(1);
    }
    const created = await prisma.tree.create({
      data: { name: args.name, ownerId: owner.id },
    });
    console.log(`Created tree "${created.name}" (id=${created.id}) owned by ${owner.email}`);
    return { id: created.id, name: created.name };
  }
  usageAndExit();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tree = await resolveTree(args);

  const jsonPath = resolve(process.cwd(), "..", "legacy", "family_tree.json");
  console.log(`Reading ${jsonPath}`);
  const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
  const people = Array.isArray(raw) ? raw : [raw];

  // legacy/family_tree.json is a bare people array/object — wrap it into the
  // canonical document, reusing the tree's own name.
  const doc = treeDocumentSchema.parse({
    formatVersion: 1,
    tree: { name: tree.name },
    people,
  });

  const rows = flattenDocument(doc, tree.id);
  console.log(`Flattened ${rows.length} people for tree ${tree.id}`);
  const inserted = await replaceTreePeople(tree.id, tree.name, rows);
  console.log(`Inserted ${inserted} people into tree ${tree.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @family-tree/server build`
Expected: exits 0.

- [ ] **Step 7: Manual verification (requires local DB + an existing tree)**

Run: `pnpm import-json --tree <existing-treeId>`
Expected: prints "Flattened N people" then "Inserted N people". The editor for that tree shows the imported people. (If no local DB, skip — typecheck covers the code path.)

- [ ] **Step 8: Commit**

```bash
git add legacy/family_tree.json server/scripts/import-json.ts
git commit -m "refactor(server): camelCase legacy JSON + import-json via shared tree-IO"
```

---

## Task 6: Client API base URL (deploy prerequisite)

**Files:**
- Modify: `client/src/api/client.ts:19`
- Create: `client/.env.example`

- [ ] **Step 1: Use VITE_API_URL as the fetch base**

In `client/src/api/client.ts`, change the fetch line. Replace:

```ts
  const res = await fetch(`/api${path}`, { ...init, headers });
```

with:

```ts
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  const res = await fetch(`${apiBase}/api${path}`, { ...init, headers });
```

- [ ] **Step 2: Document the env var**

Create `client/.env.example`:

```sh
# Base URL of the backend API in production (no trailing slash), e.g.
#   VITE_API_URL=https://family-tree-api.onrender.com
# Leave UNSET for local dev — the Vite proxy (vite.config.ts) forwards /api to :4000.
VITE_API_URL=
```

- [ ] **Step 3: Verify local dev path unaffected**

Run: `pnpm --filter @family-tree/client build`
Expected: exits 0. (With `VITE_API_URL` unset, `apiBase` is `""`, so requests stay `/api/...` and the dev proxy still applies — behavior identical to before.)

- [ ] **Step 4: Commit**

```bash
git add client/src/api/client.ts client/.env.example
git commit -m "feat(client): VITE_API_URL base so client can reach a remote backend"
```

---

## Task 7: Client export/import API + hook

**Files:**
- Modify: `client/src/api/queries.ts`
- Modify: `client/src/hooks/useTreeMutations.ts`

- [ ] **Step 1: Add export/import API calls**

Append to `client/src/api/queries.ts`:

```ts
// Export returns the raw document (used to trigger a file download).
export function exportTree(treeId: string): Promise<unknown> {
  return api<unknown>(`/trees/${treeId}/export`);
}

export function importTree(
  treeId: string,
  doc: unknown,
): Promise<{ imported: number; name: string }> {
  return api(`/trees/${treeId}/import`, {
    method: "POST",
    body: JSON.stringify(doc),
  });
}
```

- [ ] **Step 2: Add the import mutation hook**

In `client/src/hooks/useTreeMutations.ts`, add the import to the existing query imports and a new hook. First update the import of `../api/queries`:

```ts
import { queryKeys } from "../api/queries";
import { importTree } from "../api/queries";
```

Then append this hook at the end of the file:

```ts
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
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @family-tree/client build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/api/queries.ts client/src/hooks/useTreeMutations.ts
git commit -m "feat(client): export/import API calls + useImportTree hook"
```

---

## Task 8: Editor Export/Import UI

**Files:**
- Modify: `client/src/pages/Editor.tsx`

- [ ] **Step 1: Import the hook and a ref/useRef**

In `client/src/pages/Editor.tsx`, change the React import on line 1:

```ts
import { useMemo, useRef, useState } from "react";
```

Add to the hook imports block (the `from "../hooks/useTreeMutations"` import), so it reads:

```ts
import {
  useCreatePerson,
  useUpdatePerson,
  useDeletePerson,
  useDeleteTree,
  useRenameTree,
  useImportTree,
} from "../hooks/useTreeMutations";
```

- [ ] **Step 2: Wire up export/import state in the Editor component**

Inside `export function Editor()`, after the line
`const deleteTreeMutation = useDeleteTree();`, add:

```ts
  const importTreeMutation = useImportTree(treeId!);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ doc: unknown; count: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleExport() {
    try {
      const doc = await (await import("../api/queries")).exportTree(treeId!);
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${treeName.replace(/[^\w.-]+/g, "_") || "tree"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`Couldn't export: ${(e as Error).message}`);
    }
  }

  function onImportFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const doc = JSON.parse(String(reader.result));
        const count = Array.isArray(doc?.people) ? countNodes(doc.people) : 0;
        setPendingImport({ doc, count });
      } catch {
        setImportError("That file isn't valid JSON.");
        toast.error("That file isn't valid JSON.");
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!pendingImport) return;
    try {
      await importTreeMutation.mutateAsync(pendingImport.doc);
      setPendingImport(null);
    } catch {
      // toast handled in hook; keep dialog open so the user can retry/cancel
    }
  }
```

`toast` is already used indirectly via hooks but not imported here — add at the top with the other imports:

```ts
import { toast } from "sonner";
```

- [ ] **Step 3: Add the countNodes helper**

Add this module-level function near `genderClass` (top of the file, outside the component):

```ts
function countNodes(nodes: Array<{ children?: unknown[] }>): number {
  return nodes.reduce(
    (sum, n) => sum + 1 + (Array.isArray(n.children) ? countNodes(n.children as Array<{ children?: unknown[] }>) : 0),
    0,
  );
}
```

- [ ] **Step 4: Add Export/Import buttons to the header**

In the header, immediately after the "Collapse all" button (the one with text `Collapse all`), insert:

```tsx
          <Button variant="outline" size="sm" onClick={handleExport} className="uppercase tracking-widest">
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="uppercase tracking-widest"
          >
            Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFileChosen}
          />
```

- [ ] **Step 5: Add the import confirmation dialog**

Immediately before the closing `</div>` that ends the component's returned JSX (the last line before `);`  — i.e. after the "Delete tree" `<Dialog>` block closes with `</Dialog>`), insert:

```tsx
      <AlertDialog
        open={!!pendingImport}
        onOpenChange={(o) => { if (!o && !importTreeMutation.isPending) { setPendingImport(null); setImportError(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-widest text-destructive">
              Replace this tree?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all {people.length} people in "{treeName}" with{" "}
              {pendingImport?.count ?? 0} people from the file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {importError && (
            <Alert variant="destructive">
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importTreeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmImport(); }}
              disabled={importTreeMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {importTreeMutation.isPending ? "Importing…" : "Replace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @family-tree/client build`
Expected: exits 0.

- [ ] **Step 7: Manual verification (full round-trip, requires local stack)**

Start the stack: `pnpm dev`. Log in, open a tree's editor.
1. Click **Export JSON** → a `<treename>.json` file downloads. Open it: nested camelCase, `formatVersion: 1`.
2. Click **Import JSON**, pick that same file → confirm dialog shows "replace all N people … with N people". Click **Replace**.
3. Expected: toast "Imported N people"; the tree renders identically (ids preserved). Tree name unchanged (matches the file).
4. Edit the file (e.g. rename a person), import again → that change appears, proving import replaced contents.
5. Pick a non-JSON file → inline/toast error "That file isn't valid JSON.", no replacement.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/Editor.tsx
git commit -m "feat(client): Export/Import JSON buttons + confirm-replace dialog in editor"
```

---

## Task 9: Render blueprint + deploy config

**Files:**
- Create: `render.yaml`
- Modify: `server/package.json` (add a `prisma:deploy` script)

- [ ] **Step 1: Add a migrate-deploy script to the server**

In `server/package.json`, add to `"scripts"` (after `"prisma:migrate"`):

```json
    "prisma:deploy": "prisma migrate deploy",
```

- [ ] **Step 2: Create render.yaml at the repo root**

```yaml
# Render blueprint: static SPA + Express API.
# Database: Neon Postgres (created separately; its connection string is set as
# the DATABASE_URL env var on the web service via the Render dashboard).
services:
  - type: web
    name: family-tree-api
    runtime: node
    plan: free
    rootDir: server
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm prisma:generate && pnpm build
    startCommand: pnpm prisma:deploy && pnpm start
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        sync: false        # set in dashboard to the Neon connection string (?sslmode=require)
      - key: JWT_SECRET
        generateValue: true
      - key: CLIENT_ORIGIN
        sync: false        # set to the static site URL once known
      - key: PORT
        value: 10000

  - type: web
    name: family-tree-web
    runtime: static
    rootDir: client
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm build
    staticPublishPath: dist
    envVars:
      - key: VITE_API_URL
        sync: false        # set to the family-tree-api URL once known
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

- [ ] **Step 3: Typecheck server build still works**

Run: `pnpm --filter @family-tree/server build`
Expected: exits 0. (`prisma:deploy` is only invoked at deploy time; no local effect.)

- [ ] **Step 4: Verify render.yaml is valid YAML**

Run (PowerShell):
```powershell
node -e "const y=require('fs').readFileSync('render.yaml','utf8'); if(!y.includes('family-tree-api')||!y.includes('family-tree-web')){process.exit(1)}; console.log('render.yaml present, both services named')"
```
Expected: prints the confirmation line. (Full schema validation happens on Render at deploy.)

- [ ] **Step 5: Commit**

```bash
git add render.yaml server/package.json
git commit -m "chore: Render blueprint + prisma:deploy script for free hosting"
```

---

## Task 10: Docs — CLAUDE.md updates

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the format + endpoints under the "Tree assembly" section**

In `CLAUDE.md`, in the `### Tree assembly` section, after the two existing
endpoint bullets (`GET .../people` and `GET .../tree`), add:

```markdown
- `GET /api/trees/:treeId/export` — returns the tree as a single camelCase JSON
  document `{ formatVersion: 1, tree: { name }, people: [...] }` where `people`
  is the nested form (each node has a `children` array). Sent as a file download.
- `POST /api/trees/:treeId/import` — accepts that same document and **destructively
  replaces** the tree's people in one transaction (BFS insert, parent before child),
  preserving the ids in the file and renaming the tree to `tree.name`. Rejects
  documents with duplicate ids (400) without touching the tree.

The export/import document is the **canonical interchange format** (camelCase). The
shared logic lives in `server/src/lib/treeIO.ts` and is reused by the `import-json`
CLI. `legacy/family_tree.json` is stored in this camelCase shape.
```

- [ ] **Step 2: Update the import-json note to reflect camelCase**

In the `### Import semantics` section, the script description mentions BFS-by-layer.
Add this sentence to that paragraph:

```markdown
The CLI and the in-app import share `server/src/lib/treeIO.ts`; `legacy/family_tree.json`
uses the canonical camelCase keys (not the original snake_case).
```

- [ ] **Step 3: Add a Deployment section**

At the end of `CLAUDE.md`, add:

```markdown
## Deployment (free tier)

The app deploys to **Render** (frontend static site + Express web service) with a
**Neon** Postgres database — chosen because Neon's free Postgres persists data
through idle (Render's free Postgres expires after 30 days). See
`docs/superpowers/specs/2026-05-27-deploy-and-json-export-import-design.md`.

- `render.yaml` (repo root) defines both services. Pushes to `main` redeploy.
- Set on the **web service**: `DATABASE_URL` (Neon string with `?sslmode=require`),
  `CLIENT_ORIGIN` (the static site URL). `JWT_SECRET` is auto-generated; `PORT` is set.
- Set on the **static site**: `VITE_API_URL` (the web service URL). Baked in at build.
- The web service runs `prisma migrate deploy` on each release (`pnpm prisma:deploy`).
- Seed a fresh DB by running `create-superadmin` then `import-json` against the Neon
  `DATABASE_URL` (superadmin must exist before migrate on a brand-new DB).
- **Backup:** use the in-app Export (download JSON) as the primary backup; `pg_dump`
  against the Neon URL is the whole-DB fallback.
- The free web service sleeps after 15 min idle (~30–50s cold start on next request).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document export/import format and Render+Neon deployment"
```

---

## Final verification (after all tasks)

- [ ] `pnpm build` at the repo root exits 0 (both workspaces typecheck + build).
- [ ] Full local round-trip from Task 8 Step 7 passes (export → import → identical tree).
- [ ] Atomic-rollback check from Task 4 Step 3 passes (duplicate-id import leaves tree intact).
- [ ] `legacy/family_tree.json` has camelCase keys and `import-json` seeds a tree from it.
- [ ] `render.yaml` exists with both services; `client/.env.example` documents `VITE_API_URL`.

Note: actual Render+Neon provisioning (creating the Neon DB, connecting the Render
blueprint, setting dashboard env vars) is a manual hosting step done in the browser —
out of scope for code changes here, but documented in CLAUDE.md and the spec.
