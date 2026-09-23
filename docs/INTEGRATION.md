# Menu integration map - ov-system

Last reviewed: 2026-09-23 · v1.50.0 · Migrations up to 0051

This is the record of **which menus share data, and how a change in one reaches
the others**. Read it before adding a menu, a field that names something in
another menu, or a new write path. The short version: most menus are views over
the same tables, so they are integrated by construction; the places where one
menu keeps a *copy* or a *name* of something owned by another are where
integration has to be written by hand, and those are listed one by one below.

If you change any arrow on this page, update the page in the same change, the
same habit AGENTS.md asks for the Panduan and Violet's `system.ts`.

---

## 1. Menus and the data they own

Every menu below except Inbox, Role Request, FAQ, Panduan and Pengaturan is
scoped to ONE Ormawa Visit (edition, `events.id`), the one picked in the topbar.

| Menu (route) | Owns (tables) | Reads from other menus |
|---|---|---|
| Daftar Ormawa Visit (`/events`) | `events` | task progress, primary RAB total |
| Dashboard (`/dashboard`) | nothing | tasks, divisions, members, primary RAB, edition performance fields |
| Work Breakdown (`/tasks`) | `tasks`, `task_links`, `task_refs`, `task_comments` | divisions, members + teams (PIC picker), Super Link (reference picker) |
| Kalender (`/calendar`) | nothing | the same tasks as Work Breakdown |
| Papan Divisi (`/divisions/[key]`) | nothing | the same tasks, filtered to one division |
| Divisi & Anggota (`/members`) | `divisions`, `members`, `teams` | task progress per division |
| Rundown (`/rundown`) | `rundown` | divisions (one column per division not excluded from the rundown) |
| Job Hari-H (`/jobs`) | `job_harih` | members (PIC picker) |
| Reach & Offer (`/prospects`) | `prospects`, `prospect_links` | members (PIC picker) |
| Himpunan (`/himpunan`) | `fgd_plans`, `fgd_rows`, `compare_subjects`, `compare_entries` | prospects (the Compare gate and the subject picker) |
| Super Link (`/links`) | `links` | divisions of every edition (grouping) |
| Anggaran (`/budget`) | `budget_plans`, `budget_items` | nothing |
| Kotak Masuk (`/inbox`) | `broadcasts`, `broadcast_recipients` | accounts (not edition-scoped) |
| Role Request (`/roles`) | `role_requests` | `profiles` (approval writes the role through an RPC) |

Cross-cutting readers that see everything at request time, so they need no
wiring: global search (`actions/search.ts`), Violet (`lib/violet/live.ts`),
backups (`lib/backup.ts`).

---

## 2. How integration is achieved: four mechanisms

Knowing which mechanism an arrow uses tells you what can go stale.

1. **Shared read.** Two menus render the same rows. Work Breakdown, Kalender,
   Papan Divisi and the Dashboard all read `tasks`; nothing is copied, so
   nothing can disagree. The only thing that can go stale is Next's page cache,
   which is what mechanism 4 is for.
2. **Derived at read time.** A value is computed when read instead of stored:
   Overtime status (`effectiveStatus`), rundown duration, a division's team
   roster (from `members.divisions`), the Compare gate (count of DITERIMA
   prospects), the RAB figure on the Dashboard (`primaryBudgetPlan`), and since
   v1.50.0 the URL of a task reference picked from Super Link. Always current,
   no write needed. Prefer this whenever the value can be computed cheaply.
3. **Write-through.** One action writes a second menu's table in the same
   request. Needed wherever a menu stores a COPY or a NAME of another menu's
   data. Every write-through in the app is listed in section 3; each one runs
   inside the action's `try`, so a failure surfaces as an error toast rather
   than a half-applied change that says "saved".
4. **Cache invalidation.** Pages are server-rendered, so after a write the
   routes that read the changed entity must be revalidated.
   `CONSUMERS` in `src/lib/actions/revalidate.ts` maps each entity to the routes
   that read it, and every action calls `revalidateEntities(...)` for every
   entity it wrote, including the write-through targets. When a page starts
   reading a new entity, add its route there, or that page stays stale until
   some unrelated write happens to bust it.

The database adds two more guarantees underneath: foreign-key cascades (an
edition's children go with it) and the archive lock (`writable_event()`),
which blocks writes to every edition-scoped table of a locked edition.

---

## 3. The integration matrix

"When X changes, Y follows." Each row names the code that does it.

### Ormawa Visit (edition)

| Change | What follows | Mechanism | Code |
|---|---|---|---|
| Edition deleted | Its divisions, tasks (+ links, refs, comments), rundown, jobs, teams, FGD, Compare **and** its members, prospects (+ links), Super Link entries, RAB plans (+ items) are deleted | DB cascade + explicit delete | `repo.deleteEvent`, migration **0051** |
| Edition archived (`locked`) | Every edition-scoped menu turns read-only for non-admins | RLS + UX guard | `writable_event()`, `archivedGuard`, `attenuate` |
| Active edition switched | Every edition-scoped menu shows that edition | Shared read (cookie) | `session.ts` |
| New edition created from a template | Chosen menus are COPIED once from source editions | One-shot copy, not a live link | `cloneEventData` |

### Divisi & Anggota

| Change | What follows | Mechanism | Code |
|---|---|---|---|
| Division added / renamed / recoloured | Work Breakdown badges and filters, Papan Divisi, Rundown columns, Super Link grouping, Dashboard, member pickers | Shared read (by `key`) | `getDivisions` |
| Division "not in rundown" toggled | Its Rundown column appears or disappears (text is kept) | Derived at read | `rundown-view.tsx` |
| Division deleted | Members lose that division (primary moves to the next one), its team/coordinator row is deleted; its tasks stay, without a badge | Write-through | `detachDivisions` |
| Division `key` | Never changes after creation: every other table points at it | Stripped from updates | `withoutKey` in `manage.ts` |
| Member given a division | They appear on that division's card and in its PIC picker | Derived at read | `divisionMembers`, `splitForDivision` |
| Member renamed (name or nickname) | Same person renamed in task PIC, Hari-H PIC, prospect PIC, team coordinator, within their edition | Write-through | `memberRipple` + `renameMemberReferences` |
| Member leaves a division, or becomes an intern | Removed from that division's coordinator line | Write-through | `memberRipple` + `unseatCoordinator` |
| Member deleted | Removed from every coordinator line of the edition; PIC history kept | Write-through | same |

People are stored **by name** (comma-joined text) in `tasks.pic`,
`job_harih.pic`, `prospects.pic` and `teams.coordinator`, not by member id. That
format predates the roster and lets hand-typed names survive, which is why a
rename has to be written through. Two safety rules live in `memberRipple`:
a name another member of the same edition also answers to is never rewritten
(it would move the other person's tasks), and an edit that does not change the
name ripples nowhere.

### Work Breakdown

| Change | What follows | Mechanism | Code |
|---|---|---|---|
| Any task field | Kalender, Papan Divisi, Dashboard, edition progress, division progress on `/members` | Shared read + revalidation | `CONSUMERS.tasks` |
| Deadline passes | Status reads as Overtime everywhere | Derived at read | `withOvertime` |
| Result link ticked "Tampilkan di Super Link" | A Super Link entry is created, then updated on every save (never duplicated) | Write-through, owner pattern | `syncTaskLinks` |
| Result link unticked / removed / task deleted | Its Super Link entry is deleted | Write-through | `syncTaskLinks`, `purgeTaskLinks` |
| Title, division or edition changed without the dialog (bulk editor) | Published entries move to the new division / title | Write-through | `refreshTaskSuperLinks` |
| Comment thread opened or resolved | Badge in the Work Breakdown table and Kanban | Shared read | `getTaskCommentsByEvent` |

### Super Link

| Change | What follows | Mechanism | Code |
|---|---|---|---|
| Owned entry's name or URL edited here | The owning task result / prospect link gets the same URL and label | Write-through (reverse) | `pushLinkToOwners` |
| Owned entry's division / note / section | Locked in the form and ignored by the action: they belong to the owner | Guard | `updateLinkAction`, `isOwnedLink` |
| Owned entry deleted here | The owner's "Tampilkan di Super Link" is unticked, so it is not silently republished | Write-through | `releaseLinkOwners` |
| Any entry's URL fixed | Every task reference picked from it shows the new URL | Derived at read | `followLinkedRef` |
| Entry deleted | References keep the last URL as plain text (FK sets `link_id` null) | DB | `task_refs.link_id` |

An "owned" entry has `links.source` = `task` or `prospect` (see
`src/lib/links.ts`). Hand-made entries are `manual`. The clone skips owned
entries on purpose: an owned entry without its owner would be an orphan.

### Reach & Offer

| Change | What follows | Mechanism | Code |
|---|---|---|---|
| Prospect set as primary, or the primary edited | Edition's partner, campus, location, mode are copied from it | Write-through | `syncEventFromProspect` |
| Their response set to DITERIMA (on more than one) | Compare opens in Himpunan | Derived at read | Himpunan page |
| Prospect renamed | Its Compare subject is renamed (unless the new name is taken) | Write-through | `renameCompareSubjectFor` |
| Prospect link published / unpublished / deleted | Same owner contract as task results | Write-through | `syncProspectLinks`, `purgeProspectLinks` |
| Prospect deleted | Its Compare subject stays, keeping its copied name (`prospect_id` set null) | DB | 0041 |

### Anggaran

| Change | What follows | Mechanism | Code |
|---|---|---|---|
| Item added / edited in the MAIN plan | Dashboard and Daftar Ormawa Visit totals | Derived at read | `budgetTotal`, `primaryBudgetPlan` |
| Main plan switched | Same | Derived at read | `setPrimaryBudgetPlan` |
| Category colour | Every item of that category in that plan | Write-through (same table) | `setCategoryColor` |

---

## 4. Deliberately NOT integrated

Each of these was considered and left as a copy or free text on purpose. Do
not "fix" one without revisiting the reason.

- **A deleted member's name stays on old tasks as PIC.** A finished task still
  records who did it; the picker shows an unknown name as a free-text chip, so
  nothing is lost or silently reassigned. Only the coordinator line (a
  *current* role) is cleared.
- **A deleted division's tasks are kept, without a division.** Deleting or
  re-filing a division's whole work history as a side effect of tidying the
  division list is the user's decision, not a cascade's (decided in v1.9.0).
  They stay findable through the "Tanpa divisi" filter.
- **Unsetting or deleting the primary prospect leaves the edition's partner
  data as it is.** The edition keeps the last confirmed partner rather than
  going blank.
- **FGD plotting's partner name is free text.** Plotting is usually drafted
  before the partner is confirmed, so it cannot point at a prospect.
- **A Compare subject keeps its own copy of the association name**, so its
  assessments stay readable after the prospect is deleted. While the prospect
  exists, a rename is carried over (section 3).
- **Rundown MC and "Kebutuhan Operator" are free text**, not member pickers.
  A candidate for integration if the committee wants it; today nothing points
  at the roster from there.
- **Copying from another edition is a one-shot snapshot**, not a live link.
  Later edits in the source never reach the copy.
- **Rundown text in a deleted division's column is kept** in
  `division_jobs`, just not shown. Re-creating a division reuses no key (keys
  are generated), so it does not reappear by accident.
- **Kotak Masuk and Role Request are account-scoped, not edition-scoped.** An
  account has no division or edition (see AGENTS.md), so nothing here follows
  the edition switcher.

---

## 5. Cache invalidation map

The authoritative list is `CONSUMERS` in `src/lib/actions/revalidate.ts`. As of
this review:

| Entity | Routes re-rendered after a write |
|---|---|
| `tasks` | `/tasks`, `/calendar`, `/divisions`, `/divisions/[key]`, `/dashboard`, `/events`, `/members` |
| `taskLinks` | task pages + `/links` |
| `taskComments` | task pages |
| `divisions` | task pages, `/rundown`, `/members`, `/links`, `/dashboard` |
| `members` | `/members`, task pages, `/jobs`, `/prospects`, `/dashboard` |
| `teams` | `/members`, task pages, `/links` |
| `prospects` | `/prospects`, `/dashboard`, `/events`, `/himpunan` |
| `prospectLinks` | `/prospects`, `/links` |
| `links` | `/links` + task pages (reference picker) |
| `budget` | `/budget`, `/dashboard`, `/events` |
| `rundown`, `jobs`, `faq`, `himpunan` | their own page |
| `events`, `roles`, `inbox` | the whole layout (topbar switcher, sidebar badges) |

A write-through action busts the targets too: renaming a member revalidates
`members`, `teams`, `tasks`, `jobs` and `prospects`; editing an owned Super
Link entry revalidates `links`, `taskLinks` and `prospectLinks`.

---

## 6. Checklist: adding a menu or a cross-menu field

1. **Can it be derived instead of stored?** If yes, derive it at read time
   (mechanism 2) and you are done.
2. If it must store a copy or a name of another menu's data, write the
   write-through in the ACTION that changes the source, inside its `try`, and
   add it to section 3 here.
3. Add the new route to every relevant entity in `CONSUMERS`, and make each
   write-through action revalidate its targets.
4. Edition-scoped table: its `event_id` foreign key must be
   `ON DELETE CASCADE` (never `SET NULL`: the readers treat a null edition as
   "every edition"), and its write policies need `writable_event()`.
5. Cover it: a pure planner in `src/lib/*` with unit tests where there is
   logic (see `memberRipple`), and an action test in
   `src/lib/actions/integration.test.ts` pinning the arrow.
6. Update the Panduan (`guide.ts`) and Violet's `system.ts` ("integration"
   passage) if users can see the effect.

---

## 7. Review log

### 2026-09-23 (v1.50.0)

Full pass over every menu. Found integrated already: shared reads for tasks,
the Super Link owner contract on save/delete, primary prospect to edition,
the Compare gate, primary RAB to Dashboard, derived team rosters.

Broken or missing, now fixed:

| # | Problem | Fix |
|---|---|---|
| 1 | Deleting an edition left its members, prospects, Super Link entries and RAB plans with `event_id = NULL`, and the readers show null-edition rows under **every** edition, so the deleted edition's roster and prospects appeared everywhere | `repo.deleteEvent` deletes them; migration **0051** switches the four FKs to `ON DELETE CASCADE` (`setup.sql` too) |
| 2 | Renaming a member left the old name in every PIC and coordinator field | `memberRipple` + `renameMemberReferences` |
| 3 | A member removed from a division, turned intern, or deleted stayed listed as that division's coordinator | `unseatCoordinator` |
| 4 | Deleting a division left its key in members' division lists and its team row behind; it also deleted on the first click with no warning | `detachDivisions` + confirmation dialog |
| 5 | An update payload could change a division's `key`, orphaning everything pointing at it | `withoutKey` |
| 6 | Editing an owned Super Link entry was silently reverted on the owner's next save; deleting one left the owner claiming it was still published, and it was republished on the next save | `pushLinkToOwners`, `releaseLinkOwners`, locked fields + source badge in the form |
| 7 | Bulk re-filing tasks into another division left their published results under the old division | `refreshTaskSuperLinks` |
| 8 | Task references kept a stale copy of a Super Link URL after it was fixed | `followLinkedRef` (derived at read) |
| 9 | Renaming a prospect left its Compare card with the old name | `renameCompareSubjectFor` |
| 10 | Finishing a task did not refresh the division progress on `/members` | `/members` added to `CONSUMERS.tasks` |
| 11 | The Super Link edit form offered an edition picker the action silently ignored | Picker disabled in edit mode |

**To deploy:** run `supabase/migrations/0051_edition_delete_cascade.sql` on the
production project (or re-run `setup.sql`). Its closing query also counts rows
that already have no edition; those may be leftovers of earlier deletions and
are worth checking by hand. The demo project needs nothing: the app deletes
those rows itself.
