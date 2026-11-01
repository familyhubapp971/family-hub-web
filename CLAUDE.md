# Family Hub: Claude Code Instructions

This file is automatically loaded by Claude Code in this repo. It augments
the global config at `~/.claude/CLAUDE.md`, which exposes the full local
skill catalogue (Anthropic skills, SWE Superpowers, Plugins Plus, subagents,
slash commands, prompt-generator tool).

**All skills, agents, and slash commands installed at `~/.claude/` are
active in this project.** Do not duplicate global definitions here.

**The project rules live in [AGENTS.md](AGENTS.md)**, imported below, so
Claude Code and other coding agents follow one set of rules. Change a
project rule there. This file holds only Claude Code setup: skill routing,
helper agents, multi-agent runs and slash commands.

@AGENTS.md

---

## Skill routing: when to use what

These are project-specific cues for when to invoke skills/agents. They do
**not** override the trigger conditions in each skill's own definition.

### Always

- **`using-superpowers`**: at the start of any conversation, surface
  relevant skills.
- **`verification-before-completion`**: never claim work is "done" without
  running the verification commands and confirming output.
- **`systematic-debugging`**: for any bug, test failure, or unexpected
  behavior, before proposing fixes.

### Planning & execution

- **`brainstorming`**: before any new feature, component, or behavior change.
- **`writing-plans`** / **`/write-plan`**: for multi-step tasks with
  specifications.
- **`executing-plans`** / **`/execute-plan`**: when working through a written plan.
- **`subagent-driven-development`** / **`dispatching-parallel-agents`**: when
  the plan has independent tasks that can be parallelized.
- **`planning-with-files`**: for research-heavy or >5-tool-call tasks.

### Implementation

- **`test-driven-development`**: for any feature or bugfix, before writing
  implementation code. The repo uses Vitest (unit) and Playwright (E2E).
- **`using-git-worktrees`**: for feature work that needs isolation.
- **`finishing-a-development-branch`**: when work is complete and ready
  to integrate.

### Code review

- **`requesting-code-review`**: before merging.
- **`receiving-code-review`**: when processing PR feedback.

### Stack-specific (Plugins Plus)

- **API work** → `15-api-development`, `06-backend-dev`
- **React/Vite/Tailwind** → `05-frontend-dev`
- **Postgres / Drizzle** → `11-data-pipelines` (for ETL/migrations),
  `12-data-analytics` (for read patterns)
- **Auth / RLS** → `03-security-fundamentals`, `04-security-advanced`
- **Railway / CI / Docker** → `01-devops-basics`, `02-devops-advanced`
- **Vitest / Playwright / k6** → `09-test-automation`, `10-performance-testing`
- **Supabase / Jira / GitHub APIs** → `16-api-integration`

### Frontend / design artifacts

- **`frontend-design`**: production-grade UI work.
- **`shadcn-ui`**: when integrating shadcn components.
- **`webapp-testing`**: interactive Playwright debugging of the local web app.

---

## Helper agents

> **USE THE MATCHING AGENT: don't do specialist work inline when one fits.**
> This repo ships a curated set of agents in [`.claude/agents/`](.claude/agents/)
> (api-designer, backend-developer, code-reviewer, deployment-engineer,
> devops-engineer, documentation-engineer, frontend-developer,
> fullstack-developer, multi-agent-coordinator, product-manager, qa-expert,
> security-auditor, test-automator, typescript-pro). **Whenever a request maps
> to one of these (API design, a backend/frontend/full-stack build, a code
> review, a deploy, QA/test authoring, security review, docs, requirements),
> delegate to that agent via the Task tool rather than doing it inline.** Pick
> the most specific match; set the agent's model per Operating Rule G (Sonnet
> for most builds/reviews, Opus for genuinely hard calls). The project agents
> take precedence; fall back to the global set below for domains they don't
> cover.

Reference `~/.claude/agents/` for the 135 specialised agents. Most useful
for this project:

- `01-core-development/{api-designer,backend-developer,frontend-developer,fullstack-developer,react-specialist}`
- `02-language-specialists/{typescript-pro,python-pro}`
- `03-infrastructure/{deployment-engineer,docker-expert,terraform-engineer,devops-engineer}`
- `04-quality-security/{code-reviewer,test-automator,security-auditor,security-engineer,qa-expert}`
- `06-developer-experience/{documentation-engineer,dx-optimizer,build-engineer}`
- `08-business-product/product-manager`
- `09-meta-orchestration/{multi-agent-coordinator,context-manager}`

Delegate via the Task tool when a subagent's specialty matches the work.

---

## Multi-agent orchestration (workflows)

**Spin up multiple agents in parallel for substantial, fan-out-shaped
work**: either several `Agent` calls in one message, or the `Workflow`
tool for scripted fan-out → verify → synthesize. The founder has opted
in: use multi-agent orchestration **by default** on the task types below
without asking first. Don't fan out trivial or conversational work: a
single-file lookup or a two-line edit is faster solo.

Use it for:

- **Backlog / codebase audits**: classify many tickets or files in
  parallel, then verify + synthesize (e.g., the Jira backlog prune).
- **Code review at PR time**: `code-reviewer` + `qa-expert` in one
  parallel block (already mandatory, see [Pull requests](#pull-requests)).
- **Large refactors / migrations / sweeps**: one agent per file or
  call-site (worktree-isolated if they mutate in parallel), then a
  verify pass.
- **Research across many files / surfaces**: parallel readers, each
  blind to the others, → one synthesized summary.
- **Any "find everything" task**: fan out finders, dedupe, then
  adversarially verify each finding before acting.

How to do it well:

- **Scout first, then fan out.** List the work-items inline (the files,
  tickets, sites), then parallelise over that list.
- **Verify before acting.** For anything destructive or outward-facing
  (closing/cancelling tickets, deleting code, posting), have a second
  agent skeptically re-check each finding; default to keep/skip when
  unsure.
- **Synthesize yourself.** Read the agents' results and make the call:
  never hand a subagent the final decision.
- **Keep the human in the loop.** Present the plan and get a yes before
  executing consequential changes (e.g., cancelling Jira tickets).
- **Match the model to the job** (Operating Rule G): Sonnet for most
  classify / review / search agents; Opus only for genuinely hard calls.

---

## Useful slash commands

- `/plan`, `/write-plan`, `/execute-plan`: planning lifecycle
- `/brainstorm`: feature exploration
- `/start`: surface relevant skills at session start
- `/status`: check progress

---

## Living document

Keep this file to Claude Code setup only. Project rules belong in
AGENTS.md; drift between the two is a bug.
