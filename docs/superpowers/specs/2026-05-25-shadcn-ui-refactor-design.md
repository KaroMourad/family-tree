# Design: shadcn/ui + Tailwind v4 refactor with dark/light mode

**Date:** 2026-05-25
**Status:** Approved
**Scope:** `client/` only — no server changes.

## Goal

Refactor the family-tree client UI to:

1. Use **shadcn/ui** components for chrome (auth, tree list, headers, modal, detail panel, editor controls).
2. Use **Tailwind CSS v4** for layout/styling.
3. Add **light / dark / system** theme modes, with the current dark palette preserved as the dark theme and a new warm-parchment palette introduced as the light theme.
4. Preserve the existing visual identity (Oswald + Noto Sans Armenian, olive / teal / coral accents, uppercase letterspacing).
5. Leave d3 SVG drawing code (`ChartView`, `IllustratedView`, `CompactView`, indented list in `ListView`) untouched aside from CSS variable references.

## Non-goals

- No changes to `server/`, Prisma schema, API routes.
- No changes to `useTree`, `useTreeList`, or any data-fetching logic.
- No d3 layout-algorithm or SVG markup changes.
- No new product features (auth flows, sharing, permissions, etc.).
- No test suite addition — this repo has none and the refactor is verified manually.

## Stack

- **Tailwind CSS v4** (latest) + `@tailwindcss/vite` plugin. No `tailwind.config.js`; tokens are declared in CSS via `@theme inline`.
- **shadcn/ui** — initialized with `npx shadcn@latest init -t vite`. Components copied into `client/src/components/ui/` as owned source.
- **`class-variance-authority`**, **`clsx`**, **`tailwind-merge`** — installed automatically by shadcn init.
- **`lucide-react`** — icons.
- **`tw-animate-css`** — Tailwind v4-compatible replacement for `tailwindcss-animate`.
- **No `next-themes`** — a small hand-rolled `ThemeProvider` (~30 lines) handles light/dark/system and `matchMedia` follow-OS behavior.

Verified against latest Context7 docs for both shadcn/ui (Vite install path) and Tailwind CSS v4.

## Theme tokens

Single source of truth in `client/src/index.css`. Both palettes are declared as HSL components (no `hsl()` wrapper) so Tailwind v4's `@theme inline` block can wrap them.

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  /* light = warm parchment */
  --background: 44 30% 95%;        /* #f7f5ef */
  --foreground: 200 4% 17%;        /* #2a2d2e */
  --card: 0 0% 100%;
  --card-foreground: 200 4% 17%;
  --border: 42 26% 87%;            /* #e6e2d4 */
  --input: 42 26% 87%;
  --primary: 65 53% 35%;           /* darker olive #8a9420 */
  --primary-foreground: 0 0% 100%;
  --secondary: 172 31% 42%;        /* darker teal #4a8d80 */
  --secondary-foreground: 0 0% 100%;
  --destructive: 7 50% 46%;        /* darker coral #b04a3c */
  --muted: 40 13% 90%;
  --muted-foreground: 35 6% 44%;   /* #73706a */
  --ring: 65 53% 35%;
  --radius: 0.375rem;

  /* brand accents (also used by d3 SVG views) */
  --olive: 65 53% 35%;
  --teal: 172 31% 42%;
  --coral: 7 50% 46%;
}

.dark {
  /* dark = current charcoal palette */
  --background: 195 6% 20%;        /* #303435 */
  --foreground: 0 0% 96%;          /* #f6f6f6 */
  --card: 200 5% 17%;              /* #2a2d2e */
  --card-foreground: 0 0% 96%;
  --border: 195 4% 30%;            /* #4a4e4f */
  --input: 195 4% 30%;
  --primary: 64 60% 53%;           /* #c2cc3e */
  --primary-foreground: 195 6% 20%;
  --secondary: 170 39% 62%;        /* #75c6b8 */
  --secondary-foreground: 195 6% 20%;
  --destructive: 7 53% 57%;        /* #cc6658 */
  --muted: 195 4% 25%;
  --muted-foreground: 200 4% 62%;  /* #9aa0a2 */
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
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-ring: hsl(var(--ring));

  --color-olive: hsl(var(--olive));
  --color-teal: hsl(var(--teal));
  --color-coral: hsl(var(--coral));

  --font-display: "Oswald", "Noto Sans Armenian", "Sylfaen", system-ui, sans-serif;
  --radius: 0.375rem;
}

body { font-family: var(--font-display); background: hsl(var(--background)); color: hsl(var(--foreground)); }
```

### Compat shim for d3 SVG views

The d3 view files (`ChartView`, `IllustratedView`, `CompactView`) reference legacy variable names like `var(--bg)`, `var(--ink)`, `var(--panel)`, `var(--muted)` directly in their inline SVG styles and in `styles/views.css`. To avoid editing those files, add an alias shim in `index.css`:

```css
/* legacy aliases — let d3 SVG selectors keep working without edits */
:root, .dark {
  --bg-color: hsl(var(--background));
  --panel-color: hsl(var(--card));
  --ink-color: hsl(var(--foreground));
  --muted-color: hsl(var(--muted-foreground));
  --border-color: hsl(var(--border));
  --olive-color: hsl(var(--olive));
  --teal-color: hsl(var(--teal));
  --teal-light-color: hsl(var(--teal));   /* `--teal-light` was an alias for teal in old palette */
  --coral-color: hsl(var(--coral));
}
```

Since the d3 SVG code uses `var(--olive)`, `var(--bg)`, `var(--ink)`, `var(--teal-light)`, `var(--coral)`, `var(--panel)`, `var(--muted)`, `var(--border)` literally (both in `styles/views.css` and inline `style={{}}` in `TreeAccessBoundary.tsx` + `ChartView.tsx`), the migration replaces each `var(--X)` → `var(--X-color)` in those files. This is a mechanical find/replace and doesn't change behavior in dark mode (the HSL values match today's hex codes within rounding).

## Theme provider

`client/src/theme/ThemeProvider.tsx`:

- Context value: `{ theme: "light" | "dark" | "system", setTheme, resolvedTheme: "light" | "dark" }`.
- Default theme: `"system"`.
- Persists `theme` to `localStorage["ft.theme"]`.
- Resolves `"system"` via `window.matchMedia("(prefers-color-scheme: dark)")` and listens to its `change` event.
- Applies the resolved theme as a class (`light` or `dark`) on `document.documentElement`.
- No SSR concerns — Vite SPA only.

`ThemeToggle` component: lucide `Sun` / `Moon` / `Laptop` icons inside a shadcn `DropdownMenu`. Mounted in:

- View headers (top right, before stats)
- Auth pages (top right corner)
- `TreeList` and `TreeChooser` headers (replaces the inline userbar)

`<ThemeProvider>` wraps `<App />` in `client/src/main.tsx`.

## Component conversion map (chrome only)

| File | shadcn primitives |
|---|---|
| `pages/Login.tsx`, `pages/Register.tsx` | `Card`, `Input`, `Label`, `Button`, `Alert` |
| `pages/TreeList.tsx` | `Card`, `Button`, `DropdownMenu` (user menu), `Dialog` (create-tree form) |
| `pages/TreeChooser.tsx` | `Card` grid for viewer-route links, `Button`, `Avatar` (initials) |
| View headers in `ListView` / `ChartView` / `IllustratedView` / `CompactView` | `Input` (search), `Button`/`Toggle` (view switcher), `ThemeToggle`, `Badge` (stats) |
| `components/DetailPanel.tsx` | rewritten using `Sheet` (replaces hand-rolled translate-X panel), `Button`, `Separator` |
| `pages/Editor.tsx` modal + row actions | `Dialog`, `Input`, `Select`, `Textarea`, `Label`, `Button` variants (`ghost`, `destructive`), `Tooltip` |

`ListView`'s indented tree body markup is kept; only the surrounding header chrome is converted. The d3 SVG views keep their `<svg>` rendering — only the surrounding header changes.

## Files affected

**New:**

- `client/src/index.css` — Tailwind v4 imports, `@custom-variant dark`, theme vars, `@theme inline`, d3 var shim
- `client/src/lib/utils.ts` — `cn()` helper (written by shadcn init)
- `client/src/components/ui/*` — shadcn primitives (`button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `select`, `separator`, `sheet`, `textarea`, `tooltip`, `alert`, `badge`, `avatar`, `toggle`)
- `client/src/components/ThemeToggle.tsx`
- `client/src/theme/ThemeProvider.tsx`
- `client/components.json` — shadcn config
- `client/tsconfig.json` / `tsconfig.app.json` — `"baseUrl": "."` + `"paths": { "@/*": ["./src/*"] }`

**Modified:**

- `client/package.json` — add `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/*` (whatever shadcn primitives pull in)
- `client/vite.config.ts` — add `tailwindcss()` plugin, `resolve.alias["@"]`
- `client/src/main.tsx` — import `./index.css` (instead of `./styles/global.css`), wrap `<App />` in `<ThemeProvider>`
- `client/src/pages/*.tsx`, `client/src/components/DetailPanel.tsx` — convert chrome to shadcn primitives + Tailwind utilities
- `client/src/styles/views.css` — slimmed to d3 SVG selectors only; replace `var(--olive)` → `hsl(var(--olive))` etc.

**Deleted:**

- `client/src/styles/global.css` (replaced by `src/index.css`)
- `client/src/styles/chooser.css` (TreeChooser now uses Tailwind + shadcn)

## Behavior preserved

- Existing routes, route guards, auth flow, tree access semantics — all unchanged.
- `localStorage["ft.token"]` continues to work (separate key from `ft.theme`).
- d3 SVG drawing logic and layout — bit-identical aside from CSS-variable resolution.
- Oswald + Noto Sans Armenian font family applied globally.

## Verification (manual — no test suite)

1. `pnpm install` — clean install with new deps.
2. `pnpm build` — TypeScript and Tailwind v4 build succeed.
3. `pnpm dev` — walk every route in light, dark, and system modes:
   - `/login`, `/register`
   - `/` (TreeList)
   - `/tree/:treeId` (TreeChooser)
   - `/tree/:treeId/list`, `/chart`, `/illustrated`, `/compact`, `/editor`
4. Toggle Windows OS light/dark while in "system" mode — confirm app follows.
5. Open detail panel from a list / chart node — confirm `Sheet` slides in correctly in both themes.
6. Create / edit / delete a person in the editor — confirm modal renders in both themes.
7. Confirm d3 SVG node colors (male/female/deceased/match) render correctly in both themes.

## Out-of-scope follow-ups (not part of this work)

- Switching to Inter or any non-Oswald font.
- Theming the d3 SVG node card visuals (e.g., rounded `rect` corners, drop shadows).
- Adding a "high contrast" or "sepia" mode.
- Migrating any server-side or Prisma code.
