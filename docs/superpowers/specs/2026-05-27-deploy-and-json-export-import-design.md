# Design: Make the family tree app shareable — deploy + JSON export/import

**Date:** 2026-05-27
**Status:** Approved (design); pending spec review

## Goal

Make the app usable beyond `localhost`: host the frontend, backend, and database on
free infrastructure that keeps the family-tree data persistent, and add in-app JSON
export/import so a tree can be downloaded and restored (doubling as the primary backup
mechanism).

## Constraints (from brainstorming)

- **Cost:** truly $0, simplest path. Cold-start latency is acceptable.
- **Usage:** a few family members, occasional low-traffic browsing.
- **Data safety:** the tree data must persist and be recoverable. The free DB must not
  auto-delete after inactivity, and there must be an easy backup/export path.

## Hosting research (decisive findings)

- **Render free Postgres expires 30 days after creation, then is deleted** → disqualified
  as our database host given the data-safety requirement.
  (https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90)
- **Neon free Postgres** scales compute to zero after ~5 min idle, but **data is never
  deleted for inactivity** — storage persists. 0.5 GB free, ample for this app.
  (https://neon.com/docs/introduction/scale-to-zero)
- **Render free web service** runs a long-running Express server unchanged; sleeps after
  15 min idle (~30–50s cold start), 750 instance-hours/month. (https://render.com/docs/free)
- **Render static site** serves the built Vite SPA from a CDN, no sleep, free.
- **Vercel** (Approach B) runs backends as serverless functions (10s cap, awkward fit for
  this Express app) and forbids commercial use on the free tier. **Fly.io** (Approach C)
  moved to a usage-based/trial model in 2026 (not truly always-free, requires a card).

**Chosen: Approach A — Render (static site + web service) + Neon (Postgres).** It honors
all three constraints with minimal code change: Express stays Express, Prisma stays Prisma.

## Section 1 — Architecture & topology

```
[Browser]
   │  loads SPA from
   ▼
Render Static Site  ──(fetch https://api.../api/*)──►  Render Web Service (Express)
 (client/dist, CDN, no sleep)                                 │ Prisma
                                                              ▼
                                                      Neon Postgres (persistent)
```

- **Render Static Site** — builds `client/`, serves `client/dist`. Free, CDN, no sleep.
- **Render Web Service** — runs the existing Express server (`node dist/index.js`).
  Sleeps after 15 min idle; ~30–50s cold start on first request. Acceptable per constraints.
- **Neon Postgres** — the database. Compute scales to zero when idle; data persists.

Wired together purely by environment variables (no hardcoded URLs).

## Section 2 — Required code changes (deployment)

1. **Client API base URL.** `client/src/api/client.ts` currently calls `/api` and relies on
   the Vite dev proxy (`client/vite.config.ts`). In production the API is on a different
   origin, so the proxy doesn't apply. Change the fetch to use a build-time base URL,
   defaulting to empty string so local dev keeps using the proxy:
   ```ts
   const API_BASE = import.meta.env.VITE_API_URL ?? "";
   const res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });
   ```
   - Local dev: `VITE_API_URL` unset → `fetch("/api/...")` → Vite proxy → `:4000`. Unchanged.
   - Production: `VITE_API_URL = https://<web-service>.onrender.com` baked into the static build.
2. **CORS.** `server/src/index.ts` already uses `cors({ origin: env.clientOrigin })` and
   `env.ts` reads `CLIENT_ORIGIN`. No code change — set `CLIENT_ORIGIN` to the static
   site's URL in Render.
3. **Health check.** `/api/health` already exists; Render uses it for readiness. No change.

No changes to routes, auth, JWT, or the Prisma schema for deployment.

## Section 3 — Config, deploy & data seeding

- **`render.yaml`** (blueprint) at repo root declaring the static site + web service.
  Deploys trigger on `git push` to `main`.
- **Environment variables:**
  - Web service: `DATABASE_URL` (Neon connection string, `?sslmode=require`), `JWT_SECRET`,
    `CLIENT_ORIGIN` (static site URL), `PORT` (Render-provided).
  - Static site build: `VITE_API_URL` (web service URL).
- **Schema migration:** web service runs `prisma migrate deploy` on release to apply the
  existing migrations (`server/prisma/migrations/*`) to Neon.
- **First superadmin + initial data:** run `create-superadmin` then `import-json` as one-off
  jobs against the Neon `DATABASE_URL`. Per CLAUDE.md, superadmin must exist before migrate
  on a fresh DB — sequence accordingly when seeding.
- **Backups (data-safety requirement):** primary path is the in-app Export (Section 4);
  secondary is a documented `pg_dump` against the Neon URL. `legacy/family_tree.json` +
  `import-json` remains a third recovery path.

## Section 4 — In-app Export / Import (JSON)

### Canonical format — app-native camelCase, nested

One JSON document per tree. Keys match what the API already returns (camelCase), so export
is a near-direct serialization of `GET /:treeId/tree`.

```json
{
  "formatVersion": 1,
  "tree": { "name": "Armenian Family Tree" },
  "people": [
    {
      "id": "AB12X",
      "name": "...",
      "surnameNow": "...",
      "parentId": null,
      "sortOrder": 0,
      "children": [ /* nested people, same shape */ ]
    }
  ]
}
```

The legacy `import-json` CLI and `legacy/family_tree.json` are migrated to this same
camelCase shape so there is exactly one format in the codebase, not two. (The current CLI
uses snake_case keys — `surname_now`, `father_id`, etc. — these are renamed to camelCase.)

### Export (editor)

- **`GET /api/trees/:treeId/export`** (behind `requireTreeAccess`) → returns the document
  above with `Content-Disposition: attachment; filename="<tree-name>.json"`.
- Editor **"Export JSON"** button downloads via the authenticated `api()` client (so the
  `Authorization` header is attached), then triggers a client-side file save.

### Import (editor, replaces current tree)

- **`POST /api/trees/:treeId/import`** (behind `requireTreeAccess`) — body is the JSON
  document.
- **Validation:** Zod schema mirroring `personInputSchema` plus a recursive `children`
  array and the `tree`/`formatVersion` envelope. Rejects duplicate `id`s within the file.
- **IDs preserved** from the file (true export→import round-trip). Parent/partner/
  father/mother references therefore stay valid.
- **Atomic replace:** inside one `prisma.$transaction` — delete all `Person` rows for the
  tree, then BFS-insert by layer (parent-before-child, same ordering as the CLI) so FKs
  resolve. A bad file aborts the whole transaction; the tree is never left half-replaced.
- Import also updates `tree.name` from the `tree.name` field in the document.

### UI

Two buttons in the editor:
- **"Export JSON"** — direct download.
- **"Import JSON"** — file picker → confirmation dialog *"This will replace all N people in
  this tree"* → `POST` → on success, TanStack Query invalidates the tree's queries so the
  view refreshes.

### Backup story

In-app Export is the primary backup for the deployed app: download the JSON anytime,
restore by importing. CLI `pg_dump` becomes a secondary whole-DB option.

## Out of scope (YAGNI)

- No custom domain (use the Render-provided URLs).
- No always-on/no-sleep tier; cold start is accepted.
- No merge-on-import; import is full-replace only.
- No per-tree sharing/permissions changes; access stays binary per tree.
- No automated scheduled backups; manual export covers it.

## Testing

- There is no test suite, linter, or formatter wired up in this repo (per CLAUDE.md). Do not
  invent test commands.
- **Manual verification:** local round-trip — export a tree, import it into a fresh tree,
  confirm people/structure match; confirm the confirmation dialog and atomic replace
  (feed an invalid file and verify the tree is untouched). After deploy, verify the static
  site loads, login works, a tree renders (post cold-start), and export/import work against
  Neon.
