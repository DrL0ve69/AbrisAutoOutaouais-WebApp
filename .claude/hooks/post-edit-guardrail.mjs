#!/usr/bin/env node
/**
 * PostToolUse hook (matches Edit | Write | MultiEdit) — a deterministic guardrail.
 *
 * WHY THIS EXISTS
 *   You asked that the right tools/rules be used WITHOUT you having to say so each time.
 *   Advisory rules in CLAUDE.md are easy to forget mid-task. This hook fires AFTER every
 *   successful edit, looks at which file changed, and injects a short, non-blocking
 *   reminder of the matching verification + tooling for that layer:
 *     - Frontend (.Client/**.ts|.html|.scss) → angular skill + angular-cli MCP, npm build/test, a11y bar.
 *     - Backend  (**.cs)                      → keep Clean Architecture, dotnet test, solid-review the diff.
 *     - EF migration (/Migrations/**)         → owned-entity/nullability caution (lesson L-001).
 *   It NEVER blocks (always exit 0) — it only nudges, so it can't wedge your session.
 *
 * CONTRACT
 *   - Receives the PostToolUse event JSON on stdin: { tool_name, tool_input: { file_path, ... }, ... }.
 *   - To inject context we print, on stdout, exit 0 + JSON:
 *       { "hookSpecificOutput": { "hookEventName": "PostToolUse", "additionalContext": "<text>" } }
 *     (additionalContext is delivered to Claude as a system reminder.)
 *   - Emits nothing for files where no reminder is useful (config, docs, build output).
 *   - Pure Node, no `jq` — robust on Windows. Wired in .claude/settings.json.
 */

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let path = '';
  try {
    const input = JSON.parse(raw || '{}');
    path = input?.tool_input?.file_path ?? '';
  } catch {
    process.exit(0); // malformed input → stay silent, never block
  }

  // Normalise to forward slashes so the same matching works on Windows.
  const p = String(path).replace(/\\/g, '/');

  // Budget guardrail surface: dependency / provider / cloud-config files. Some are .json
  // (package.json, appsettings*.json) which the source-file ignore below would otherwise skip —
  // so detect them first and let them through. Vendored copies (node_modules/obj/bin/dist) excluded.
  const isVendored = /\/(obj|bin|dist|node_modules)\//.test(p) || /\/\.claude\//.test(p);
  const isBudgetSurface =
    !isVendored &&
    (/\/package\.json$/.test(p) ||
      /\.csproj$/.test(p) ||
      /\/appsettings[^/]*\.json$/.test(p) ||
      /\/DependencyInjection\.cs$/.test(p));

  // Ignore non-source files: our own tooling, build output, deps, lockfiles.
  // Budget surfaces bypass this ignore (handled above).
  if (
    !p ||
    (!isBudgetSurface &&
      (/\/\.claude\//.test(p) ||
        /\/(obj|bin|dist|node_modules)\//.test(p) ||
        /\.(md|json|lock|css\.map|snap)$/.test(p)))
  ) {
    process.exit(0);
  }

  const reminders = [];

  if (isBudgetSurface) {
    reminders.push(
      'Dependency / provider / cloud-config surface touched (' +
        p.split('/').slice(-1)[0] +
        '). BUDGET hard rule (`.claude/rules/budget-free-tier.md`): never add paid/billed services or ' +
        'API keys, nor paid Azure SKUs, without the owner’s explicit consent — prefer free AND keyless ' +
        '(Photon, Esri, OSM, Leaflet/geoman, Turf). A "free tier" that needs a billing account / credit ' +
        'card (Google Maps Platform, Algolia, Radar…) counts as PAID → reject. Document any new external ' +
        'dependency’s cost in the PR; stay within the ~$120 Azure student credit (`docs/deployment.md`).',
    );
  }

  const isClient = p.includes('.Client/');
  const isFrontend = isClient && /\.(ts|html|scss)$/.test(p);
  const isBackend = /\.cs$/.test(p) && !isClient;
  const isMigration = /\/Migrations\//.test(p);

  // Motion / colour-tokens / heavy-lib (maps, 3D, autocomplete) surfaces: these carry the
  // hardest-to-catch regressions (contrast — invisible in vitest, L-016 — and reduced-motion).
  // Any .scss counts (tokens/animations/translucent fills), plus the named motion/maps files.
  const isMotionOrTokens =
    isClient &&
    (/\.scss$/.test(p) ||
      /(motion\.service|reveal-on-scroll|count-up|magnetic-hover|cursor-ring|loading-overlay|hero-story|shelter-3d|address-autocomplete|\/directives\/|\/places\/)/.test(
        p,
      ));

  if (isFrontend) {
    reminders.push(
      'Frontend edit detected (' +
        p.split('/').slice(-1)[0] +
        '). Follow the `angular` skill + angular-cli MCP `get_best_practices` (Angular 21: ' +
        'standalone, signals, OnPush, inject(), native control flow, [class]/[style], reactive forms). ' +
        'Before finishing, run from src/AbrisAutoOutaouais-WebApp.Client: `npm run build` (typecheck) ' +
        'and `npm test` (vitest + axe). Keep WCAG 2.2 AA — zero AXE violations. UI strings in French with i18n.',
    );
  }

  if (isMotionOrTokens) {
    reminders.push(
      'Motion / colour-tokens / heavy-lib surface touched — run the `.claude/rules/motion-a11y.md` ' +
        'checklist before finishing: reduced-motion belt+braces (MotionService + CSS @media), ' +
        'semantic-tokens-ONLY (no hardcoded colours; on-dark/`.btn--secondary` tokens belong only on ' +
        'DARK surfaces), heavy libs (three/leaflet/turf) lazy via `@defer` + dynamic import in ' +
        '`afterNextRender`. CONTRAST is NOT covered by vitest (`color-contrast` disabled, L-016) — ' +
        'verify with `npm run e2e` (`motion-a11y.spec.ts`: dual-theme axe + real reduced-motion).',
    );
  }

  if (isBackend) {
    reminders.push(
      'Backend edit detected (' +
        p.split('/').slice(-1)[0] +
        '). Respect Clean Architecture (Domain ← Application ← Infrastructure/API), custom Mediator ' +
        '(DispatchAsync/HandleAsync), sealed-record DTOs, validator beside its command. Reuse the ' +
        "repo's existing pattern idiom and hand-roll a simple pattern rather than adding a dependency " +
        '(see `.claude/rules/design-patterns.md` + `docs/design-patterns.md`; MediatR → custom ' +
        'Dispatcher precedent). Run `dotnet test` and give the diff a `solid-review` pass before claiming done.',
    );
  }

  if (isMigration) {
    reminders.push(
      'EF migration touched. Re-check owned-entity mapping + column nullability (see lesson L-001: ' +
        'optional owned types need an identifying/required property). InMemory tests will NOT catch ' +
        'relational owned-entity bugs — verify against real SQL Server LocalDB.',
    );
  }

  if (reminders.length === 0) process.exit(0);

  const payload = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: '[guardrail] ' + reminders.join(' '),
    },
  };
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
});
