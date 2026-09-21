# Git & GitHub Workflow

**Task**: T003 · **Governs**: Constitution VII (Code Review gate)

The official development cycle is **Planning → Development → Code Review → Testing → Demo →
Feedback**. Code Review is a required stage, so every change reaches the default branch through
a reviewed pull request. No exceptions.

## Branching

One branch per cycle, named for the user story it delivers:

| Cycle | Branch | Delivers |
|-------|--------|----------|
| 0 | `cycle-0-foundation` | Setup, database design, UI design, foundations |
| 1 | `cycle-1-user-management` | US1 |
| 2 | `cycle-2-projects` | US2 |
| 3 | `cycle-3-tasks` | US3 |
| 4 | `cycle-4-workflow` | US4 |
| 5 | `cycle-5-collaboration` | US5 |
| 6 | `cycle-6-dashboard` | US6 |
| 7 | `cycle-7-search` | US7 |
| 8 | `cycle-8-notifications` | US8 |
| 9 | `cycle-9-delivery` | Verification, deployment, documentation |

Fix branches during a cycle: `fix/<short-description>`, merged into the cycle branch.

## Commit messages

```text
<type>: <imperative summary>

<why, if not obvious from the summary>

Refs: T0NN, FR-0NN
```

`type` is one of `feat`, `fix`, `docs`, `test`, `refactor`, `chore`. **Every commit references
the task ID it implements**, so the traceability matrix required by T156 can be rebuilt from
the history.

## Pull requests

A cycle branch opens a PR when its Development stage is complete. The PR description lists:

- the tasks completed (T-IDs),
- the requirements delivered (FR-/SC-IDs),
- how to run the cycle's validation scenario from `quickstart.md`.

**Review requirements** — a PR may not merge until:

1. At least one approving review from someone other than the author.
2. The reviewer has confirmed compliance with the constitution, **citing the principle number
   when rejecting a change** (Constitution VII, Governance).
3. The cycle's tests pass, with no test skipped or disabled to make the suite green.

Branch protection on the default branch enforces requirement 1.

## What must never be committed

- Credentials of any kind. Configuration comes from environment variables; `.env.example`
  lists the required keys with placeholder values only.
- Build output (`target/`, `dist/`, `node_modules/`).
- Runtime attachments written to `TMS_ATTACHMENT_DIR`.

`.gitignore` enforces all three.
