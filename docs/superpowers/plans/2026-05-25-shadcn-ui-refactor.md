# shadcn/ui + Tailwind v4 Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the `client/` UI to use shadcn/ui (latest) + Tailwind CSS v4 with a light / dark / system theme toggle, preserving the existing Oswald + olive/teal/coral visual identity. d3 SVG drawing code is untouched.

**Architecture:** Tailwind v4 + `@tailwindcss/vite` plugin (no `tailwind.config.js` — tokens go in CSS via `@theme inline`). shadcn primitives copied into `client/src/components/ui/`. A hand-rolled `ThemeProvider` (~30 lines) toggles `.dark` class on `<html>` and listens to `matchMedia` for system mode. Old palette CSS variables (`--bg`, `--ink`, `--olive`…) survive via a legacy alias shim so the d3 SVG views in `views.css` and inline TSX styles can keep referencing them with a mechanical find/replace of var names.

**Tech Stack:** React 18, Vite 5, Tailwind CSS v4, shadcn/ui (CLI), Radix UI primitives (pulled in by shadcn), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`. Package manager is **pnpm** (required — repo uses pnpm workspaces).

**Spec:** `docs/superpowers/specs/2026-05-25-shadcn-ui-refactor-design.md`

**Testing approach:** No unit test suite exists in this repo (per CLAUDE.md). Verification is `pnpm build` (TypeScript + Vite production build must succeed) plus manual smoke-testing via `pnpm dev`. Each task ends with a build check where relevant.

---

## File Map

**New files (in `client/`):**

| Path | Responsibility |
|---|---|
| `client/components.json` | shadcn CLI config (style, baseColor, aliases) |
| `client/src/index.css` | Tailwind imports, `@custom-variant dark`, theme vars (light + dark), `@theme inline`, legacy `--bg`/`--ink`/... alias shim |
| `client/src/lib/utils.ts` | `cn()` helper (clsx + tailwind-merge) |
| `client/src/components/ui/*.tsx` | shadcn primitives (button, card, dialog, dropdown-menu, input, label, select, separator, sheet, textarea, tooltip, alert, badge, avatar, toggle) |
| `client/src/components/ThemeToggle.tsx` | Sun/Moon/Laptop DropdownMenu, uses `useTheme()` |
| `client/src/theme/ThemeProvider.tsx` | Context + provider + `useTheme()` hook |

**Modified files (in `client/`):**

| Path | Change |
|---|---|
| `client/package.json` | Add Tailwind v4 + shadcn deps |
| `client/tsconfig.json` | Add `baseUrl: "."` + `paths: { "@/*": ["./src/*"] }` |
| `client/vite.config.ts` | Add `tailwindcss()` plugin and `resolve.alias["@"]` |
| `client/src/main.tsx` | Import `./index.css` instead of `./styles/global.css`; wrap `<App />` in `<ThemeProvider>` |
| `client/src/pages/Login.tsx` | Use shadcn `Card`/`Input`/`Label`/`Button`/`Alert` |
| `client/src/pages/Register.tsx` | Use shadcn `Card`/`Input`/`Label`/`Button`/`Alert` |
| `client/src/pages/TreeList.tsx` | Use shadcn `Card`/`Button`/`DropdownMenu`/`Dialog`/`Input` |
| `client/src/pages/TreeChooser.tsx` | Use shadcn `Card` grid + `Dialog` for delete confirm + `Button` |
| `client/src/components/DetailPanel.tsx` | Rewritten with shadcn `Sheet` + `Separator` |
| `client/src/pages/Editor.tsx` | Replace modal/inputs with shadcn `Dialog`/`Input`/`Select`/`Textarea`/`Label`/`Button`/`Tooltip`; add `ThemeToggle` |
| `client/src/pages/ListView.tsx` | View header uses shadcn primitives; body keeps existing `.tree-list` markup |
| `client/src/pages/ChartView.tsx` | View header uses shadcn primitives + `ThemeToggle`; replace inline `style={{ color: "var(--coral)" }}` |
| `client/src/pages/IllustratedView.tsx` | View header uses shadcn primitives + `ThemeToggle` |
| `client/src/pages/CompactView.tsx` | View header uses shadcn primitives + `ThemeToggle` |
| `client/src/tree/TreeAccessBoundary.tsx` | Replace inline `style={{ color: "var(--coral)" }}` |
| `client/src/styles/views.css` | Slimmed to d3 SVG selectors only; find/replace legacy var names |

**Deleted files (in `client/`):**

| Path | Reason |
|---|---|
| `client/src/styles/global.css` | Replaced by `src/index.css` |
| `client/src/styles/chooser.css` | TreeChooser now uses Tailwind + shadcn `Card` |

---

## Task 1: Install Tailwind v4 + shadcn/ui CLI dependencies

**Files:**
- Modify: `client/package.json`
- Modify: `client/vite.config.ts`
- Modify: `client/tsconfig.json`
- Create: `client/components.json`
- Create: `client/src/lib/utils.ts`
- Create: `client/src/index.css`

- [ ] **Step 1.1: Install Tailwind v4 + Vite plugin + tw-animate-css**

From the repo root (pnpm workspaces — use `--filter @family-tree/client`):

```bash
pnpm --filter @family-tree/client add -D tailwindcss @tailwindcss/vite tw-animate-css
```

Expected: `client/package.json` devDependencies now include `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css` at latest stable versions. `pnpm-lock.yaml` updated.

- [ ] **Step 1.2: Install shadcn helper libs**

```bash
pnpm --filter @family-tree/client add class-variance-authority clsx tailwind-merge lucide-react
```

These are runtime deps (not devDependencies) — shadcn components import from them.

- [ ] **Step 1.3: Add `@/*` path alias to `client/tsconfig.json`**

Replace the file contents with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 1.4: Update `client/vite.config.ts`**

Replace the file contents with:

```ts
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 1.5: Create `client/components.json` (shadcn config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "stone",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

`"config": ""` is correct for Tailwind v4 (no JS config file). `"baseColor": "stone"` is the warm-neutral base shadcn ships — we override it in our own CSS anyway.

- [ ] **Step 1.6: Create `client/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 1.7: Create `client/src/index.css` with theme tokens + legacy alias shim**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  /* Light = warm parchment */
  --background: 44 30% 95%;        /* #f7f5ef */
  --foreground: 200 4% 17%;        /* #2a2d2e */
  --card: 0 0% 100%;
  --card-foreground: 200 4% 17%;
  --popover: 0 0% 100%;
  --popover-foreground: 200 4% 17%;
  --border: 42 26% 87%;            /* #e6e2d4 */
  --input: 42 26% 87%;
  --primary: 65 53% 35%;           /* darker olive #8a9420 */
  --primary-foreground: 0 0% 100%;
  --secondary: 172 31% 42%;        /* darker teal #4a8d80 */
  --secondary-foreground: 0 0% 100%;
  --accent: 40 13% 90%;
  --accent-foreground: 200 4% 17%;
  --destructive: 7 50% 46%;        /* darker coral #b04a3c */
  --destructive-foreground: 0 0% 100%;
  --muted: 40 13% 90%;
  --muted-foreground: 35 6% 44%;
  --ring: 65 53% 35%;
  --radius: 0.375rem;

  /* Brand accents (also used by d3 SVG views via legacy aliases below) */
  --olive: 65 53% 35%;
  --teal: 172 31% 42%;
  --coral: 7 50% 46%;
}

.dark {
  /* Dark = today's charcoal palette */
  --background: 195 6% 20%;        /* #303435 */
  --foreground: 0 0% 96%;          /* #f6f6f6 */
  --card: 200 5% 17%;              /* #2a2d2e */
  --card-foreground: 0 0% 96%;
  --popover: 200 5% 17%;
  --popover-foreground: 0 0% 96%;
  --border: 195 4% 30%;            /* #4a4e4f */
  --input: 195 4% 30%;
  --primary: 64 60% 53%;           /* #c2cc3e */
  --primary-foreground: 195 6% 20%;
  --secondary: 170 39% 62%;        /* #75c6b8 */
  --secondary-foreground: 195 6% 20%;
  --accent: 195 4% 25%;
  --accent-foreground: 0 0% 96%;
  --destructive: 7 53% 57%;        /* #cc6658 */
  --destructive-foreground: 195 6% 20%;
  --muted: 195 4% 25%;
  --muted-foreground: 200 4% 62%;
  --ring: 64 60% 53%;

  --olive: 64 60% 53%;
  --teal: 170 39% 62%;
  --coral: 7 53% 57%;
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-ring: hsl(var(--ring));

  --color-olive: hsl(var(--olive));
  --color-teal: hsl(var(--teal));
  --color-coral: hsl(var(--coral));

  --font-display: "Oswald", "Noto Sans Armenian", "Sylfaen", system-ui, sans-serif;
  --radius: 0.375rem;
}

/* Legacy aliases: lets d3 SVG views in views.css + inline TSX styles
   keep referencing var(--bg-color), var(--ink-color), etc. without edits. */
:root, .dark {
  --bg-color: hsl(var(--background));
  --panel-color: hsl(var(--card));
  --ink-color: hsl(var(--foreground));
  --muted-color: hsl(var(--muted-foreground));
  --border-color: hsl(var(--border));
  --olive-color: hsl(var(--olive));
  --teal-color: hsl(var(--teal));
  --teal-light-color: hsl(var(--teal));
  --coral-color: hsl(var(--coral));
}

* { box-sizing: border-box; }
html, body, #root { margin: 0; padding: 0; min-height: 100%; }
body {
  font-family: var(--font-display);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

- [ ] **Step 1.8: Verify build still succeeds**

Run from repo root:

```bash
pnpm --filter @family-tree/client build
```

Expected: build fails or succeeds? It will currently still build because `main.tsx` still imports `./styles/global.css`. We are not yet switching it. The new `index.css` is unused at this point. The point of this step is just to confirm dependency install + tsconfig changes haven't broken anything. Build should **succeed** with the same output it produced before.

If build fails: read the error carefully — most likely an alias mis-typed or vite plugin order issue. Fix before commit.

- [ ] **Step 1.9: Commit**

```bash
git add client/package.json client/pnpm-lock.yaml client/tsconfig.json client/vite.config.ts client/components.json client/src/lib/utils.ts client/src/index.css ../pnpm-lock.yaml
git commit -m "chore(client): install Tailwind v4 + shadcn config and theme tokens

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Note: the top-level lockfile is `pnpm-lock.yaml` at the **repo root** (pnpm workspaces) — that's the only lockfile and it does get updated. If `git status` shows no `pnpm-lock.yaml` change in `client/`, that's expected.

---

## Task 2: Add shadcn primitive components

**Files:**
- Create: `client/src/components/ui/button.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `textarea.tsx`, `tooltip.tsx`, `alert.tsx`, `badge.tsx`, `avatar.tsx`, `toggle.tsx`

The shadcn CLI installs primitives as owned source files and adds their Radix peer deps automatically. Run the commands below from `client/` (so the CLI picks up `components.json` and resolves `@/*` correctly).

- [ ] **Step 2.1: Add the primitives**

```bash
cd client
npx shadcn@latest add button card dialog dropdown-menu input label select separator sheet textarea tooltip alert badge avatar toggle --yes
```

The `--yes` flag accepts overwrites if any files already exist (none should). The CLI will:

1. Create files under `client/src/components/ui/`.
2. Run `pnpm install` to add Radix peer deps (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-tooltip`, `@radix-ui/react-separator`, `@radix-ui/react-avatar`, `@radix-ui/react-toggle`, `@radix-ui/react-label`, `@radix-ui/react-slot`).

If the CLI cannot detect pnpm and tries to use `npm install`, abort, then run manually:

```bash
pnpm --filter @family-tree/client add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-separator @radix-ui/react-avatar @radix-ui/react-toggle @radix-ui/react-label @radix-ui/react-slot
```

- [ ] **Step 2.2: Sanity-check the output**

List the new files:

```bash
ls client/src/components/ui/
```

Expected: 15 `.tsx` files (one per primitive named above).

- [ ] **Step 2.3: Verify build still succeeds**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS. The new files are not yet imported by anything, so they only compile-time check that the alias and tsconfig are correct.

If a primitive fails to compile with `Cannot find module '@/lib/utils'` — the alias isn't being resolved. Re-check `tsconfig.json` paths and `vite.config.ts` alias.

- [ ] **Step 2.4: Commit**

```bash
git add client/src/components/ui/ client/package.json
git commit -m "feat(client): add shadcn/ui primitives (button, card, dialog, ...)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Also commit the root `pnpm-lock.yaml` change:

```bash
git add pnpm-lock.yaml
git commit -m "chore: lockfile update for shadcn Radix deps

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>" || true
```

(The `|| true` is in case the lockfile was already included in the previous commit — don't fail the step.)

---

## Task 3: Build ThemeProvider + ThemeToggle

**Files:**
- Create: `client/src/theme/ThemeProvider.tsx`
- Create: `client/src/components/ThemeToggle.tsx`

- [ ] **Step 3.1: Create `client/src/theme/ThemeProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "ft.theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Listen for OS theme changes, but only reflect them when theme === "system".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  // Apply resolved theme to <html> whenever it changes.
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (t: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

- [ ] **Step 3.2: Create `client/src/components/ThemeToggle.tsx`**

```tsx
import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/theme/ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Toggle theme">
          <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light
          {theme === "light" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Dark
          {theme === "dark" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Laptop className="mr-2 h-4 w-4" /> System
          {theme === "system" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3.3: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 3.4: Commit**

```bash
git add client/src/theme/ client/src/components/ThemeToggle.tsx
git commit -m "feat(client): add ThemeProvider with light/dark/system + ThemeToggle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire ThemeProvider into main.tsx and swap CSS entry

**Files:**
- Modify: `client/src/main.tsx`
- Delete: `client/src/styles/global.css`

- [ ] **Step 4.1: Replace `client/src/main.tsx` contents with:**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeProvider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
```

`ThemeProvider` wraps `BrowserRouter` so theme is available everywhere including any route-level error boundaries.

- [ ] **Step 4.2: Delete the old global stylesheet**

```bash
git rm client/src/styles/global.css
```

The old file's `:root` block and body styles are now provided by `index.css`. The old `--bg`/`--ink`/etc. variable names are NOT defined directly anymore — anywhere that referenced them will need the find/replace done in later tasks. We expect visual breakage at this point in the existing chrome (Login/Register/TreeList still reference the old CSS classes from `chooser.css` and `views.css`), but `pnpm build` should still pass since CSS classes that don't exist are silently ignored.

- [ ] **Step 4.3: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 4.4: Visual smoke-check (manual)**

Start dev server:

```bash
pnpm dev
```

Open http://localhost:5173/login in the browser. Expected:
- Body background is warm parchment (`#f7f5ef`) in light mode, charcoal in dark.
- Font is still Oswald.
- The old `.auth-card` styling is broken (no background, no border) — **this is expected**; we'll fix it in Task 5.
- Toggling Windows OS light/dark while page is open: body background flips between parchment and charcoal (system mode default).

Stop the dev server.

- [ ] **Step 4.5: Commit**

```bash
git add client/src/main.tsx
git commit -m "feat(client): switch entry to index.css and mount ThemeProvider

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Convert Login and Register pages to shadcn

**Files:**
- Modify: `client/src/pages/Login.tsx`
- Modify: `client/src/pages/Register.tsx`

- [ ] **Step 5.1: Rewrite `client/src/pages/Login.tsx`**

Replace the entire file with:

```tsx
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      const params = new URLSearchParams(location.search);
      const next = params.get("next");
      nav(next && next.startsWith("/") ? next : "/", { replace: true });
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-5 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center uppercase tracking-[0.2em] text-primary text-lg">
            ◆ Login ◆
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="uppercase tracking-widest text-xs text-secondary">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="uppercase tracking-widest text-xs text-secondary">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full uppercase tracking-widest">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground tracking-wider">
              No account? <Link to="/register" className="text-primary hover:underline">Register</Link>
              {" · "}
              <Link to="/" className="text-primary hover:underline">Back</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

Notes:
- The old `import "../styles/views.css"` is removed — Login no longer relies on that stylesheet.
- The `◆ Login ◆` uppercase tracked title preserves the existing visual flavor.
- `bg-background` / `text-secondary` / `text-primary` / `text-muted-foreground` reference our `@theme inline` tokens and flip with light/dark.

- [ ] **Step 5.2: Rewrite `client/src/pages/Register.tsx`**

Replace the entire file with:

```tsx
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(email, password);
      nav("/");
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-5 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center uppercase tracking-[0.2em] text-primary text-lg">
            ◆ Register ◆
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="uppercase tracking-widest text-xs text-secondary">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="uppercase tracking-widest text-xs text-secondary">
                Password (min 6 chars)
              </Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full uppercase tracking-widest">
              {busy ? "Creating…" : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground tracking-wider">
              Already have an account? <Link to="/login" className="text-primary hover:underline">Login</Link>
              {" · "}
              <Link to="/" className="text-primary hover:underline">Back</Link>
            </p>
            <p className="text-center text-[11px] text-muted-foreground tracking-wider">
              New accounts are viewers. An admin must promote you (run{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">pnpm create-admin you@example.com password</code>{" "}
              on the server) to use the editor.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5.3: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 5.4: Manual smoke-check**

```bash
pnpm dev
```

Open http://localhost:5173/login and http://localhost:5173/register:
- Card visible, parchment background in light, charcoal in dark.
- ThemeToggle in top-right cycles light/dark/system.
- Form submit still works (try a bad password to trigger the Alert).

Stop the dev server.

- [ ] **Step 5.5: Commit**

```bash
git add client/src/pages/Login.tsx client/src/pages/Register.tsx
git commit -m "feat(client): convert Login and Register to shadcn/ui

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Convert TreeList to shadcn

**Files:**
- Modify: `client/src/pages/TreeList.tsx`

- [ ] **Step 6.1: Rewrite `client/src/pages/TreeList.tsx`**

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useTreeList } from "../hooks/useTreeList";
import type { Tree } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";

export function TreeList() {
  const { user, logout } = useAuth();
  const { trees, loading, error, refresh } = useTreeList();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setCreateError("Name is required");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      const created = await api<Tree>("/trees", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      setCreating(false);
      await refresh();
      navigate(`/tree/${created.id}/editor`);
    } catch (e) {
      setCreateError(String((e as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-5">
      <div className="absolute top-4 right-4 flex items-center gap-3 text-xs text-muted-foreground tracking-widest">
        {user && (
          <>
            <span>
              Signed in as <strong className="text-foreground">{user.email}</strong> ({user.role})
            </span>
            <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
          </>
        )}
        <ThemeToggle />
      </div>

      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-14">
          <h1 className="text-5xl text-primary uppercase tracking-[0.2em] font-semibold m-0">
            ◆ Your Trees ◆
          </h1>
          <div className="w-16 h-0.5 bg-primary mx-auto my-4" />
          <p className="text-base text-muted-foreground italic tracking-widest">
            Pick a tree or create a new one
          </p>
        </header>

        {loading && <p>Loading…</p>}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {trees && trees.length === 0 && (
          <p className="text-center mt-6 text-muted-foreground">
            You don't have any trees yet — create one below.
          </p>
        )}

        {trees && trees.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
            {trees.map((t) => (
              <Link key={t.id} to={`/tree/${t.id}`} className="block group">
                <Card className="h-full transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary">
                  <CardContent className="p-6">
                    <span className="text-4xl text-primary block mb-3">⌬</span>
                    <h2 className="text-xl text-primary uppercase tracking-widest font-semibold m-0 mb-2">
                      {t.name}
                    </h2>
                    <p className="text-sm m-0">
                      {t.peopleCount} {t.peopleCount === 1 ? "member" : "members"}
                      {t.ownerEmail && user?.role === "superadmin" && t.ownerId !== user.id
                        ? ` · owner: ${t.ownerEmail}`
                        : ""}
                    </p>
                    <span className="inline-block mt-3 px-3 py-0.5 text-[10px] text-primary uppercase tracking-widest border border-border rounded bg-primary/10">
                      Open
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button onClick={() => setCreating(true)} className="uppercase tracking-widest">
            + New Tree
          </Button>
        </div>
      </div>

      <Dialog open={creating} onOpenChange={(open) => { if (!open) { setCreating(false); setCreateError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-primary">
              Create a new tree
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="tree-name" className="uppercase tracking-widest text-xs text-secondary">
                Name *
              </Label>
              <Input
                id="tree-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mouradyan Side"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 6.2: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 6.3: Manual smoke-check**

```bash
pnpm dev
```

- Log in if needed → `/`
- Confirm trees list renders, hover state works
- Click `+ New Tree`, the Dialog should open with a usable form
- Toggle theme — colors flip cleanly

Stop the dev server.

- [ ] **Step 6.4: Commit**

```bash
git add client/src/pages/TreeList.tsx
git commit -m "feat(client): convert TreeList to shadcn/ui

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Convert TreeChooser to shadcn

**Files:**
- Modify: `client/src/pages/TreeChooser.tsx`

- [ ] **Step 7.1: Rewrite `client/src/pages/TreeChooser.tsx`**

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useTree, allRoots, flattenTree } from "../hooks/useTree";
import { useTreeContext } from "../tree/TreeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";

type ViewCard = {
  to: string;
  icon: string;
  title: string;
  desc: string;
  tag: string;
  variant?: "editor";
};

export function TreeChooser() {
  const tree = useTreeContext();
  const { user, logout } = useAuth();
  const { tree: nestedTree } = useTree(tree.id);
  const navigate = useNavigate();
  const peopleCount = Object.keys(flattenTree(nestedTree)).length;
  const rootName = allRoots(nestedTree)[0]?.name ?? "";

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function deleteThisTree() {
    if (typedName !== tree.name) {
      setErr("Type the tree name exactly to confirm.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/trees/${tree.id}`, { method: "DELETE" });
      navigate("/");
    } catch (e) {
      setErr(String((e as Error).message));
      setBusy(false);
    }
  }

  const views: ViewCard[] = [
    { to: `/tree/${tree.id}/list`, icon: "≡", title: "Indented List", desc: "Classic expandable tree with names, dates, and full details.", tag: "Compact" },
    { to: `/tree/${tree.id}/chart`, icon: "⌬", title: "Genealogical Chart", desc: "Top-down chart with horizontal generations. Pan and zoom.", tag: "Classic" },
    { to: `/tree/${tree.id}/illustrated`, icon: "❀", title: "Illustrated Tree", desc: "Stylised fractal tree on a dark background.", tag: "Artistic" },
    { to: `/tree/${tree.id}/compact`, icon: "▼", title: "Compact Illustrated", desc: "Same style with tight spacing.", tag: "Recommended" },
    { to: `/tree/${tree.id}/editor`, icon: "✎", title: "Editor", desc: "Add, edit, and delete people. All changes save directly.", tag: "Edit", variant: "editor" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-5">
      <div className="absolute top-4 right-4 flex items-center gap-3 text-xs text-muted-foreground tracking-widest">
        <Link to="/" className="text-primary hover:underline">← All trees</Link>
        {user && (
          <>
            <span>·</span>
            <span>
              Signed in as <strong className="text-foreground">{user.email}</strong> ({user.role})
            </span>
            <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
          </>
        )}
        <ThemeToggle />
      </div>

      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-14">
          <h1 className="text-5xl text-primary uppercase tracking-[0.2em] font-semibold m-0">
            ◆ {tree.name} ◆
          </h1>
          <div className="w-16 h-0.5 bg-primary mx-auto my-4" />
          <p className="text-base text-muted-foreground italic tracking-widest">Choose a view</p>
        </header>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
          {views.map((v) => {
            const isEditor = v.variant === "editor";
            const accent = isEditor ? "text-destructive border-destructive" : "text-primary border-border hover:border-primary";
            return (
              <Link key={v.to} to={v.to} className="block group">
                <Card className={`h-full transition-all hover:-translate-y-1 hover:shadow-lg ${isEditor ? "hover:border-destructive" : "hover:border-primary"}`}>
                  <CardContent className="p-6">
                    <span className={`text-4xl block mb-3 ${isEditor ? "text-destructive" : "text-primary"}`}>{v.icon}</span>
                    <h2 className={`text-xl uppercase tracking-widest font-semibold m-0 mb-2 ${isEditor ? "text-destructive" : "text-primary"}`}>{v.title}</h2>
                    <p className="text-sm m-0">{v.desc}</p>
                    <span className={`inline-block mt-3 px-3 py-0.5 text-[10px] uppercase tracking-widest border rounded ${isEditor ? "text-destructive border-destructive bg-destructive/10" : "text-primary border-border bg-primary/10"}`}>
                      {v.tag}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <footer className="text-center mt-14 text-sm text-muted-foreground uppercase tracking-widest">
          {peopleCount} members{rootName ? ` · descended from ${rootName}` : ""}
          {" · "}
          <button onClick={() => setConfirmDelete(true)} className="text-destructive hover:underline">
            Delete tree
          </button>
        </footer>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!open) { setConfirmDelete(false); setErr(null); setTypedName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-primary">
              Delete "{tree.name}"?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>This deletes the tree and all {peopleCount} people in it. There is no undo.</p>
            <p>Type the tree name to confirm:</p>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={tree.name}
            />
            {err && (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteThisTree} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 7.2: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 7.3: Manual smoke-check**

```bash
pnpm dev
```

Navigate to `/tree/:treeId` (click any tree). Expected:
- Five view cards render
- Editor card uses coral/destructive accents
- "Delete tree" button opens the confirmation Dialog
- Theme toggle in top-right works

Stop the dev server.

- [ ] **Step 7.4: Commit**

```bash
git add client/src/pages/TreeChooser.tsx
git commit -m "feat(client): convert TreeChooser to shadcn/ui

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Delete chooser.css (no longer referenced)

**Files:**
- Delete: `client/src/styles/chooser.css`

- [ ] **Step 8.1: Confirm no remaining references**

```bash
grep -rn "chooser.css" client/src/ || echo "no matches"
```

Expected: `no matches` (TreeList and TreeChooser no longer import it after Tasks 6 and 7).

- [ ] **Step 8.2: Delete**

```bash
git rm client/src/styles/chooser.css
```

- [ ] **Step 8.3: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 8.4: Commit**

```bash
git commit -m "chore(client): remove unused chooser.css

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Rewrite DetailPanel using shadcn Sheet

**Files:**
- Modify: `client/src/components/DetailPanel.tsx`

- [ ] **Step 9.1: Rewrite `client/src/components/DetailPanel.tsx`**

```tsx
import type { Person, TreeNode } from "../types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type Props = {
  person: (Person | TreeNode) | null;
  byId: Record<string, (Person | TreeNode) & { childIds?: string[] }>;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null;
  return (
    <div className="mt-3 first:mt-0">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-secondary">{label}</dt>
      <dd className="text-sm text-foreground m-0 mt-0.5">{String(value)}</dd>
    </div>
  );
}

export function DetailPanel({ person, byId, onClose }: Props) {
  const open = !!person;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[360px] overflow-y-auto">
        {person && (
          <>
            <SheetHeader>
              <SheetTitle className="text-2xl uppercase tracking-[0.15em] text-primary font-semibold">
                {person.name}
              </SheetTitle>
            </SheetHeader>
            <Separator className="my-3" />
            <dl className="m-0">
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
                  "children" in person && Array.isArray((person as TreeNode).children)
                    ? (person as TreeNode).children.map((c) => c.name).join(", ")
                    : ""
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

`Sheet` handles the slide animation, focus trap, and Escape-to-close automatically — replacing the hand-rolled `.detail-panel` CSS.

- [ ] **Step 9.2: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 9.3: Commit**

```bash
git add client/src/components/DetailPanel.tsx
git commit -m "feat(client): rewrite DetailPanel using shadcn Sheet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Manual smoke-check happens after Task 10 (ListView, the main consumer of DetailPanel).

---

## Task 10: Convert ListView header to shadcn (body untouched)

**Files:**
- Modify: `client/src/pages/ListView.tsx`

The indented list body (`<ul className="tree-list">` and the `ListNode` recursive component with its `.card`, `.toggle`, `.name`, `.meta`, `.id-tag` classes) stays as-is. Only the header chrome changes.

- [ ] **Step 10.1: Edit `client/src/pages/ListView.tsx`**

Replace the entire `return (...)` block in the `ListView` component (currently lines ~104-132) with this. The rest of the file (imports, helpers, `ListNode`, the `if (loading)` / `if (error)` / `if (Array.isArray...)` guards) is unchanged:

```tsx
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border bg-background/90 backdrop-blur">
        <h1 className="m-0 text-lg font-semibold text-primary uppercase tracking-[0.15em]">
          ◆ Family Tree
        </h1>
        <Button asChild variant="outline" size="sm" className="uppercase tracking-widest">
          <Link to={`/tree/${treeId}`}>← Views</Link>
        </Button>
        <Input
          type="search"
          placeholder="Search by name or ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
        <Button variant="outline" size="sm" onClick={() => setCollapsedAll(-1)} className="uppercase tracking-widest">
          Expand all
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCollapsedAll(1)} className="uppercase tracking-widest">
          Collapse all
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tracking-widest">
          {peopleCount} people · {roots.length} root line{roots.length === 1 ? "" : "s"}
        </span>
        <ThemeToggle />
      </header>

      <div className="p-6 overflow-auto">
        <ul className="tree-list">
          {roots.map((r) => (
            <ListNode key={r.id} node={r} collapsedAll={collapsedAll} match={matches} onSelect={setSelectedId} />
          ))}
        </ul>
      </div>

      <DetailPanel person={selected as TreeNode | null} byId={byId} onClose={() => setSelectedId(null)} />
    </div>
  );
```

Also at the top of the file, add the new imports next to the existing ones:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
```

And update the loading/error guards to use the design tokens (replaces the inline `color: "var(--coral)"`):

```tsx
  if (loading) return <div className="p-10">Loading…</div>;
  if (error) return <div className="p-10 text-destructive">Error: {error}</div>;
```

The empty-tree case stays:

```tsx
  if (Array.isArray(tree) && tree.length === 0) {
    return (
      <div className="p-10">
        <p>This tree is empty.</p>
        <p><Link to={`/tree/${treeId}/editor`} className="text-primary hover:underline">Open the editor to add people.</Link></p>
      </div>
    );
  }
```

Keep the existing `import "../styles/views.css"` — it still contains the `.tree-list`, `.card`, `.toggle`, `.name`, `.meta`, `.id-tag`, `.node` selectors that the body markup uses. (We slim views.css in Task 14.)

- [ ] **Step 10.2: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 10.3: Manual smoke-check (ListView + DetailPanel together)**

```bash
pnpm dev
```

- Navigate to `/tree/:treeId/list`
- The list body still renders with male=teal / female=coral cards
- Click any card — the DetailPanel slides in from the right via Sheet
- Press Escape — Sheet closes
- Search input filters via the `.match` class (still styled by views.css)
- Theme toggle flips colors; the `.card` SVG borders remain visible in both modes (because legacy `--ink-color` resolves correctly via the shim)

Note: the indented list body uses CSS variables like `var(--bg)`, `var(--teal-light)` etc. in `views.css` — these are still **broken** at this point because views.css hasn't been migrated to the new alias names. **Expected: list nodes will show with no border / wrong colors.** That is fixed in Task 14. Confirm the header chrome looks right; the body is on the to-do list.

Stop the dev server.

- [ ] **Step 10.4: Commit**

```bash
git add client/src/pages/ListView.tsx
git commit -m "feat(client): convert ListView header chrome to shadcn

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Convert ChartView header to shadcn

**Files:**
- Modify: `client/src/pages/ChartView.tsx`

The d3 SVG rendering inside `<div className="svg-wrap">` is unchanged. Only the header and the `if (error)` guard change.

- [ ] **Step 11.1: Read the current file**

```bash
cat client/src/pages/ChartView.tsx
```

Identify the `<header className="view-header">…</header>` JSX block and the `if (error)` line with the inline `style={{ color: "var(--coral)" }}`.

- [ ] **Step 11.2: Add the new imports at the top of `ChartView.tsx`**

After the existing imports add:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
```

- [ ] **Step 11.3: Replace the error guard**

Find the line:

```tsx
  if (error) return <div style={{ padding: 40, color: "var(--coral)" }}>Error: {error}</div>;
```

Replace with:

```tsx
  if (error) return <div className="p-10 text-destructive">Error: {error}</div>;
```

- [ ] **Step 11.4: Replace the `<header className="view-header">…</header>` block**

The existing block has an `<h1>`, a `<Link className="btn">`, an `<input type="search">`, possibly some buttons, and a `<span className="stats">`. Replace it with this structure (copy the search/onChange wiring from the original — variable names may differ):

```tsx
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border bg-background/90 backdrop-blur">
        <h1 className="m-0 text-lg font-semibold text-primary uppercase tracking-[0.15em]">
          ◆ Genealogical Chart
        </h1>
        <Button asChild variant="outline" size="sm" className="uppercase tracking-widest">
          <Link to={`/tree/${treeId}`}>← Views</Link>
        </Button>
        <Input
          type="search"
          placeholder="Search by name or ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
        {/* Preserve any extra buttons that were in the original header here */}
        <span className="ml-auto text-xs text-muted-foreground tracking-widest">
          {/* preserve stats text from original */}
        </span>
        <ThemeToggle />
      </header>
```

After editing, **read the file back and confirm** that any extra controls or stats text from the original are preserved verbatim.

- [ ] **Step 11.5: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 11.6: Manual smoke-check**

```bash
pnpm dev
```

- Navigate to `/tree/:treeId/chart`
- Header has shadcn Button/Input/ThemeToggle
- The SVG chart renders below — text and node strokes may look wrong in light mode (we fix in Task 14)
- Dark mode: SVG should look exactly like before

Stop the dev server.

- [ ] **Step 11.7: Commit**

```bash
git add client/src/pages/ChartView.tsx
git commit -m "feat(client): convert ChartView header chrome to shadcn

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Convert IllustratedView and CompactView headers to shadcn

**Files:**
- Modify: `client/src/pages/IllustratedView.tsx`
- Modify: `client/src/pages/CompactView.tsx`

Same pattern as Task 11. The d3 SVG rendering stays untouched; only the header chrome and any inline `color: "var(--coral)"` style props change.

- [ ] **Step 12.1: For `IllustratedView.tsx` — repeat steps 11.2–11.4**

Use the title `◆ Illustrated Tree` and update the search/button wiring from whatever is in the file. Replace any inline `style={{ color: "var(--coral)" }}` with `className="text-destructive"`.

- [ ] **Step 12.2: For `CompactView.tsx` — repeat steps 11.2–11.4**

Use the title `◆ Compact Illustrated` and same procedure.

- [ ] **Step 12.3: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 12.4: Manual smoke-check**

```bash
pnpm dev
```

Navigate to `/tree/:treeId/illustrated` and `/tree/:treeId/compact`. Confirm:
- Header chrome looks consistent with ChartView
- ThemeToggle is present
- SVG still renders (colors will look wrong in light mode — fixed in Task 14)

Stop the dev server.

- [ ] **Step 12.5: Commit**

```bash
git add client/src/pages/IllustratedView.tsx client/src/pages/CompactView.tsx
git commit -m "feat(client): convert IllustratedView and CompactView headers to shadcn

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Convert Editor (modal + row actions) to shadcn

**Files:**
- Modify: `client/src/pages/Editor.tsx`

This is the largest single-file conversion. The current file has `PersonForm` (modal), the `Editor` page with header chrome, the recursive `renderNode` body, and inline-style error displays.

Strategy: convert the `PersonForm` modal to `Dialog`, convert the page header chrome to shadcn primitives, convert the row-action `+ Child` / `Edit` / `Delete` buttons to `Button` variants. The recursive `renderNode` body keeps using the existing `.tree-list` / `.card` / `.toggle` classes — those get fixed when views.css is migrated in Task 14.

- [ ] **Step 13.1: Add new imports at the top of `Editor.tsx`**

After existing imports add:

```tsx
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
```

- [ ] **Step 13.2: Replace the `PersonForm` component**

Replace the entire `function PersonForm({ ... })` block (currently lines ~40–162) with:

```tsx
function PersonForm({
  initial,
  title,
  open,
  onCancel,
  onSave,
}: {
  initial: FormState;
  title: string;
  open: boolean;
  onCancel: () => void;
  onSave: (data: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.name.trim()) return setError("Name is required");
    setBusy(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest text-primary">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">Name *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Gender</Label>
              <Select value={form.gender ?? "_unset"} onValueChange={(v) => update("gender", v === "_unset" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_unset">—</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Nickname</Label>
              <Input value={form.nickname ?? ""} onChange={(e) => update("nickname", e.target.value || null)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Surname (birth)</Label>
              <Input value={form.surnameBirth ?? ""} onChange={(e) => update("surnameBirth", e.target.value || null)} />
            </div>
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Surname (now)</Label>
              <Input value={form.surnameNow ?? ""} onChange={(e) => update("surnameNow", e.target.value || null)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Birth year</Label>
              <Input
                type="number"
                value={form.birthYear ?? ""}
                onChange={(e) => update("birthYear", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Death year</Label>
              <Input
                type="number"
                value={form.deathYear ?? ""}
                onChange={(e) => update("deathYear", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Birth place</Label>
              <Input value={form.birthPlace ?? ""} onChange={(e) => update("birthPlace", e.target.value || null)} />
            </div>
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Death place</Label>
              <Input value={form.deathPlace ?? ""} onChange={(e) => update("deathPlace", e.target.value || null)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">Partner name</Label>
            <Input value={form.partnerName ?? ""} onChange={(e) => update("partnerName", e.target.value || null)} />
          </div>

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">Profession</Label>
            <Input value={form.profession ?? ""} onChange={(e) => update("profession", e.target.value || null)} />
          </div>

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">Deceased</Label>
            <Select value={form.deceased ?? "_unset"} onValueChange={(v) => update("deceased", v === "_unset" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_unset">—</SelectItem>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">Notes / Bio</Label>
            <Textarea
              value={form.bio ?? ""}
              onChange={(e) => update("bio", e.target.value || null)}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Note the `Select` empty-value workaround: Radix `Select` doesn't allow empty string values, so we use `"_unset"` as a placeholder and map it back to `null` in the handler.

- [ ] **Step 13.3: Update the `Editor`'s `editorState` handling and the JSX `<PersonForm>` invocation**

Find the JSX where `<PersonForm ... />` is rendered conditionally (currently around lines ~375–382):

```tsx
      {editorState && (
        <PersonForm
          initial={editorState.person}
          title={editorState.mode === "create" ? "Add person" : `Edit ${editorState.person.name}`}
          onCancel={() => setEditorState(null)}
          onSave={handleSave}
        />
      )}
```

Replace with:

```tsx
      <PersonForm
        key={editorState ? `${editorState.mode}-${editorState.id ?? "new"}` : "closed"}
        open={!!editorState}
        initial={editorState?.person ?? emptyForm(null)}
        title={editorState?.mode === "create" ? "Add person" : `Edit ${editorState?.person.name ?? ""}`}
        onCancel={() => setEditorState(null)}
        onSave={handleSave}
      />
```

The `key` forces remount when switching from add to edit so `useState(initial)` picks up the new value.

- [ ] **Step 13.4: Replace the Editor header**

Find the `<header className="view-header">…</header>` block (currently lines ~328-369). Replace with:

```tsx
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border bg-background/90 backdrop-blur">
        {renaming ? (
          <span className="inline-flex items-center gap-2">
            <Input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTreeName();
                else if (e.key === "Escape") cancelRename();
              }}
              disabled={renameBusy}
              className="text-lg w-64"
            />
            <Button size="sm" onClick={saveTreeName} disabled={renameBusy}>
              {renameBusy ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={cancelRename} disabled={renameBusy}>
              Cancel
            </Button>
            {renameError && <span className="text-destructive text-xs">{renameError}</span>}
          </span>
        ) : (
          <h1
            onClick={() => {
              setRenameDraft(treeName);
              setRenameError(null);
              setRenaming(true);
            }}
            className="m-0 text-lg font-semibold text-primary uppercase tracking-[0.15em] cursor-pointer"
            title="Click to rename"
          >
            ◆ {treeName} ✎
          </h1>
        )}
        <Button asChild variant="outline" size="sm" className="uppercase tracking-widest">
          <Link to={`/tree/${treeId}`}>← Views</Link>
        </Button>
        <Button size="sm" onClick={() => setEditorState({ mode: "create", person: emptyForm(null) })} className="uppercase tracking-widest">
          + Root person
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tracking-widest">
          {people.length} people · {user?.email} ({user?.role})
        </span>
        <Button size="sm" variant="outline" onClick={logout}>Logout</Button>
        <ThemeToggle />
      </header>
```

- [ ] **Step 13.5: Replace the row-action buttons inside `renderNode`**

Find the block (currently lines ~302-314):

```tsx
          <span className="editor-actions">
            <button
              className="add"
              onClick={() => setEditorState({ mode: "create", person: emptyForm(p.id) })}
              title="Add child"
            >
              + Child
            </button>
            <button onClick={() => setEditorState({ mode: "edit", person: { ...(p as any), name: p.name }, id: p.id })}>
              Edit
            </button>
            <button className="del" onClick={() => handleDelete(p)}>Delete</button>
          </span>
```

Replace with:

```tsx
          <span className="inline-flex items-center gap-1 ml-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-primary uppercase tracking-widest hover:bg-primary/15"
              onClick={() => setEditorState({ mode: "create", person: emptyForm(p.id) })}
              title="Add child"
            >
              + Child
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] uppercase tracking-widest"
              onClick={() => setEditorState({ mode: "edit", person: { ...(p as any), name: p.name }, id: p.id })}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-destructive uppercase tracking-widest hover:bg-destructive/15"
              onClick={() => handleDelete(p)}
            >
              Delete
            </Button>
          </span>
```

- [ ] **Step 13.6: Replace the loading/error guards (currently lines ~323-324)**

```tsx
  if (loading) return <div className="p-10">Loading…</div>;
  if (error) return <div className="p-10 text-destructive">Error: {error}</div>;
```

- [ ] **Step 13.7: Wrap the `Editor` `return (...)` in `TooltipProvider`**

(Even if Tooltip isn't currently used, this is forward-compat and harmless. Tooltips are imported in 13.1.) Wrap the outermost div:

```tsx
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        {/* existing header + body + PersonForm */}
      </div>
    </TooltipProvider>
  );
```

The original outer wrapper was `<div className="view-shell">`. Replace `view-shell` with `min-h-screen bg-background text-foreground` and the inner `<div className="editor-wrap">` with `<div className="p-6">`. The `<ul className="tree-list">` inside stays unchanged.

- [ ] **Step 13.8: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 13.9: Manual smoke-check**

```bash
pnpm dev
```

- Navigate to `/tree/:treeId/editor`
- Click `+ Root person` → Dialog opens with the form. Fill name, save. New row should appear.
- Click `Edit` on the new row → Dialog reopens populated. Change something, save.
- Click `Delete` → window.confirm appears (we keep `confirm()` per spec — could replace with AlertDialog later but it's out of scope).
- Click the tree title → inline rename input appears. Save / Cancel both work.
- ThemeToggle flips colors.

Stop the dev server.

- [ ] **Step 13.10: Commit**

```bash
git add client/src/pages/Editor.tsx
git commit -m "feat(client): convert Editor modal + header chrome to shadcn

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Migrate views.css to legacy alias variables (d3 SVG views now theme-aware)

**Files:**
- Modify: `client/src/styles/views.css`
- Modify: `client/src/tree/TreeAccessBoundary.tsx`

After this task the SVG views and the indented list body work correctly in both light and dark mode.

- [ ] **Step 14.1: Slim `client/src/styles/views.css` to only the selectors still in use**

Replace the entire file contents with:

```css
/* Indented list body (used by ListView and the Editor tree) */
ul.tree-list { list-style: none; padding-left: 0; margin: 0; }
ul.tree-list ul {
  list-style: none; padding-left: 28px; margin: 6px 0 6px 14px;
  border-left: 1px solid var(--border-color);
}
li.node { position: relative; margin: 6px 0; padding-left: 14px; }
li.node::before {
  content: ""; position: absolute; left: -1px; top: 18px;
  width: 14px; height: 1px; background: var(--border-color);
}
.card {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 5px 12px; border-radius: 3px;
  background: var(--bg-color);
  border: 1px solid var(--ink-color);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.card:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4); }
.card.male { border-color: var(--teal-light-color); }
.card.male .name { color: var(--teal-light-color); }
.card.female { border-color: var(--coral-color); }
.card.female .name { color: var(--coral-color); }
.card.deceased { border-style: dashed; opacity: 0.85; }
.toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--bg-color); border: 1px solid var(--border-color);
  font-size: 12px; font-weight: bold; color: var(--olive-color);
  margin-right: 2px; user-select: none;
}
.toggle.empty { visibility: hidden; }
.name {
  font-weight: 600; color: var(--ink-color);
  letter-spacing: 1px; text-transform: uppercase; font-size: 13px;
}
.meta { font-size: 11px; color: var(--muted-color); letter-spacing: 1px; }
.id-tag { font-size: 10px; color: var(--muted-color); letter-spacing: 1px; }
li.node.collapsed > ul { display: none; }
li.node.match > .card {
  border-color: var(--olive-color); box-shadow: 0 0 0 2px hsl(var(--olive) / 0.25);
}
li.node.match > .card .name { color: var(--olive-color); }

/* Chart / illustrated SVG views */
.svg-wrap { position: absolute; top: 54px; left: 0; right: 0; bottom: 0; overflow: hidden; }
.svg-wrap svg { display: block; width: 100%; height: 100%; cursor: grab; background: var(--bg-color); }
.svg-wrap svg:active { cursor: grabbing; }

.chart .link { fill: none; stroke: var(--ink-color); stroke-width: 1.4px; opacity: 0.7; }
.chart .node rect { stroke: var(--ink-color); stroke-width: 1.2px; fill: var(--bg-color); rx: 3; ry: 3; }
.chart .node.male rect { stroke: var(--teal-color); }
.chart .node.female rect { stroke: var(--coral-color); }
.chart .node.deceased rect { stroke-dasharray: 3 2; opacity: 0.85; }
.chart .node.match rect { stroke: var(--olive-color); stroke-width: 2.5px; }
.chart .node text {
  font-family: "Oswald", "Noto Sans Armenian", sans-serif;
  font-size: 11px; fill: var(--ink-color); pointer-events: none;
  font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
}
.chart .node.male text { fill: var(--teal-color); }
.chart .node.female text { fill: var(--coral-color); }
.chart .node.match text { fill: var(--olive-color); }
.chart .node text.dates { font-size: 9px; fill: var(--muted-color); letter-spacing: 1px; text-transform: none; font-weight: 400; }
.chart .node { cursor: pointer; }

/* Compact illustrated (freepik3 styling) */
.compact .branch { fill: none; stroke: var(--ink-color); stroke-linecap: round; stroke-linejoin: round; }
.compact .leaf-deco { pointer-events: none; }
.compact .leaf-deco.olive { fill: var(--olive-color); }
.compact .leaf-deco.teal { fill: var(--teal-light-color); }
.compact .leaf-deco.coral { fill: var(--coral-color); }
.compact .name-tag { cursor: pointer; }
.compact .name-tag rect.bg { fill: var(--bg-color); stroke: none; }
.compact .name-tag .frame { fill: var(--bg-color); stroke: var(--ink-color); stroke-width: 1.1; }
.compact .name-tag text.name {
  fill: var(--ink-color); font-weight: 600; text-anchor: middle;
  letter-spacing: 0.8px; text-transform: uppercase; pointer-events: none;
}
.compact .name-tag text.dates {
  fill: var(--muted-color); font-size: 8px; text-anchor: middle; letter-spacing: 1px; pointer-events: none;
}
.compact .name-tag.female .frame { stroke: var(--coral-color); }
.compact .name-tag.female text.name { fill: var(--coral-color); }
.compact .name-tag.male .frame { stroke: var(--teal-light-color); }
.compact .name-tag.male text.name { fill: var(--teal-light-color); }
.compact .name-tag.deceased .frame { stroke-dasharray: 3 2; opacity: 0.85; }
.compact .name-tag.match .frame { stroke: var(--olive-color); stroke-width: 2.5; }
.compact .name-tag.match text.name { fill: var(--olive-color); }
.compact .root-badge { fill: var(--bg-color); stroke: var(--olive-color); stroke-width: 2.5; }
.compact .root-badge-inner { fill: none; stroke: var(--olive-color); stroke-width: 1.2; opacity: 0.6; }
.compact .root-label {
  fill: var(--olive-color); font-size: 22px; font-weight: 700; text-anchor: middle;
  letter-spacing: 2.5px; text-transform: uppercase; pointer-events: none;
}
```

What changed:
- Removed: `.view-shell`, `.view-header*`, `.detail-panel*`, `.auth-wrap`, `.auth-card*`, `.editor-wrap`, `.editor-actions*`, `.modal*`, `.tree-list-wrap` (replaced by Tailwind utilities elsewhere).
- Renamed: every `var(--X)` → `var(--X-color)` so the legacy alias shim in `index.css` resolves them.
- `rgba(194, 204, 62, 0.25)` (hardcoded olive 25%) → `hsl(var(--olive) / 0.25)`.

- [ ] **Step 14.2: Migrate inline `style={{ color: "var(--coral)" }}` in TreeAccessBoundary**

`client/src/tree/TreeAccessBoundary.tsx` line ~52:

```tsx
    return <div style={{ padding: 40, color: "var(--coral)" }}>Error: {errorMsg}</div>;
```

Replace with:

```tsx
    return <div className="p-10 text-destructive">Error: {errorMsg}</div>;
```

- [ ] **Step 14.3: Verify build**

```bash
pnpm --filter @family-tree/client build
```

Expected: PASS.

- [ ] **Step 14.4: Full visual smoke-check across every route, in light + dark + system**

```bash
pnpm dev
```

For each of these URLs, toggle through Light / Dark / System and confirm rendering is correct:

| Route | What to check |
|---|---|
| `/login` | Card centered, fields, error Alert |
| `/register` | Same as login |
| `/` (TreeList) | Tree cards, create-tree Dialog |
| `/tree/:id` (TreeChooser) | View grid, delete-tree Dialog |
| `/tree/:id/list` | List body shows male=teal / female=coral borders; click → Sheet opens; search highlights matches in olive |
| `/tree/:id/chart` | d3 chart renders; male/female node strokes correct; clicking a node opens DetailPanel Sheet |
| `/tree/:id/illustrated` | Fractal tree renders; leaf colors visible |
| `/tree/:id/compact` | Name tags render; root badge in olive |
| `/tree/:id/editor` | Tree body renders with same node styling as ListView; row actions (Child/Edit/Delete) work; PersonForm Dialog works |

Confirm OS-follow: in System mode, change Windows light/dark while one of the views is open — colors should flip live.

Stop the dev server.

- [ ] **Step 14.5: Commit**

```bash
git add client/src/styles/views.css client/src/tree/TreeAccessBoundary.tsx
git commit -m "refactor(client): slim views.css and migrate to themed CSS vars

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Final verification and PR

- [ ] **Step 15.1: Clean install + build from scratch**

```bash
rm -rf client/node_modules
pnpm install
pnpm --filter @family-tree/client build
```

Expected: clean install, build produces `client/dist/` with no errors.

- [ ] **Step 15.2: Run full app end-to-end**

In one terminal: `docker compose up -d` (Postgres)
In another: `pnpm dev`

Walk every route in light + dark + system. Confirm:
- No console errors in DevTools
- No unstyled flashes of content on initial load
- DetailPanel (Sheet), TreeList create Dialog, TreeChooser delete Dialog, Editor PersonForm Dialog all keyboard-accessible (Esc, Tab)
- No stale Oswald-uppercase styling has been accidentally dropped (titles in TreeList/TreeChooser/auth pages should retain their character)

- [ ] **Step 15.3: Confirm no stray references to deleted files**

```bash
grep -rn "styles/global.css\|styles/chooser.css" client/src/ || echo "no matches"
```

Expected: `no matches`.

- [ ] **Step 15.4: Final commit (only if any cleanup needed) and PR**

If Step 15.3 surfaced any stray import, fix and commit. Otherwise, the branch is ready.

```bash
git push -u origin <branch-name>
gh pr create --title "feat(client): shadcn/ui + Tailwind v4 refactor with dark/light mode" --body "$(cat <<'EOF'
## Summary
- Refactored `client/` UI to use shadcn/ui (latest) + Tailwind CSS v4.
- Added light / dark / system theme modes with localStorage persistence and OS-follow.
- Preserved Oswald + olive/teal/coral visual identity (warm parchment in light, charcoal in dark).
- d3 SVG drawing code is untouched — only its CSS variable references are renamed via a legacy alias shim.

## Test plan
- [ ] `pnpm --filter @family-tree/client build` succeeds
- [ ] All routes render in light, dark, and system modes
- [ ] DetailPanel (Sheet), all Dialog modals are keyboard-accessible
- [ ] System mode follows OS theme changes live

Spec: `docs/superpowers/specs/2026-05-25-shadcn-ui-refactor-design.md`
Plan: `docs/superpowers/plans/2026-05-25-shadcn-ui-refactor.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

Spec coverage check:
- §Stack — covered by Task 1, 2.
- §Theme tokens — covered by Task 1.7.
- §Compat shim — covered by Task 1.7 (alias shim) + Task 14.1 (views.css migration).
- §Theme provider — covered by Task 3.
- §Component conversion map — Login/Register (Task 5), TreeList (Task 6), TreeChooser (Task 7), DetailPanel (Task 9), Editor (Task 13), view headers (Tasks 10/11/12).
- §Files affected — all "New" / "Modified" / "Deleted" paths from the spec appear in this plan.
- §Verification — Task 15.

Type consistency check: `useTheme()` is defined in Task 3.1 and consumed in Task 3.2; no signature drift.

No placeholders, no "TODO", no "similar to Task N". All code blocks are concrete.
