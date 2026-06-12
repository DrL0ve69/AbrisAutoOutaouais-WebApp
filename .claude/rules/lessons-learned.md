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
