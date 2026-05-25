# Family Tree

Armenian family tree app — **React + TypeScript** frontend, **Express + Prisma** backend, **PostgreSQL** storage, self-hosted JWT auth.

## Stack

- **Client** ([client/](client/)): Vite + React 18 + TypeScript + React Router + D3
- **Server** ([server/](server/)): Express + Prisma + PostgreSQL + zod + bcryptjs + jsonwebtoken
- **Auth**: own `users` table, bcrypt-hashed passwords, HS256 JWTs (30-day TTL) stored in `localStorage`
- **Monorepo**: pnpm workspaces

## Layout

```
family-tree/
├── client/             React app (5 views + editor)
├── server/             Express API + Prisma schema + import & admin scripts
├── legacy/             Original static views + Python build scripts + family_tree.json
├── docker-compose.yml  Local Postgres
├── pnpm-workspace.yaml
└── package.json        Workspace root
```

## Setup

### 1. Install dependencies

```sh
pnpm install
```

### 2. Start Postgres

```sh
docker compose up -d
```

This runs Postgres 16 on `localhost:5432` by default (user/password/db all `family_tree`).

If another Postgres instance is already on port 5432, override the port in the repo-root `.env`:

```
POSTGRES_PORT=5433
```

Docker Compose reads this automatically.

### 3. Server env

```sh
cp server/.env.example server/.env
```

Update `DATABASE_URL` if you set a custom `POSTGRES_PORT` above. Generate a real `JWT_SECRET`:

```sh
openssl rand -base64 48
```

Paste it into `server/.env`.

### 4. Create the first super-admin

```sh
pnpm create-superadmin you@example.com your-password
```

Idempotent — re-running updates the role to superadmin and resets the password. This step **must be done before running migrations** on a fresh database; the migration aborts if no superadmin exists.

### 5. Run migrations + generate client

```sh
pnpm prisma:migrate
```

(First run: enter a name like `init` when prompted.)

### 6. Import existing JSON data (one-shot seed)

```sh
pnpm import-json --owner you@example.com --name "Armenian Family Tree"
```

Reads `legacy/family_tree.json` and imports ~108 people into a new tree with the given name and owner. Alternatively, import into an existing tree:

```sh
pnpm import-json --tree <treeId>
```

The wipe is scoped to the target tree only; other trees are untouched.

### 7. Start dev servers

```sh
pnpm dev
```

- API: http://localhost:4000
- Web: http://localhost:5173

The Vite dev server proxies `/api/*` to Express, so the client uses `/api/...` URLs.

## Auth

- Sign up at `/register` (email + password, min 6 chars). New accounts are `user`.
- Promote someone to superadmin by running `pnpm create-superadmin <their-email> <new-password>` on the server.
- All viewing and editing requires login. Owning a tree grants full read/write access; superadmins can access any tree.
- Only the owner of a tree or a superadmin can edit it (via `/tree/:treeId/editor` and `POST/PUT/DELETE /api/trees/:treeId/people`).

The browser stores the JWT in `localStorage` under `ft.token`. Logging out just clears that key.

## API

| Method | Path                       | Auth   | Purpose                                |
|--------|----------------------------|--------|----------------------------------------|
| POST   | `/api/auth/register`       | —      | Create account, returns `{token, user}` |
| POST   | `/api/auth/login`          | —      | Sign in, returns `{token, user}`      |
| GET    | `/api/me`                  | Bearer | Returns current user                   |
| GET    | `/api/trees`               | Bearer | List trees visible to caller           |
| POST   | `/api/trees`               | Bearer | Create a new tree                      |
| GET    | `/api/trees/:treeId`       | Bearer | Tree metadata                          |
| PUT    | `/api/trees/:treeId`       | Bearer | Rename tree                            |
| DELETE | `/api/trees/:treeId`       | Bearer | Delete tree (cascades to people)       |
| GET    | `/api/trees/:treeId/people` | Bearer | Flat list, ordered by parent          |
| GET    | `/api/trees/:treeId/people/:id` | Bearer | One person + direct children       |
| POST   | `/api/trees/:treeId/people` | Bearer | Create person                          |
| PUT    | `/api/trees/:treeId/people/:id` | Bearer | Update person                      |
| DELETE | `/api/trees/:treeId/people/:id` | Bearer | Delete person (children become roots) |
| GET    | `/api/trees/:treeId/tree`   | Bearer | Nested tree (single root or array)    |

## Views

| Route                           | Description                                |
|---------------------------------|--------------------------------------------|
| `/`                             | TreeList (list of user's trees)            |
| `/login`                        | Login form                                 |
| `/register`                     | Sign-up form                               |
| `/tree/:treeId`                 | Chooser (pick a view for this tree)        |
| `/tree/:treeId/list`            | Indented expandable list                   |
| `/tree/:treeId/chart`           | Top-down/horizontal genealogical chart     |
| `/tree/:treeId/illustrated`     | Stylized fractal tree                      |
| `/tree/:treeId/compact`         | Compact illustrated layout                 |
| `/tree/:treeId/editor`          | CRUD UI (owner or superadmin only)         |

## Production build

```sh
pnpm build
```

Outputs to `client/dist/` (static) and `server/dist/` (Node). Serve `client/dist` from any static host and run `node server/dist/index.js` for the API.

When moving off local Postgres, point `DATABASE_URL` at any managed Postgres (Neon, Railway, Fly, RDS) — no other code changes needed.

## Legacy files

The original `index.html`, `family_*.html`, `build_*.py`, and `family_tree.json` live in [legacy/](legacy/) for reference and as the source for the one-shot import. They are no longer the source of truth — the Postgres database is.
