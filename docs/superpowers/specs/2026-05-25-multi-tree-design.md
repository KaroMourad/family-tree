# Multi-tree support: select and create family trees

**Date:** 2026-05-25
**Status:** Design approved; ready for implementation plan

## Problem

The app stores exactly one family tree as a flat `Person` table. Users have no way to:

- Maintain more than one family tree
- Keep their tree private from other users
- Switch between trees in the UI

The existing role model (`viewer` / `admin`) treats the database as a single shared workspace where admins edit and everyone (including anonymous visitors) reads. We need to model "tree" as a top-level entity owned by a specific user, with a god-mode role that can override ownership.

## Goals

- A logged-in user can create any number of trees and is the owner of each.
- A tree is private: only its owner and any super-admin can read or write it.
- Users select which tree to work on from a landing page; URLs encode `treeId` so views and editor links are bookmarkable.
- The existing 108-person tree (`legacy/family_tree.json` import) is preserved and assigned to a super-admin owner on migration.

## Non-goals

- Inviting other users as co-editors or co-viewers of a tree. Sharing is strictly owner + super-admin. Multi-user collaboration is out of scope and intentionally deferred (see "Future" below).
- Public/anonymous viewing of any tree. After this change, viewing requires login.
- Per-tree custom themes, settings, or default views. A tree has a name and an owner; nothing else.
- A test suite. The project has no tests; verification is manual via a checklist (see "Verification").

## Data model

### `User`

- `role` column: default changes from `"viewer"` to `"user"`. Allowed values: `"user" | "superadmin"`.
- Existing rows: `role = "admin"` → `"superadmin"`; `role = "viewer"` → `"user"`. The migration runs these `UPDATE`s.
- `pnpm create-admin` is renamed to `pnpm create-superadmin`; it writes `role: "superadmin"` and remains idempotent (sets the role and resets password for existing users).

### `Tree` (new)

```prisma
model Tree {
  id        String   @id @default(cuid())
  name      String
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  people    Person[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
}
```

`onDelete: Cascade` on the owner relation means deleting a `User` removes their trees (and via `Person.treeId` cascade, all their people). This is correct under the private-by-default policy: if the owner is gone, nobody else has access anyway.

### `Person`

- Add `treeId String` foreign key referencing `Tree.id`, with `onDelete: Cascade`. Index on `treeId`.
- Drop `@id` on `Person.id`. Add composite primary key `@@id([treeId, id])`. Result: the existing 5-character base36 ids stay valid and remain unique within a tree, but the same id can recur across different trees with no collision.
- `parentId` keeps `onDelete: SetNull` (children of a deleted person become roots within the same tree).

## API surface

### New `/api/trees` router

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `GET` | `/api/trees` | `requireAuth` | List trees visible to the caller. `role=user`: only `ownerId = me`. `role=superadmin`: all trees. Response: `[{id, name, ownerId, peopleCount, createdAt, updatedAt}]`. |
| `POST` | `/api/trees` | `requireAuth` | Create a tree. Body: `{ name: string (1..100 chars) }`. Sets `ownerId = req.user.id`. Returns the created tree. |
| `GET` | `/api/trees/:treeId` | `requireTreeAccess` | Tree metadata (same shape as list-row). |
| `PUT` | `/api/trees/:treeId` | `requireTreeAccess` | Rename. Body: `{ name }`. |
| `DELETE` | `/api/trees/:treeId` | `requireTreeAccess` | Delete the tree; cascades to all its people. |

### Tree-scoped people / render routes

The existing top-level `/api/people` and `/api/tree` mounts are **removed**. No backwards-compatibility shims (pre-launch).

| Method | Path | Auth | Replaces |
|---|---|---|---|
| `GET` | `/api/trees/:treeId/people` | `requireTreeAccess` | `GET /api/people` |
| `GET` | `/api/trees/:treeId/people/:id` | `requireTreeAccess` | `GET /api/people/:id` |
| `POST` | `/api/trees/:treeId/people` | `requireTreeAccess` | `POST /api/people` |
| `PUT` | `/api/trees/:treeId/people/:id` | `requireTreeAccess` | `PUT /api/people/:id` |
| `DELETE` | `/api/trees/:treeId/people/:id` | `requireTreeAccess` | `DELETE /api/people/:id` |
| `GET` | `/api/trees/:treeId/tree` | `requireTreeAccess` | `GET /api/tree` |

### `requireTreeAccess` middleware

Added to `server/src/auth.ts`. The previous `requireAdmin` is removed.

1. If no `req.user`: respond `401 { error: "Unauthorized" }`.
2. Load `tree = prisma.tree.findUnique({ where: { id: req.params.treeId } })`.
3. If no tree, OR `tree.ownerId !== req.user.id` AND `req.user.role !== 'superadmin'`: respond `404 { error: "Tree not found" }`. (Wrong-owner returns 404, not 403, to avoid leaking existence. Cuids aren't enumerable in practice, so this is mostly hygiene.)
4. Attach `req.tree = tree` and call `next()`.

Both reads and writes use the same middleware. The access model is binary: if you can see the tree, you can edit it. There is no per-tree "viewer" role.

### Person-id collisions

`randomId()` in `server/src/routes/people.ts` currently checks global uniqueness:

```ts
while (await prisma.person.findUnique({ where: { id } })) { id = randomId(); }
```

Becomes per-tree:

```ts
while (await prisma.person.findUnique({ where: { treeId_id: { treeId, id } } })) { id = randomId(); }
```

### Auth & register

- `POST /api/auth/register` keeps current behavior but the default role for new accounts becomes `"user"` (was `"viewer"`).
- `POST /api/auth/login` is unchanged.

## Client routing & state

### Routes (`client/src/App.tsx`)

```
/                              → TreeList         (redirects to /login if anonymous)
/login                         → Login            (unchanged)
/register                      → Register         (unchanged; creates a 'user')
/tree/:treeId                  → Chooser          (existing "choose a view" page, scoped to this tree)
/tree/:treeId/list             → ListView
/tree/:treeId/chart            → ChartView
/tree/:treeId/illustrated      → IllustratedView
/tree/:treeId/compact          → CompactView
/tree/:treeId/editor           → Editor           (no longer admin-only; gated by tree access)
*                              → redirect to /
```

### Route guards

- `AdminRoute` (current implementation in `App.tsx`) is removed.
- `RequireAuth` wraps every `/tree/...` route. If `user` is null, redirect to `/login?next=<encoded-path>`. After successful login, redirect back to `next`.
- `TreeAccessBoundary` is a layout component inside each `/tree/:treeId/...` route. It fetches `GET /api/trees/:treeId` on mount and provides the tree via React context. On 200 it renders children; on 401 it forwards to login; on 404 it renders an inline "Tree not found or you don't have access" with a "← Back to all trees" link.

### Hooks

1. **`useTreeList()` (new)** — fetches `/api/trees`. Used only by the `TreeList` page.
2. **`useTree(treeId)` (modified, `client/src/hooks/useTree.ts`)** — takes a `treeId` parameter and calls `/api/trees/:treeId/tree`. The five viewer pages obtain `treeId` from `useParams()` and pass it in.
3. **Editor data calls** — change every `/api/people[...]` call in `Editor.tsx` to `/api/trees/${treeId}/people[...]`. `treeId` from `useParams()`.

### Pages

**`TreeList`** (new, replaces `Chooser` at `/`):

- Header with "Your Trees", logged-in user info, logout, and `+ New Tree` button.
- One card per tree: name, owner email (only visually distinct when a super-admin sees a tree they don't own), member count, last-updated timestamp.
- Empty state: "You don't have any trees yet — [Create your first tree]".
- Clicking a card navigates to `/tree/:treeId` (the per-tree chooser).
- `+ New Tree` opens a small inline form (single field: name). On `POST /api/trees` success, navigate to `/tree/:newTreeId/editor` so the user can immediately add the first person.

**`Chooser` (existing, now scoped to a tree at `/tree/:treeId`):**

- Reuses current layout from `client/src/pages/Chooser.tsx`.
- The five view cards link to `/tree/${treeId}/list`, `/chart`, etc.
- Footer member count comes from this tree only (via the existing `useTree(treeId)` hook).
- A small "← All trees" link in the top bar (next to the user/logout info).
- The Editor card no longer shows the "Admin" tag — everyone with tree access can edit.

## Migration

Single Prisma migration (`pnpm prisma:migrate`) named e.g. `add-multi-tree`. Steps inside one `.sql` file:

1. Create `Tree` table.
2. Add `Person.treeId` as nullable column (no FK constraint yet).
3. Data backfill (raw SQL):
   - `UPDATE "User" SET role = 'superadmin' WHERE role = 'admin';`
   - `UPDATE "User" SET role = 'user' WHERE role = 'viewer';`
   - Pick first user with `role = 'superadmin'` ordered by `createdAt ASC` (call it `$ownerId`). If none exists, the migration aborts with: `RAISE EXCEPTION 'No superadmin user exists. Run pnpm create-superadmin before migrating.'`
   - Generate a tree id (`gen_random_uuid()::text` is fine — Prisma's `cuid()` default applies only to runtime inserts, and the column is just a `String`). Insert: `INSERT INTO "Tree" (id, name, "ownerId", "createdAt", "updatedAt") VALUES ($treeId, 'Armenian Family Tree', $ownerId, now(), now())`.
   - `UPDATE "Person" SET "treeId" = $treeId;`
4. Tighten constraints:
   - `ALTER TABLE "Person" ALTER COLUMN "treeId" SET NOT NULL;`
   - Add FK `Person.treeId → Tree.id ON DELETE CASCADE`.
   - Drop primary key on `Person.id`, add composite primary key `("treeId", "id")`.
   - Create index on `Person.treeId`.

**Pre-migration requirement:** at least one super-admin user must exist before running the migration. Practically: `pnpm create-superadmin you@example.com password` first, then `pnpm prisma:migrate`.

**Rollback:** there is no automated rollback. For local dev, `docker compose down -v` wipes the volume; restore by re-running migrations and `pnpm import-json --owner <email>`. For any later production deployment, take a `pg_dump` first.

## Scripts

- **`pnpm create-superadmin <email> <password>`** — renamed from `create-admin`. Idempotent. Writes `role: "superadmin"`.
- **`pnpm import-json`** — now requires a destination tree. Two accepted forms:
  - `pnpm import-json --tree <treeId>` → import into an existing tree (destructive within that tree's people only; does not touch other trees).
  - `pnpm import-json --owner <email> --name "<tree name>"` → create a new tree with that name owned by that user, and import into it. Both flags required in this form.
  - With no flag, the script errors out with usage instructions. There is no implicit destination.

## Error handling

| Condition | Response |
|---|---|
| Missing/invalid token on a protected route | `401 { error: "Unauthorized" }` (client clears token via existing `api()` helper) |
| Authenticated, tree doesn't exist OR not the owner and not superadmin | `404 { error: "Tree not found" }` |
| Validation failure on body | `400 { error: <zod flatten> }` (matches existing pattern) |
| Empty tree | `GET /api/trees/:treeId/tree` returns `[]`. Viewer pages render "This tree is empty — open the editor to add people." |
| Delete tree | UI requires typed confirmation (user types the tree's name) before issuing `DELETE /api/trees/:treeId`. |

## Verification

There is no test suite. Verify manually after implementation:

1. Sign up a new user → land on `/` showing TreeList with empty state.
2. Click "Create your first tree" → enter a name → land on `/tree/:newTreeId/editor` for the new (empty) tree.
3. Add a few people in the editor → all five view routes (`/list`, `/chart`, `/illustrated`, `/compact`, `/editor` under `/tree/:treeId/`) render correctly.
4. Log out, register a second user, log in → see only the second user's (empty) tree list. Visiting `/tree/<first-user-tree-id>` shows the "not found / no access" boundary.
5. Run `pnpm create-superadmin <second-user-email> <password>` → log in as that user → TreeList shows both users' trees; can open and edit either.
6. Click "Delete tree", type the tree name in the confirm prompt → tree and its people are removed.
7. After running the migration on a database that already has the 108-person tree imported: log in as the super-admin assigned during migration, browse to `/tree/<armenian-tree-id>/chart`, confirm all 108 people render in the chart, list, illustrated, and compact views.

## Future (out of scope)

- **Sharing.** Add a `TreeMember` join table `(treeId, userId, role: 'editor' | 'viewer')` and switch `requireTreeAccess` to check membership rather than ownership. The migration from this design to that one is additive (create table, treat current `ownerId` as an implicit owner-tier membership) — no schema break.
- **Public read links.** Per-tree share tokens for unauthenticated read-only viewing.
- **Per-tree settings.** Default view, theme, custom labels.
- **Transferring ownership.** Move a tree to another user without re-creating it.
