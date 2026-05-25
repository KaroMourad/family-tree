# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is a pnpm workspaces monorepo — always use `pnpm` (never `npm`/`yarn`). Root scripts forward into `client/` and `server/` via `pnpm --filter`.

```sh
# install everything
pnpm install

# Postgres 16 (port configurable via POSTGRES_PORT env var; defaults to 5432)
# If another local Postgres is on 5432, set POSTGRES_PORT=5433 in the repo-root .env
docker compose up -d

# create or promote a superadmin (idempotent — also resets that user's password)
# MUST be run before pnpm prisma:migrate on a fresh database
pnpm create-superadmin you@example.com your-password

# run Prisma migrations + regenerate client (also: pnpm prisma:studio)
pnpm prisma:migrate

# one-shot seed from legacy/family_tree.json into a tree
# Either form: import into an existing tree OR create a new tree
pnpm import-json --tree <treeId>
pnpm import-json --owner you@example.com --name "Armenian Family Tree"

# dev: API on :4000 and Vite on :5173 concurrently
pnpm dev

# production build → client/dist + server/dist
pnpm build
```

There is no test suite, no linter, and no formatter wired up. Don't invent test commands.

The server needs `server/.env` with `DATABASE_URL` and `JWT_SECRET` set (see `server/.env.example`); both are required at startup (`server/src/env.ts` throws if missing). The `DATABASE_URL` should match the Postgres port set by `POSTGRES_PORT` (default 5432; if overridden in `docker-compose.yml` or locally, adjust the connection string accordingly).

## Architecture

Three trees of files coexist at the repo root:

- **`client/`** — Vite + React 18 + TypeScript SPA. `/login` and `/register` are anonymous; `/` is a TreeList page (logged-in only). Viewer routes and editor are nested under `/tree/:treeId/...` and require auth via `RequireAuth` + `TreeAccessBoundary`. State for a tree lives in `client/src/hooks/useTree.ts`.
- **`server/`** — Express + Prisma + Postgres. Three domain models in `server/prisma/schema.prisma`: `User` (auth), `Tree` (a workspace, has an owner), and `Person` (a tree member, scoped to one tree via `treeId`). All routes mount under `/api/*` (see `server/src/index.ts`).
- **`legacy/`** — the original static HTML viewers, the Python build scripts that produced them, and `family_tree.json`. Kept for reference and as the **source for the one-shot import only**. The Postgres DB is the source of truth — do not edit `legacy/family_tree.json` and expect it to flow into the app.

### Client ↔ server wiring

The Vite dev server proxies `/api/*` → `http://localhost:4000` (`client/vite.config.ts`), so the client always uses relative `/api/...` URLs via `client/src/api/client.ts`. That `api()` helper auto-attaches `Authorization: Bearer <token>` from `localStorage["ft.token"]` and clears the token on any 401.

### Auth model

Self-hosted JWT, no external IdP. `server/src/auth.ts` exports middlewares including:

- `optionalAuth` is mounted globally — it decodes the bearer token if present and attaches `req.user`, but never rejects. Anonymous requests just pass through with no `req.user`.
- `requireAuth` is applied to protected routes. Rejects with 401 if no token.
- `requireTreeAccess` gates per-tree routes — it checks that `req.user` exists, loads the tree, and verifies ownership or superadmin role. Returns 404 (not 403, to avoid leaking existence) if the tree is not found or access is denied.

Tokens are HS256, 30-day TTL, signed with `JWT_SECRET`. New signups via `/api/auth/register` default to role `"user"`; `"superadmin"` users are created only by running `pnpm create-superadmin` server-side. Both reads and writes on a tree require `requireTreeAccess` — there is no separate reader role; access is binary per tree.

### Tree assembly

The `Person` table is flat with a self-referential `parentId` FK and a per-sibling `sortOrder`. Scoped by `treeId`. Endpoints are nested under `/api/trees/:treeId`:

- `GET /api/trees/:treeId/people` — flat list of people in the tree, ordered by `(parentId, sortOrder)`. The editor uses this.
- `GET /api/trees/:treeId/tree` — server assembles a nested tree in one pass (`server/src/routes/tree.ts`) and returns a single object if there's exactly one root, otherwise an array. Viewer routes use this.

`Person.id` is a custom 5-char base36 string, **not** a CUID — `server/src/routes/people.ts` generates it on POST and retries on collision **per tree** (composite uniqueness check `(treeId, id)`). When importing from `legacy/family_tree.json`, the original string IDs are preserved verbatim.

### Import semantics (important if you re-seed)

`server/scripts/import-json.ts` does **destructive** re-imports into a specific tree: it deletes every `Person` row for that tree only, then inserts BFS-by-layer so that parent FKs always resolve before children. Other trees are untouched. It does not touch the `User` or `Tree` tables. Two invocation forms:

- `pnpm import-json --tree <treeId>` — import into an existing tree.
- `pnpm import-json --owner <email> --name "<tree name>"` — create a new tree with that owner and name, then import into it.

Never run `pnpm import-json` against a tree that has unsaved manual edits.

When deleting a person via `DELETE /api/trees/:treeId/people/:id`, Prisma's `onDelete: SetNull` on the `parent` relation means that person's children become roots within that tree (their `parentId` is nulled, not cascade-deleted).

## User preferences

Per stored memory: prefer `pnpm` over `npm`/`yarn` across all projects; follow the existing lockfile when one exists. This repo's lockfile is `pnpm-lock.yaml`.
