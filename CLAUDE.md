# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal Ragnarok Online (RO) management tool: MD (mini-dungeon) run tracking, MVP kill tracking, trading/inventory, and finance analytics. React 19 + TypeScript + Vite (rolldown-vite) + Dexie.js (IndexedDB) — everything is client-side, no backend, no auth, no cloud sync. Dark-only UI. Deployed to GitHub Pages (`.github/workflows/deploy.yml`, pushes to `main` auto-deploy).

Explicit design goal (from the user): a unique tool, not a clone of the reference tools it borrows ideas from (`d44aki-lang/RO-tools`, pROfitia). Prefer an original take that fits this app's existing conventions over replicating another tool's exact UI/UX.

## Commands

```bash
npm run dev      # dev server (Vite)
npm run build    # REAL typecheck gate: tsc -b && vite build
npm run lint     # oxlint (zero-warning bar)
npm run format   # prettier --write .
```

**`npx tsc --noEmit` is a silent no-op in this repo** — the root `tsconfig.json` has `"files": []` and only `references` to `tsconfig.app.json`/`tsconfig.node.json`, so there's nothing for it to check. Always use `npm run build` (which runs `tsc -b`) to actually typecheck.

No automated test suite exists. Verify changes by running `npm run dev` and checking the feature in a browser (Playwright can be installed temporarily for scripted verification — `npm install --no-save playwright`, then `npm uninstall playwright --no-save` and delete any scratch scripts when done; don't leave it in `package.json`).

## Architecture

### Data layer (`src/db/`)

- `types.ts` — every persisted record shape (`Character`, `MdDungeon`, `MdRun`, `MvpMaster`, `MvpKill`, `FinanceTransaction`, `ItemPrice`, `InventoryItem`, `WishlistItem`, `DebtEntry`, `CashFlowPlanEntry`, `Goal`, `AppConfig`). New fields are added as optional so no migration is needed for additive changes.
- `db.ts` — Dexie schema, versioned via `this.version(N).stores({...})` calls, each with a comment explaining what changed and why. `CURRENT_SCHEMA_VERSION` must be bumped whenever a table is added/changed **and** kept in sync with `lib/exportImport.ts`'s migration chain (see below). Use `.upgrade()` for any backfill of existing rows.
- `seed.ts` — one-time initial data insert (only when a table is empty), pulling from each feature's `masterData.ts` (e.g. `features/mvp/masterData.ts`). Editing a seed file only affects fresh installs — it never touches an existing database. See the README for the full seed-editing walkthrough.

### Feature modules (`src/features/<domain>/`)

Each domain (dashboard, md, mvp, finance, wishlist, cashflow, goals, characters, settings, guide, revenue) follows the same shape:

- `useX.ts` — a hook wrapping `useLiveQuery` with a default empty-array/object third argument, so consumers never need `if (!data)` guards. Exposes CRUD functions: `addX`, `updateX`/`setX`, `deleteX`, `restoreX` (re-inserts a deleted record by id, powering the undo-toast pattern — see below), and `reorderX` (drag-and-drop reordering: finds both items' indices, splices, renumbers a `sortOrder`/`priority` field).
- `XForm.tsx` / `XPanel.tsx` — the input form(s).
- `XList.tsx` / `XTable.tsx` — the display, usually sortable (`lib/useTableSort.ts` + `components/SortableHeader.tsx`).
- `XPage.tsx` — composes the above; this is what `components/layout/AppShell.tsx` renders per tab.

New tabs are wired in three places: `components/layout/SideNav.tsx` (`TabKey` union + `NAV_GROUPS`), `components/layout/AppShell.tsx` (`VALID_TABS` + the render switch), and usually `components/GlobalSearch.tsx` if the entity should be cross-app searchable.

### Shared code

- `lib/financeCalc.ts` — pure calculation functions (realized profit, MD efficiency, asset trend, weekly/monthly summaries, etc.), all take plain arrays in and return plain values/arrays out. Add new dashboard metrics here, not inline in `DashboardPage.tsx`.
- `lib/zeny.ts` — money formatting/parsing (`k`/`M`/`G` suffixes) and the N-server ×1000 rate rule.
- `lib/party.ts` — `partyShare(totalQty, party)`: splits a quantity across a party, rounded to 2 decimals (not floored — a 1-card drop split 4 ways should read as 0.25, not vanish to 0). Used anywhere a quantity gets divided by party size (MD drop recording, trade "obtain").
- `lib/exportImport.ts` — full-database JSON export/import. `ExportPayload.data` must list every table; `migrateExport`'s `migrations` record has one entry per schema version bump (keyed by the version migrated *from*), and `validateExportPayload`'s `optionalTables` list needs the new table name too. **Any new Dexie table requires changes in four places**: `db.ts` schema, `types.ts`, and these two spots in `exportImport.ts`.
- `components/toastContext.ts` / `components/ToastProvider.tsx` — the undo-toast system (`useToast().showUndo(message, onUndo)`), split into two files because oxlint's `react/only-export-components` rule fires on a file that exports both a component and a hook/context — follow this split for any similar case.
- `components/ReorderButtons.tsx` — ▲/▼ buttons as a touch-friendly alternative to HTML5 drag-and-drop reordering; most reorderable lists offer both.

### Styling

Single global stylesheet (`src/styles/global.css`), no CSS-in-JS/modules. Theme lives entirely in `:root` CSS custom properties (`--bg`, `--panel-bg`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent2`, `--danger`, `--good`, plus `--radius`/`--shadow` tokens) — change the palette there, not per-component. Dark-only; no light theme.

### Deployment gotcha (GitHub Pages base path)

`vite.config.ts` sets `base: '/ro-md-management/'`. Vite's dev server and HTML transform correctly rewrite root-absolute paths (`href="/x"`) *inside `index.html`'s own tags*, but this does **not** extend to:
- JS string literals (e.g. a hardcoded `fetch("/x")` or `serviceWorker.register("/x")`) — use `` `${import.meta.env.BASE_URL}x` `` instead.
- Relative-URL fields inside a separately-served JSON file like `public/manifest.webmanifest` (`start_url`, `scope`, icon `src`) — use `"."`/relative paths there, not `"/"`.
- Hardcoded paths inside `public/sw.js` — use `self.registration.scope` instead of assuming `/`.

If a static asset works when navigating from the site root but 404s in production, this is almost always why.
