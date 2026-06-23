# Lessons learned — AbrisTempo Local

> **What this file is.** A living list of project-specific mistakes we've actually hit and the
> rule that prevents them next time. It is **maintained by the `mentor` agent** after reviews, and
> it is **auto-injected into every session** by the `SessionStart` hook (see `.claude/README.md`),
> so the architect, developer and reviewer all start already knowing these.
>
> **Format.** One lesson per entry: a short title, **Symptom** (what went wrong / how it looked),
> **Rule** (what to do instead), and **Refs** (files/commits). Keep each entry tight — if a lesson
> stops being relevant, delete it. Newest at the top.

---

## L-052 · An additive server-side DTO field not mirrored in the TS interface is a silent data drop — update both in the same commit

- **Symptom.** `AdminOrderDto` gained `PaymentReference` and `PaymentConfirmedAt` server-side (EPIC 7
  e-Transfer work). The TypeScript interface in the client was not updated in the same change. The
  build stayed green, `dotnet test` stayed green, `npm test` stayed green — TypeScript has no way to
  flag a missing property it doesn't know about. The fields were simply absent from the client-side
  object. Any future UI that reads `order.paymentReference` to display payment status gets `undefined`
  with no compile-time warning. The gap only materialised as a silent data drop when the consuming UI
  was later built.
- **Rule.** Every new field added to a C# DTO that is serialised over the wire to the Angular client
  **must** be mirrored in the corresponding TypeScript interface in the same commit. The checklist: (1)
  after adding a property to a C# DTO (query result, response record…), grep the client for the
  interface that maps it (typically `features/*/` or `core/models/`); (2) add the matching property
  with the correct TypeScript type (nullable fields → `T | null`, not `T | undefined`); (3) if no
  interface exists yet, create it — do not rely on `any`. The coupling is silent in both directions:
  the server does not know the client dropped a field, and the client's TypeScript checks cannot flag
  a field that doesn't exist in its own interface. Cousin of [[L-036]] (DTO must expose FK ids for
  edit forms) on the **additive-field** axis; also [[L-004]] (one canonical contract shared between
  client and server).
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Application/Orders/Queries/GetAdminOrders/AdminOrderDto.cs`
  (`PaymentReference`, `PaymentConfirmedAt`),
  `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/admin/orders/` (TS interface — update
  target), branch `feat/epic-7-paiement-etransfer`.

## L-051 · Adding a NEW upstream endpoint to an existing read path silently breaks e2e specs that mock only the OLD endpoints

- **Symptom.** The `product-detail` route gained a `GET /catalog/{slug}/type` pre-flight call and the
  home page gained a `GET /shelters` call as part of the shelter-configure-only rework. Every existing
  e2e spec that navigated those routes (`a11y.spec.ts`, `motion-a11y.spec.ts`, `shelter-3d.spec.ts`)
  mocked only the old endpoints. With the new call unmocked, the fetch returned a network error
  (unintercepted `page.route`) and the route either failed to load or timed out. The failure looked
  like a generic backend/network timeout, not obviously program-related — the diff was in the
  component code, not in the spec, so the connection was non-obvious. Fix: add the new endpoint's
  `page.route` mock in every existing spec that navigates the affected route, in the same PR that
  introduces the new call.
- **Rule.** When a new HTTP call is added to an existing read path (a new pre-flight, a new parallel
  load, a new dependency endpoint), treat it as a **breaking change to the e2e mock contract**: grep
  `e2e/` for every spec that navigates the affected routes or mocks any of that route's endpoints, and
  add the new `page.route(…)` mock in the same PR. The failure mode is a silent timeout or empty
  render — not a compile error, not a 404 — because Playwright does not error on an unrouted fetch by
  default. Two guards: (1) before merging any change that adds a new `http.get(…)` or `inject(…Service).load(…)`
  to a component, grep `e2e/` for the component name and every URL segment it uses; (2) add the new
  mock to every hit. Cousin of [[L-037]] (route deletion breaks e2e URL-based navigation) on the
  **new-upstream-endpoint** axis: both are invisible to a grep of the changed component file, and both
  surface as a generic "route didn't load" failure.
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/shop/product-detail/product-detail.ts`
  (`GET /catalog/{slug}/type` pre-flight),
  `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/home/home.ts` (`GET /shelters`),
  `e2e/a11y.spec.ts` + `e2e/motion-a11y.spec.ts` + `e2e/shelter-3d.spec.ts` (new mocks added),
  `e2e/shelter-configure-required.spec.ts` (new guard spec), branch `feat/shelters-configure-only`.

## L-050 · A `forkJoin`/parallel-load error handler that swallows failures into an empty list turns a backend outage into a silent empty-catalog state

- **Symptom.** `catalog.ts` loaded products and shelter-models in parallel via `forkJoin`. The initial
  error handling mapped any failure to `[]` (empty list) with no error flag. A backend outage on either
  endpoint produced an empty catalog that was visually indistinguishable from « no items »: no error
  banner, no retry option, the surviving list not rendered. Two failure modes: (a) **full outage** —
  both calls fail, the whole page looks empty; (b) **partial outage** — one call fails, the surviving
  list is also blanked because both results are merged before rendering. Neither produced a console
  error or a test failure.
- **Rule.** A parallel data load (`forkJoin`, `combineLatest`, `Promise.all`) must track errors
  **per consumed list** with a dedicated error signal, not swallow them into an empty array. Template
  branches for the error state must be distinct from the empty-data state: an error renders a user-
  visible message (« impossible de charger… ») + a retry action; empty data renders « aucun résultat ».
  Partial failure must be **non-blanking**: the surviving list renders even when a sibling call fails.
  Concrete guard: after writing any parallel load, add a spec case that makes ONE of the two calls
  fail (error response) and asserts (a) the surviving list renders, (b) an error signal is truthy, and
  (c) the error branch in the template is visible — these three assertions cannot be satisfied by an
  empty-array handler ([[L-009]]: an assertion that passes on the error path and on the empty path is
  vacuous; the test must distinguish them).
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/shop/catalog/catalog.ts`
  (`productsError` / `shelterModelsError` signals, partial-failure non-blanking load),
  `catalog.html` (error branch distinct from empty branch),
  `catalog.spec.ts` (partial-failure spec), branch `feat/shelters-configure-only`.

## L-049 · An idempotent seeder's "table already populated?" gate must run AFTER unconditional category upserts — or a new category is never delivered to existing DBs and every dependent model is silently skipped

- **Symptom.** `ProductSeeder` opens with `if (await db.Products.AnyAsync()) return;`. A new product
  category (e.g. « Abris de chantier ») was added to the spec and seeded inside that gate. On any
  already-seeded dev or prod DB, the early-return fired before the category was created → the category
  row was absent → `ShelterModelSeeder`, which looks up models by category, silently skipped every
  model whose category FK could not be resolved → the new models were never delivered. Fresh-DB test
  runs were green (the gate never fires; categories and models seed in full). The gap only appeared on
  an existing DB, which no test exercises. Cousin of [[L-031]] (idempotent seeder + late-added column
  = stale data) on the **category/FK-parent axis**: here it is not a NULL column but a missing FK
  parent row that prevents child rows from being inserted at all.
- **Rule.** Category (and any other FK-parent) seed data must live in an **unconditional
  `EnsureCategoriesAsync`** method (or equivalent) that runs **before** the `AnyAsync()` early-return
  gate — it must be safe to call on every startup. The gate protects row data (products, models…),
  not the reference/lookup tables they depend on. Two guards: (1) Any seeder that has a FK to a
  lookup/reference table must call the reference-table's ensure method first, outside the gate; (2)
  when a downstream seeder (e.g. `ShelterModelSeeder`) looks up an FK parent by name/slug, add a
  test that proves it handles a missing parent gracefully (skip with a warning, not a silent no-op
  and not a crash) — silent skips are the hardest failure mode to notice in prod ([[L-031]]). Run the
  full seeder against a real LocalDB (not just InMemory) after any category addition ([[L-001]]).
  **Corollary — a seed-time recategorization must be a guarded one-time migration, not a blind
  overwrite.** `ShelterModelSeeder` needed to move certain models from an old category to a new one.
  The first implementation reset `CategoryId` to the spec category on **every startup** whenever they
  differed — silently reverting any admin who had intentionally moved a model via
  `UpdateShelterModelCommand → Reconfigure`. The correct pattern is a **static migration map**
  `{slug: (expectedOldCat, newCat)}` that only moves the model when it is still in the known old
  category — if the admin has already moved it to a third category, the migration leaves it alone.
  This is [[L-031]]'s « never overwrite a value an admin may have set » principle applied to a
  categorical move, and it parallels [[L-046]] (a seeder is a write path — it must respect the same
  invariant as `UpdateShelterModelCommand`). Test: `Seed_DoesNotRevertAdminMovedReferentialModel_GuardedMigrationOnly`.
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Infrastructure/Persistence/ProductSeeder.cs`
  (`EnsureCategoriesAsync` called before `Products.AnyAsync()` gate),
  `src/AbrisAutoOutaouais-WebApp.Infrastructure/Persistence/ShelterModelSeeder.cs`
  (`CategoryMigrations` map + `ShelterModel.Recategorize`; skip-with-warning when category missing),
  branch `feat/shelters-configure-only`. Related: [[L-031]] (column backfill axis), [[L-038]]
  (seeder crash axis), [[L-001]] (real-DB verification).

## L-048 · Text rendered BOTH in a visible surface AND an `aria-live` region causes `findByText`/`getByText` to match multiple nodes — scope the query or use a role locator

- **Symptom.** While testing the « combinaison non offerte » message in `DimensionConfiguratorComponent`:
  the error message string was present both in the visible template (e.g. a `<p>`) and in the backing
  `aria-live` / `role="status"` node used to announce it to screen readers. `findByText('combinaison non
  offerte')` (or `getByText`) returned **two nodes** — one visible, one in the live region — and the test
  threw « found multiple elements with the text ». The live region is often off-screen or empty-looking
  visually, so the duplication is non-obvious.
- **Rule.** When a message is echoed into both a visible element and a `role="status"` / `aria-live`
  region, bare text queries (`getByText`, `findByText`, `queryByText`) are ambiguous — **scope the query**
  to the visible container (`within(visibleContainer).getByText(...)`) or use a **role locator**
  (`getByRole('paragraph', { name: /.../ })`, `getByRole('status')`). Never assert on an unscoped
  text query when the component carries a live region. Cousin of [[L-010]] (global role nodes widen
  match sets in unrelated specs) on the **duplicate-text-node** axis: the live region is a second
  owner of the same text, and the query tool finds both.
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/shop/dimension-configurator/dimension-configurator.spec.ts`
  (scoped `within` or role locator to disambiguate « combinaison non offerte »),
  this delivery cycle (pricing rework).

## L-047 · A child component that emits only on VALID state leaves the parent with stale `canAdd = true` when the state silently becomes invalid — the output must emit `null` on every invalid transition

- **Symptom.** `DimensionConfiguratorComponent` (`features/shop/dimension-configurator/`) emitted
  `configurationChange` only after a successful server-price round-trip. When the user switched to a
  (length, height) combination not offered in the sparse pricing grid, the server returned 422 — but
  the component stayed **silent**: it neither updated nor cleared its last emission. The parent
  (`shelter-configurator-overlay`, `product-detail`) held the last valid `ShelterConfiguration` and
  kept `canAdd` true. Staff could place an order for a configuration marked « non offerte » in the
  UI — a **silent ordering invariant bypass**. Caught by the independent code-reviewer. Fix: the
  `output` type becomes `output<ShelterConfiguration | null>`; the component emits `null` whenever the
  configuration is no longer orderable (recalculation in progress OR 422 from the server); the parent
  does `configuration.set(null)` on receiving `null` → `canAdd` falls to false immediately.
- **Rule.** A child component that drives a parent's « can submit » gate via an `output()` must emit
  `null` (or an equivalent « not valid » sentinel) **on every transition that makes the state invalid**
  — not only on transitions to a new valid state. This is the frontend `output()` analog of [[L-046]]
  (an invariant held on one write path is not a guarantee if a parallel path can bypass it): here the
  « parallel path » is a silent no-emit when the state degrades. The parent's gate must be driven
  exclusively by the **most recent emission**, not by a cached one. Two guards: (1) After writing any
  child `output()` that a parent uses for `canSubmit`/`canAdd`, enumerate every code path that makes
  the child's state invalid (validation failure, 422, loading reset) and confirm each path emits `null`
  before the handler returns. (2) Write a spec that exercises the sequence « valid confirmed → switch to
  invalid combination » and asserts the parent's gate becomes `false` — a test that only covers the
  initial-invalid path is vacuous for this regression ([[L-009]]: an assertion that cannot distinguish
  stale-valid from re-valid catches nothing). Also cousin of [[L-027]] (a signal-driven state that
  doesn't change on certain paths leaves a stale value).
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/shop/dimension-configurator/dimension-configurator.ts`
  (`output<ShelterConfiguration | null>()`, emit `null` in `requestServerPrice` error branch +
  `reemitOnDimensionChange` reset),
  `features/shop/shelter-configurator-overlay/shelter-configurator-overlay.ts` +
  `features/shop/product-detail/product-detail.ts` (`onConfigurationChange(config | null)`,
  `canAdd` derived from non-null config),
  `dimension-configurator.spec.ts` + `shelter-configurator-overlay.spec.ts`
  (« valid → switch to non-offered → canAdd false » guard), this delivery cycle (pricing rework).

## L-046 · An invariant enforced in one write path is NOT a domain guarantee — a new parallel write path on the same resource must re-apply the same guard

- **Symptom.** EPIC 11, US-11.3 (`OptimizeRouteCommandHandler`): the handler rewrites the `SlotStart`
  of all bookings for a given day onto a 2-hour grid. First implementation assigned `gridSlots[index]`
  without checking whether a slot was already occupied by a booking that keeps its original time — an
  **excluded** booking (no lat/lng coordinates, not optimised) or a **surplus** one (grid slot in the
  past → not reschedulable). Result: two bookings landing on the same slot = **silent double-booking**.
  The existing `RescheduleBookingCommand` prevents exactly this via `SlotRules.Overlaps` (same-day
  overlap check). That invariant lived in the « reschedule » write path but was **absent from the new
  « optimise » write path**. All tests were green; caught as a Minor by the independent reviewer. Fix:
  freeze the times of non-reschedulable bookings first, then assign only genuinely free grid slots via
  `SlotRules.Overlaps`; a reschedulable booking with no free slot becomes surplus.
- **Rule.** When adding a new write path (command handler, batch job, seeder) that places or moves
  a resource governed by an invariant (appointment slot, stock unit, capacity…), grep **all other
  write paths that mutate the same entity/aggregate** and enumerate the guards they enforce. Then
  re-apply the identical guard in the new path — an invariant coded in one handler is not a domain
  guarantee as long as a parallel path can bypass it. Concrete gesture: before finishing any handler
  that mutates a shared resource, grep the codebase for other `Command`/`Handler` files touching the
  same entity and cross-check their guard list against yours. The durable fix is to lift the invariant
  into a shared domain rule or a well-named static method (`SlotRules.Overlaps`, `SlotRules.IsGridSlotFree`)
  so every path shares the same callable — if you have to duplicate the guard, you've already accepted
  the risk of a future divergence. Cousin of [[L-007]] (a temporal assumption that makes a query
  correct lives far from the query that depends on it) on the **parallel-write-path** axis: the
  assumption here is not about window size but about which paths are responsible for enforcing a
  booking invariant.
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Application/Planning/Commands/OptimizeRoute/OptimizeRouteCommandHandler.cs`
  (frozen times + `IsGridSlotFree` via `SlotRules.Overlaps` — the fix),
  `src/AbrisAutoOutaouais-WebApp.Application/Bookings/Commands/RescheduleBooking/RescheduleBookingCommand.cs`
  (the origin of the `Overlaps` invariant),
  `src/AbrisAutoOutaouais-WebApp.Application/Bookings/Common/SlotRules.cs`,
  `OptimizeRouteCommandHandlerTests.Handle_GridSlotOccupiedByExcludedBooking_ReschedulesOntoFreeSlot_NoCollision`,
  branch `feat/epic-11-calendrier`.

## L-045 · A new `ISoftDeletable` entity with a unique business-key index must use `HasFilter("[IsDeleted] = 0")` — unconditional `IsUnique()` creates a latent re-insert trap

- **Symptom.** EPIC 11, US-11.2: `WorkHoursEntry` implements `ISoftDeletable` (global `!IsDeleted`
  query filter) but its initial `(EmployeeId, WorkDate)` unique index was unconditional —
  `.IsUnique()` with no `HasFilter`. If a delete path is ever added, soft-deleting an entry for
  employee E on day D marks it `IsDeleted = 1` but the invisible row still occupies the unique index
  slot. A subsequent re-insert of hours for the same E/D pair would fail with a **unique-constraint
  violation at the DB level**, even though EF's query filter hides the deleted row from every query.
  No error at write time, no warning at migration time — the trap is detectable only when the re-insert
  actually executes in prod. Caught as a Minor by the independent reviewer. The fix was
  `.IsUnique().HasFilter("[IsDeleted] = 0")` — the identical idiom already used by `Product` and
  `ShelterModel` in this codebase; the new entity simply diverged from the established pattern.
- **Rule.** Every entity that implements `ISoftDeletable` AND carries a unique business-key index
  must have `.HasFilter("[IsDeleted] = 0")` on that index — **always, even when no delete path
  exists yet**. The filter is a pre-emptive contract between the unique-index invariant and the
  soft-delete mechanism: a soft-deleted row must release its index slot. The established idiom in
  this repo is `Product`/`ShelterModel` — follow it exactly. Two guards: (1) After writing any
  `.IsUnique()` in an entity-type configuration, grep the corresponding domain entity for
  `ISoftDeletable` — if the interface is present, add `HasFilter("[IsDeleted] = 0")` before
  committing; (2) After adding `ISoftDeletable` to an existing entity, grep its configuration for
  every `.IsUnique()` call and retrofit the filter. Regenerate the migration and snapshot after the
  fix — the migration will add `filter: "[IsDeleted] = 0"` to the existing index definition.
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Infrastructure/Persistence/Configurations/WorkHoursEntryConfiguration.cs`
  (`.IsUnique().HasFilter("[IsDeleted] = 0")` — the fix),
  `Configurations/ProductConfiguration.cs` + `Configurations/ShelterModelConfiguration.cs`
  (the established repo idiom to follow), branch `feat/epic-11-calendrier`.

## L-044 · A datetime rendered with an explicit UTC timezone on one screen while sibling screens use local timezone creates a silent cross-screen mismatch — pick one canonical timezone and share it between display AND grouping

- **Symptom.** EPIC 11, US-11.1 (`calendar.html`, read-only `/planning` view): the « RDV du jour »
  panel rendered slot times with an explicit UTC timezone: `{{ b.slotStart | date: 'HH:mm' : 'UTC' : 'fr-CA' }}`.
  Every sibling screen in the app renders the same `slotStart` values using the **local browser
  timezone** (empty timezone parameter): `bookings.html` (`date: 'short' : '' : 'fr-CA'`),
  `installation.html` (same). Two silent consequences: (1) **Cross-screen inconsistency** — the same
  appointment displayed « 14:00 » on `/admin/reservations` (local) and « 10:00 » on `/planning`
  (UTC), a 4–5 h drift in EDT. Staff could not reconcile the two screens. (2) **Internal
  inconsistency** — the day-grouping in `calendar-grid.util.ts` used `isoDate(new Date(slotStart))`
  (local date), but the hour displayed was UTC, so a slot grouped under local day J could visually
  show an hour belonging to J±1. Both defects were invisible to tests: vitest specs asserted only
  client names (not the rendered hour), and an axe scan sees nothing (no WCAG violation). The defect
  was detectable only by reading the template or comparing two screens in prod. Caught by the
  independent reviewer (US-11.1 code review).
- **Rule.** Choose ONE canonical timezone per business value (for this app: **local browser timezone**,
  i.e. empty timezone parameter in the Angular `date` pipe) and apply it consistently to **both**
  display and grouping/sorting. Three guards: (1) When rendering a datetime on a new screen, **grep
  sibling screens** that render the same business value and copy their timezone parameter exactly —
  never introduce an explicit `'UTC'` (or any other literal) where siblings use `''`. (2) When
  grouping/bucketing by day and displaying the hour in the same component, confirm both operations use
  the **same** timezone reference — a local-day bucket with a UTC-hour label is internally
  inconsistent. (3) **Pin the rendered hour in a test with a forced timezone** (`test.use({ timezoneId:
  'America/Toronto' })` in Playwright e2e, or equivalent); assert that a slot stored as `12:00Z`
  displays as `« 08:00 »` (EDT), NOT `« 12:00 »` — a test without a forced timezone is vacuous in
  any CI environment running UTC (local == UTC → the bug is invisible). This is the **timezone** axis
  of [[L-004]] (one agreed format shared across all consumers of a business value) and of [[L-009]]
  (an assertion that cannot distinguish the correct from the incorrect case is vacuous).
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/admin/calendar/calendar.html`
  (hour display corrected to local, empty timezone param),
  `features/admin/calendar/util/calendar-grid.util.ts` (day grouping — local `isoDate`),
  `features/admin/bookings/bookings.html` + `features/installation/installation.html` (app's local
  timezone convention), `e2e/admin-calendar.spec.ts` (`timezoneId: 'America/Toronto'` + asserts
  `08:00` ≠ `12:00`), branch `feat/epic-11-calendrier`.

## L-043 · An Angular `effect()` that reads `form.getRawValue()` does NOT re-run when async data fills the form — depend on the SIGNAL that actually changes

- **Symptom.** EPIC 13, sub-task 13.2 (`MapVoieComponent`): an `effect()` was initially written to
  read the form's current values via `form.getRawValue()` in order to auto-geocode the profile
  address and centre the map. `getRawValue()` is a plain method call — it is **not reactive**; Angular's
  signal graph has no knowledge of it. The effect ran once at construction (synchronously), found no
  profile address yet, and never re-ran when `ProfileService.defaultDeliveryAddress` resolved
  asynchronously from `/auth/me`. The result: for a logged-in user whose profile address loads after
  the initial render (the normal case), the auto-centring silently never fired — no error, no warning,
  the map simply opened at the fallback Gatineau centre. The same bug was invisible when the stub
  provided the address synchronously in the constructor (tests passed), revealing the gap only on the
  real async path. Caught by the independent reviewer (13.2); fixed by depending on
  `this.addr.profileAddress()` (a signal) instead of the form snapshot.
- **Rule.** An `effect()` (or `computed()`) only re-executes when **signals** it read during its last
  run change value. `form.getRawValue()`, `form.value`, `service.someProperty` (plain property), and
  any Observable subscription are **not** tracked — reading them inside an effect gives a one-shot
  snapshot at construction, not a reactive dependency. To react to async data arriving after render:
  depend on the **signal that wraps the async source** (e.g. `ProfileService.defaultDeliveryAddress`
  is already a `Signal<AddressDto | null>` — read it directly). Two guards: (1) When writing an
  `effect()` that should re-fire on async data, trace the data's origin: if it lives in a signal,
  read that signal inside the effect body; if it only exists as a form control value (RxJS
  `valueChanges`), subscribe explicitly rather than polling inside an effect. (2) In specs, always
  exercise the **async delivery path**: provide `null` at render, then set the signal to the real
  value after `fixture.detectChanges()`, and assert the side-effect fired — a synchronous stub at
  construction masks the reactivity gap ([[L-001]]: reproduce the real async path; [[L-009]]: an
  assertion that never reached the async branch is vacuous).
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/mesurer/steps/dimension-step/map-voie/map-voie.ts`
  (constructor `effect` reads `this.addr.profileAddress()` signal, comment D6/L-003),
  `map-voie.spec.ts` (test « adresse profil livrée APRÈS le rendu (async /auth/me) »: `addressSignal.set(…)` after render → `places.geocode` asserted called),
  branch `feat/epic-13-mesurer-rework`.

## L-042 · Rewriting the FR source text under a reused `@@id` silently leaves the EN `<target>` stale — `npm run i18n:extract` updates `<source>` only

- **Symptom.** EPIC 13, sub-task 13.3: the `/mesurer` page shell (`mesurer.html`) was rewritten —
  `mesurer.title`, `mesurer.lead`, and `mesurer.back` got new French source text while keeping their
  existing `@@id`s. `npm run i18n:extract` faithfully updated the `<source>` nodes in `messages.xlf`
  (FR catalog), but left the `<target>` nodes in `messages.en.xlf` (EN catalog) **unchanged** — they
  still held translations of the old text. The Angular EN build compiled without error or warning: the
  `@@id` existed in both catalogs, so the extractor was satisfied. The EN locale silently served the
  old (now incorrect) English text. The developer caught this and corrected all three EN targets by
  hand in the same PR — the lesson is that the build gave no signal that correction was needed.
- **Rule.** `npm run i18n:extract` is a **source-catalog tool only**: it writes or updates `<source>`
  in `messages.xlf` (FR) but **never touches** any `<target>` in `messages.en.xlf` (EN) — whether
  the id is new, changed, or untouched. When the **FR source text changes** under a reused `@@id`
  (a rewrite, not a deletion): (1) after running `npm run i18n:extract`, diff `messages.xlf` for any
  `<source>` node whose text changed; (2) for each changed `<source>`, manually update the
  corresponding `<target>` in `messages.en.xlf` in the same commit — the EN build will silently use
  the old translation forever otherwise; (3) confirm with `npm run build:prod` (which runs the
  bilingual build) that both locales render the expected text. This is **distinct from** [[L-018]]
  (which covers *orphaned* trans-units when the last consumer is deleted): here the id survives,
  no orphan, no divergence flag — the drift is invisible to all tooling. The pattern to grep after
  any copy rewrite: ids you kept + `<source>` text that changed = mandatory manual EN re-translation.
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/src/locale/messages.xlf` (`mesurer.title`,
  `mesurer.lead`, `mesurer.back` — new FR source text),
  `src/AbrisAutoOutaouais-WebApp.Client/src/locale/messages.en.xlf` (same ids — EN targets updated
  by hand to match new meaning), branch `feat/epic-13-mesurer-rework`. Related: [[L-018]] (orphaned
  ids on deletion), [[L-024]] (dynamic bindings use `$localize`, not `i18n-` — the other i18n trap).

## L-041 · Two pure utils that share a core function must extract it into a neutral third module — a bidirectional import A↔B is fragile even when runtime-safe

- **Symptom.** EPIC 10: `footprint.util` (historical side-by-side shelter footprint) was refactored
  to delegate to `orientation.util` (`footprintForVehiclesOriented`), while `orientation.util`
  already imported `finalizeFootprint` + shared types FROM `footprint.util` → bidirectional import
  cycle. TypeScript/esbuild did not error because all cross-module references live inside function
  bodies (evaluated lazily) and types are erased at compile time. Build and specs stayed green. The
  fragility: any future usage of those imports at **module evaluation time** (a top-level `const`, a
  class field initialiser, a decorator) would cause one module to see the other as `{}` (not yet
  initialised) — a silent `undefined` that only breaks at runtime. Caught as a Nit by the independent
  reviewer; fixed in commit 02a1afd by extracting `Footprint`/`VehicleSelection`/bounds/
  `finalizeFootprint` into a neutral `footprint-core.util` that both modules import from.
- **Rule.** When two pure utils in the same feature need to share a function or types, extract that
  shared piece into a **third, neutral module** (`*-core.util`, `*-shared.util`, `*-types.ts`) that
  both depend on — never let A import from B while B imports from A. The cycle is easy to miss because
  TypeScript compiles it without error and specs stay green (lazy function-body references are safe at
  test time). To preserve the existing public API of the original module, re-export the extracted
  symbols from it (`export { finalizeFootprint } from './footprint-core.util'`). The dependency graph
  must stay a DAG: utils → core, never core → utils, never peer ↔ peer.
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/mesurer/util/footprint-core.util.ts`
  (new neutral module), `footprint.util.ts` (re-exports from core), `orientation.util.ts` (imports
  from core), commit 02a1afd, branch `feat/epic-10-smart-suggestion`.

## L-040 · An `aria-labelledby` that points to an EMPTY text node gives the dialog no accessible name — AXE passes anyway; test the unresolved/async path explicitly

- **Symptom.** EPIC 10: `ShelterConfiguratorOverlayComponent` carries `role="dialog"` +
  `aria-labelledby` bound to a `modelName()` signal passed in by the parent catalog. When the page is
  opened via a deep-link (`/boutique?configure={slug}`) before the shelter-model list has loaded,
  `modelName()` is `''` (the parent hasn't resolved the slug yet) — so the dialog opens with
  `aria-labelledby` pointing to a node whose text content is an empty string → **no accessible name**
  (WCAG 4.1.2). AXE did NOT catch it: the `aria-labelledby` attribute is syntactically present and
  points to a real DOM node — AXE only checks that the referenced id exists, not that the referenced
  node is non-empty. The bug surfaced only on the **unresolved deep-link path**, which the initial
  specs did not exercise. Caught as Major by the independent reviewer; fixed in commit 617cd11 with a
  three-level `displayTitle` computed: `modelName()` → name from config → `$localize` fallback.
- **Rule.** Any `aria-labelledby` (or `aria-label`) whose value is derived from an async-resolved or
  parent-supplied input must have a **guaranteed non-empty fallback** — a `computed()` that falls
  through multiple sources and ultimately lands on a static translated string. The fallback is NOT
  optional: it is the required base case for the async-unresolved path. Three guards: (1) After
  writing any `aria-labelledby`/`aria-label` bound to a signal or `input()`, ask « what is the value
  when the data hasn't arrived yet? » — if the answer is `''` or `undefined`, add the fallback before
  committing. (2) Write a spec that renders the component with the **unresolved / empty-input path**
  and asserts the accessible name is non-empty (`getByRole('dialog', { name: /.+/ })`). AXE alone
  cannot catch this regression — the attribute is present and AXE is satisfied. (3) This is a
  specialisation of [[L-009]] (an assertion that structurally cannot fire): the axe check fires and
  passes, but it is vacuous for the empty-text-node case. Pair every axe dialog-name check with a
  unit assertion on the computed label value for the unresolved-input path.
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/shop/shelter-configurator-overlay/shelter-configurator-overlay.ts`
  (`displayTitle` three-level computed), `features/shop/catalog/catalog.ts` (deep-link `configure`
  path), commit 617cd11, branch `feat/epic-10-smart-suggestion`.

## L-039 · A Container Apps container that exits at startup is NOT a native segfault — get the managed exception first; missing Log Analytics makes you blind and wastes hours on the wrong layer

- **Symptom.** After the EPIC 9 merge, every Container Apps revision showed « ActivationFailed »,
  exit code 139, and `/api/v1/shelters` returned 404. Three image rebuilds followed (disabling
  `UseAppHost`, pinning `ContainerBaseImage`, etc.) — all appeared to « fail the same way ». In
  reality the image was fine. The actual cause was a **managed C# exception thrown in a seeder during
  app startup** (see [[L-038]]), which kills the host before it ever binds to a port. Exit code 139
  is the Unix signal for SIGSEGV, but the .NET runtime also maps an **unhandled exception that
  terminates the process** to that code in some Container Apps / Linux configurations — it is NOT
  necessarily a native memory fault. The stdout containing the full exception stack was invisible
  because `appLogsConfiguration.destination` in the Terraform IaC was `""` (empty) — no Log Analytics
  workspace was wired, so Container Apps had nowhere to ship container stdout/stderr. Activating
  Log Analytics (and querying `ContainerAppConsoleLogs_CL`) revealed the real error in seconds.
- **Rule.** When a containerised .NET backend fails at startup (exit code 139, « ActivationFailed »,
  service unreachable), do **not** assume a native image or cross-build fault. The most common cause is
  an **unhandled managed exception during startup** — DI misconfiguration, a seeder throwing, a failed
  migration — that terminates the host before the HTTP port is bound. The diagnostic checklist: (1)
  **Read the logs first** — `az containerapp logs show --name … --follow` or Log Analytics
  `ContainerAppConsoleLogs_CL | where Log contains "Exception"`. (2) If no logs appear, the environment
  has no log destination: add an `azurerm_log_analytics_workspace` to the IaC and wire it to the
  Container App (`log_analytics_workspace_id`) **before** spending any time on image theory. An
  environment without a log store is **blind by design** — any rebuild/redeploy is guesswork. (3) Only
  after the managed exception is ruled out (stdout is clean, JIT/native crash confirmed by a memory
  dump) should cross-build / base-image / `UseAppHost` hypotheses be explored. This is [[L-001]]
  (reproduce/observe the REAL stack before blaming a layer) extended to the **container-observability**
  axis: the "real stack" in prod is the container stdout, and you cannot read it without a log sink.
- **Refs.** `infra/main.tf` (`azurerm_log_analytics_workspace` + `log_analytics_workspace_id` wired
  to the Container App environment), branch `fix/seeder-sql-translation`.

## L-038 · `IReadOnlySet<T>.Contains` (and `HashSet<T>.Contains`) on a column is NOT translated by EF Core SQL Server — use `T[]` or `List<T>` for `IN (…)` queries; seeder code is the highest-risk site

- **Symptom.** After the EPIC 9 merge, the deployed backend (Azure Container Apps + Azure SQL S0)
  crashed at every startup — all revisions « ActivationFailed », exit code 139 (see [[L-039]] for the
  diagnostic path). 349 unit tests and 95 integration tests were green. Root cause (visible only after
  wiring Log Analytics): `ShelterModelSeeder.LegacyMultiWidthSlugs` was typed as
  `IReadOnlySet<string>` (a `HashSet`). The seeder query
  `.Where(s => LegacyMultiWidthSlugs.Contains(s.Slug))` compiled fine and passed InMemory integration
  tests (which evaluate LINQ **client-side**), but threw at runtime on SQL Server:
  ```
  System.InvalidOperationException: The LINQ expression '…HashSet<string>{…}.Contains(s.Slug)…'
  could not be translated. Translation of method 'IReadOnlySet<string>.Contains' failed.
  ```
  EF Core's SQL Server provider only translates `.Contains` when the collection is `T[]` or `List<T>`
  (→ SQL `IN (…)`). The InMemory provider evaluates everything in-process and **never surfaces this
  gap** — a perfect instance of [[L-035]] / [[L-022]] (InMemory masks relational provider divergence).
  Because seeders run at host startup before the HTTP port is bound, the unhandled exception killed the
  entire process — no graceful error, just exit 139.
- **Rule.** Any collection used in an EF LINQ `.Contains(column)` expression **must** be declared as
  `T[]` or `List<T>` — not `IReadOnlySet<T>`, `HashSet<T>`, `IEnumerable<T>`, or any other type. The
  SQL Server provider maps exactly those two concrete types to a SQL `IN (…)` clause; all others fail
  **at runtime on a relational provider** while passing silently on InMemory ([[L-022]]). The fix is
  often a one-character change to the field declaration (`string[]` instead of `IReadOnlySet<string>`),
  but the cost of missing it in a seeder is a **total prod outage from first boot**. Three guards:
  (1) After writing any EF query that calls `.Contains(column)`, check the collection's declared type;
  if it is not `T[]` or `List<T>`, change it before committing. (2) After any seeder or infrastructure
  change, do a **live round-trip on SQL Server LocalDB** ([[L-001]]) — `dotnet run` against a real
  LocalDB database and confirm the app starts and the relevant endpoint responds — before merging.
  `dotnet test` (InMemory) cannot catch this class of error. (3) Seeder code is the highest-risk site:
  it runs unconditionally at boot, is covered only by InMemory tests, and an uncaught exception kills
  the whole host. Treat every new seeder query as requiring a real-provider smoke-test as part of the
  PR checklist, independently of integration test results.
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Infrastructure/Persistence/ShelterModelSeeder.cs`
  (`LegacyMultiWidthSlugs` changed from `IReadOnlySet<string>` to `string[]`),
  `infra/main.tf` (Log Analytics wired — prerequisite for diagnosing this class of error, [[L-039]]),
  branch `fix/seeder-sql-translation`. Cross-links: [[L-035]] (InMemory masks OwnsMany/relational
  bugs), [[L-022]] (InMemory diverges from relational providers), [[L-001]] (reproduce against real
  stack), [[L-031]] (seeders run at boot and are only covered by InMemory tests).

## L-037 · When a rework deletes a route/component, e2e specs in `e2e/` that navigate by URL are NOT caught by a component-level grep — audit them explicitly

- **Symptom.** EPIC 9 rework (`feat/epic-9-rework-shelter-dimensions`): routes
  `/boutique/modeles/:category` and `/boutique/configurer/:slug` were removed, their components
  deleted, and the vitest co-located specs migrated — all correctly. But two **Playwright** specs,
  `e2e/shelter-configurator.spec.ts` and `e2e/shelter-order.spec.ts`, still did
  `page.goto('/boutique/configurer/simple')`, awaited a heading that no longer existed, and targeted
  `#configurator-length-number` (now a `<select>`). Because `npm run e2e` runs in CI
  ([[L-005]]), the branch would have turned CI red. A second gap: the replacement surface (the
  shelter-config overlay/dialog) had **no e2e guard at all** — no dual-theme contrast check
  ([[L-016]]), no APG focus-trap / Échap / return-focus contract. Both gaps were caught by the
  independent code-reviewer; the developer had not seen them. Fixed: specs migrated + new
  `e2e/shelter-overlay.spec.ts` added (non-vacuity proven on revert).
- **Rule.** When a rework **removes a route or replaces a component**, the vitest co-located
  specs and the new component's spec are NOT the whole picture. e2e Playwright specs live in
  `e2e/` and navigate by **absolute URL paths** and **DOM ids** — they are invisible to a grep
  of the deleted/renamed component file. Before closing a rework: (1) **grep `e2e/` for every
  URL segment of the removed route** (e.g. `/boutique/configurer`, `/modeles/`) and for every
  stable DOM id that was part of the old surface (`#configurator-length-number`) — migrate or
  delete every hit in the same PR ([[L-008]]: hunt the old mechanism everywhere); (2) also check
  `shop.routes.ts` (or whatever route registry owns the path) and grep for the old path constant
  across all non-component files; (3) every **new surface** introduced by the rework (modal,
  overlay, inline panel) needs its own e2e guard before the PR closes — at minimum: dual-theme
  axe contrast scan ([[L-016]] — vitest cannot cover it) + APG dialog contract (focus-trap on
  open, Échap closes, focus returns to trigger); prove non-vacuity by running on a revert
  ([[L-005]]). The zombie-server risk ([[L-017]]) is live here too — confirm no stale `ng serve`
  is running before declaring e2e green.
- **Refs.** `e2e/shelter-configurator.spec.ts` + `e2e/shelter-order.spec.ts` (migrated, old URL
  removed), `e2e/shelter-overlay.spec.ts` (new dual-theme + APG guard, proven non-vacuous),
  `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/shop/shop.routes.ts` (routes deleted),
  branch `feat/epic-9-rework-shelter-dimensions`.

## L-036 · An edit-form DTO must expose FK columns as ids, not force the client to reverse-resolve by display label

- **Symptom.** EPIC 9.5 admin shelter-model form: the initial `startEdit()` draft resolved
  `categoryId` with `categories().find(c => c.name === detail.categoryName)?.id ?? ''` — reverse-
  looking up the FK from the displayed name. Two silent failure modes: (a) if two categories share
  the same name, the wrong id is picked with no warning; (b) if `categoryName` in the detail DTO
  doesn't exactly match the name in the categories list (different casing, trailing space, locale
  difference), the find returns `undefined` and `categoryId` silently resets to `''` → the form
  opens with no category selected and the user unknowingly clears it on save. Caught by the
  independent reviewer; the root cause is a DTO contract hole.
- **Rule.** A detail/edit DTO must expose **every FK as its id** (Guid/int), not only its display
  label. The client form binds the id directly to the `<select>` control (`categoryId:
  detail.categoryId`) — never a reverse-lookup by name. Display labels are for reading; id is the
  contract for writing. When designing a DTO for an edit endpoint: list all relationships the form
  can change, confirm the FK id is a field, and verify the label is purely cosmetic. Same axis as
  [[L-004]] (one canonical value shared client↔server), applied to **DTO shape**: the canonical key
  is an opaque id, never a user-visible string that can change or collide.
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Application/Shelters/Queries/GetShelterModelBySlug/ShelterModelDetailDto.cs`
  (`CategoryId Guid` field),
  `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/admin/shelter-models/shelter-models.ts`
  (`startEdit` → `categoryId: detail.categoryId`),
  branch `feat/epic-9-dimension-catalog`.

## L-035 · EF InMemory raises `DbUpdateConcurrencyException` when replacing the child collection of a TRACKED owned entity — convert to a regular entity and use explicit `RemoveRange`/`AddRange`

- **Symptom.** EPIC 9.5: the `UpdateShelterModelCommandHandler` tried to replace `ShelterModel.Dimensions`
  (configured as `OwnsMany`) in a single `SaveChanges` call against the EF InMemory provider (used by
  the integration-test `WebAppFactory`). InMemory raised `DbUpdateConcurrencyException` — it cannot
  reconcile adding/removing **owned** children of an already-tracked parent in one round-trip. The bug
  was **InMemory-only**: the same command round-tripped cleanly on SQL Server LocalDB ([[L-001]]),
  which confirmed the logic was correct but the provider diverged. The schema on SQL Server was
  unchanged (same table, same FK/cascade/index) — the distinction between `OwnsMany` and a regular
  `HasMany` is purely an EF model-level concern.
- **Rule.** When a child collection must support **CRUD operations from admin UI** (add/remove/replace
  items), do **not** use `OwnsMany` — the InMemory provider (used in `WebAppFactory`-backed integration
  tests) cannot handle replacing owned children of a tracked aggregate ([[L-022]]: InMemory diverges
  from relational providers). Convert to a **regular entity** with `HasMany().WithOne().IsRequired()
  .OnDelete(Cascade)` — the SQL Server schema is typically identical, so the resulting migration is
  empty-bodied (verify by inspecting it). Two consequences follow automatically: (a) the child entity
  is **not** auto-included — every reader (query handlers, update handlers) must add an explicit
  `.Include(m => m.Children)` or the collection silently loads as empty ([[L-009]]: no error ≠
  correct); (b) replacement must be explicit: materialise the old children BEFORE the domain method
  clears the collection, call `db.Set<TChild>().RemoveRange(old)`, let the domain rebuild the
  collection, then call `db.Set<TChild>().AddRange(model.Children.ToList())` — all in one
  `SaveChanges`. Verify the fix covers all providers by running `dotnet test` (InMemory) AND a live
  round-trip ([[L-001]]) on SQL Server.
  **Corollary — seeder backfill on an already-tracked parent requires `db.Set<TChild>().AddRange(...)` explicitly.** When a seeder loads an existing parent (`ShelterModel`) without `AsNoTracking` and calls a domain method that clears + rebuilds a regular-entity child collection (`PriceEntries`), the new children must be added to the DbSet explicitly: `db.Set<PriceEntry>().AddRange(model.PriceEntries)`. The cascade path (parent → navigation → children) that works for a freshly-`AddAsync`-ed parent does **not** reliably track the new children under InMemory when the parent is already in the change tracker — InMemory raises `DbUpdateConcurrencyException` on the child insert. The parent-is-fresh path never exercises this; only the backfill path does. Add a dedicated backfill spec that loads an existing parent and confirms the new children persist ([[L-031]]: backfill paths need their own regression tests).
  **Style guard — update `<summary>` comments when the EF mapping changes.** After converting from `OwnsMany` to `HasMany`, grep the configuration file's XML doc comments (`<summary>`) and update any that still describe the old mapping — stale comments mislead future readers about which [[L-035]] trap applies and which approach is correct.
- **Refs.**
  `src/AbrisAutoOutaouais-WebApp.Domain/Entities/ShelterModelDimension.cs` (regular entity),
  `src/AbrisAutoOutaouais-WebApp.Infrastructure/Persistence/Configurations/ShelterModelConfiguration.cs`
  (`HasMany().WithOne().IsRequired().OnDelete(Cascade)` replacing `OwnsMany`; `<summary>` updated),
  `src/AbrisAutoOutaouais-WebApp.Infrastructure/Persistence/Migrations/20260619150301_ShelterModelDimensionRegularEntity.cs`
  (empty `Up`/`Down` — schema unchanged on SQL Server),
  `src/AbrisAutoOutaouais-WebApp.Application/Shelters/Commands/UpdateShelterModel/UpdateShelterModelCommandHandler.cs`
  (`RemoveRange` / `Reconfigure` / `AddRange` pattern),
  `src/AbrisAutoOutaouais-WebApp.Application/Shelters/Queries/GetShelterModelBySlug/GetShelterModelBySlugQueryHandler.cs`
  (explicit `.Include(m => m.Dimensions)`),
  `src/AbrisAutoOutaouais-WebApp.Infrastructure/Persistence/ShelterModelSeeder.cs`
  (`db.Set<PriceEntry>().AddRange(...)` in backfill path; `ShelterModelSeederBackfillTests`),
  branch `feat/epic-9-dimension-catalog`; pricing rework (backfill corollary).

## L-034 · An axis-aligned `turf.bbox()` over-estimates a drawn rectangle's width/length when it isn't aligned North–South — measure with per-edge great-circle distances or an oriented bbox

- **Symptom.** The `/mesurer` map tool derives a parking spot's width and length in `handleShape()`
  (`features/mesurer/steps/measure-step/map-measure/map-measure.ts`, ~lines 186-213) from
  `turf.bbox()` — an **axis-aligned** (min/max lat-lng) bounding box. For a driveway not aligned to
  North–South, the axis-aligned box is always larger than the real footprint: a 3 m × 6 m spot
  rotated 45° reads ~6.4 m × 6.4 m. That inflated footprint is fed to `SuggestShelters`, so the user
  is suggested a too-large (and pricier) shelter. The bug is **silent** — no test fails (tests draw
  axis-aligned shapes whose bbox equals the true dimensions), and the output looks plausible.
  Surfaced by a 2026-06-19 docx consult which correctly noted « a simple bounding box will fail for
  rotated driveways ». Tracked as US-14.2 (EPIC 14); documented but not yet fixed.
- **Rule.** When deriving a rectangle's width/length from a user-drawn polygon on a map, do **not**
  use `turf.bbox()` — it equals the true dimensions only when the shape aligns with the lat/lng axes.
  Instead, compute **per-edge great-circle distances** (`@turf/distance` / haversine) for a 4-vertex
  polygon and pair opposite edges: width = mean of the two shorter edge pairs, length = mean of the
  two longer (both are free — no billing-required Google Maps API, see budget-free-tier rule). An
  oriented / minimum-area bounding box is equally valid. Pin with a **unit test that feeds a ROTATED
  rectangle** and asserts the true ~3×6, not the inflated bbox — an axis-aligned test case cannot
  catch this regression. Same family as [[L-007]] (a geometric/temporal assumption that makes a query
  correct lives far from the query — pin it there), on the **measurement-orientation** axis.
- **Refs.** `features/mesurer/steps/measure-step/map-measure/map-measure.ts` (`handleShape`,
  `turf.bbox` call), `docs/agile/product-backlog.md` (US-14.2),
  source: `probleme abris-auto-outaouais.docx` (2026-06-19).

## L-033 · A contrast fix that targets only the NAMED items leaves the same faulty pattern dormant elsewhere — grep ALL consumers of the pattern before closing

- **Symptom.** Épic 12 p2: the user story named two contrast failures — `/mesurer` badge
  « Ajusté serré » (`--color-warning` #fbbf24 at 1.67:1 dark) and `.profile-tab.is-active`
  (`--color-primary` #f87171 at 2.77:1 dark). Both were fixed at the token level (brand-fixed tokens
  `--color-warning-solid`/`--color-on-warning` and `--color-red-600`/`--color-on-brand`). The
  **independent reviewer** then found the **identical pattern** (`color: #fff` on
  `background: var(--color-primary)`) dormant in two unrelated scoped stylesheets NOT named by the
  story: `installation.scss` `.booking__slot--selected` and `mesurer.scss`
  `.mesurer__step--current .mesurer__step-num` — both also ~2.77:1 in dark theme. The faulty pattern
  is: **hardcoded light text** (`#fff`/`white`) over a **theme-SWAPPING background token**
  (`--color-primary`, `--color-warning`, `--color-secondary`…) that resolves to a light colour in dark
  mode — making the composed contrast fail. The story names a symptom (these two elements), not the
  class of bug (the pattern), so a targeted fix leaves all sibling occurrences broken.
- **Rule.** When fixing a contrast regression caused by a **pattern** (light fixed text on a
  theme-swapping background token), treat the story's named items as a **sample**, not the inventory.
  Before closing the change: (1) **grep ALL scoped stylesheets** for the faulty pattern —
  `color:\s*(#fff|white|#ffffff)` combined with `background.*var\(--color-primary\|--color-warning\|…\)`
  — and fix every match, not just the named ones; (2) add a **dual-theme e2e guard** for every
  newly-fixed surface and **prove it fails on a revert** before trusting it ([[L-005]]); (3) migrate
  each fixed surface to a brand-fixed token pair (`--color-red-600`/`--color-on-brand`,
  `--color-warning-solid`/`--color-on-warning`) — never `#fff` on a token that flips per theme
  ([[L-023]]: theme-FIXED vs theme-SWAPPING). The discipline is the same as [[L-008]] (after a fix,
  hunt all occurrences of the old mechanism) and [[L-032]] (grep ALL sibling scoped sheets, not just
  the named one), extended to the **contrast-pattern** axis: the user story names an example, the fix
  covers the pattern.
- **Refs.** `features/installation/installation.scss` (`.booking__slot--selected` → `--color-on-brand`),
  `features/mesurer/mesurer.scss` (`.mesurer__step--current .mesurer__step-num` → `--color-on-brand`),
  `features/account/profile/profile.scss` (`.profile-tab.is-active` → `--color-on-brand`),
  `features/mesurer/steps/results-step/results-step.scss` (`.shelter-card__badge` → `--color-on-warning`),
  `shared/styles/_tokens.scss` (`--color-warning-solid`, `--color-on-warning`, `--color-on-brand`),
  `e2e/primary-surface-contrast.spec.ts` + `e2e/badge-tab-contrast.spec.ts` (dual-theme guards, proven
  non-vacuous), branch `fix/epic-12-p2-contrast-badge-tab`.

## L-032 · A hardcoded `background: white` on `:focus` in a SCOPED stylesheet makes typed text invisible in dark theme — and the regression is invisible to ALL tooling

- **Symptom.** Épic 12: in register/login/reset forms, typed text was illegible (white-on-white)
  **only in dark theme**. Root cause: `.field__input:focus` in the **scoped** auth stylesheets
  (`features/auth/auth.scss` + `features/auth/reset/reset.scss`) hardcoded `background: white`.
  `color` stayed `var(--color-text)` (≈`#f1f5f9` in dark mode), so the composed contrast was
  ~3.19:1 < 4.5 AA. The global `styles.scss` focus rule was fine (border + shadow only); only the
  scoped overrides introduced the bug. Invisible to ALL tooling: (a) **axe does not evaluate the
  value-text of an `<input>`** — the typed value lives in `.value`, not a DOM text node, so axe has
  nothing to scan; (b) **`color-contrast` is already disabled in vitest** ([[L-016]]); (c) a live
  visual check in light theme looked clean. The regression only surfaced via direct WCAG-ratio
  computation on the focused input in Playwright.
- **Rule.** (1) Never hardcode `background: white`/`#fff` on a form control's `:focus` (or any
  interactive state) — use a theme-SWITCHING surface token (`var(--color-surface)`) so dark theme
  keeps `color` and `background` from the same palette. (2) A contrast regression on an input's
  **typed value** cannot be caught by axe (value text isn't a DOM node) or vitest
  ([[L-016]] `color-contrast` off) — gate it with a Playwright e2e that **computes the WCAG ratio
  directly** from the focused input's composed `color` vs `background-color`, after focusing + typing,
  in BOTH themes (`e2e/auth-input-contrast.spec.ts`); prove the test actually fails on a revert before
  trusting it ([[L-005]]). (3) When fixing one scoped component, **grep ALL scoped form-control
  stylesheets** for the same hardcoded color before closing — here auth + reset shared the bug while
  the global was clean; a component-only fix leaves sibling scoped sheets broken. Extends [[L-016]]
  (color-contrast vacuous in vitest) and [[L-023]] (theme-swapping token traps) onto the
  **form-field-value** axis.
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/auth/auth.scss` +
  `features/auth/reset/reset.scss` (`.field__input:focus` → `var(--color-surface)`),
  `e2e/auth-input-contrast.spec.ts` (direct-compute dual-theme gate, proven non-vacuous),
  `docs/accessibility/wcag-2.2-audit.md` §5.11, branch `docs/docx-followup-planning-and-epic12`.

## L-031 · An idempotent seeder + a late-added column = silently stale dev data — backfill per-key per-field when you add a column to a seeded entity

- **Symptom.** G3: `/mesurer` shelter suggestions always returned an empty list. Root cause found by
  querying the live dev DB ([[L-001]]): the 12 seeded products had `WidthCm`/`LengthCm` (Épic D/D1)
  and `Brand`/`Model` (Épic G/G1) = **NULL** because the `ProductSeeder` is **idempotent**
  (`if (await db.Products.AnyAsync()) return;`). The dev DB had been seeded before those columns
  existed — the existing rows were never re-seeded, so every newly added column stayed NULL.
  The `SuggestSheltersQueryHandler` filter `WHERE WidthCm != null` (correct, tested) silently
  eliminated all rows → 0 results, no error. Tests were blind to this: the test DB always starts
  empty, so seeds run in full and all columns land populated — a **fresh-DB/stale-dev-DB divergence**
  that no test exercises.
- **Rule.** Any time you add a column to an entity already covered by an idempotent seeder, add a
  **backfill block** in the same change: look up each existing row **by its stable key** (slug,
  code…) and fill the new field **only when it is still NULL** — never overwrite a value an admin
  may have set. Run `SaveChanges` only if something actually changed; keep the whole block
  idempotent so restarts are safe. Guard the backfill with CI tests (skip/fill/preserve/idempotence
  — [[L-005]]: an unguarded "fix data" block has no regression net). Diagnose « 0 results /
  unexpected NULL » by querying the **real running DB first** ([[L-001]]), not by reading tests
  (fresh-DB seeds hide the gap). Same family as [[L-007]] (a correctness invariant lives far from
  the code that depends on it) and [[L-018]] (adding a column is not done at the migration alone —
  existing rows need populating too), on the **seeded-data** axis.
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Infrastructure/Persistence/ProductSeeder.cs`
  (`BackfillShelterDataAsync` / `FillBrandModel`),
  `src/AbrisAutoOutaouais-WebApp.UnitTest/Infrastructure/Persistence/ProductSeederBackfillTests.cs`
  (6 tests: fill known, preserve admin data, unknown slug untouched, idempotence),
  `src/AbrisAutoOutaouais-WebApp.Application/Products/Queries/SuggestShelters/SuggestSheltersQueryHandler.cs`
  (`WidthCm != null` filter), branch `feat/epic-g-catalog`.

## L-030 · A `.First()` after a partial `OrderBy` is non-deterministic if the projection reads fields NOT in the sort key — add a deterministic tie-break at the query

- **Symptom.** G2: `GetShelterCatalogQueryHandler` ordered rows by `(Brand, Model)` then did
  an in-memory `GroupBy(Brand)` → `GroupBy(Model)` → `m.First()` to pick the canonical
  `Slug`/`WidthCm`/`LengthCm`/`HeightCm` for each distinct model. `Slug` and the dimension
  fields are **not part of the sort key**, so when two products share the same brand+model but
  differ in slug or dimensions, `First()` returns a **non-deterministic row** — whatever
  EF/SQL happens to materialise first. The published slug and dims would flip between runs. A
  comment even claimed « alphabetical order guaranteed by SQL » — overstating the guarantee.
  The bug was latent because the seed has no duplicate brand+model pair; caught by the
  independent reviewer, not by tests ([[L-005]]: no failing test ≠ correct).
- **Rule.** Any `.First()`/`.FirstOrDefault()`/`[0]` after a LINQ `OrderBy` is only deterministic
  if the sort key **pins every field the projection subsequently reads**. When it does not,
  add a deterministic **tie-break** (e.g. `.ThenBy(p => p.Slug)`) at the query so the pick is
  well-defined regardless of DB/SQL row order — and correct any comment that overstates the
  ordering guarantee. Pin the uniqueness assumption with a unit test that seeds two rows with
  the same group key but different tie-break values and asserts the expected pick, so a future
  data-model change that would break it is caught at `dotnet test` time. Same family as
  [[L-007]] (an invariant that makes a grouped/windowed query correct lives far from the query
  — pin it there), on the **sort-stability** axis rather than the temporal one.
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Application/Products/Queries/GetShelterCatalog/GetShelterCatalogQueryHandler.cs`
  (`.ThenBy(p => p.Slug)` tie-break + corrected comment), branch `feat/epic-g-catalog`.

## L-029 · Removing the declarative `authGuard` from a route is NOT enough — grep for imperative guards and post-action navigations too

- **Symptom.** Épic F: opening `/panier/caisse` to guests required removing `canActivate: [authGuard]`
  from `app.routes.ts`. Two **hidden doors** still blocked the guest path after that change. (a) An
  **imperative guard** in `cart.ts`: the `checkout()` method redirected to `/auth` unconditionally
  before the route was even activated — guests never reached the form. (b) A **post-action
  navigation**: on order success, the redirect pointed to `/mon-compte/commandes` (an auth-protected
  route), sending the newly-created guest straight back to `/auth`. Both were invisible to a route-level
  grep for `authGuard` — one lived in a click handler, the other in a success callback.
- **Rule.** When you open a route to anonymous users, do three things beyond removing the route guard:
  (1) grep the **service / component methods** that trigger navigation TO that route for any
  imperative `if (!user) router.navigate(['/auth'])` (or equivalent) — those are invisible to
  `app.routes.ts`; (2) grep every **success / post-action navigation** inside handlers that run on that
  route for redirects that land on a **protected** destination — a guest completing an action must have
  somewhere reachable to go; (3) confirm the anonymous e2e actually exercises the full happy path
  (entry → fill → submit → success page), not just that the route loads ([[L-005]]). Same "hunt the
  old mechanism everywhere" discipline as [[L-008]], extended to the auth axis; and the companion to
  [[L-026]] (which covers why the *test* for this path is also constrained by the guard).
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/cart/cart.ts` (imperative
  `/auth` redirect removed from `checkout()`),
  `features/{checkout,location,installation}` (post-success navigation to a guest-reachable page),
  `src/app/app.routes.ts` (`canActivate: [authGuard]` removed from `/panier/caisse`),
  branch `feat/epic-f-guest-checkout`.

## L-028 · Opening an endpoint to `[AllowAnonymous]` requires a two-part security review: JWT-emission reachability AND sibling-action coverage

- **Symptom.** Épic F: `OrdersController.PlaceOrder`, `RentalsController.Create`, and
  `BookingsController.Create` were opened to guests via `[AllowAnonymous]` on the action, with
  `[Authorize]` still at the class level. Two things had to be verified in the same review but are
  easy to miss independently. (a) The express (passwordless) account created by
  `FindOrCreateByEmail` must never be able to obtain a JWT — `IdentityService.Login` gates on
  `CheckPasswordAsync` (returns false for `PasswordHash == null`), and no handler in the guest flow
  calls `BuildAuthResponse` / returns a token. (b) Every **sibling action** on the same controller
  (e.g. `GetMine`, `Cancel`, `Reschedule`, admin reads) must still be auth-protected by the
  class-level `[Authorize]` — adding `[AllowAnonymous]` to one action must not silently widen another.
  Neither gap was caught by the automated tests; both were caught by the independent code-reviewer.
- **Rule.** Any time `[AllowAnonymous]` is added to an action on a class decorated with `[Authorize]`,
  run a two-part security review before merging: (1) **JWT-emission reachability** — trace every code
  path reachable from the anonymous entry point and confirm none calls `BuildAuthResponse`/returns
  a token; a passwordless account (`PasswordHash == null`) must fail `CheckPasswordAsync` and the
  login gate must be the only barrier; (2) **sibling-action coverage** — grep `[AllowAnonymous]`
  across **all** controllers after the change and confirm no adjacent action on the same class lost
  its auth requirement. Add an integration test asserting the anonymous action succeeds (2xx) AND a
  sibling protected action returns 401 for an unauthenticated caller ([[L-005]]: the guard only guards
  if CI runs it).
- **Refs.** `src/AbrisAutoOutaouais-WebApp.API/Controllers/{Orders,Rentals,Bookings}Controller.cs`
  (`[AllowAnonymous]` on create actions; `[Authorize]` at class level covers siblings),
  `Infrastructure/Identity/ExpressAccountService.cs` (`FindOrCreateByEmail`, `IsExpress` flag),
  `Infrastructure/Identity/IdentityService.cs` (`CheckPasswordAsync` login gate),
  branch `feat/epic-f-guest-checkout`.

## L-027 · A signal-driven `aria-live` region won't RE-announce the same value — reset to a neutral state first

- **Symptom.** Épic D (unified address). A screen-reader **re-announcement** silently dropped whenever
  the live-region's backing signal was `.set(...)` to the **same value** it already held: Angular's
  signal equality skips the no-op write, so the bound `role="status"` text node never changes and the
  AT has nothing to re-read. Hit **twice**, independently: (a) the postal-code feedback on all 4 address
  forms — a `postalFill` 3-state signal where selecting a second QC address re-set `'filled'` over
  `'filled'` and announced nothing; (b) the new `app-address-choice` live-region, where toggling back to
  a mode already announced (`'other'`→…→`'other'`) re-set an identical message. Same « state didn't
  re-fire » family as [[L-006]] but on the **re-announce** axis, not focus — and invisible to axe (which
  checks the static `aria-live` attribute, not whether the text actually changed — [[L-009]]/[[L-015]]).
- **Rule.** Any `aria-live`/`role="status"` region driven by a signal must **pass through a neutral
  state before each trigger** so the bound text genuinely changes and the AT re-reads it — `set('')`
  (or `'idle'`) then `set(message)` in the same handler (the two writes flush as one render; the empty
  string is never voiced). Do this for **every** announcement path, including « announce the same thing
  again ». A live-region that only changes value on *distinct* states will skip legitimate repeat
  announcements — assert the re-announce in a spec (trigger the SAME state twice, expect the message to
  re-appear), or the gap is silent.
- **Refs.** `shared/components/a11y-components/address-choice/address-choice.component.ts`
  (`announce()` = `set('')` then `set(message)`),
  `features/{checkout,location,installation}/*.ts` (`postalFill` reset to `'idle'` before each lookup),
  branch `feat/epic-d-address-unified`.

## L-026 · A wrapper that projects a form via `<ng-content>` behind `@if/@else` hides those fields in one branch — and an auth-guarded route makes the anonymous path untestable

- **Symptom.** Épic D introduced `app-address-choice`, which wraps each screen's structured address
  form as projected `<ng-content>` and, in « pastille profil » mode, renders an `@else` branch that
  **removes the projected form from the DOM** (it's masked, not just hidden). Two consequences. (a) Any
  spec/e2e asserting the inner fields directly (`#street`, `#civicNumber`, `#mesurer-rue`…) now has to
  first click « Utiliser une autre adresse » to bring them back — a test that pins the *old* direct
  access breaks (same hunt-the-pinned-spec discipline as [[L-008]]). (b) The « anonymous user sees the
  form directly » non-regression could be covered on the **public** routes (`/location`,
  `/installation`, `/mesurer`) but **NOT on `/panier/caisse`**: checkout is behind the auth guard, so a
  guest is redirected to `/auth` and never reaches the address form at all — the anonymous-checkout
  e2e was correctly **removed** (it asserted an unreachable state), with a comment citing the guard.
- **Rule.** When a wrapper conditionally projects a form via `<ng-content>` behind `@if/@else`, remember
  the projected fields are **absent from the DOM in the non-default branch** — grep every spec touching
  those fields and gate them on the toggle that reveals them (assert the *behaviour*: pastille →
  click → fields visible, not a bare `#field`). And before writing an « anonymous / unauthenticated
  parcours » test, confirm the route is actually **reachable** while logged out — an `authGuard`-protected
  route (checkout) redirects a guest to `/auth`, so that path can't be exercised anonymously; cover the
  guest non-regression only on genuinely public routes and document why the guarded one is excluded
  ([[L-005]]: don't ship a guard that asserts an impossible state). Pre-fill still tests with a value
  ≠ the form default ([[L-002]]).
- **Refs.** `shared/components/a11y-components/address-choice/address-choice.component.{ts,html}`
  (`@if hasProfileAddress` → pastille `@else` projects `<ng-content>`),
  `e2e/address-choice.spec.ts` (anonymous test only on public routes; checkout-anonymous removed with
  guard note ~l.235), branch `feat/epic-d-address-unified`.

## L-025 · An `environment.*` flag tied to a build option must match the `angular.json` config of EVERY configuration that replicates it — sibling configs don't merge

- **Symptom.** Épic C (local EN language switch). `environment.staging.ts` set `localized: true`, but
  the `staging` configuration in `angular.json` had **no** `"localize": true` — only `production` did,
  and Angular build configurations **do not inherit/merge between siblings**. A `staging` build would
  ship a **mono-locale FR** bundle while the runtime flag claimed bilingual → the « EN » button would
  be fully active and do `location.href = '/en/...'` to a path that doesn't exist → **silent redirect
  back to the FR home** — exactly the regression Épic C set out to kill. `deployment.md` made it worse
  by documenting the broken state as correct. The gap was **invisible to dev/prod gates**: it lives
  only on the `staging` config, which `npm test` / `npm run build` / `e2e` never exercise. Fix:
  `"localize": true` added to the `staging` config (mirror of `production`), staging build verified
  green. Same family as [[L-005]] (a flag/guard that doesn't match what the build/CI actually runs
  guards nothing) and [[L-022]] (per-environment build/deploy flags).
- **Rule.** Any `environment.*` flag backed by a build option (`localize`, `outputHashing`,
  `optimization`, `fileReplacements`, `sourceMap`…) must be checked against the `angular.json` config
  of **every** configuration that replicates it — sibling Angular configs **don't merge**, so one
  config (e.g. `staging`) can silently « lie » to the runtime without breaking dev/prod. When you add
  or change such a flag: grep all `configurations` in `angular.json`, confirm each that claims the
  behaviour carries the matching build option, and keep the doc that describes them in sync ([[L-018]]:
  finish the change at every layer). A config no gate exercises is unverified — build it once to prove
  the flag and the option agree.
- **Refs.** `angular.json` (`staging` config `"localize": true`),
  `src/environments/environment.{ts,prod.ts,staging.ts}`, `docs/deployment.md`,
  branch `feat/epic-c-locale-dev`.

## L-024 · Degrade a control with `aria-disabled` (focusable + accessible explanation), not native `disabled`; and a dynamically-bound attribute (`title`, `aria-label`…) can't use static `i18n-`

- **Symptom.** Two independent hits of the same bound-attribute i18n trap. (a) Épic C: the « EN »
  button tooltip used `[attr.title]`, a **dynamic binding**, so `i18n-title` (which only marks
  **static** attribute values) did not apply — the title stayed French in the EN build, breaking the
  accessible name in the non-default locale. Fix: a component property built with `$localize` +
  `@@id`. (b) EPIC 9.5 (admin shelter-model table): the per-row edit/delete buttons needed
  `[attr.aria-label]="editLabel(m.name)"` — a bound expression interpolating the row name. `i18n-aria-label`
  is inapplicable for the same reason (dynamic binding). Without `$localize`, the aria-label stays
  in French regardless of build locale → the button's accessible name is broken in the EN build.
  Fix: a component method returning `$localize\`:@@id:Modifier ${name}:name:\`` with a named
  placeholder, both trans-units in **both** catalogs. Also noted for Épic C: native `disabled` pulls
  the degraded « EN » button out of the tab order, hiding the « why » from keyboard users — an
  `aria-disabled` + `aria-describedby` pattern keeps it focusable.
- **Rule.** To « disable » a control while keeping it accessible, prefer **`aria-disabled="true"`** on
  a focusable element over native `disabled`: it stays in the tab order so its `aria-describedby`
  explanation is reachable, and the handler no-ops. Anchor the explanation in a **scoped** `sr-only`
  node (never a global landmark/live-region — [[L-010]]). When **any** attribute is **bound**
  (`[attr.title]`, `[attr.aria-label]`, `[attr.aria-describedby]`…), `i18n-<attr>` does **not**
  apply — the Angular i18n extractor only marks **static** attribute values. Translate via a
  **`$localize` component property or method** with an explicit `@@id`:
  - Simple string (no interpolation): `langUnavailableTitle = $localize\`:@@id:Text\``.
  - Interpolated value (e.g. row name): a method returning
    `$localize\`:@@id:Modifier ${name}:name:\`` — the `:name:` after the expression is the
    **placeholder name** required by the xlf format; omitting it causes extraction failure.
  Maintain the `@@id` in **both** `messages.xlf` and `messages.en.xlf` ([[L-018]]); a missing
  trans-unit in the EN catalog compiles to the source-language fallback, which looks correct in FR
  CI but breaks the EN build silently.
- **Refs.** `src/app/shared/layout/navbar/navbar.{html,ts}` (`aria-disabled` + scoped `sr-only` +
  `langUnavailableTitle = $localize\`@@navbar.langUnavailable\``),
  `src/app/core/services/locale.service.ts` (`localized()`),
  `src/locale/messages.{xlf,en.xlf}`,
  `src/AbrisAutoOutaouais-WebApp.Client/src/app/features/admin/shelter-models/shelter-models.ts`
  (`editLabel`/`deleteLabel` methods with named placeholder + `@@admin.shelterModels.table.editLabel`
  / `deleteLabel` in both catalogs),
  branches `feat/epic-c-locale-dev`, `feat/epic-9-dimension-catalog`.

## L-023 · A global `a:visited`/`a:hover` rule overrides `.btn--primary` on anchor-buttons — and a `:visited`-only contrast bug is INVISIBLE to axe/wave by design

- **Symptom.** G-A: primary CTAs styled as anchors (`<a class="btn btn--primary">` on the home hero
  and empty cart) rendered with illegible/invisible text — the user reported « le texte ne s'affiche
  pas » and suspected a z-index issue, yet axe AND wave (run manually) both passed, so it looked like
  a non-issue to tooling. Two compounding causes (both fixed). (1) `.btn--primary` used
  `color: var(--color-text-inverse)`, a **theme-SWAPPING** token that resolves to dark navy `#0f1923`
  in dark mode over the dark-theme primary background `#f87171` (light red). (2) The decisive one: the
  **global `a:visited` / `a:hover` rules** (specificity 0,1,1) **override** `.btn--primary`'s `color`
  (specificity 0,1,0) on anchor-styled buttons. Once the user had visited `/boutique`, the CTA text
  took `--color-link-hover` — `#991b1b` (dark red, barely visible on red) in light theme and `#f87171`
  (**identical** to the red button background → fully invisible) in dark theme. Tooling missed it
  because `:visited` styles are **not readable via `getComputedStyle`** (browser privacy returns the
  unvisited color), so axe/wave/Playwright color reads are **structurally blind** to a `:visited`-only
  regression — a vacuity cousin of [[L-016]] (contrast off in vitest) / [[L-009]] (assertion that
  cannot fire).
- **Rule.** (a) **Scope global link-color rules to `a:not(.btn)`** so anchors styled as buttons never
  inherit `:link`/`:visited`/`:hover` link colors — a class selector (0,1,0) always loses to
  `a:visited` (0,1,1), so an unscoped link rule silently wins on every `<a class="btn">`. (b) Style
  brand CTAs with **theme-FIXED** tokens (`--color-red-600/700` bg + `--color-on-brand` white text),
  never theme-SWAPPING ones (`--color-primary` / `--color-text-inverse`) — mirror `.btn--danger` /
  `.cta-banner` / `--gradient-brand`, which are correct precisely because they don't flip per theme.
  (c) Know that a `:visited`-only contrast regression **cannot** be caught by axe/vitest/Playwright
  color reads (privacy): verify it with a **live visual round-trip in BOTH themes after marking the
  target visited** ([[L-001]]), and **document the limitation honestly** in any regression guard — the
  guard can only assert the unvisited/token half (same honesty bar as [[L-016]]). The right fix lives
  in the **global** stylesheet, not a per-component patch (cousin of [[L-020]]: get the rule onto the
  element that actually wins by specificity).
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/src/styles.scss` (`a:not(.btn)` scoping +
  `.btn--primary` fixed-brand tokens), `e2e/button-contrast.spec.ts` (regression guard + honest
  `:visited` disclaimer), `src/.../_tokens.scss` (`--color-red-600/700`, `--color-on-brand`),
  branch `fix/epic-a-button-contrast`.

## L-022 · Container Apps : migration EF au démarrage OFF par défaut (sinon InMemory casse les tests), et le flag forwarded-headers évite la boucle 307 sans code

- **Symptom.** Préparation du déploiement backend sur Azure Container Apps. Deux pièges. (a) Une
  migration EF « au démarrage » non gardée ferait tomber TOUTE la suite d'intégration : le
  `WebAppFactory` boote l'app sur le provider **InMemory**, qui lève sur `Database.MigrateAsync()`
  (méthodes relationnelles indisponibles sur un provider non-relationnel). (b) Derrière l'ingress
  Container Apps (TLS terminé, HTTP:8080 en interne), `app.UseHttpsRedirection()` (actif hors dev)
  voit du HTTP et **boucle en 307** — le conteneur paraît « up » mais l'API est inatteignable.
- **Rule.** (a) Toute migration au démarrage est **opt-in, OFF par défaut**
  (`if (Configuration.GetValue<bool>("Database:MigrateOnStartup"))`), activée seulement par
  `Database__MigrateOnStartup=true` sur le conteneur prod — dev/tests restent sur
  `ef database update` / InMemory. Ici le garde doit précisément **NE PAS** s'exécuter en test pour
  garder `dotnet test` vert (miroir de [[L-005]]). `MigrateAsync` prend le verrou de migration SQL
  Server → sûr en multi-réplicas, et tourne **avant** les seeders (le schéma doit exister). (b)
  Poser `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` (flag natif, **aucun code**) → les
  forwarded-headers sont traités avant `UseHttpsRedirection`, qui voit alors `https`. Repli si la
  boucle persiste : `UseForwardedHeaders` en code avec `KnownNetworks`/`KnownProxies` vidés
  (l'ingress Envoy n'est pas loopback, donc non fié par défaut).
- **Refs.** `src/AbrisAutoOutaouais-WebApp.API/Program.cs` (migration opt-in),
  `Dockerfile`, `.github/workflows/azure-container-app.yml` (gated sur `AZURE_CREDENTIALS`),
  `docs/deployment.md` §4.2, branche `chore/prep-backend-deploy`.

## L-021 · An `addInitHook` Leaflet plugin (geoman) only patches maps built AFTER it loads — and a global-reading IIFE plugin needs `globalThis.L` set before import

- **Symptom.** F2-D: on `/mesurer` the satellite map rendered but was **non-drawable** — geoman's
  draw toolbar never appeared and `map.pm` was `undefined`. Two compounding causes (both required to
  fix; verified by inspecting `node_modules/@geoman-io/leaflet-geoman-free@2.19.3/dist/leaflet-geoman.js`
  + live `window.ng.getComponent()` probes before/after). (1) geoman's dist is a self-contained
  esbuild **IIFE that imports no Leaflet** (0 `require`/`import` of leaflet, 463 `L.` references) — it
  reads `L` as a **free variable off `globalThis.L`**. The component imported Leaflet as a local ESM
  module and never exposed it globally, so `globalThis.L` was `undefined` when geoman evaluated → it
  patched nothing. (2) Even after setting the global, `map.pm` was still null: geoman attaches it via
  `L.Map.addInitHook(...)`, which **only fires for map instances constructed AFTER the plugin loads** —
  but the code did `L.map(...)` **before** importing geoman, so the already-built map never acquired
  `pm`. This was **NOT** the "different/duplicate Leaflet instance" / CJS-ESM dedup theory L-019 had
  recorded (there's nothing to dedup — geoman loads no leaflet); it reproduces identically in vite-dev
  and esbuild-prod.
- **Rule.** For a Leaflet (or any `addInitHook`-style) plugin shipped as a **global-reading IIFE**:
  (a) set the global the plugin expects **before** importing it — `globalThis.L = L;` then
  `await import('@geoman-io/leaflet-geoman-free')`, inside `afterNextRender` so it stays SSR-safe; and
  (b) **import the plugin BEFORE constructing the instance** it must patch (`import(geoman)` then
  `L.map(...)`) — an `addInitHook` retro-fits nothing onto already-built objects. Don't stop at "the
  global got patched" (`L.PM` exists): **probe the CAPABILITY on the live instance** (`map.pm` present /
  toolbar drawable) via `window.ng.getComponent()` ([[L-001]] live repro, [[L-009]] capability-not-
  envelope) — the global being patched and *this* map being drawable are different facts. Resolves the
  geoman `map.pm` follow-up that [[L-019]] left open.
- **Refs.** `features/mesurer/steps/measure-step/map-measure/map-measure.ts` (`globalThis.L = L` +
  import-geoman-before-`L.map` reorder), `e2e/mesurer.spec.ts` (capability test flipped to assert the
  draw toolbar), branch `fix/f2d-mesurer-geoman-draw`.

## L-020 · Before deduping a utility CSS class across SCOPED stylesheets, prove who can actually reach it — a "shared" class may resolve nowhere

- **Symptom.** F2-C: `.btn--small` / `.btn--danger` were defined **3×** across scoped component
  stylesheets. The audit reco — « keep the `admin-shared.scss` copy, delete the others » — was
  **impossible as written**: `orders.ts` / `products.ts` don't list `admin-shared.scss` as a
  `styleUrl`, so Angular's view-encapsulation scoping meant deleting the duplicates would leave their
  buttons unstyled (a scoped class only applies inside the component that declares it). Worse, a
  **non-admin** component (`account/rentals`, inline template) referenced `.btn--danger` while **no
  scoped SCSS reached it at all** → the button was silently unstyled until the class was promoted.
- **Rule.** Angular view encapsulation scopes a component's styles to **that component only** — a class
  living in `a/x.scss` does **not** apply in component `b` even if `b`'s template uses the same name.
  So before "deduping" a utility class (`.btn--*`, badges, chips) between scoped stylesheets: grep
  **every** consumer — external templates **and** inline `template:` in `.ts` files — and confirm
  which stylesheet each actually loads. The correct dedup for a genuinely cross-component utility is to
  **promote it to global `styles.scss`** (where the `.btn` base already lives), not to pick one scoped
  copy as the survivor. Verify in a live render that each consuming button is still styled after the
  move (a class that resolved nowhere produces no error, only an unstyled element — cousin of [[L-009]]:
  no failure ≠ correct).
- **Refs.** `src/styles.scss` (`.btn--small` / `.btn--danger` promoted to global),
  `features/admin/{orders,products}`, `features/account/rentals/rentals.ts` (inline template consuming
  `.btn--danger`), branch `fix/f2-heuristics-followup` (F2-C).

## L-019 · Behind a dynamic heavy-lib import, `vi.mock` doesn't intercept and a container-only smoke test is vacuous — test the capability, not the envelope

- **Symptom.** F2-B touched the `/mesurer` Leaflet+geoman map (the lib is imported **dynamically**
  inside `afterNextRender`). Two traps surfaced. (a) **`vi.mock('leaflet')` is inoperative** in vitest
  **browser** mode for a dynamically-imported, pre-bundled (`optimizeDeps`) dep — « Mock wasn't
  registered » — because the dep is already bundled before the mock registers. (b) A smoke test that
  asserted only the **container** (`.leaflet-container`) was **vacuous**: it passed while the
  interactive widget was silently dead. Adding a **positive capability** assertion — « is the geoman
  draw toolbar (`.leaflet-pm-toolbar`) present? » — revealed `map.pm` never attaches. That geoman
  defect was **pre-existing (Épic D)**; the durable thing here is the *test discipline*. **Root-cause
  note (corrected by F2-D):** the original guess below — « geoman patches a *different* Leaflet
  instance », same family as the « `L.map` is not a function » CJS/ESM interop trap — was **wrong**.
  The real cause was a global-reading IIFE + `addInitHook` ordering, now captured and fixed in
  [[L-021]] (which resolves the once-open `board.md` follow-up).
- **Rule.** When a component dynamically imports a heavy lib (`leaflet`/`geoman`/`turf`/`three`) in
  `afterNextRender`, **don't rely on `vi.mock(<lib>)`** — it won't intercept the pre-bundled dynamic
  import in browser mode. Instead: (a) **test what renders BEFORE/independently of the heavy init** —
  e.g. the `notLocated()` hint is a **pure `computed`** of the inputs, evaluated on first render, so it
  needs no map at all; and (b) make the heavy init **robust to the lib being absent** (`if (!pm) return;`),
  which both kills the unhandled post-assertion rejections that polluted the whole suite **and** hardens
  prod. For the heavy path itself, **assert the CAPABILITY, not the wrapper**: a positive check that the
  widget is actually usable (draw toolbar present / map interactive), never just that its container
  mounted — a container-only assertion guards nothing ([[L-009]], [[L-005]]). Same « test the right
  layer » discipline as [[L-016]] / [[L-001]], extended to the dynamic-import axis. (For the actual
  geoman attach fix — `globalThis.L` + import-before-construct, NOT a CJS/ESM interop dedup — see
  [[L-021]].)
  **Corollary — asserting a component INPUT is not the same as asserting the EFFECT it should trigger (production fix #3, `/mesurer` map recentring).** The e2e « carte centrée sur l'adresse » test asserted `cmp.lat()` — the Angular input signal, which is propagated by the parent before the map lib is ready. The input was correctly set even when the map stayed frozen on the Gatineau fallback: `map.setView()` was never called because the recentring effect fired before `leaflet` was initialised. The test passed in CI while prod was broken. Fix: expose a `getMapCenter()` method that reads the **real Leaflet map centre** and assert its value after the effect fires. The rule is the same as [[L-009]] (test the capability, not the wrapper) applied to the **input-propagated vs effect-applied** axis: the input being set and the side-effect being executed are two distinct facts, and only the latter proves the feature works.
- **Refs.** `features/mesurer/steps/measure-step/measure-step.ts` (`notLocated()` computed; map init
  `if (!pm) return;` guard), the `/mesurer` map spec (capability assertion on `.leaflet-pm-toolbar`),
  `docs/agile/board.md` (open geoman `map.pm` follow-up, Épic D), branch `fix/f2-heuristics-followup`
  (F2-B);
  `features/mesurer/steps/measure-step/map-measure/map-measure.ts` (`getMapCenter()` + recentring
  effect), `e2e/mesurer.spec.ts` (asserts `getMapCenter()` not `cmp.lat()`), production fix #3.

## L-018 · Deleting the last consumer of a dep / i18n string isn't done until you finish the removal at EVERY layer

- **Symptom.** Two half-done removals in the Épic-F wrap-up, same root cause. (a) The GSAP "scroll
  story" hero — the only consumer of `gsap` — was deleted and all `gsap`/`ScrollTrigger` imports were
  gone, but `gsap` still sat in `package.json` `dependencies` (and `package-lock.json`). The
  tree-shaken prod bundle was green and the commit even claimed « gsap fully dropped from the bundle »,
  so the dead dependency was invisible — it only lingers as install-time + supply-chain surface. (b)
  Five trans-units (`navbar.register`, `home.heroStory.beat1`–`beat4`) became orphaned when the navbar
  button was merged and the hero rewritten. The build stayed green; left as-is, the next
  `npm run i18n:extract` would prune them from the **source** `messages.xlf` while they remained
  hand-maintained in the **translated** `messages.en.xlf` → the two catalogs silently desync.
- **Rule.** When you delete the **last** consumer of a dependency or an i18n string, finish the removal
  at every layer in the same change — a green tree-shaken bundle hides a dead dep, and a green build
  hides orphaned/desynced translations. For a now-unused npm dep: drop it from `package.json` AND
  refresh `package-lock.json` (grep imports across the client to confirm it's truly the last consumer).
  For an orphaned trans-unit: prune it from BOTH catalogs — `npm run i18n:extract` regenerates the
  source `messages.xlf` but does **not** touch the translated `messages.en.xlf`, so remove the orphan
  there too (line-based) and confirm both files carry the same id set. Cousin of [[L-008]] (after a
  removal, hunt down everything that still references the old thing) on the dependency/i18n axis.
- **Refs.** `package.json` / `package-lock.json` (`gsap` removed), `src/locale/messages.xlf` +
  `src/locale/messages.en.xlf` (`navbar.register`, `home.heroStory.beat*` pruned from both),
  commit `5adb1f3`, branch `docs/program-wrapup`.

## L-017 · A zombie dev-server + `reuseExistingServer: true` makes Playwright test STALE code

- **Symptom.** During E4 an e2e failed (`has3dDims` came back `undefined` on the component instance)
  even though the source was correct and vitest passed. Cause: `playwright.config`
  (`webServer.reuseExistingServer: true`) attached to a **zombie `ng serve`** left running from an
  *earlier* session — started BEFORE the edits — so the e2e ran against a stale bundle. The tell was
  probing the live instance via `window.ng.getComponent()`: the property was simply absent → the
  served bundle predated the change. Cousin of [[L-001]] (reproduce against the REAL stack — here the
  "real" stack also has to be the *current* one, not a leftover process).
- **Rule.** Before you blame an e2e failure on the current diff — or declare an e2e green — confirm no
  zombie dev-server from a previous session is listening on the port (4200/4300): with
  `reuseExistingServer: true`, Playwright binds to it and tests dead code. Kill the listener and let
  Playwright spin up a fresh server (or, when in doubt, probe the live component via
  `window.ng.getComponent()` to confirm the served bundle matches HEAD). **Distinguish this from a
  legitimately pre-existing failure**: isolate the latter with `git stash` to prove your diff didn't
  cause it (E4 correctly stashed to confirm the `/en/` color-contrast failures were pre-existing, not
  introduced — the [[L-008]] discipline of separating "my change broke it" from "already broken").
- **Refs.** `src/AbrisAutoOutaouais-WebApp.Client/playwright.config.ts`
  (`webServer.reuseExistingServer`), E4 (Épic E).

## L-016 · « Zéro violation axe » in vitest is VACUOUS for color-contrast — it's disabled by design

- **Symptom.** `src/testing/axe-helper.ts` (`expectNoA11yViolations`) explicitly disables the
  `color-contrast` rule (`rules: { 'color-contrast': { enabled: false } }`, line 14) — rightly, since
  global styles (`styles.scss` + `_tokens.scss`) aren't loaded in the unit render, so the composed
  colors aren't representative. Consequence: the E1 (tokens v2), E2 (hero) and E3 (micro-interactions +
  navbar glass `.navbar--scrolled` at `rgba(15,25,35,0.82)`) sub-tasks each reported « npm test: zéro
  violation axe » and that gate was taken as *proof of accessibility* — when it **cannot** catch a
  contrast regression. The real regression (`color-contrast` failures on `.navbar--scrolled` plus the
  admin/rentals/mesurer sections introduced by the Épic-E redesign) only surfaced at the **Playwright
  e2e** run (real composed colors) several sub-tasks later. Same vacuity family as [[L-009]] (an
  assertion that passes because the condition is structurally unreachable), but on the contrast axis
  and across several consecutive sub-tasks.
- **Rule.** Any sub-task touching **colors / tokens / backgrounds** (theme, `_tokens.scss`,
  translucent/glass fills, gradients, hover states) **cannot** rely on `npm test` (vitest) for
  contrast — `color-contrast` is off there by design. **This includes any NEW component that puts text
  on a tinted background token** (e.g. Épic D's `app-address-choice` card on `--color-bg-muted`, whose
  `--color-text-muted` line came out at **4.39:1 < AA** and was caught *only* by the dual-theme e2e
  axe scan) — a fresh surface re-opens the contrast question even when the tokens are « semantic ».
  Contrast MUST be verified by Playwright e2e + axe (`npm run e2e`, real composed colors) AND a live
  round-trip ([[L-001]]) **in BOTH themes**. When reporting a « zéro axe » gate on a color diff,
  qualify it — « (vitest — color-contrast NON couvert; contraste validé en e2e/live) » — so the gate
  isn't over-credited (same honesty as [[L-005]]: a guard that can't fire guards nothing). Best: every
  new tinted-background component ships its own dual-theme axe e2e (the E5 « axe both themes » gate).
  **Corollary — an axe scan must run on a STABILISED DOM; a transient `:disabled`/opacity state can produce a false contrast violation (PR #58, `feat/shelters-configure-only`).** `mesurer.spec.ts:500` (D5) ran an axe `color-contrast` scan immediately after a `role="status"` appeared, without waiting for a `.btn--outline` trigger button to exit its transitional `:disabled` state. While disabled, the button's CSS applied `opacity: 0.5` — axe reads the composited color at that opacity and computed #c54444 on #f3d7d7 = 3.62:1 (< 4.5 AA), flagging a violation that does not exist in the stable post-action state. Fix: add `await expect(button).toBeEnabled()` (and `not.toHaveAttribute('aria-busy', 'true')` if relevant) **before** the axe scan. This is the same vacuity axis as L-016 itself (axe sees the DOM as it is at scan time, not as it will be) — except here the DOM is not permanently wrong, only transiently so. A scan fired before a transition has settled is a false positive that causes flake, not a missed real violation. Guard: after any action that triggers a loading/disabled state on an interactive element, gate the axe scan on `toBeEnabled()` + absence of `aria-busy`.
- **Refs.** `src/testing/axe-helper.ts:14` (`color-contrast` disabled),
  `src/app/shared/layout/navbar/navbar.scss` (`.navbar--scrolled`), Épic-E commits `cdd82a4` / `1e38a4d`;
  `e2e/address-choice.spec.ts` (per-theme `for (const theme of ['light','dark'])` axe scan of the
  pastille on `--color-bg-muted`, Épic D);
  `e2e/mesurer.spec.ts:500` (`toBeEnabled()` barrier before axe scan, PR #58 `feat/shelters-configure-only`).

## L-015 · `role="radio"`/`radiogroup` without roving `tabindex` + arrow keys is keyboard-broken — and AXE passes anyway

- **Symptom.** Two mode toggles (`features/mesurer/steps/measure-step` calculateur⇄carte and
  `.../vehicle-calculator` véhicules⇄manuel) declared `role="radiogroup"` + `role="radio"` +
  `[attr.aria-checked]` but **none of the APG interaction contract**: no roving `tabindex` (each
  option was its own Tab stop instead of one group stop), no arrow/Home/End handling. **AXE went
  green** — it only checks *static* ARIA attributes, not the keyboard contract — so the e2e axe sweep
  gave false confidence ([[L-009]]). The independent `code-reviewer` caught it (Major); neither the
  author nor the automated tests did.
- **Rule.** A composite widget (`radiogroup`/`tablist`/`menu`/`listbox`…) is **not** done when its
  roles/`aria-checked` are present and AXE is green — AXE does not exercise the APG keyboard contract.
  Implement it: **roving `tabindex`** (`[attr.tabindex]="selected ? 0 : -1"` — one group Tab stop) and
  a `(keydown)` handler for arrows + Home/End that **moves selection AND focus together**; factor the
  index math into a pure, unit-tested util (`features/mesurer/util/radio-nav.util.ts`:
  `isRadioNavKey`/`nextRadioIndex`). Keep the real ARIA `role` so e2e role locators stay valid
  ([[L-008]]: assert behaviour, not the attribute). **Add a keyboard test** that presses an arrow and
  asserts both the selection flip and `toHaveFocus()` on the newly-selected option — a status/role-only
  test never catches a missing-contract bug ([[L-006]]).
  **Focus nuance vs [[L-006]].** Here the handler does `signal.set(...)` then `.focus()` **synchronously**
  and that is **safe**, because both radios are **static** template elements — only `tabindex`/class
  toggle, no element is added/removed (`tabindex="-1"` does not block programmatic `.focus()`). [[L-006]]
  (focus *after* render) applies only when the focus target **appears/disappears in the same tick** as
  the signal write; when the target stays mounted, synchronous focus right after `set()` is correct.
- **Refs.** `features/mesurer/util/radio-nav.util.ts` (`isRadioNavKey`/`nextRadioIndex` + spec),
  `features/mesurer/steps/measure-step/measure-step.html`,
  `features/mesurer/steps/vehicle-calculator/vehicle-calculator.html`, commit `53d99fd`.

## L-014 · Build a typed reactive control explicitly — never spread a `readonly [value, validators]` tuple into `fb.control(...)`

- **Symptom.** In an Angular reactive form, creating a numeric control by **spreading** a
  `readonly [value, validators]` tuple into `fb.control(...)` breaks the typecheck
  (`'nonNullable' is missing in type …`): the tuple's second element is read as the
  `AbstractControlOptions` argument, which `FormBuilder` then expects to carry `nonNullable`.
- **Rule.** Declare the control explicitly with its type parameter:
  `this.fb.control<number | null>(null, [Validators.min(...), Validators.max(...)])` — never a tuple
  spread. Pass `value` and `validators` as separate positional arguments so the overload resolves.
- **Refs.** `features/mesurer/steps/measure-step/vehicle-calculator/vehicle-calculator.ts`
  (`manualForm`, `vehiclesForm`); first flagged by the dev in D1 (admin product form), reapplied in D3.

## L-013 · A component `input()` named after a global DOM attribute (`id`, `class`, `role`) reflects onto the host AND breaks the accessible name

- **Symptom.** `app-address-autocomplete` declared `id = input.required<string>()` and was used as
  `<app-address-autocomplete id="street">`. Because `id` is a **global DOM attribute**, Angular
  reflected `id="street"` onto the component **host element** as well as the inner `<input>` that the
  component bound it to → **two `#street` nodes**. The `<label for="street">` accessible-name
  computation resolves via `getElementById`, which returned the *non-labelable host* first, so the
  real `<input>` got no accessible name and `getByRole('combobox', { name })` failed.
- **Rule.** When a component forwards a value to an inner element under a name that collides with a
  **global DOM attribute** (`id`, `class`, `role`, `title`, `style`…), neutralise it on the host so a
  single element carries it: `host: { '[attr.id]': 'null' }` (or rename the input to a non-reflecting
  name like `inputId`). Verify there's exactly one node with that id in the rendered tree. Corollary
  (vitest browser, sibling of [[L-010]]): the browser runner shares one `document` across renders, so
  duplicate ids leak between cases — scope every query with `within(container)` and never assert on a
  bare `getElementById`/`#id`.
- **Refs.** `shared/components/a11y-components/autocomplete/address-autocomplete.component.ts`
  (`host: { '[attr.id]': 'null' }`), commit `8183d46`.

## L-012 · SSR+hydration e2e: drive typing through the locator and gate on a network barrier, never `keyboard.type` + fixed waits

- **Symptom.** `e2e/address-autocomplete.spec.ts` was flaky **only in the full suite** (green in
  isolation). Root cause: the app is SSR + hydration — `page.keyboard.type(...)` dispatches native
  keystrokes to whatever node has focus, but until Angular re-wires the `(input)` listener *after
  hydration*, those native keystrokes fire **no Angular event** → no `places/suggest` call → nothing
  renders. Under suite load hydration lands later, so the race flipped run-to-run.
  **Second hit — a full interaction sequence, not just a bare `fill` (EPIC 11, `mesurer.spec.ts`
  Conseil dark, flake préexistant sur master).** `fill('berline','1')` → click « calculer le gabarit »
  → `expect(heading 'Abri double pointu 16 pi')` failed in CI on the dark-theme variant only (later
  suite position → slower hydration, amplified by `[WebServer] ECONNREFUSED` noise from the SSR shell).
  Before hydration: either the `fill` doesn't reach the reactive model (no emission → no result), or
  the click fires before the step's handler is wired (stage never mounts). **Diagnostic trap:** the
  `[WebServer] ECONNREFUSED` log line looks like a missing backend, but the suggestion data came from
  a `page.route` mock (client-side, post-hydration) — `page.route` does **not** intercept SSR fetches,
  but the relevant flow is client-side and correctly mocked. The real cause was the interaction race,
  not missing data.
- **Rule.** In an SSR+hydration app: (1) type through the **locator** (`locator.pressSequentially(...)`,
  which auto-focuses and waits for actionability), not `page.keyboard.type`; (2) gate any
  « type → debounced request → rendered result » sequence on a **network barrier**
  (`page.waitForResponse(/…/)`) — never a fixed `waitForTimeout`; (3) wrap the **entire interaction
  sequence** (`fill → toHaveValue → click → assert visible`) in `expect(async () => {…}).toPass()`
  when the sequence spans a step transition or a network/render boundary — a `toPass` around the `fill`
  alone is not enough if the subsequent click also fires before the handler is hydrated. **Rule of
  thumb: every keystroke, `fill`, or click that must land in a reactive form or trigger a step
  transition on an SSR+hydrated page goes through a `toPass` (or a network/state barrier), never a
  bare one-shot.** When triaging a CI-only e2e red, get the REAL error from the CI log first
  ([[L-001]]) and check whether the data is mocked via `page.route` — a `[WebServer] ECONNREFUSED`
  is a **lure** when the relevant data flow is client-side post-hydration; the `ng-pristine`/empty-value
  tell points straight at the interaction race, not at missing backend data.
  **Corollary — a one-shot `fill()` on a reactive-form control has the SAME race (Épic G).** The D1
  civic-preservation test did `await page.locator('#civicNumber').fill('77')` once, **outside** any
  retry, right after a `goto` that only awaited `#street` visibility. Before the civic field's
  `ControlValueAccessor` is hydrated, `fill()` sets the *native* value but Angular's form model stays
  `''` (control resolved `ng-pristine`/value `''`); the next CD cycle (the suggestion patch) writes the
  empty model back over the DOM and ERASES the `77` → final assertion received `''`. **CI-only** (green
  locally — faster hydration), reproducible there across runs (it reads like a regression, but isn't:
  the spec is byte-identical to master and none of the `/location` cascade changed). Fix: wrap the
  `fill` in `await expect(async () => { await ctrl.fill('77'); await expect(ctrl).toHaveValue('77'); }).toPass()`
  so Playwright replays it until Angular actually registers the value.
  **Corollary — `toHaveValue` inside a `toPass` proves the DOM value, NOT the reactive model (PR #58, `feat/shelters-configure-only`).** The D1 civic `toPass` was already in place (`fill('77')` → `toHaveValue('77')`), yet the spec still flaked in CI. Root cause: `toHaveValue` reads the **native DOM input value** set by `fill()` — it returns `'77'` even when the `ControlValueAccessor` is not yet hydrated and the Angular `FormControl` still holds `''`. The `toPass` therefore exits as soon as the DOM shows `77` (immediately after `fill`), before Angular's reactive model has registered the change. The next change-detection cycle (a suggestion patch, an autofill effect) then writes the model's `''` back into the DOM, erasing the typed value. Fix: add `await expect(civic).toHaveClass(/ng-dirty/)` **inside the same `toPass`**, after `toHaveValue`. Angular only sets `ng-dirty` (and removes `ng-pristine`) when its reactive model has actually recorded a user-driven change — so the `toPass` loop does not exit until both the DOM **and** the model hold the value. Rule of thumb: in an SSR+hydration test, **`toHaveValue` is a DOM assertion, not a reactive-model assertion** — it is vacuous as a hydration gate ([[L-009]]: an assertion that passes on the broken path proves nothing). Pair it with `toHaveClass(/ng-dirty/)` (or an equivalent model-state signal) whenever a subsequent CD cycle could overwrite the DOM from a stale model value.
- **Refs.** `e2e/address-autocomplete.spec.ts` (`pressSequentially` + `waitForResponse` barrier;
  civic `fill` wrapped in `expect(...).toPass()` with `toHaveClass(/ng-dirty/)`), commits `6e23b48`
  (combobox), `feat/epic-g-catalog` (civic), PR #58 `feat/shelters-configure-only` (ng-dirty corollary);
  `e2e/mesurer.spec.ts` (helper `calculerVehiculeBerline` = fill→toHaveValue→click→heading
  dans `toPass`; `fillMapAddress` durci), branch `feat/epic-11-calendrier`.

## L-011 · Interchangeable port implementations must each emit the CANONICAL format — and the test mock must mimic the DEFAULT provider, not a conformant one

- **Symptom.** `IPlacesService` has three adapters (Photon — default, keyless; Radar; Google).
  `AddressDtoValidator` requires `Province.MaximumLength(2)` (2-letter canonical code, per [[L-004]]).
  Radar (`StateCode ?? State`) and Google (`ComponentShort`) return 2 letters — but **Photon, the
  provider actually active by default, returned the full name** (« Québec »/« Ontario »). The client
  patched `province` raw from the suggestion → submit → **silent 422 on the autofill happy-path**.
  Worse, the e2e mock returned `province: 'ON'` (the Radar/Google already-conformant shape), so it
  **masked** the mismatch entirely.
- **Rule.** When several implementations of one port feed a shared validator/format, **every** adapter
  must emit the **canonical** value — normalise inside the Infrastructure adapter (e.g.
  `CanadianProvinceCodes` maps full name → 2-letter), never downstream in the client. And the test
  double **must reproduce the real shape of the *default* provider** (the one most likely live), not a
  pre-conformed shape that hides the gap — pick mock fixtures that *differ* from the canonical form so
  the assertion can actually fail ([[L-002]]). Extends [[L-004]] across the *adapter* axis: one agreed
  format isn't enough if only some producers honour it.
- **Refs.** `Infrastructure/Services/Places/{PhotonPlacesService,CanadianProvinceCodes}.cs`,
  `Application/Common/Validators/AddressDtoValidator.cs`, `e2e/address-autocomplete.spec.ts`
  (mock now returns Photon's full-name shape), commit `2c963f7`.

## L-010 · A new global ARIA landmark/live-region can break role locators in UNRELATED specs

- **Symptom.** B4 added a **global** live region (`role="status"` / `aria-live="polite"`) to
  `app.html` to announce the language switch after reload. That silently broke an unrelated spec,
  `e2e/password-reset.spec.ts`, whose locator `getByRole('status')` was **unscoped**: with a second
  `status` node now in the page, Playwright strict mode raised a « resolved to 2 elements » ambiguity
  and the test failed — even though nothing about password-reset changed. A role-based locator picks
  from a **page-global** namespace, so adding one shared landmark widens the match set of every such
  locator in the suite, not just the file you edited.
- **Rule.** When you add a **global** landmark/live-region/role node (`status`, `alert`,
  `navigation`, `main`, `banner`…) in a shared shell like `app.html`, grep the whole test suite for
  unscoped role locators that can now collide (`getByRole('status'|'alert'|…)` without a scope) and
  re-anchor them to the **real post-condition** — scope by accessible name / text
  (`getByRole('status').filter({ hasText: /si un compte correspond/i })` or `getByText(...)`), not by
  bare role. Confirm by sweeping the suite, as B4 did (the only other `getByRole('status')` was a
  component spec rendered in isolation without `app.html`, so unaffected). Same root as [[L-008]]:
  after a change, hunt the tests it can knock over — but here the breakage is by **collision in a
  global namespace**, not by pinning the old mechanism, and it hits specs with no topical link to the
  change ([[L-002]]: assert the real post-condition, not a brittle proxy like a bare role).
  Corollary (tooling hygiene): vitest browser mode writes failure screenshots to
  `.vitest-attachments/`; these PNGs had been committed in an earlier session and polluted the diff —
  keep `.vitest-attachments/` in the client `.gitignore` and never commit those artifacts.
  **Backend analogue (shared test-host global state, C2).** The same "one global namespace,
  many tests" hazard exists in the integration suite: every IT class runs against the shared
  `WebAppFactory` (a single **named** InMemory database + an `IdentitySeeder` run at host start).
  A new IT class declared **outside** `[Collection("Integration")]` runs in a *parallel* xUnit
  collection, so two hosts seed the same identity store at once → `IsInRoleAsync` hits a « sequence
  contains more than one element » race and **~63 unrelated tests fail at host startup**. Rule:
  every class touching `WebAppFactory` must carry `[Collection("Integration")]` so they share one
  serialized context — never let a new IT class default into its own parallel collection.
  **Second-order corollary — a seeder that reads from a SIBLING seeder must tolerate duplicates
  (EPIC 9.1).** Every seeder registered in `Program.cs` runs inside `WebAppFactory` against the
  shared InMemory DB. If seeder A runs first and seeder B subsequently queries A's rows by a key
  that is logically unique in prod (e.g. `Slug`), that key can appear **duplicated** in the shared
  InMemory store when two parallel test hosts each ran seeder A before serialization kicks in.
  `ToDictionaryAsync(x => x.Slug)` throws « an item with the same key has already been added »,
  crashing host startup and failing **15 unrelated IT tests** (Rentals/Users). Fix: replace any
  `ToDictionary`/`Single`/`SingleOrDefault` lookup on such a key with a **duplicate-tolerant,
  deterministic pick** — `GroupBy(slug).Select(g => g.OrderBy(x => x.Id).First())` — and seed only
  rows whose key is not yet present. This is the [[L-030]] tie-break discipline applied to the
  **seeder-reads-sibling** axis: the code must behave correctly whether it sees 1 or N rows for a
  given key.
- **Refs.** `src/app/app.html` (global `role="status"` language-switch live region),
  `e2e/password-reset.spec.ts` (locator re-scoped by text), `.gitignore` (client,
  `.vitest-attachments/`), `IntegrationTest/Common/WebAppFactory.cs` +
  `IntegrationTest/Common/IntegrationCollection.cs` (`[Collection("Integration")]`),
  `src/AbrisAutoOutaouais-WebApp.Infrastructure/Persistence/ShelterModelSeeder.cs` +
  `src/AbrisAutoOutaouais-WebApp.API/Program.cs` (duplicate-tolerant category lookup, EPIC 9.1).

## L-009 · Breakpoint-gated UI: pin the viewport in vitest browser specs, or assertions pass vacuously

- **Symptom.** The navbar has two variants split at 1024px (desktop user-menu vs hamburger panel).
  In vitest browser mode, whichever variant the default window size hides is `display:none` — and a
  hidden element satisfies almost any *negative* assertion ("not focusable", "axe-clean", "inert")
  vacuously, so the spec passes while exercising nothing.
- **Rule.** When the tested UI lives behind a CSS breakpoint, set the viewport explicitly per
  variant — `await page.viewport(w, h)` in setup (navbar uses DESKTOP 1280×800 / MOBILE 414×896) —
  and pair every negative assertion with a positive one proving the element is actually rendered in
  that variant. Same vacuity class as [[L-002]] (an assertion that can't fail proves nothing).
- **Refs.** `src/app/shared/layout/navbar/navbar.spec.ts` (`setup(viewport)`, `DESKTOP`/`MOBILE`
  constants), `src/app/shared/layout/navbar/navbar.scss` (the 1024px breakpoint).

## L-008 · After a fix, hunt down tests pinning the OLD mechanism and guards excusing the OLD bug

- **Symptom.** Two instances in one epic (Bug-08: closed nav menus went from `aria-hidden` to
  `inert`). (a) `e2e/mobile-menu.spec.ts` asserted `aria-hidden="true"` after Escape — it pinned
  the *implementation mechanism*, so it failed when the mechanism was correctly replaced; had the
  replacement been wrong in some other way, it could equally have kept passing. (b)
  `e2e/rental-cancel.spec.ts` scoped its axe scan with `.include('app-rentals')` plus a comment
  « bug PRÉEXISTANT … à traiter séparément » — after Bug-08 was fixed the exclusion silently
  remained, leaving the only authenticated-navbar scenario unscanned until the reviewer caught it.
- **Rule.** When you fix a bug or replace a mechanism, grep the test suites for two things and fix
  them **in the same change**: (1) assertions naming the old mechanism — rewrite them to assert the
  *behavior* (menu children unreachable/infocusable; page axe-clean), not the attribute that
  happened to implement it ([[L-002]]: test the real post-condition, not a proxy); (2)
  scopes/exclusions/skips whose justification names the bug you just fixed — remove them and let the
  full check run, because a fixed bug whose guard still excludes it is **unverified**
  ([[L-005]]: a guard that doesn't run guards nothing). Corollary: always make workaround comments
  cite the bug ID (« Bug-08 ») — that's what makes this grep possible.
- **Refs.** `e2e/mobile-menu.spec.ts` (Escape now asserts `inert` + focus return),
  `e2e/rental-cancel.spec.ts` (full-page axe scan, exclusion removed),
  `src/app/shared/layout/navbar/navbar.html` (Bug-08 fix), `docs/agile/board.md` (Bug-08).

## L-007 · A date-window DB scan is only correct under a max-duration invariant

- **Symptom.** The reschedule handler checks « le créneau cible est-il déjà pris ? » by loading
  **same-day** active bookings (`b.SlotStart >= dayStart && < dayStart.AddDays(1)`) and testing
  overlap in memory. This is correct **only because every booking is a fixed 2-hour (sub-day) slot** —
  no existing booking can start the previous day and bleed into the target morning. If durations ever
  became variable or multi-day (an 8-hour or overnight job), a long booking starting the prior
  afternoon would overlap the target slot yet be missed by the same-day window — a **silent
  double-booking**. The constraint that makes the query correct (the fixed 2 h grid) lives in
  `SlotRules`, far from the query that depends on it.
- **Rule.** When a time-overlap/availability check narrows the DB scan with a date window (same-day,
  this-week…), that window's correctness depends on a **maximum-duration assumption**. Pin that
  assumption **at the query** with a comment AND a test, so any future change to durations is forced
  to confront it. If durations can exceed the window, widen the scan (`AddDays(-1)`, or filter on
  `SlotStart < targetEnd && SlotStart + Duration > targetStart` over a sufficient range).
  Generalises [[L-004]] (one agreed definition shared across producers/consumers) to the *temporal*
  dimension: the slot-grid duration is a shared value, and every consumer — the availability query
  and the overlap check — must agree on it.
- **Refs.** `Application/Bookings/Commands/RescheduleBooking/RescheduleBookingCommand.cs` (same-day
  overlap query + the pinned-assumption comment), `Application/Bookings/Common/SlotRules.cs` (the 2 h
  grid constants), `IntegrationTest/Bookings/BookingsEndpointTests.cs`
  (`Reschedule_ToSlotTakenByAnotherBooking_Returns422`).

## L-006 · Move focus AFTER render, not in the same tick that removes the element; the focus target must be UNCONDITIONALLY rendered

- **Symptom.** A « retour de focus » handler called `element.focus()` **synchronously** inside an
  RxJS `next`, right after a signal update that removes the triggering button from the DOM (the
  cancelled rental row hides its « Annuler » via `@if`). Change detection hadn't run yet, so the
  button was still connected → focus landed on it → CD then removed it → focus silently fell back to
  `<body>`. WCAG 2.4.3 (focus order) was violated even though the code "looked" right, and an
  `isConnected` heuristic hid it. The status-only e2e passed; the bug surfaced only when a **vitest**
  `expect(heading).toHaveFocus()` assertion was added and failed.
  **Second hit (EPIC 11, US-11.2 — calendar add-appointment overlay):** an `effect()` targeted a
  `viewChild` (`#addFormFirstField`) declared inside `@if (availableSlots().length > 0)`. On any day
  with no free slots or while slots are loading — the normal case for a busy installation company — the
  branch was inactive, the `viewChild` returned `undefined`, the effect silently no-oped, and focus
  fell to `<body>`. Invisible to happy-path tests (which always provided slots) and to axe. Caught by
  the independent reviewer as a Minor.
- **Rule.** Two rules, both required:
  (1) **Timing.** When the focus target only exists **after** the next render (a signal add/removes
  DOM), focus it **after** the view updates — `setTimeout(() => target.focus())` (macrotask, post-CD),
  `afterNextRender`, or an `effect()` reading the target's `viewChild()` signal. Never call `.focus()`
  in the same tick as the signal update that changes which elements exist. Focus the **trigger** (still
  present) when nothing changed (dismiss / error); focus a **stable fallback** (the heading) *after
  render* when the trigger is being removed.
  (2) **Stability of the target.** The element a `viewChild` targets for post-open focus must be
  **unconditionally rendered** within the container — a heading or `<legend>` with `tabindex="-1"`
  placed at the top of the sub-form, **outside** any `@if/@else` guard. A `viewChild` whose element
  lives inside a conditional branch returns `undefined` on the empty/loading path and silently no-ops.
  This is the most dangerous failure mode: no error, no warning, focus drops to `<body>`, and happy-
  path tests never exercise the empty branch (see also [[L-040]]: the unresolved/empty path is both
  the one that breaks and the one tests skip). Guard with a vitest test that passes `availableSlots =
  []` (or equivalent empty/loading state) and asserts `toHaveFocus()` on the unconditional element.
  **Corollary — static target → synchronous focus is safe (see [[L-015]]):** when the focus target is
  a static template element (only `tabindex`/class toggled, never added/removed), `.focus()` right
  after `signal.set(...)` is correct — `tabindex="-1"` does not block programmatic focus.
  And **assert focus at the unit level** (vitest `toHaveFocus()`) in all cases — a status-only e2e
  never catches a focus bug ([[L-002]]).
- **Refs.** `features/account/rentals/rentals.ts` (`confirmCancel` / `focusTrigger` /
  `focusHeadingAfterRender`, the `effect()` reading `cancelDialog()`),
  `features/account/rentals/rentals.spec.ts` (the `toHaveFocus()` assertions);
  `features/admin/calendar/calendar.ts` (`addFormHeading` unconditional `viewChild` + focus effect),
  `features/admin/calendar/calendar.html` (`#addFormHeading tabindex="-1"` outside `@if (availableSlots().length > 0)`),
  `features/admin/calendar/calendar.spec.ts` (test « jour sans créneau libre » → focus on heading),
  branch `feat/epic-11-calendrier`.

## L-005 · A regression guard only guards if CI actually runs it

- **Symptom.** During the checkout/Ontario hardening, a new Playwright e2e
  (`e2e/checkout-order.spec.ts`) was added to lock in that a non-QC (Ontario) delivery address
  places an order successfully. The reviewer refused to take "I added a spec" on faith and made us
  **prove** the pipeline executes it — because a spec file the workflow never invokes is
  documentation, not enforcement, and gives false confidence. Verified-good here: CI was already
  wired (this is the discipline, not a fix to a gap). See [[L-002]] for getting the *assertion*
  right once it does run.
- **Rule.** When you add a test as a regression guard, confirm it's in the CI-run set before calling
  it done — read `.github/workflows/ci.yml`, don't assume. The runners: Playwright `e2e/*.spec.ts`
  via **`npm run e2e`** (= `playwright test`), vitest+axe via **`npm test`**, typecheck via
  **`npm run build`**, backend via **`dotnet test`**. If your new test lives outside those globs/steps
  (or needs a new step), wire it in — otherwise the pipeline silently skips it.
- **Refs.** `.github/workflows/ci.yml` (`npm run e2e` / `npm test` / `npm run build` steps),
  `src/AbrisAutoOutaouais-WebApp.Client/e2e/checkout-order.spec.ts`,
  `src/AbrisAutoOutaouais-WebApp.Client/package.json` (`e2e` → `playwright test`).

## L-004 · A value shared across screens needs ONE agreed format (client AND server)

- **Symptom.** Fixing the profile postal code to the canonical « A1A 1A1 » (with space) and
  auto-filling it into checkout silently created a NEW bug: the backend `PlaceOrderCommandValidator`
  required `^[A-Z]\d[A-Z]\d[A-Z]\d$` (no space), so a logged-in user choosing « Livraison » with the
  pre-filled address got a **400**. A fix on one screen regressed a sibling screen that shares the
  value. (Caught by the independent `code-reviewer`, not by the author — that's the point of the step.)
- **Rule.** When a value flows between screens/layers, pick one canonical format and make **every**
  validator agree on it; normalize at the boundary you control. When you change a shared value's
  format, grep for **all** producers/consumers (here: profile, checkout, location, installation, and
  every server-side validator) before calling it done. Pin the agreement with a test at the boundary.
  **A validated architect plan does NOT override this lesson or its regression tests (C1).** The
  Epic-C plan prescribed a province *whitelist* in `AddressDtoValidator`; implementing it as written
  would have re-introduced exactly this regression (Ontario → 400) that `PlaceOrderCommandValidatorTests`
  exists to lock down. The developer correctly **deviated from the plan** and flagged it in review.
  Before coding any "shared validation rule" a plan dictates, grep `*ValidatorTests` and comments
  citing a lesson ID — the lesson/test wins over the plan, and the deviation gets called out in review.
- **Refs.** `Application/Orders/Commands/PlaceOrder/PlaceOrderCommandValidator.cs`,
  `Application/Common/Validators/AddressDtoValidator.cs`,
  `Client/.../features/{account/profile,checkout}`, `UnitTest/.../PlaceOrderCommandValidatorTests.cs`.

## L-003 · The cached `AuthUser` does NOT carry the saved address

- **Symptom.** A form tried to pre-fill the delivery address from `AuthService.user()` and always
  got nothing — `AuthUser` only holds `id/email/username/firstName/lastName/roles/avatar`. The
  default delivery address lives **only** in `GET /auth/me` (`UserProfileDto.defaultDeliveryAddress`),
  not in the JWT/localStorage cache.
- **Rule.** To read the user's saved address on the client, go through **`ProfileService`**
  (`core/services/profile.service.ts`), which loads `/auth/me` once and caches it as a signal. Do
  not widen `AuthUser` with profile fields — auth state and profile state are separate concerns.
- **Refs.** `core/services/auth.service.ts`, `core/services/profile.service.ts`, `features/account/profile/profile.ts`.

## L-002 · Pre-fill on "untouched" (pristine), NOT on "empty"

- **Symptom.** Auto-filling a form must not clobber what the user typed — but a `pristine && !value`
  guard silently **skips any field that carries a default value**. The address forms default
  `province` to « QC », so a saved Ontario address never filled the province (the e2e with a
  non-default province caught this; a QC-only test would have missed it).
- **Rule.** Pre-fill **once** into every control the user hasn't touched — guard on **`pristine`
  only**, not pristine-and-empty. A default like « QC »/« Canada » is not user input, so replace it;
  only a **dirty** (user-edited) control is sacred. Drive it with a `signal`-backed `effect()` that
  patches when the data arrives (`ProfileService.applyDefaultAddress(...)`). Test autofill with a
  value that **differs from the form's default**, or the assertion proves nothing.
- **Refs.** `core/services/profile.service.ts`, `features/{checkout,location,installation}`,
  `Client/e2e/address-autofill.spec.ts`.

## L-001 · Reproduce against the REAL running stack before blaming the backend

- **Symptom.** "The profile doesn't save" was first theorised as an EF Core owned-entity persistence
  bug (`Address` owned by `AspNetUsers` with no required/identifying property). A live **SQL Server
  LocalDB** round-trip (set / update / clear / re-set the address via the running API) proved the
  backend persists perfectly — the hypothesis was wrong. The real cause was **frontend**: the postal
  validator `^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$` rejected « J8X 1A1 », the exact spaced format the
  field's own placeholder/hint instructed, so `saveAddress()` bailed on `invalid` and never sent.
- **Rule.** Reproduce a bug against the **real running stack** (live LocalDB, real DOM + form
  validation) before theorising about a layer. Don't trust the **InMemory** integration tests to
  prove/disprove relational or owned-entity behaviour — InMemory round-trips owned objects perfectly
  and hides such issues. Check the cheap, visible layer (client validation, the value actually sent)
  before the deep one. Make a field's validator accept exactly what its placeholder/hint promises.
- **Refs.** `features/account/profile/profile.ts` (postalCode validator + `normalizePostal`),
  `Infrastructure/Identity/Configurations/AppUserConfiguration.cs` (owned `Address` — verified OK).

---

<!-- mentor: append new lessons above this line, newest first, keeping IDs sequential (L-005, …). -->
