# Ormawa Visit Management System - Improvement Plan

Date: 2026-07-26 · Version at time of writing: v1.18.0
Evidence base: Graphify knowledge graph (`graphify-out/graph.json` - 1098 nodes, 3677 edges,
84 communities, built from 196 code files + 28 SQL migrations), plus direct measurement of
the tree. Every item below cites what it is based on.

Regenerate the graph before re-reading this doc:

```bash
graphify extract . --code-only && graphify cluster-only . --no-label
```

---

## What the graph says about the system today

**Healthy signals**

- **No import cycles.** Graphify's cycle detector reports none across 196 files. The layering
  (page → component → action → repo → backend) is genuinely acyclic.
- **The hubs are the right hubs.** The ten most-connected nodes are `useT()` (121 edges),
  `cn()` (105), `getCurrentUser` (92), `react` (76), `parse()` (63), `sb()` (55), `mutate()`
  (49), `getT()` (33), `Button` (32), `getActiveEvent` (31). Those are exactly the shared
  concerns you would *want* centralised: i18n, styling, auth, validation, DB client. There is
  no accidental god-object holding business logic.
- **The validation layer is real.** `parse()` at 63 edges means the Zod gate is genuinely on
  the hot path of the action layer, not decoration.

**Where the mass sits**

- The data layer is the single heaviest thing in the codebase: `repo.ts` (954 lines) +
  `local.ts` (718 lines) = **1672 lines, ~10% of all source**, and 47 function names exist in
  *both* files.
- 71 server actions across 12 files, all funnelling into that layer.
- 66 of 153 source files are `"use client"`.

---

## Wave 0 - Operational risk (do first; cheap, and everything else assumes it)

### 0.1 - Two migrations share the number `0020` **[S, do today]**

```
supabase/migrations/0020_security_authz_hardening.sql
supabase/migrations/0020_task_links.sql
```

Migrations here are applied **by hand in the Supabase SQL editor**, in filename order, and
`0020_security_authz_hardening.sql` has never been run. There is no tooling that will catch
the collision - the ordering is whatever the person reading the folder decides. Rename
`0020_task_links.sql` → `0025_task_links.sql` (it is already applied in production, so also
record that fact) or, better, renumber the *unapplied* security one to the end of the
sequence. Then add `scripts/check-migrations.mjs` asserting numbers are unique and gapless,
and run it in `npm test`.

### 0.2 - Production is 8 migrations behind **[S, blocking]**

`0017`–`0024` are all documented as "user must run". Until they are applied, several shipped
features are dead in production (role requests need `0023`/`0024`, prospect primary needs
`0022`, task links need task_links). Write the actual apply order down in
`supabase/migrations/README.md` and track applied-state in a table
(`schema_migrations(version, applied_at)`) so the app can *tell you* it is behind instead of
failing opaquely.

### 0.3 - There is no CI **[M, high leverage]**

Every quality gate in this repo is "the agent remembered to run it". Add a GitHub Action on
push/PR: `tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`, plus 0.1's migration
check. This is the single change that stops regressions between sessions.

---

## Wave 1 - Security

### 1.1 - Apply the `0020` self-promotion fix **[S, critical]**

`docs/SECURITY-AUDIT.md` C1: `profiles_update_own` has no `WITH CHECK` and no column grant,
so any authenticated session - **including the credential-less anonymous "Tamu"** - can run
`update profiles set role='admin' where id = <own uid>`. The fix exists, unapplied, in
`0020_security_authz_hardening.sql`. Since the anon key is public, `permissions.ts` cannot
mitigate this; RLS is the only boundary.

### 1.2 - Make "every table has explicit policies" mechanical **[M]**

The audit's recurring theme is that a new table ships without policies and silently inherits
something permissive. Add a test that parses `supabase/migrations/*.sql`, collects
`create table` statements, and fails if a table never receives both `enable row level
security` and at least one policy - and a second assertion that every write policy carries
`not is_anon()`. Cheap to write, permanently closes the class.

### 1.3 - The cron backup route has been broken since 0016 **[S]**

Audit H4: it uses the cookie-scoped client with no session, so it reads zero rows. This is
the one legitimate service-role use in the app. Fix it or delete the route - a backup system
that silently backs up nothing is worse than none, because Settings shows it as working.

---

## Wave 2 - Performance and efficiency

### 2.1 - `revalidatePath("/", "layout")` is called 61 times **[M, biggest perf win]**

Measured: 75 `revalidatePath` calls, **61 of them the full-layout bust**. Every single
mutation - renaming one budget line, ticking one task - invalidates the entire route tree, so
the next navigation re-fetches everything for every page. The prior decision to keep this was
"correctness > perf", which was right at the time; the graph now gives you the dependency
information to narrow it safely.

Move to tag-based invalidation: tag reads in `repo.ts`
(`unstable_cache(..., { tags: ["tasks", `event:${id}`] })`), and have each action call
`revalidateTag` for exactly what it touched. `graphify affected "getTasks"` already prints
the consumer set for each getter, which is the mapping you need - for `getTasks` it is
calendar, divisions/[key], tasks, dashboard, members, events pages plus `taskStats`,
`divisionStats`, `cloneEventData`.

### 2.2 - 33 KB of translations ship to every browser **[S, easy win]**

`src/lib/i18n/dict.ts` is 33,367 bytes and is imported by `src/lib/i18n/provider.tsx`, which
is `"use client"`. Both languages' full map lands in the client bundle on every page, for
every user, including Indonesian users who never toggle. Options, cheapest first:

1. Split `EN` into its own module and `import()` it lazily inside the provider only when
   `lang === "en"` - Indonesian users then download none of it.
2. Longer term, key by stable IDs rather than the Indonesian source string and ship only the
   keys a given route uses.

### 2.3 - Dashboard aggregates in the app, not the database **[M]**

`taskStats`, `divisionStats`, `prospectStats`, `budgetTotal` each pull whole tables and
reduce them in JS. That is six parallel round-trips returning far more rows than the four
numbers on screen. Replace with one Postgres view or RPC (`dashboard_stats(event_id)`)
returning the aggregates. Also fixes the fact that the numbers can disagree if a write lands
between the parallel fetches.

### 2.4 - Serialise-free the remaining pages **[S]**

`src/app/(app)/settings/page.tsx` has 4 awaits and **zero** `Promise.all`; `links` and
`budget` each have one `Promise.all` but additional loose awaits. Wrap them.

### 2.5 - Code-split the heavy client islands **[S]**

`@dnd-kit` is only used by `task-kanban.tsx` and `jobs-table.tsx`, but the kanban is one of
three tabs on the tasks page - most visits never open it. `next/dynamic` both, with the
table view as the default import.

### 2.6 - Cache the graph of who-needs-what, not just the data **[S]**

21 getters in `repo.ts` are already `cache()`-wrapped. Two are not fully: keep the audit
going, and remember the documented gotcha that `cache()` keys on **primitive** args, so
object-arg getters like `getTasks(filter)` do not dedupe (hence `getEventTasks`).

---

## Wave 3 - Architecture and maintainability

### 3.1 - Collapse the dual data backend **[L, biggest maintenance win]**

This is the structural finding. `repo.ts` and `local.ts` implement the same 47 operations
twice; ~70 functions open with `if (!USE_SUPABASE) return local.X(...)`. Every new feature
costs two implementations plus a bulk variant that loops in local and batches in Supabase
(`bulkDeleteTasks` is the canonical example). This is where drift will eventually bite.

Two honest options:

- **(A) Delete the local backend.** Use a real Postgres for dev (Supabase CLI local stack, or
  PGlite for tests). Removes 718 lines and an entire class of divergence. Cost: contributors
  need Docker or the CLI.
- **(B) Keep both, but dispatch once.** Define a `DataSource` interface, make Supabase and
  local two implementations, and select the implementation *once* at module load rather than
  in every function body. Generate the CRUD-shaped 80% from a table descriptor
  (name, nullable text columns, event-scoped yes/no) and hand-write only the rest.

I recommend **(B)** - it preserves the zero-setup demo path the project clearly values, and
it can be done incrementally, one entity at a time, with the existing tests as the harness.

### 3.2 - Make the `coalesce()` footgun impossible **[S]**

The known crash class - Supabase returns `NULL` for empty text, then `.trim()` explodes - is
currently prevented by remembering to call `coalesce(rows, keys)` in each new getter, with
the key list written out by hand each time. Move the nullable-text-column list into one
per-table descriptor and apply it inside a shared `select()` helper. Then a new getter is
null-safe by construction, and the AGENTS.md rule ("when adding a getter, coalesce its text
fields") can be deleted rather than obeyed.

### 3.3 - Split the four oversized components **[M]**

`member-manage.tsx` (511), `budget-view.tsx` (491), `links-view.tsx` (411),
`rundown-view.tsx` (372). Each mixes a table, a form dialog, and bulk-selection logic in one
file. Extract the dialogs and the bulk bars; the multi-select hook already exists
(`lib/use-multi-select.ts`) and gives you the seam.

### 3.4 - Stop storing people as comma-joined name strings **[M, correctness]**

PIC and team membership are comma-joined display names. The current defence is a Zod
`.refine()` rejecting commas in member names - explicitly recorded as a stopgap. It also
means `isAssignedTo` matches on first names, which already caused the demo-user PIC matching
to silently stop working. Introduce join tables (`task_pics`, `team_members`) with real FKs.
This is the last significant data-model debt.

---

## Wave 4 - Code quality and tests

### 4.1 - 31 lint errors, in two families **[M]**

Measured across 15 files:

- **17 × "setState synchronously within an effect"** - budget-view (×2), division-manage,
  event-form-dialog, faq-manage, jobs-table (×2), theme-toggle, links-view (×2),
  member-manage (×2), prospect-form-dialog, task-form-dialog, task-kanban, task-table,
  backup-panel. The project already has the correct pattern for this - `useSynced()` in
  `rundown-view.tsx` does render-time prev/next sync. Apply it uniformly and the family
  disappears.
- **14 × "Cannot create components during render"** - `prospects-view.tsx:230-235`,
  `task-table.tsx:171-176`, `guide-tabs.tsx:32-33`. All are components defined inline in a
  render body; hoist them to module scope.

Plus one `useMemo` dependency warning (`divMap` in members-view) and one unused import
(`DivisionBadge` in `task-timeline.tsx`). Once at zero, make lint a CI gate (Wave 0.3) so it
stays there.

### 4.2 - The 71 server actions have no tests **[M, highest-value test work]**

Current coverage: 6 test files for 153 source files, all of it pure logic (permissions,
schemas, format, demo, multi-sort, legal). The actions themselves - the place where the
`can.*` → `parse()` → repo pipeline actually has to hold - are untested end to end. Every
production bug in the changelog history lives here: validated data discarded and the raw
input passed on (`createProspectAction`), a `progressOnly` payload that failed its own check,
bulk writes that swallowed RLS errors.

Add a fake `DataSource` (trivial once 3.1 lands, doable now with `vi.mock`) and, per action,
assert: denied role → `{ok:false}` and no repo call; invalid input → `{ok:false}` and no repo
call; valid input → repo called with the *parsed* object, not the raw one. A generic
"every exported action rejects a viewer" sweep catches new actions automatically.

### 4.3 - One end-to-end smoke test **[M]**

Demo mode is a perfect fixture: no auth, separate database, resettable. A single Playwright
run - enter demo, create a task, change its status, verify it persists, reset - would have
caught the "status changes did nothing" bug that shipped twice.

### 4.4 - Guard the i18n contract **[S]**

The translation key *is* the Indonesian source string, so a typo silently falls back to
Indonesian instead of failing. Add a test that greps `t("…")` / `getT()` call sites and
reports keys missing from `EN`. Turns a silent degradation into a build error.

---

## Wave 5 - Product and UX

Ordered by value to the actual users (EA committee members during a visit cycle):

1. **Excel export** - they came from spreadsheets and their advisors still ask for them. WBS,
   RAB and rundown to `.xlsx` closes the loop.
2. **Deadline notifications** - the data is there (`daysUntil`, overtime auto-status) but
   nothing reaches the user unless they open the dashboard. Email or WhatsApp digest of
   what's due this week, per PIC.
3. **Realtime instead of revalidate** - Supabase realtime on tasks/rundown would make the
   rundown table genuinely collaborative on event day, which is when several people edit it
   at once. Pairs naturally with 2.1.
4. **Mobile polish** - the dashboard currently overflows horizontally at 375px; the offenders
   are the topbar control cluster and the quick-access carousel, not the cards. Event day is
   phone-first.
5. **Accessibility pass** - several interactive elements are `div role="button"`; the charts
   convey status by colour alone. Neither is hard to fix and both matter for a public-facing
   university system.
6. **Onboarding for a new cabinet** - the template/clone flow exists but is buried in the new
   OV dialog. A "start next Ormawa Visit" wizard would make the yearly handover the happy
   path.

---

## Wave 6 - Keep the map current

The graph is only useful if it is fresh. `graphify hook install` adds post-commit and
post-checkout hooks that run `graphify update .` (local AST, no API cost, no data leaves the
machine). Add `graphify-out/` to `.gitignore` - **done** - and consider `graphify claude
install` so future sessions can query the graph instead of re-reading the tree.

---

## Suggested order

| Order | Items | Why here |
|---|---|---|
| 1 | 0.1, 0.2, 1.1, 1.3 | Correctness and a live privilege-escalation hole. Days, not weeks. |
| 2 | 0.3, 4.1 | CI + a clean lint baseline, so nothing below regresses silently. |
| 3 | 2.2, 2.4, 2.5, 2.1 | Perf, cheapest first; the `revalidateTag` migration last because it is the widest. |
| 4 | 4.2, 4.4, 1.2 | Test the action pipeline before refactoring what it sits on. |
| 5 | 3.2, 3.3, 3.1 | Architecture, protected by the tests from step 4. |
| 6 | 3.4, 2.3 | Data-model changes; need migrations and a backfill. |
| 7 | Wave 5 | Product work, once the foundation stops costing double. |

Waves 1–4 are all internal: no user-visible behaviour changes, so they need no changelog
entry beyond a patch bump. Waves 5 and 3.4 do - follow the AGENTS.md rules for version,
changelog, `guide.ts`, and `dict.ts` in the same change.
