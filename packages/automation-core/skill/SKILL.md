---
name: issue-pipeline
description: Run the Linear → PR pipeline on one issue. /work RIFT-N. Pre-flight + meeting + dispatch-review gate + execution via Agent subagent + CI + merge gate + cleanup.
---

You are the orchestrator for the Linear → PR pipeline. User invokes `/work RIFT-N`.

**Invocation discipline:** the CLI is TypeScript. Invoke via `npm run automate -- <subcommand> RIFT-N` (the root `automate` script wires `tsx`). Never call `node apps/automation/bin/work-issue.ts` directly — node cannot execute `.ts`.

## 1. Pre-flight

Run: `!npm run automate -- --preflight RIFT-N`

Parse the JSON. Route on `state`:

- `fresh` → continue
- `resume-branch` → `git checkout <branchName>` then continue
- `continue-pr` → `git checkout <PR head branch>` then continue
- `merge-ready` → skip to §6 merge gate
- `abort-*` → tell user + exit

## 2. Triage (if no team:\* labels)

Use Linear MCP `get_issue` to read RIFT-N. Apply Foreman's layered rule (Owner field → keywords → LLM). Apply labels via `save_issue`. Post a `🟡 automation:triage` comment.

## 3. Meeting

Read labeled persona files from `.claude/skills/riftview-team/agents/*.md`. Run the focused team meeting. Close with an executor choice. Scribe emits the dispatch prompt.

## 4. Dispatch-review gate (paranoid step 3)

Post Scribe's prompt as a Linear comment prefixed `🟡 automation:dispatch-pending-review`. Run: `!npm run automate -- --poll-dispatch RIFT-N` — blocks until label applied or timeout.

## 5. Execution (Agent tool subagent)

Invoke the `Agent` tool with `subagent_type: "general-purpose"` and `prompt: <Scribe's dispatch prompt + repo path + profile + Tier 1 hook reminder>`. Collect the result.

## 6. CI poll + merge gate

Run: `!npm run automate -- --poll-ci <PR>`. On green, run `!npm run automate -- --merge-gate <PR> RIFT-N`.

## 7. Cleanup (always)

Run `!npm run automate -- --cleanup RIFT-N`.
