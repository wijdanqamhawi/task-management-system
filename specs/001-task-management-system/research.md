# Phase 0 Research: Task Management System

**Feature**: `001-task-management-system` | **Date**: 2026-09-21 | **Plan**: [plan.md](./plan.md)

Every decision below is a **[PLAN]** decision — a technical choice made within the bounds of
the official requirements document and the clarified specification. None of them changes what
the system does; they decide how the prescribed stack is used. Decisions marked ⚠ need the
project owner's confirmation.

---

## R-001: Data access strategy: where SQL and PL/SQL live

> **Revised 2026-10-04 (backend moved to Python/FastAPI, Constitution v3.0.0).** The earlier
> revisions (2026-09-21) already rejected an ORM; that decision stands. Only the mechanism
> changed: `JdbcTemplate` became `python-oracledb`.

**Decision**: `python-oracledb` in thin mode (no Oracle Client install) with a connection pool,
used for all data access. SQL is written by hand in each feature's service/repository code
with **bind variables only** (never string-built values) and results are mapped to plain
dicts. PL/SQL packages handle dashboard aggregation (`PKG_DASHBOARD`) and scheduled
notification generation (`PKG_NOTIFICATION`), called through the driver. Schema DDL is
hand-written and version-controlled in `database/ddl/` and is the sole source of truth for the
schema. **No ORM (neither SQLAlchemy nor any other), no model-driven schema generation.**
Transactions are explicit: one pooled connection per request, `commit()` at the end of a
successful unit of work, rollback if an error escapes.

**Rationale**: The official document names Oracle Database, SQL, and PL/SQL as technologies to
be used. Writing SQL directly uses every named database technology for real work, keeps the
true shape of the schema in DDL rather than negotiated between annotations and DDL, and avoids
lazy-loading and N+1 surprises.

**Cost, stated honestly**: row-to-JSON mapping is written by hand for each resource, and the
two many-to-many relationships (PROJECT_MEMBERS, TASK_ASSIGNEES) are handled explicitly. That is
more typing than an ORM and less risk. Dynamic WHERE clauses (search) are assembled from fixed
SQL fragments with bind variables, and ORDER BY comes from a whitelist.

**Alternatives considered**:

- *SQLAlchemy / any ORM*: rejected. It is a dependency the official document never names, and
  it pushes SQL out of sight in exactly the project where SQL is a stated learning objective.
- *ORM-driven schema creation*: rejected. The team designs the database and delivers the ERD.

---

## R-013: Client-side routing without a router library

> **Added 2026-09-21 (compliance review).** React Router was removed under the same rule as
> R-001.

**Decision**: A hand-written routing module at `frontend/src/router/`, roughly 70 lines of
plain JavaScript over the browser's History API (`history.pushState`, the `popstate` event).
It supports path patterns with parameters (`/projects/:id`), a `<Link>` component that calls
`pushState` instead of reloading, and a role guard that redirects to login or to a "not
permitted" view based on the session from `GET /api/auth/me`.

**Rationale**: The official document names JavaScript as a required technology; the History
API is part of the browser platform and needs nothing installed. Eleven routes is well within
what a small hand-written router handles cleanly. This keeps deep links, bookmarking, and
browser back/forward working — the properties that made a router necessary in the first place
— while removing the dependency.

**Cost, stated honestly**: React Router is battle-tested and this will not be. The realistic
failure modes are the well-known ones — forgetting to call `preventDefault` on link clicks,
losing scroll position on navigation, and mishandling the initial `popstate`. All three are
covered by the V9 responsive walkthrough and the per-screen manual tests in `quickstart.md`.
Reverting to React Router is a one-file change if the hand-written router proves troublesome.

**Alternatives considered**:

- *React Router* — the original decision, now rejected as an unnecessary dependency.
- *Conditional rendering from a single state variable (no routes at all)*: rejected. It breaks
  browser back/forward and makes every screen unlinkable, which degrades the responsive web
  interface deliverable and makes the demo harder to run.
- *Hash-based routing (`#/projects/12`)*: simpler still and needs no server configuration, but
  produces uglier URLs. The History API approach needs only a catch-all rewrite to
  `index.html`, which the backend already does when serving the built frontend (R-012).

---

## R-014: Concurrent update policy — last-write-wins

> **Added 2026-09-21**, resolving finding F1 of the cross-artifact analysis.

**Decision**: Concurrent updates to the same resource are **last-write-wins**. No version
column, no optimistic locking, no ETag or `If-Match` header, and no `409` for a concurrent
modification. The `409` status remains in the contract only for genuine duplicate-key
conflicts (username, email).

**Rationale**: The official document does not address concurrent editing anywhere — not in the
functional areas, not in the deliverables. Under Constitution Principle I, a conflict-detection
mechanism would be scope the project was never asked to build, and it would touch every update
path in the system. The previous state of the artifacts was worse than either choice: the REST
contract advertised a `409 concurrent modification` that nothing could produce, so the API
documented a response that would never be returned.

**Cost, stated honestly**: if two users edit the same task simultaneously, the second save
silently overwrites the first, and neither user is told. For a departmental tool where tasks
have named assignees and edits are rare, this is an acceptable and conventional trade. It would
not be acceptable for a high-contention document editor.

**Alternatives considered**:

- *Optimistic locking with a version column*: the correct answer if conflicts mattered. Rejected
  as unrequested scope touching every write path.
- *Leaving the contract's `409` in place with no mechanism*: rejected — that was the defect.

---

## R-015: Parent task completion with incomplete subtasks

> **Added 2026-09-21**, resolving finding C1 of the cross-artifact analysis.

**Decision**: A task MAY be moved to `COMPLETED` while one or more of its subtasks remain
incomplete. No warning, no block, no cascade.

**Rationale**: `spec.md` Edge Cases required that the system *decide* this; the official
document defines no relationship between subtask completion and parent status. The permissive
option adds no rule, no UI, and no test surface, and matches R-005's reasoning on status
transitions: where the official document states no restriction, none is invented. Subtasks
remain a breakdown aid, not a gate.

**Alternatives considered**:

- *Warn the user*: requires a confirmation dialog and a UI state that no requirement asks for.
- *Block the transition*: would contradict Constitution Principle VI, which fixes the four
  statuses and their transitions without any subtask precondition.

---

## R-002: Authentication mechanism

**Decision**: A server-issued **signed session cookie** (Starlette `SessionMiddleware`, signed
with `TMS_SESSION_SECRET` using `itsdangerous`; `HttpOnly`, `SameSite=Lax`, `Secure` in
production) that carries only the user id. On **every** request the `current_user` dependency
re-reads the user from `USERS`; an unknown or deactivated user gets `401` and the session is
cleared. Passwords are hashed with **bcrypt** (the existing `$2a$` demo hashes verify
unchanged). No token library, and no session table: the schema is unchanged.

**Rationale**: The official document requires "Authentication & Authorization" without naming a
mechanism. `spec.md` Assumptions record login with an identifier and password held by the
system, no federated provider. FR-007 / SC-008 require that deactivating a user refuse their
**next** request; because the account state is re-checked from the database on each request,
that holds even though the cookie itself is still validly signed, which a stateless JWT
cannot offer without a denylist. Frontend and backend share an origin in deployment (Vite proxy
in development), so a cookie works without CORS complications.

**Alternatives considered**:

- *JWT bearer tokens*: adds a library and needs a denylist to revoke a deactivated user.
- *Server-side session table*: would require a schema change, which is out of bounds; the
  per-request database check gives the same revocation guarantee.
- *HTTP Basic*: rejected. No logout, credentials re-sent on every request.
- *OAuth2 / external identity provider*: excluded by the spec's Assumptions.

---

## R-003: Authorization model

**Decision**: Two layers, both server-side. (1) **Role checks** via FastAPI dependencies
(`require_roles(...)`) for coarse capability — e.g. only Admin may deactivate a user, only
Manager may create a project. (2) **Membership checks** in the service layer (`app/common/access.py`) for every
project-scoped or task-scoped operation — the acting user must be a member of the task's
project, and for assignee-only operations must be an assignee.

**Rationale**: FR-005 requires permissions enforced on every action; Constitution V requires
server-side enforcement, not frontend hiding. Roles alone are insufficient: a Manager must not
manage a project they are not a member of, and that is data-dependent, so it cannot be
expressed as a role annotation. FR-045 and FR-053 further require that dashboard figures and
search results contain only data the viewer may see — which means visibility must be a filter
applied in the query layer, not a check applied after fetching.

**Alternatives considered**:

- *Role checks only*: rejected — cannot express "your own projects", so it fails FR-045/FR-053.
- *Row-level security in Oracle (VPD)*: powerful and genuinely Oracle-native, but adds database
  configuration complexity and splits authorization across two places. Rejected for a training
  project; noted as a legitimate future option.

---

## R-004: Task sharing and visibility rule

**Decision**: A single `visibleTaskIds(user)` predicate applied in the data layer:
a user may see a task if they are a member of the task's project, or hold the Admin role.
"Assigned to me" is the subset where the user is in TASK_ASSIGNEES; "shared with me" is the
complement within visible tasks.

**Rationale**: Direct implementation of the **[CLARIFIED]** decision in `spec.md` FR-035 —
shared means project member, not assignee. Expressing it as one predicate used by task lists,
search, filtering, and dashboard counts means FR-030, FR-031, FR-045 and FR-053 cannot drift
apart, and one test fixture validates all of them.

**Alternatives considered**: applying the rule separately per feature — rejected as the obvious
source of the class of bug where a task hidden from a list still appears in a dashboard count.

---

## R-005: Task status workflow enforcement

**Decision**: Status is a fixed set (`TO_DO`, `IN_PROGRESS`, `REVIEW`, `COMPLETED`) in the application, mirrored by
a `TASK_STATUS` reference table with a check constraint. Transitions are validated in a single
service method; any status change goes through it. The API exposes status change as its own
endpoint (`PATCH /tasks/{id}/status`), not as a general task update.

**Rationale**: Constitution VI requires exactly these four statuses and server-side transition
application. A dedicated endpoint makes the workflow auditable in one place and means a general
task edit cannot silently move a task through the workflow. The reference table satisfies the
official entity list (TASK_STATUS) and gives the database its own integrity guarantee, so no
route into the data — including direct SQL — can produce an invalid status.

**Resolved 2026-09-21 during `/speckit-tasks`**: the project owner confirmed that the official
document does not specify forward-only transitions and that none should be invented.
**Any transition among the four statuses is permitted**; only values outside the four are
rejected. Implemented by T085 and asserted in both directions by T092.

---

## R-006: Dashboard aggregation in PL/SQL

**Decision**: One PL/SQL package, `PKG_DASHBOARD`, exposing functions/cursors for each figure
in FR-036 to FR-044, each taking the acting user id so that visibility (R-004) is applied
inside the query. The backend calls it through python-oracledb (`callproc` / `callfunc` returning `SYS_REFCURSOR`). Dashboard figures are
computed on request, never cached.

**Rationale**: Uses the officially required PL/SQL for the work it genuinely suits — set-based
aggregation across TASKS, PROJECTS, TASK_ASSIGNEES. Nine figures computed in the database means
one round trip rather than nine, satisfying FR-045's "reflect the current state" without a
caching layer that would add a technology and a staleness class of bug. SC-005 requires 100%
accuracy against a seeded data set, which is far easier to demonstrate against a single SQL
source of truth.

**Alternatives considered**:

- *Application-side aggregation in Python*: rejected — leaves PL/SQL unused and moves set operations out
  of the database.
- *Materialised views with periodic refresh*: rejected — contradicts FR-045 (figures must be
  current) and adds refresh scheduling for a data volume that does not need it.

---

## R-007: Notification generation

> **Confirmed 2026-09-21 (compliance review).** The project owner confirmed all five triggers
> and the 24-hour approaching-deadline threshold are to be kept. The scheduled job is therefore
> required, not optional. No longer open.

**Decision**: Two mechanisms. **Event-driven** triggers (FR-054 assignment, FR-055 update,
FR-058 comment/mention) are written synchronously in the same transaction as the action that
causes them. **Date-driven** triggers (FR-056 approaching deadline at 24 hours, FR-057 overdue)
are generated by a PL/SQL package `PKG_NOTIFICATION` invoked by an hourly background task
(an asyncio loop started in the FastAPI lifespan; `TMS_SCHEDULER=off` disables it). A uniqueness constraint on (task, recipient, trigger type) makes generation
idempotent, so a task that stays overdue for days produces exactly one notification.

**Rationale**: The **[CLARIFIED]** decision put all five triggers in scope. Three are caused by
a user action and belong in that action's transaction — no scheduling, no lag, no possibility of
a notification for an action that rolled back. Two are caused by the passage of time and have no
triggering request, so something must run without a user. The loop is plain `asyncio`,
adding no dependency. Hourly granularity is sufficient for a 24-hour threshold and a
day-granularity overdue rule, and the uniqueness constraint is what actually guarantees
"once, not repeatedly" — the schedule is then just a liveness concern.

**Note**: this remains the only part of the system that runs without a user request, and it
exists because of the **[CLARIFIED]** choice to build all five triggers — now confirmed. Cycle 8
therefore carries the scheduler and `PKG_NOTIFICATION` as required work, not optional work. No
technology is added: the loop is standard-library `asyncio` and the package is PL/SQL.

---

## R-008: Attachment storage

**Decision**: Files stored on the server filesystem under a configured directory; the
ATTACHMENTS table stores metadata and the stored filename, never the bytes. Stored filenames
are generated, never taken from user input. A per-file size limit and an allowed-type list are
configured in `app/config.py` (limits); the location is the `TMS_ATTACHMENT_DIR` environment variable. Download is served by the backend after the same visibility
check as the task (R-004).

**Rationale**: The official document requires attachments on tasks and says nothing about how
they are stored. Filesystem storage needs no additional technology. Keeping bytes out of Oracle
avoids BLOB tuning and keeps database backups small. Serving downloads through the backend is
required by Constitution III (the frontend must not reach storage directly) and by FR-053's
visibility guarantee.

**Alternatives considered**:

- *Oracle BLOB columns*: legitimate and arguably more Oracle-native; rejected to keep the
  database small and restores fast. Worth revisiting if the designated server has no writable
  persistent volume — **a deployment question to confirm before cycle 5**.
- *Any object-storage service*: rejected outright — an external service, forbidden by
  Principle I and II.

---

## R-009: Search and filtering implementation

**Decision**: One endpoint, `GET /tasks`, accepting all six filters (project, user, status,
priority, due date, title) as optional query parameters, combined with AND (FR-052). Implemented
as a native SQL query with dynamically appended predicates, always intersected with the
visibility predicate (R-004). Results are paginated. Title search is case-insensitive substring
matching, supported by a function-based index on `UPPER(TITLE)`.

**Rationale**: SC-006 requires 95% of searches under 2 seconds against 10,000 tasks. A single
parameterised query with indexes on the filtered columns meets that comfortably at this scale.
One endpoint for all six filters means FR-046 to FR-052 share one code path and one visibility
check, so a filter combination cannot leak a task.

**Alternatives considered**:

- *A separate endpoint per filter*: rejected — FR-052 requires combining filters, which would
  then have no home.
- *Oracle Text full-text search*: rejected — FR-051 asks only for title search; substring
  matching is sufficient and needs no extra database feature.
- *Client-side filtering*: rejected — would require sending all tasks to the browser, violating
  both SC-006 at scale and FR-053's visibility guarantee.

---

## R-010: API documentation approach

> **Confirmed 2026-09-21 (compliance review).** The project owner confirmed hand-written API
> documentation is acceptable and that springdoc/Swagger should not be added. No longer open.

**Decision**: Hand-written Markdown at `docs/api.md`, generated from and kept consistent with
`contracts/rest-api.md`. No documentation-generation dependency.

**Rationale**: API documentation is required deliverable 12. Hand-written Markdown adds no
dependency and is reviewable in pull requests like any other file, which suits Constitution
VII's code-review gate. The contract file already exists as a Phase 1 artifact, so the
documentation is largely a formatting exercise rather than new work.

**Alternatives considered**:

- *springdoc-openapi (Swagger UI)*: produces interactive documentation that cannot drift from
  the code, which is a real advantage. Rejected because it adds a dependency not named in any
  official list, and the project owner has confirmed hand-written documentation is acceptable.
  The drift risk is mitigated by treating `contracts/rest-api.md` as the contract that
  controller tests assert against (R-011), so documentation and code cannot diverge silently.

---

## R-011: Testing approach ⚠

**Decision**: Backend: **pytest** with FastAPI's `TestClient` (httpx). Unit tests cover pure rules
(hashing, paging, error body, filename sanitising, status set). Integration/contract tests
drive every endpoint through HTTP against a **real Oracle schema** using the demo seed
accounts, asserting status codes and payload shapes against `contracts/rest-api.md`. Tests
create only `ZZTEST`-prefixed rows and delete them afterwards, leaving the demo data intact.
Frontend: documented manual test procedures in `docs/testing.md`, covering each user story's
acceptance scenarios plus a responsive-behaviour checklist at three breakpoints. Per
Constitution VII, tests are written **after** development within each cycle and before the
cycle's Demo.

**Rationale**: pytest is the standard Python test runner and FastAPI ships `TestClient`, so
backend automation costs two test-only packages (pytest, httpx). No frontend test framework is
named in any official list, and the required deliverable is "testing documentation", which a
manual procedure satisfies. Authorization rules (FR-005, FR-053, SC-007) are the highest-risk
area and are fully covered by backend tests, where enforcement actually lives.

**⚠ Confirm**: manual frontend testing is the weakest part of this plan. It satisfies the
official deliverable, but it means the React code has no automated regression safety net.
Adding Vitest and React Testing Library would fix that at the cost of two dev dependencies.

---

## R-012: Deployment ⚠

**Decision**: Backend run by Uvicorn (`uvicorn app.main:app --port 8080`) and, for deployment, containerised with a Python Dockerfile;
frontend built to static assets and served by the backend from a static directory with an `index.html` fallback, so
that one artifact is deployed and the frontend and API share an origin (which R-002's session
cookie relies on). Oracle runs on the designated server as an existing instance, not in a
container. Configuration via environment variables; no credential committed.

**Rationale**: Deliverable 14 requires deployment on the designated server, and the planning
instruction includes "Docker basics for deployment where applicable". Serving the built
frontend from the backend removes CORS configuration, removes a second deployed process, and is
the simplest thing that satisfies both the SPA and same-origin session requirements.

**⚠ Open questions for the project owner, needed before cycle 9, not before development:**

1. Does the designated server already host an Oracle instance, or must one be provisioned?
2. Does it run Docker? If not, the app deploys directly under Uvicorn and the Dockerfile becomes optional —
   the official wording is "where applicable".
3. Is there a writable persistent directory for attachments (see R-008)?

These are deployment-environment facts, not design decisions, and nothing in cycles 0–8 depends
on the answers.

---

## Summary of items needing confirmation

| ID | Item | Impact if changed |
|----|------|-------------------|
| R-011 ⚠ | Manual frontend testing | Medium — no automated regression safety for React code |
| R-012 ⚠ | Deployment environment facts | None before cycle 9 |

**Resolved by the compliance review of 2026-09-21** and no longer open:

| ID | Was | Now |
|----|-----|-----|
| R-001 | ORM / Spring Data JPA ⚠ | Raw SQL via python-oracledb (was `JdbcTemplate` before the 2026-10-04 move to Python): no ORM |
| R-013 | React Router ⚠ | Hand-written History API router — no non-official dependency |
| R-010 | Hand-written API docs vs Swagger ⚠ | Confirmed hand-written; springdoc not adopted |
| R-007 | All five notification triggers ⚠ | Confirmed kept, including the 24-hour threshold |
| R-005 | Free vs strict status transitions | Confirmed free movement among the four statuses |

Only R-011 (frontend test automation) and R-012 (deployment environment facts) remain open.
Neither blocks `/speckit-implement`; R-012 is not needed before Phase 12.
