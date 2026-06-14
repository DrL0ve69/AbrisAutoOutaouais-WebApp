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
  contrast — `color-contrast` is off there by design. Contrast MUST be verified by Playwright e2e +
  axe (`npm run e2e`, real composed colors) AND a live round-trip ([[L-001]]) **in BOTH themes**. When
  reporting a « zéro axe » gate on a color diff, qualify it — « (vitest — color-contrast NON couvert;
  contraste validé en e2e/live) » — so the gate isn't over-credited (same honesty as [[L-005]]: a
  guard that can't fire guards nothing). Best: add an e2e scenario that axe-scans the redesigned routes
  for contrast on both themes (the intended E5 « axe both themes » gate).
- **Refs.** `src/testing/axe-helper.ts:14` (`color-contrast` disabled),
  `src/app/shared/layout/navbar/navbar.scss` (`.navbar--scrolled`), Épic-E commits `cdd82a4` / `1e38a4d`.

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
- **Rule.** In an SSR+hydration app, type through the **locator** (`locator.pressSequentially(...)`,
  which auto-focuses and waits for actionability), not `page.keyboard.type`. Wrap any
  « type → debounced request → rendered result » sequence so the hydration race self-heals: clear the
  field first (so `distinctUntilChanged` re-emits), then `await page.waitForResponse(/places\/suggest/)`
  as a **network barrier** before asserting the rendered suggestions — never a fixed `waitForTimeout`.
  Same vacuity/flake family as [[L-009]] (assertions made meaningless by environment timing), but the
  trigger here is hydration latency, not a CSS breakpoint.
- **Refs.** `e2e/address-autocomplete.spec.ts` (`pressSequentially` + `waitForResponse` barrier),
  commit `6e23b48`.

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
- **Refs.** `src/app/app.html` (global `role="status"` language-switch live region),
  `e2e/password-reset.spec.ts` (locator re-scoped by text), `.gitignore` (client,
  `.vitest-attachments/`), `IntegrationTest/Common/WebAppFactory.cs` +
  `IntegrationTest/Common/IntegrationCollection.cs` (`[Collection("Integration")]`).

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
