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

## L-006 · Move focus AFTER render, not in the same tick that removes the element

- **Symptom.** A « retour de focus » handler called `element.focus()` **synchronously** inside an
  RxJS `next`, right after a signal update that removes the triggering button from the DOM (the
  cancelled rental row hides its « Annuler » via `@if`). Change detection hadn't run yet, so the
  button was still connected → focus landed on it → CD then removed it → focus silently fell back to
  `<body>`. WCAG 2.4.3 (focus order) was violated even though the code "looked" right, and an
  `isConnected` heuristic hid it. The status-only e2e passed; the bug surfaced only when a **vitest**
  `expect(heading).toHaveFocus()` assertion was added and failed.
- **Rule.** When the focus target only exists **after** the next render (a signal add/removes DOM),
  focus it **after** the view updates — `setTimeout(() => target.focus())` (macrotask, post-CD),
  `afterNextRender`, or an `effect()` reading the target's `viewChild()` signal so it re-runs once the
  element is in the DOM. Never call `.focus()` in the same tick as the signal update that changes
  which elements exist. Split the cases: focus the **trigger** (still present) when nothing changed
  (dismiss / error), but focus a **stable fallback** (the heading) *after render* when the trigger is
  being removed. And **assert focus at the unit level** (vitest `toHaveFocus()`) — a status-only e2e
  never catches a focus bug. Same discipline as [[L-002]]: the a11y assertion must test the real
  post-condition, not a proxy.
- **Refs.** `features/account/rentals/rentals.ts` (`confirmCancel` / `focusTrigger` /
  `focusHeadingAfterRender`, the `effect()` reading `cancelDialog()`),
  `features/account/rentals/rentals.spec.ts` (the `toHaveFocus()` assertions).

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
- **Refs.** `Application/Orders/Commands/PlaceOrder/PlaceOrderCommandValidator.cs`,
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
