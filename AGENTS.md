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

**Access levels.** `MODULE_ACCESS_LEVEL` in `src/lib/constants.ts` is the single source of truth: per module × role, one of `full` (create/edit/delete) → `limited` (create/edit/fill in results, **no delete**) → `view` → `none`. `permissions.ts` derives every `can.*` from it via `atLeast(user, moduleKey, level)` — never hardcode a role list in a `can.*` helper, and add the module row to the matrix instead. Deleting is always `"full"`, so an action that deletes must check `can.deleteX`, not `can.manageX`, and the component needs a separate `canDelete` prop. `MODULE_ACCESS` (nav gating) and the Settings matrix are both generated from the same table.

Rights are **not** scoped by `profiles.division` — an earlier cut confined non-admins to their own division and the visible symptom was "staff can edit only some tasks." Don't reintroduce a division filter in `can.*`. Opening a module read-only is also not permission to run its destructive actions: when a module moves from `none` to `view` for a role, re-check every write path on that page (e.g. `resetDemoDataAction` needed its own admin check once Pengaturan became readable).

**Client/server shared cookies.** A constant exported from a `"use client"` module reaches a Server Component as a client *reference*, not its value — reading `store.get(THAT_CONST)` silently returns undefined. Put any cookie name both sides need in a plain module with no directive (e.g. `src/lib/ui-prefs.ts`, `src/lib/demo.ts`).

**Error handling.** `src/app/(app)/error.tsx` is the segment boundary (client, uses `useT()`); `src/app/global-error.tsx` is the self-contained root fallback (no providers/tokens available there). Add EN copy for any new user-facing string in `src/lib/i18n/dict.ts`.

**The cron backup route** (`src/app/api/cron/backup/route.ts`) is gated by `CRON_SECRET` (Bearer header or `?secret`) — keep it that way.

**Testing.** Vitest. `npm test` runs `*.test.ts` under `src/`. Cover pure logic (permissions, schemas, formatters, scheduling/budget math). Run `npm test` + `npx tsc --noEmit` before finishing a change.

**Seed.** `npm run db:seed` regenerates `supabase/seed.sql` from `src/lib/seed/seed.json`.

**Panduan (user guide).** `src/lib/guide.ts` holds the per-feature usage guide as data, with Indonesian **and** English in the same entry (`{ id, en }`) — it follows the language toggle without going through `dict.ts`. Rendered by `components/panduan/guide-sections.tsx` under `/panduan`, below the flowchart. **Whenever you add or change a user-facing feature, update that feature's section here in the same change** (purpose / steps / tips / access), in both languages. Add a new `GuideSection` when you add a menu, and keep `key` equal to the nav/module key.

**Versioning (v1.x.y).** The version scheme is `v1.x.y`: the leading `1` is **LOCKED — never change it**. Bump `x` (minor) for a big/feature update and reset `y` to 0; bump `y` (patch) for a small fix. On every shipped change you MUST: (1) update `APP_VERSION` in `src/lib/version.ts`, (2) prepend a matching entry to `CHANGELOG` in `src/lib/changelog.ts` (Indonesian copy, newest first), and (3) keep the footer in sync — it reads `APP_VERSION` from `src/components/layout/app-shell.tsx`, so no manual edit needed there. The Settings page renders the changelog automatically.

**Accounts & role requests.** Anyone can self-register (`/signup`, email+password or Google; OAuth returns through `/auth/callback`). The `handle_new_user` trigger gives every new account role `viewer` → the app's read-only "Tamu". They then file a role request from the user menu or the amber banner; an admin approves it in `/roles`. Approval must go through the `decide_role_request` SECURITY DEFINER RPC — `profiles.role` is deliberately not writable by `authenticated` (that's the fix for the self-promotion hole in migration 0020). Add `/signup` and `/auth/*` to `proxy.ts`'s public paths if you touch that list.

`requestableRolesFor(user)` in `permissions.ts` is the authority on what may be requested: never `admin`, never the role the account already holds, nothing for admins (so they can't be demoted this way) and nothing for anonymous Tamu sessions. A role is global — requests carry **no** event scope (`role_requests.event_id` is retained but deprecated, see 0024). A pending request is editable by its owner and immutable once decided.

**Demo mode = a SEPARATE Supabase project.** Demo and real data live in different databases and can never cross. `src/lib/demo.ts` (dependency-free, client+server) holds `DEMO_COOKIE`, `demoConfigured()`, and `supabaseCreds(demo)`. The single choke point is `supabase/server.ts` (+ `supabase/client.ts` for the browser): when the `ov_demo` cookie is set AND `NEXT_PUBLIC_SUPABASE_DEMO_URL`/`_ANON_KEY` are configured, every Supabase client points at the demo project. `proxy.ts` skips auth/redirect in demo mode; `getCurrentUser` (auth.ts) returns a `DEMO_USERS` identity (default admin, role-switchable) with no production auth. Enter/exit via `enterDemoMode`/`exitDemoMode` (`actions/session.ts`); the login page shows a "Coba Mode Demo" button when configured, and `DemoBanner` + the RoleSwitcher render while in demo. The demo project's mockup seed + open-RLS script are generated by `npm run db:demo` (`scripts/gen-demo-seed.mjs` → `supabase/demo/`). The demo project uses the anon key with no login, so `demo-open-access.sql` disables RLS there — never run it on production.
