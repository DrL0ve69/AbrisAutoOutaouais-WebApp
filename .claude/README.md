# `.claude/` — the AbrisTempo agent & automation system

This folder turns Claude Code from "one assistant" into a small **team with a process**: an
architect plans, a developer implements, a reviewer checks, and a mentor records what we learn so we
don't repeat mistakes. Most of it runs **automatically** — you describe what you want in plain
language and the right agents, skills, tools and checks engage on their own.

> New to Claude Code? Read this top-to-bottom once. After that you can mostly forget it's here.

---

## 1. The mental model: a 4-agent loop

```
            you describe a task
                    │
          ┌─────────▼──────────┐
          │ solution-architect │   plans it (file-level), flags risks   ← read-only
          └─────────┬──────────┘
                    │ plan
          ┌─────────▼──────────┐
          │ feature-developer  │   writes the code, runs build + tests
          └─────────┬──────────┘
                    │ diff + evidence
          ┌─────────▼──────────┐
          │   code-reviewer    │   independent review of the diff       ← read-only
          └─────────┬──────────┘
                    │ findings
          ┌─────────▼──────────┐
          │       mentor       │   writes durable lessons → rules/lessons-learned.md
          └─────────┬──────────┘
                    │ (auto-injected into the NEXT session for everyone)
                    └──────────────────────────────────────────────►
```

The two reviewers (architect, code-reviewer) are **read-only** on purpose: an agent that can't edit
gives an honest second opinion instead of quietly "fixing" things to make its own review pass.

### Why a loop and not one big agent?
Each agent runs in its **own fresh context window** and returns only a summary. That keeps the main
conversation clean, and — crucially — the reviewer never sees the developer's reasoning, so it
catches things the author rationalised away. This is the single most effective quality guardrail.

---

## 2. What's in this folder

| Path | What it is | When it runs |
|------|------------|--------------|
| `agents/solution-architect.md` | Planner (read-only, model: opus) | Proactively, before non-trivial work |
| `agents/feature-developer.md` | Implementer (all tools) | When implementing an agreed change |
| `agents/code-reviewer.md` | Independent reviewer (read-only) | After any change, before commit |
| `agents/mentor.md` | Lesson-keeper (edits only the lessons file) | After a review / a tricky fix |
| `skills/feature-cycle/SKILL.md` | One entrypoint that runs the whole loop | `/feature-cycle …` or auto |
| `skills/solid-review/SKILL.md` | SOLID audit of a diff (pre-existing) | Backend reviews |
| `skills/a11y-ux-pass/SKILL.md` | Turn docs/ audits into code (pre-existing) | Accessibility work |
| `rules/lessons-learned.md` | The team's living gotcha list | Auto-injected every session |
| `hooks/inject-context.mjs` | Loads the rules into context at session start | `SessionStart` hook |
| `hooks/post-edit-guardrail.mjs` | Reminds which check/skill fits each edit | `PostToolUse` hook |
| `settings.json` | Wires the hooks + auto-approves the Angular MCP | Always (committed) |
| `settings.local.json` | **Your** personal, gitignored overrides | Always (local only) |
| `../.mcp.json` | Registers the angular-cli MCP for the repo | On load (auto-approved) |

---

## 3. How things fire **without you asking** (your requirement #3)

Three independent mechanisms, so nothing depends on the model "remembering":

1. **Agent auto-delegation.** Claude reads each agent's `description:` and delegates when it matches.
   The descriptions use trigger phrases like *"Use PROACTIVELY"* / *"MUST BE USED after any code
   change"*, which is the documented way to make delegation automatic. You can still force one with
   `@agent-code-reviewer …`.

2. **Hooks = deterministic automation** (the strongest guarantee — they ignore the model's
   judgement and run on events):
   - **`SessionStart`** runs `inject-context.mjs`, which prints the operating rules + the entire
     `rules/lessons-learned.md` into the session. So every session and every subagent *starts*
     knowing our hard-won lessons — you never paste them.
   - **`PostToolUse`** (after every `Edit`/`Write`) runs `post-edit-guardrail.mjs`, which looks at
     the file you changed and injects a short reminder: *frontend → use the angular skill + MCP, run
     `npm run build`/`npm test`, keep WCAG AA*; *backend → keep the layer boundaries, run
     `dotnet test`, do a solid-review*; *migration → re-check owned-entity/nullability (lesson
     L-001)*. It never blocks — it only nudges.

3. **CLAUDE.md routing.** The root `CLAUDE.md` has an "Agent system" section telling the main thread
   to route real work through the loop. CLAUDE.md is auto-loaded into every session and every
   subagent, so the policy is always present.

The hooks are written in **Node** (not bash + `jq`) because this is a Windows machine with Node
guaranteed present — they run identically on Windows/macOS/Linux and have no extra dependencies.

---

## 4. The MCP server (your requirement: "angular already there")

`angular-cli` is registered two ways: at your **user** scope (already on your machine) **and** in the
repo's `../.mcp.json` (so a fresh clone gets it too). `settings.json` lists it under
`enabledMcpjsonServers`, so it loads **without a trust prompt**. Agents call
`mcp__angular-cli__get_best_practices` to get version-correct Angular 21 rules before touching the
frontend. You don't have to mention it — the agents and the post-edit guardrail point to it.

---

## 5. Using it day to day

- **Just talk.** "Fix the profile save bug", "add a wishlist", "make the cart accessible." The right
  agents/skills/checks engage automatically.
- **Run the whole loop on demand:** `/feature-cycle add a promo-code field to checkout`.
- **Force a specific agent:** `@agent-solution-architect plan the refund flow` or
  `@agent-code-reviewer review my diff`.
- **Built-in review too:** `/code-review` (correctness pass on the current diff) complements the
  `code-reviewer` agent.

### ⚠️ One important caveat — restart to load new/edited agents
Claude Code reads `agents/*.md` at **session start**. Files created or edited on disk (like these)
**load on your next session** — restart Claude Code (or `/clear`) to pick them up. Until then, the
`feature-cycle` skill falls back to running each step inline with the matching skill. (Agents created
through the interactive `/agents` menu load immediately — that's the exception.)

---

## 6. The learn loop (how the "teacher" actually teaches)

Subagents have no memory between runs, so "teaching the developer and reviewer" can't be a chat — it
has to be a **file they all read at the start**. That file is `rules/lessons-learned.md`:

1. The `code-reviewer` flags a recurring mistake (it tags it `→ mentor: candidate lesson`).
2. The `mentor` agent distils it into a numbered lesson (Symptom / Rule / Refs) and curates the file
   (it also merges duplicates and prunes stale entries — it's a gardener, not an append-only log).
3. The `SessionStart` hook injects that file next time, so the architect, developer and reviewer all
   begin already knowing it. The loop closes itself.

Seeded with three real lessons from this repo (EF owned-entity persistence, address pre-fill safety,
and where the saved address actually lives). Add to it via the mentor, or by hand.

---

## 7. Optional: stop being prompted for routine commands

Left out of the committed `settings.json` on purpose (a committed file shouldn't silently widen what
the agent may auto-run). If **you** want fewer "allow this command?" prompts, paste this into
`.claude/settings.local.json` (your personal, gitignored file) — review it first, it's your call:

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(dotnet build:*)", "Bash(dotnet test:*)", "Bash(dotnet ef:*)",
      "Bash(npm run:*)", "Bash(npm test:*)", "Bash(npx ng:*)",
      "Bash(npx vitest:*)", "Bash(npx playwright:*)",
      "Bash(git status:*)", "Bash(git diff:*)", "Bash(git add:*)", "Bash(git commit:*)",
      "mcp__angular-cli__get_best_practices", "mcp__angular-cli__find_examples",
      "mcp__angular-cli__search_documentation", "mcp__angular-cli__list_projects"
    ],
    "ask": ["Bash(git push:*)"]
  }
}
```

---

## 8. Reusing this in future projects

The system is deliberately portable. To seed a new repo:
1. Copy `.claude/agents/`, `.claude/hooks/`, `.claude/settings.json`, and `.claude/rules/` (start the
   lessons file empty).
2. In each agent body, swap the AbrisTempo-specific conventions for the new stack's (or, better,
   keep the conventions in that repo's `CLAUDE.md` — agents read it automatically).
3. Keep agent **descriptions** behaviour-focused ("plans", "reviews", "implements") so they stay
   stack-agnostic.
4. Want them available in *every* project without copying? Put generic versions in
   `~/.claude/agents/` (user scope). Project-level `.claude/agents/` always wins on a name clash, so
   you can override a generic agent per-repo.

---

*Built from the Claude Code docs: sub-agents, hooks, settings, skills, and the best-practices /
common-workflows guides (code.claude.com/docs).*
