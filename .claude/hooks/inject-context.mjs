#!/usr/bin/env node
/**
 * SessionStart hook — auto-injects the team's operating rules + the living
 * "lessons learned" file into EVERY session's context.
 *
 * WHY THIS EXISTS
 *   Subagents and fresh sessions don't automatically know the project's hard-won
 *   gotchas. CLAUDE.md is auto-loaded, but the *dynamic* lessons (maintained by the
 *   `mentor` agent) are not. This hook reads `.claude/rules/lessons-learned.md` and
 *   prints it to stdout. For the SessionStart event, anything printed to stdout is
 *   injected into Claude's context — so the architect, developer and reviewer all
 *   start already knowing what we've learned. This is the mechanism that makes the
 *   "teacher → everyone" loop automatic (you never have to paste the rules yourself).
 *
 * CONTRACT (see .claude/README.md and the Claude Code hooks docs)
 *   - Wired in .claude/settings.json under hooks.SessionStart.
 *   - Receives the event JSON on stdin (unused here); writes context to stdout; exit 0.
 *   - Pure Node, no external deps (no `jq`), so it runs the same on Windows/macOS/Linux.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the repo root from this script's location (.claude/hooks/inject-context.mjs).
// CLAUDE_PROJECT_DIR is provided by Claude Code, but deriving it keeps the script
// runnable on its own for testing.
const here = dirname(fileURLToPath(import.meta.url));
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? join(here, '..', '..');

const out = [];
out.push('=== AbrisTempo · operating rules (auto-injected at session start) ===');
out.push(
  'Route real work through the agent loop: solution-architect (plan) → feature-developer ' +
    '(implement) → code-reviewer (independent review) → mentor (capture lessons). Backend changes ' +
    'get a solid-review pass; frontend changes follow the `angular` skill + the angular-cli MCP. ' +
    'Verify with build + tests before claiming done. Codebase language is French. WCAG 2.2 AA is a hard bar. ' +
    'Prefer hand-rolling a simple design pattern over adding a dependency (the MediatR → custom Dispatcher ' +
    'precedent) and reuse the repo’s existing pattern idioms — see `.claude/rules/design-patterns.md` and ' +
    '`docs/design-patterns.md`.',
);
out.push('');

try {
  const lessons = readFileSync(join(projectDir, '.claude', 'rules', 'lessons-learned.md'), 'utf8');
  out.push(lessons.trim());
} catch {
  // First run, or the file was removed — not an error, just nothing to inject yet.
  out.push('(no .claude/rules/lessons-learned.md yet — the mentor agent will create it)');
}

process.stdout.write(out.join('\n') + '\n');
process.exit(0);
