# Security audit — ov-system

Audit date: 2026-07-21 · Scope: `ov-system/` at v1.10.0 · Migrations reviewed: 0001–0019

## Executive summary

The architecture is fundamentally sound in one very important way: **the service role key is never used anywhere in application code.** Every Supabase call — server actions, server components, the browser client — goes through the anon key plus the caller's own session, so Postgres RLS is genuinely in the request path. Input validation (Zod, `src/lib/actions/schemas.ts`) is applied consistently, and the XSS surface is clean.

That same architecture is what makes the findings below severe. Because RLS is the only real boundary, **any gap in RLS is a gap in the product** — the `NEXT_PUBLIC_SUPABASE_ANON_KEY` is by design public, and the session JWT sits in the user's own browser. An attacker never has to go through a Server Action; they call PostgREST directly. Every "the app checks this" control in `src/lib/permissions.ts` is advisory from an attacker's point of view.

One finding is a full unauthenticated compromise.

---

## Findings

### C1 — CRITICAL — Privilege escalation to `admin` from a credential-less guest session

**Where:** `supabase/migrations/0002_rls.sql:60-62`

```sql
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid() or auth_role() = 'admin');
```

RLS is **row**-level, not column-level. This policy asks "is this your row?" and nothing else. After setting `role = 'admin'` the row still satisfies `id = auth.uid()`, so the write is accepted.

**The exploit chain, end to end, requiring zero credentials:**

1. The login page offers "Masuk sebagai Tamu", which calls `signInAnonymously()` (`src/app/login/page.tsx:37`). Anyone can do this. The anon key needed to do it directly is in the public JS bundle.
2. The `handle_new_user` trigger (`0017_fix_anon_profile_trigger.sql`) fires on **every** `auth.users` insert including anonymous ones, so the guest now has a real `profiles` row with `id = auth.uid()`.
3. From the browser console:
   ```js
   supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
   ```
4. `auth_role()` now returns `'admin'`, which is the sole condition in every write policy in 0002 and 0016.
5. Full read/write/delete on all 13 tables, plus `backups` (`backups_admin_all`) — which is a complete JSON dump of the database — plus restore.

`src/lib/auth.ts:61` returns `GUEST_USER` for anonymous users and never reads their profile, so the **app UI** stays read-only. That is exactly the trap: the app-layer control is real, and completely irrelevant, because the attack does not go through the app. This is the concrete cost of trusting `permissions.ts` as a security boundary rather than as UX.

**Why it wasn't caught:** migration 0016 correctly hardened the *read* policies against the bare anon key, but the *write* policies were left keyed on `auth_role()` alone — and a guest's auto-created profile row makes `auth_role()` a value the guest controls.

**Fix:** `0020_security_authz_hardening.sql` — revoke blanket UPDATE on `profiles` and re-grant only `(name, avatar_color)`; add a `WITH CHECK` pinning `role`/`division` to their stored values; move admin role changes into a `SECURITY DEFINER` `set_user_role()`; and add restrictive `not is_anon()` write policies on every table.

---

### H1 — HIGH — Authorization is division-scoped but not Ormawa-Visit-scoped

**Where:** `supabase/migrations/0002_rls.sql:64-78`, `src/lib/permissions.ts:50-59`

```sql
(auth_role() = 'coordinator' and division = auth_division())
```
```ts
if (user.role === "coordinator") return !division || division === user.division;
```

Both layers compare a bare division **key**. Migration 0018 changed `divisions` so that `key` is unique only *per event* (`unique(event_id, key)`), and 0019's real roster deliberately reuses keys across editions (`EVENT`, `OPERATIONAL`, `CREATIVE` appear in ov1-2025, ov2-2025, ov1-2026).

So the coordinator of division `EVENT` in **ov1-2025** can read, edit, and delete the tasks of division `EVENT` in **ov2-2026** — a different edition with a different team. This is precisely the isolation guarantee you asked about, and it currently does not hold. The same is true for staff/intern via `tasks_update`.

**Fix:** `profiles.event_id` + `auth_event()` + an `owns_scope(event_id, division)` helper used by all task policies. Fails closed: a NULL `profiles.event_id` grants no authority to a non-admin, so **you must backfill `event_id` for every coordinator/staff/intern profile** as part of deploying 0020.

---

### H2 — HIGH — Staff and interns can rewrite any column of a task

**Where:** `0002_rls.sql:69-74` vs `src/lib/actions/tasks.ts:46-49`

The Server Action carefully restricts non-coordinators to progress fields only:

```ts
const onlyProgress = keys.every((k) => k === "status" || k === "result");
const allowed = onlyProgress ? can.editTaskProgress(user, task) : can.editTask(user, task);
```

RLS has no equivalent restriction — `tasks_update` permits staff/intern to update the whole row. A staff member can reassign `pic`, rewrite `title`, or move deadlines by calling PostgREST directly. The app-layer check is bypassed entirely, not weakened.

**Fix:** column-level `GRANT UPDATE (...)` on `tasks` in 0020. RLS cannot express "not this column"; GRANTs can.

Related: `isAssignedTo()` (`src/lib/permissions.ts:5-10`) is loose in two ways worth knowing about. It substring-matches the first name against the free-text `pic` field (a user named "Ali" matches a task assigned to "Alifia"), and it returns `true` for *any* task in the user's division regardless of PIC. The comma-joined-names storage noted in your AGENTS.md is the root cause; storing member IDs would let both layers do an exact check.

---

### H3 — HIGH — Budget, rundown, jobs and teams have no event scope at all

**Where:** `src/lib/actions/budget.ts` (every action), `0002_rls.sql:93-104`, `0016:69-80`

`can.manageBudget()` is a pure role check — `admin || coordinator` — with no reference to which RAB, which division, or which edition. RLS matches it. Any coordinator can call `deleteBudgetPlanAction(id)` for **any** plan in **any** Ormawa Visit and it succeeds at both layers.

Same shape for `rundown` / `job_harih` / `teams` after 0016.

**Fix:** event-scoped policies in 0020, plus the Server Action pattern in the next section.

---

### H4 — HIGH — The scheduled backup has been silently failing since 0016 (and is the one legitimate service-role case)

**Where:** `src/app/api/cron/backup/route.ts:26` → `src/lib/backup.ts:31-40`

`createBackup()` calls `createClient()` from `src/lib/supabase/server.ts`, which builds a **cookie-scoped** client. A Vercel Cron request carries no cookies, so `auth.uid()` is NULL. Since 0016 replaced `read_public USING (true)` with `USING (auth.uid() is not null)`, `captureSnapshot()` now reads **zero rows from every table**, and the insert into `backups` is rejected by `backups_admin_all`.

The rollback safety net is not working. Worth verifying against your Vercel cron logs — you should see 500s every 3 days.

This is the textbook case for the service role key: a trusted server-only context with no user session, on a route that has its own authentication.

---

### M1 — MEDIUM — `enterGuestMode` / `ov_guest` make the proxy a non-boundary

**Where:** `proxy.ts:60-64`, `src/lib/actions/session.ts:38-42`, `src/lib/auth.ts:54`

```ts
const isGuest = request.cookies.get("ov_guest")?.value === "1";
if (!user && !isGuest && !isPublic) { /* redirect */ }
```

`ov_guest` is set without `httpOnly`, so `document.cookie = "ov_guest=1"` in any browser passes the proxy check and makes `getCurrentUser()` return `GUEST_USER` with no Supabase session whatsoever. `enterGuestMode()` is likewise an unauthenticated Server Action.

Post-0016 this leaks no data (`auth.uid()` is NULL, so RLS returns nothing), so I'm rating it medium rather than high — but it means **`proxy.ts` is a UX redirect, not an access control**, and should be documented as such so nobody later moves a real check into it.

---

### M2 — MEDIUM — `setRole` is an unauthenticated role-switch action

**Where:** `src/lib/actions/session.ts:12-17`

```ts
export async function setRole(userId: string) {
  if (!DEMO_USERS.some((u) => u.id === userId)) return;
  store.set(AUTH_COOKIE, userId, ...);
}
```

Inert in production **only** because `getCurrentUser()` ignores `AUTH_COOKIE` when `USE_SUPABASE` is true. That is an accident of control flow, not a check. If anyone ever reorders those branches in `auth.ts`, this becomes instant privilege escalation in production. Add the explicit guard.

---

### M3 — MEDIUM — Cron secret accepted via query string, compared non-constant-time

**Where:** `src/app/api/cron/backup/route.ts:16-19`

```ts
const provided = auth?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("secret");
if (provided !== secret) { ... }
```

`?secret=` lands in Vercel access logs, any proxy logs, and the `Referer` header of anything the page loads. Vercel Cron sends the `Authorization` header, so the query-string fallback buys nothing. `!==` on a secret is also a (weak, but free-to-fix) timing oracle. There is no rate limit on the route.

---

### M4 — MEDIUM — Anonymous guests can read every member's email

**Where:** `0002_rls.sql:59` — `profiles_read ... using (auth.uid() is not null)`

An anonymous guest satisfies `auth.uid() is not null`, so the guest button grants a read of every profile row: names, emails, roles, divisions. 0016 was careful to keep budget and links away from guests but left `profiles` open. Combined with `members.nrp` (student ID — PII) being guest-readable via `read_auth`, a no-credential visitor can enumerate the full roster.

---

### M5 — MEDIUM — No security headers

**Where:** `next.config.ts`

No CSP, `X-Frame-Options`, `Referrer-Policy`, or HSTS. A CSP is the second line of defense that turns a hypothetical future XSS into a blocked report instead of a session theft.

---

### Clean — things I checked that are correct

- **Service role key: never used in application code.** Only declared in `.env.example`. This is the single most important thing to keep true.
- **XSS: no findings.** Zero occurrences of `dangerouslySetInnerHTML`, `innerHTML`, or `eval` in `src/`. React escapes by default, and every rendered link is gated on `isUrl()` (`src/lib/format.ts:48`) which requires `^https?://` — so a stored `javascript:` URI cannot become a live href even if written directly to the DB. All external anchors carry `rel="noopener noreferrer"`.
- **Input validation is genuinely good.** `parse(schema, input)` in every action, `.strip()` semantics for mass-assignment, length caps, enum whitelists. Note its real role though: it protects data integrity, not authorization — a direct PostgREST call skips it entirely, which is why the DB-level constraints in 0020 matter.
- **CSRF.** Next.js Server Actions are POST-only with non-guessable IDs and a built-in Origin/Host check; `@supabase/ssr` sets `httpOnly` session cookies. No custom CSRF layer needed. Do add `secure: true` to your own cookies (below).
- **`SECURITY DEFINER` functions.** `handle_new_user`, `auth_role`, `auth_division` all correctly `set search_path = public`, which closes the classic definer-function hijack.
- **Per-request Supabase client.** `src/lib/supabase/server.ts` builds a fresh client per request — no module-global session leak between users.
- **Demo isolation.** `supabaseCreds()` as a single choke point, unit-tested. `demo-open-access.sql` disabling RLS is safe *only* because it targets a separate project; keep that invariant loudly documented.

---

## Prioritized action checklist

| # | Action | Severity | Effort |
|---|--------|----------|--------|
| 1 | **Rotate nothing yet — first, check `profiles` for unauthorized `role='admin'` rows.** See query below. Assume compromise until proven otherwise. | Critical | 5 min |
| 2 | Run `0020_security_authz_hardening.sql` | Critical | 10 min |
| 3 | Backfill `profiles.event_id` for every coordinator/staff/intern (0020 fails closed without it) | Critical | 15 min |
| 4 | Disable public sign-ups in Supabase Auth if you provision accounts manually | High | 2 min |
| 5 | Fix the cron backup with a service-role client (code below); verify a backup actually lands | High | 30 min |
| 6 | Add event scoping to `permissions.ts` + budget/schedule actions (code below) | High | 2 h |
| 7 | Header-only cron secret + `timingSafeEqual` | Medium | 15 min |
| 8 | Guard `setRole` with `demoActive()`; add `secure`/`httpOnly` to app cookies | Medium | 20 min |
| 9 | Security headers in `next.config.ts` | Medium | 20 min |
| 10 | Replace comma-joined PIC/member names with member IDs (fixes H2's loose matching properly) | Low | 1 day |

### Step 1 — check for existing compromise, before anything else

```sql
-- Any admin you did not create by hand is an incident, not a bug.
select p.id, p.name, p.email, p.role, u.is_anonymous, u.created_at, u.last_sign_in_at
  from profiles p
  join auth.users u on u.id = p.id
 where p.role in ('admin','coordinator')
 order by u.created_at desc;

-- Anonymous sessions whose profile is not 'viewer' = confirmed exploitation of C1.
select count(*) from profiles p join auth.users u on u.id = p.id
 where u.is_anonymous and p.role <> 'viewer';
```

If either turns up something unexpected: take a backup, demote the rows, rotate the Supabase JWT secret to invalidate all outstanding sessions, and review `backups` for exfiltration.

---

## Reference implementations

### Securing a Server Action (the pattern to apply everywhere)

The current pipeline is role-check → validate → mutate. The missing step is **resource scoping**: authorization must be evaluated against the row being touched, not just the caller's role. `deleteBudgetPlanAction` today authorizes a *verb* (`manageBudget`) without ever looking at the *object*.

Add one helper:

```ts
// src/lib/permissions.ts
/**
 * Scoped authority: a non-admin only has power inside their own Ormawa Visit.
 * Fails closed — an unscoped profile (event_id null) is treated as no authority,
 * so a half-provisioned account can never inherit another edition's data.
 */
export function inScope(user: AppUser, eventId: string, division?: string): boolean {
  if (user.role === "admin") return true;
  if (!user.event_id || user.event_id !== eventId) return false;
  if (!division) return true;
  return !!user.division && user.division === division;
}
```

Then make every mutating action **load the row first** and authorize against it:

```ts
// src/lib/actions/budget.ts
export async function deleteBudgetPlanAction(id: string): Promise<Result> {
  // 1. Identity — never from the client. getCurrentUser() reads the verified
  //    Supabase session; a client-supplied user/role/event id is an attacker input.
  const user = await getCurrentUser();

  // 2. Validate the identifier before it reaches the data layer.
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;

  // 3. Load the RESOURCE, and fail identically for "missing" and "not yours".
  //    Distinct error messages here turn the action into an oracle that lets a
  //    coordinator enumerate which plan ids exist in other editions.
  const plan = await getBudgetPlan(idv.data);
  if (!plan) return DENY;

  // 4. Authorize the verb against THIS object, not against the role alone.
  if (!can.manageBudget(user) || !inScope(user, plan.event_id)) return DENY;

  await deleteBudgetPlan(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
```

Four properties, each load-bearing: identity is server-derived; input is validated; the resource is fetched so authorization has an object to reason about; and the denial is indistinguishable from not-found. Note that step 4 is still only *defense in depth* — the authoritative version of this rule is the `budget_plans_write` policy in 0020, because that one also holds when the request bypasses this function entirely.

### An RLS policy that survives a direct PostgREST call

The two ideas that matter most, both from 0020:

```sql
-- 1. Scope on the tuple that actually identifies ownership. Since 0018 a
--    division key alone is ambiguous across editions, so match BOTH.
create policy "tasks_update" on tasks for update to authenticated
using (
  auth_role() = 'admin'
  or (auth_role() in ('coordinator','staff','intern')
      and owns_scope(event_id, division))
)
-- WITH CHECK is not optional. USING gates which rows you may target; WITH CHECK
-- gates what the row is allowed to look like AFTERWARDS. Omit it and a user can
-- move a row out of their own scope — writing event_id of another edition — in
-- the same statement that passes USING.
with check (
  auth_role() = 'admin'
  or (auth_role() in ('coordinator','staff','intern')
      and owns_scope(event_id, division))
);

-- 2. RLS cannot say "every column except this one". That is a GRANT.
--    This is the actual fix for C1 and H2 — policies alone cannot express it.
revoke update on public.profiles from authenticated, anon;
grant  update (name, avatar_color) on public.profiles to authenticated;
```

And the guard that would have prevented C1 outright — anonymous sessions are read-only at the database, not merely in the UI:

```sql
-- RESTRICTIVE policies AND with everything else, so this cannot be widened by
-- adding another permissive policy later. Split by command because a FOR ALL
-- restrictive policy applies USING to SELECT (breaking guest reads) and DELETE
-- ignores WITH CHECK (leaving deletes open).
create policy "tasks_no_anon_update" on tasks as restrictive
  for update to authenticated using (not is_anon()) with check (not is_anon());
```

### Fixing the cron backup — the only correct use of the service role key

```ts
// src/lib/supabase/admin.ts
import "server-only";                      // build-time failure if imported from a client component
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES RLS ENTIRELY — every row of every table.
 *
 * Permitted callers: the cron backup route only.
 * Forbidden: anything reachable from a user request, any Server Action, any
 * Server Component, any file under src/components. If a request-scoped caller
 * needs data, it must go through the cookie-scoped client in server.ts so RLS
 * applies. A single service-role query behind a user-facing endpoint silently
 * deletes every authorization guarantee in this document.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

```ts
// src/app/api/cron/backup/route.ts
import { timingSafeEqual } from "node:crypto";

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  // Compare length separately — timingSafeEqual throws on a length mismatch,
  // and an exception is itself an observable timing/behaviour difference.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi." }, { status: 501 });

  // Header only. A ?secret= query param is written to Vercel access logs and
  // leaks via Referer; Vercel Cron sends the Authorization header anyway.
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... createBackup() must now use createAdminClient(), not createClient()
}
```

`createBackup` / `captureSnapshot` in `src/lib/backup.ts` should take the client as a parameter so the admin client is used *only* on this path, and the admin-triggered manual backup in Settings keeps using the RLS-scoped one.

### Cookie and header hardening

```ts
// src/lib/actions/session.ts
const COOKIE_OPTS = {
  path: "/",
  maxAge: YEAR,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production", // never send over plaintext HTTP
  httpOnly: true,                                // JS cannot read or forge it
};
// Note: ov_demo must stay httpOnly:false — supabase/client.ts reads it from
// document.cookie to pick which project to talk to.

export async function setRole(userId: string) {
  // Demo-only identity switch. Without this guard it is one refactor in
  // auth.ts away from being production privilege escalation (M2).
  const store = await cookies();
  if (!demoActive(store.get(DEMO_COOKIE)?.value)) return;
  if (!DEMO_USERS.some((u) => u.id === userId)) return;
  store.set(AUTH_COOKIE, userId, COOKIE_OPTS);
  revalidatePath("/", "layout");
}
```

```ts
// next.config.ts
const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },                    // clickjacking
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Content-Security-Policy",
          // 'unsafe-inline' on style-src is required by Tailwind's runtime styles.
          // script-src should move to a nonce once you can measure the fallout;
          // start in Report-Only if you want to ship this without risk.
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} ${process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL ?? ""}`,
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ],
    }];
  },
};
```

---

## Ongoing practice

**A test that would have caught C1.** Any new table or policy should be checked from the attacker's seat — a raw PostgREST call with the anon key and a guest JWT, asserting the write is rejected. Add it to Vitest alongside the existing schema tests; it is the only kind of test that models the actual threat, because it does not go through `permissions.ts` at all.

**A rule for `AGENTS.md`.** The current step 1 ("check the role with `can.*`") should be amended: *authorize against the loaded row, not the role alone, and mirror the rule in RLS — the RLS policy is the real control; the `can.*` check is UX.* Also: any new table must ship with explicit SELECT/INSERT/UPDATE/DELETE policies in the same migration that creates it, because a table with RLS enabled and no policy fails closed, but a table with RLS *not* enabled is world-writable through the public anon key.

**On `is_anonymous`.** Guest mode via anonymous sign-in was the right call for the read side — it is what let 0016 close the `read_public USING (true)` hole. But it means guests now hold a real `auth.uid()`, and every policy written as "authenticated ⇒ trusted" silently includes them. Treat `not is_anon()` as a required clause on every write policy you add from here.
