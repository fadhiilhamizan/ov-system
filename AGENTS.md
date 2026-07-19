<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions (ov-system)

**Next 16 specifics.** `middleware` is renamed to `proxy.ts` (root). Request APIs are async — `await cookies()` / `await params`. Supabase server client is created **per request** in `src/lib/supabase/server.ts` (never a module-global — that would leak sessions across users).

**Server Actions (`src/lib/actions/*`) must, in order:**
1. Check the role with `can.*` from `src/lib/permissions.ts` (pure RBAC).
2. Validate **all** client input through a Zod schema in `src/lib/actions/schemas.ts` via `parse(schema, input)`. Never trust the raw payload; schemas trim, length-cap, whitelist enums, and strip unknown keys (mass-assignment protection). Add a schema when you add an action; reuse `idSchema` for row identifiers.
3. Mutate through `src/lib/data/repo.ts`, then `revalidatePath("/", "layout")`.

Actions return `{ ok: true } | { ok: false; error: string }` (Indonesian error copy). RLS in `supabase/migrations/000x_rls.sql` mirrors these checks as a second layer.

**Error handling.** `src/app/(app)/error.tsx` is the segment boundary (client, uses `useT()`); `src/app/global-error.tsx` is the self-contained root fallback (no providers/tokens available there). Add EN copy for any new user-facing string in `src/lib/i18n/dict.ts`.

**The cron backup route** (`src/app/api/cron/backup/route.ts`) is gated by `CRON_SECRET` (Bearer header or `?secret`) — keep it that way.

**Testing.** Vitest. `npm test` runs `*.test.ts` under `src/`. Cover pure logic (permissions, schemas, formatters, scheduling/budget math). Run `npm test` + `npx tsc --noEmit` before finishing a change.

**Seed.** `npm run db:seed` regenerates `supabase/seed.sql` from `src/lib/seed/seed.json`.

**Versioning (v1.x.y).** The version scheme is `v1.x.y`: the leading `1` is **LOCKED — never change it**. Bump `x` (minor) for a big/feature update and reset `y` to 0; bump `y` (patch) for a small fix. On every shipped change you MUST: (1) update `APP_VERSION` in `src/lib/version.ts`, (2) prepend a matching entry to `CHANGELOG` in `src/lib/changelog.ts` (Indonesian copy, newest first), and (3) keep the footer in sync — it reads `APP_VERSION` from `src/components/layout/app-shell.tsx`, so no manual edit needed there. The Settings page renders the changelog automatically.

**Demo edition.** `src/lib/demo.ts` defines the protected `ov-demo` sandbox (`DEMO_EVENT_ID`, `isDemoEvent`). It cannot be deleted (guarded in `deleteEvent` repo + `deleteEventAction`) and can be reset to its mockup via `resetDemoDataAction` (`src/lib/actions/demo.ts` → `resetDemoData` in repo). The demo dataset is derived from the `ov-demo`-scoped rows in `seed.json` (single source). If you add a new event-scoped table, extend `resetDemoData` to clear+reseed it too.
