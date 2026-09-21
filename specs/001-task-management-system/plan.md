# Implementation Plan: Task Management System

**Branch**: `001-task-management-system` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-task-management-system/spec.md`

## Summary

Build a full-stack Task Management System for teams and departments: a React single-page
frontend over a Spring Boot REST backend over an Oracle Database. The system delivers user
management with role-based authorization, project management with membership, task management
with the fixed To Do → In Progress → Review → Completed workflow, task sharing derived from
project membership, dashboards, search and filtering, and in-app notifications.

The technical approach is deliberately minimal: the prescribed stack and nothing beyond it.
Authentication uses Spring Security's built-in session and password hashing rather than any
token library; API documentation is hand-written Markdown rather than a generated-documentation
dependency; the frontend uses hand-written CSS3 rather than any UI component library; data
access is JdbcTemplate writing SQL directly rather than an ORM; routing is a hand-written
module over the browser History API rather than a router library. After the compliance review
of 2026-09-21, exactly **one** non-official dependency remains — Vite, the React build step —
and it is named in Complexity Tracking with the requirement it serves.

**Provenance convention used throughout this plan and its artifacts:**

| Tag | Meaning |
|-----|---------|
| **[OFFICIAL]** | Stated in the official project requirements document. |
| **[CLARIFIED]** | A project decision already recorded in `spec.md` under `## Clarifications`. |
| **[PLAN]** | A technical decision made in this plan, within the bounds of the above. Recorded in `research.md` with its rationale and alternatives. |

## Technical Context

**Language/Version**: Java 21 (LTS) on the backend **[OFFICIAL: Java; PLAN: version]**;
JavaScript (ES2022) and JSX on the frontend **[OFFICIAL]**

**Primary Dependencies**:

- Backend: Spring Boot 3.x — `spring-boot-starter-web` (Spring MVC, REST),
  `spring-boot-starter-security` (authentication & authorization),
  `spring-boot-starter-validation`, `spring-boot-starter-jdbc` (JdbcTemplate — SQL and PL/SQL
  executed directly), `spring-boot-starter-test`, Oracle JDBC driver (`ojdbc11`)
  **[OFFICIAL: Spring Boot / Spring MVC, RESTful APIs, Authentication & Authorization, SQL,
  PL/SQL; PLAN: which starters]**
- **No ORM.** Spring Data JPA / Hibernate is deliberately not used — see R-001.
- Frontend: React 18, Vite (build tool only) **[OFFICIAL: React; PLAN: build tool — see
  Complexity Tracking]**
- **No router library.** Routing is a small hand-written module over the browser History API
  — plain JavaScript, which is officially required — see R-013.
- No UI component library, no CSS framework, no state-management library, no HTTP client
  library — hand-written CSS3 and the browser's built-in `fetch` **[PLAN]**

**Storage**: Oracle Database 19c or 21c (XE acceptable for development). Schema defined in
hand-written SQL DDL; dashboard aggregation and scheduled notification generation implemented
as PL/SQL packages **[OFFICIAL: Oracle Database, SQL, PL/SQL]**

**Testing**: JUnit 5 + Spring Boot Test + MockMvc for backend unit, integration, and REST
contract tests (all included in `spring-boot-starter-test`); documented manual test procedures
for the frontend and for responsive behavior **[OFFICIAL: Testing and debugging, testing
documentation deliverable; PLAN: the specific approach]**

**Target Platform**: Modern web browsers (desktop and mobile screen sizes); backend deployed to
the designated server, optionally via Docker **[OFFICIAL: Responsive Web Design, deployment on
the designated server, Docker basics where applicable]**

**Project Type**: Web application — separate frontend and backend, communicating only over REST

**Performance Goals**: Search and filter results returned within 2 seconds against at least
10,000 tasks (SC-006); dashboard figures always reflect current data (SC-005, FR-045)

**Constraints**: The frontend MUST NOT access the database directly (Constitution III); all
authorization MUST be enforced server-side (Constitution V, FR-005); exactly four task statuses
(Constitution VI, FR-027); interface usable from small mobile to desktop with no horizontal
page scrolling (SC-010)

**Scale/Scope**: A single organisation's departments. Planning target: ~200 users, ~100
projects, ~10,000 tasks. 8 user stories, 65 functional requirements, 12 entities, ~40 REST
endpoints, ~11 screens (see Screen inventory below).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from `.specify/memory/constitution.md` v2.1.0.

| # | Principle | Gate | Initial | Post-Design |
|---|-----------|------|---------|-------------|
| I | Scope Fidelity | Every planned capability traces to an [OFFICIAL] or [CLARIFIED] item; nothing else is built | PASS | PASS |
| II | Fixed Technology Stack | Only HTML5/CSS3/JS/React, Java/Spring Boot/Spring MVC, Oracle/SQL/PL/SQL, Git/GitHub, testing/debugging, and Docker for deployment only; no substitutions; application code independent of Docker | PASS | PASS |
| III | REST API as Layer Boundary | Frontend reaches data only via documented REST endpoints; API documentation kept current | PASS | PASS |
| IV | Relational Data Design Integrity | ERD produced before development; officially listed entities modelled; many-to-many relationships modelled relationally | PASS | PASS |
| V | AuthN, AuthZ, Role-Based Access | Every endpoint authenticated; authorization enforced server-side; deactivation revokes access | PASS | PASS |
| VI | Task Status Workflow Integrity | Exactly To Do → In Progress → Review → Completed; transitions applied server-side | PASS | PASS |
| VII | Code Review and Testing Gates | Planning → Development → Code Review → Testing → Demo → Feedback per cycle; testing documented | PASS | PASS |
| VIII | Responsive Web Interface | Responsive design verified during Testing, not deferred | PASS | PASS |

**Principle II — both previously flagged items are now closed.**

1. **Docker — RESOLVED in constitution v2.1.0 (2026-09-21).** Principle II now names Docker
   basics as an official deployment technology and binds it with an explicit constraint:
   application code MUST NOT depend on Docker, and the system MUST build, run, and be tested
   identically whether or not Docker is present. This plan already complies — Docker appears
   only in Phase 12 (Deployment), in tasks T150 and T152. No further action.
2. **Supporting tools, reduced to one.** The compliance review of 2026-09-21 removed two of the
   three previously planned non-official dependencies. Only **Vite** remains, because JSX cannot
   run in a browser without a build step. Spring Data JPA was replaced by `spring-boot-starter-
   jdbc` (R-001) and React Router by a hand-written History API module (R-013), both of which
   move the work onto officially named technologies. Principle II permits "supporting libraries
   only where they serve a required functional area and do not replace a prescribed technology";
   Vite replaces nothing and ships no runtime code.

**Gate result: PASS, no open items.** No principle is violated and no amendment is pending.
Development may proceed.

## Project Structure

### Documentation (this feature)

```text
specs/001-task-management-system/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — every [PLAN] decision with rationale
├── data-model.md        # Phase 1 output — entities, relationships, ERD, DDL notes
├── quickstart.md        # Phase 1 output — how to run and validate the system
├── contracts/
│   └── rest-api.md      # Phase 1 output — the REST contract, all endpoints
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/main/java/com/computercenter/taskmanagement/
│   ├── TaskManagementApplication.java
│   ├── config/                  # Spring Security config, CORS, Jackson, scheduling
│   ├── user/                    # User, Role: entity, repository, service, controller
│   ├── project/                 # Project, ProjectMember
│   ├── task/                    # Task, TaskAssignee, Subtask, status workflow
│   ├── comment/                 # Comment
│   ├── attachment/              # Attachment upload/download
│   ├── notification/            # Notification entity, triggers, scheduled jobs
│   ├── dashboard/               # Dashboard aggregation (calls PL/SQL)
│   ├── search/                  # Task search and filtering
│   └── common/                  # Error handling, DTO base, pagination, auditing
├── src/main/resources/
│   ├── application.yml          # Datasource, file-storage, scheduling settings
│   └── application-docker.yml   # Deployment profile
├── src/test/java/...            # unit/ integration/ contract/ mirroring the above
├── Dockerfile                   # Deployment phase only
└── pom.xml

frontend/
├── src/
│   ├── main.jsx
│   ├── api/                     # One module per resource; the only place fetch() is called
│   ├── router/                  # Hand-written History API router + role guards (R-013)
│   ├── auth/                    # Login, session context, role-aware route guards
│   ├── components/              # Reusable presentational components
│   ├── pages/                   # Login, Dashboard, Projects, Project, Tasks, Task, Users,
│   │                            #   Notifications, Profile
│   ├── styles/                  # Hand-written CSS3: tokens, layout, responsive breakpoints
│   └── utils/
├── index.html
├── vite.config.js
└── package.json

database/
├── ddl/                         # Tables, constraints, indexes, sequences — in dependency order
├── plsql/                       # Packages: dashboard aggregation, notification generation
├── seed/                        # Reference data (roles, statuses, priorities) + demo data
└── erd/                         # ERD diagram source and exported image

docs/
├── api.md                       # API documentation deliverable
├── erd.md                       # Database design / ERD deliverable
├── testing.md                   # Testing documentation deliverable
├── deployment.md                # Deployment guide for the designated server
└── final-report.md              # Final documentation deliverable
```

**Structure Decision**: A two-part web application — `backend/` and `frontend/` — matching the
officially prescribed split between a RESTful Java backend and a React frontend, plus
`database/` for the SQL and PL/SQL that the official document requires as first-class artifacts
rather than as generated output, and `docs/` for the five documentation deliverables. The
frontend and backend are separately buildable and separately deployable; they share nothing but
the REST contract in `contracts/rest-api.md`.

## Lifecycle Mapping

The official lifecycle **[OFFICIAL]**, mapped to this plan's artifacts and to the phase that
produces each deliverable.

| # | Lifecycle phase | Produced by | Output |
|---|-----------------|-------------|--------|
| 1 | Requirements | `/speckit-specify` | `spec.md` |
| 2 | Analysis | `/speckit-clarify` | `spec.md` § Clarifications |
| 3 | Database Design | This plan, Phase 1 | `data-model.md`, `database/ddl/`, `docs/erd.md` |
| 4 | UI Design | This plan, Phase 1 | Screen inventory below; `frontend/src/styles/` tokens |
| 5 | Development | `/speckit-tasks` → `/speckit-implement` | `backend/`, `frontend/` |
| 6 | API Integration | `/speckit-implement` | `frontend/src/api/` against `contracts/rest-api.md` |
| 7 | Testing | `/speckit-implement` | `backend/src/test/`, `docs/testing.md` |
| 8 | Code Review | Each cycle, via GitHub | Pull request reviews |
| 9 | Deployment | Final cycle | `Dockerfile`, `docs/deployment.md` |
| 10 | Documentation | Final cycle | `docs/api.md`, `docs/final-report.md` |

Constitution Principle VII fixes the per-cycle sequence as Planning → Development → Code
Review → Testing → Demo → Feedback. Note that this places testing **after** development, which
is the official ordering; `/speckit-tasks` must be generated to match it rather than to the
Spec Kit template's default test-first ordering. This is the pending template reconciliation
already flagged in the constitution's Sync Impact Report.

### Screen inventory (UI Design phase)

| Screen | Serves | Role access |
|--------|--------|-------------|
| Login | US1 | Public |
| Profile | US1 | All authenticated |
| User administration | US1 | Admin |
| Project list | US2 | All (own projects); Admin sees all |
| Project detail + members | US2 | Members; edit by Manager |
| Task board / list | US3, US4 | Project members |
| Task detail (subtasks, attachments, comments) | US3, US5 | Project members |
| My tasks (assigned + shared) | US4 | All authenticated |
| Dashboard | US6 | All authenticated, scoped to visible data |
| Search & filter | US7 | All authenticated, scoped to visible data |
| Notifications | US8 | All authenticated, own only |

All screens use a single set of responsive breakpoints defined once in
`frontend/src/styles/` **[PLAN]**, satisfying SC-010 and Constitution VIII.

## Delivery Order

Cycles follow the spec's user-story priorities, so that each cycle ends in something
demonstrable (Constitution VII requires a Demo stage).

| Cycle | Stories | Delivers |
|-------|---------|----------|
| 0 | — | Schema, seed data, project skeletons, security shell, CI-less build verified locally |
| 1 | US1 | Register, log in, profile, roles, activate/deactivate |
| 2 | US2 | Projects and membership |
| 3 | US3 | Tasks: create, edit, delete, assign, priority, dates |
| 4 | US4 | Status workflow, my tasks, shared tasks, progress |
| 5 | US5 | Subtasks, attachments, comments |
| 6 | US6 | Dashboard (PL/SQL aggregation) |
| 7 | US7 | Search and filtering |
| 8 | US8 | Notifications — lowest priority; may be cut without affecting any official deliverable |
| 9 | — | Deployment, API documentation, testing documentation, final report, presentation |

Cycle 8 is the only cut line available: notifications are the single area the official document
marks as optional **[OFFICIAL: "may provide"]**, and the decision to build them is
**[CLARIFIED]**, not required. Every other cycle maps to a required final deliverable.

## Complexity Tracking

> Derived dependencies and constitution gaps requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| ~~Docker, absent from Constitution II's list~~ — **resolved 2026-09-21** | — | Closed by constitution v2.1.0, which names Docker as an official deployment technology and forbids application code from depending on it. Confined to Phase 12. |
| **Vite** (React build tool) — *the only remaining non-official dependency* | React with JSX cannot run in a browser without a build step; no official document names a build tool because the choice is assumed | Two alternatives were tested against the rule "prefer the official stack where reasonable" and rejected: (a) `React.createElement` with no build step avoids the dependency but abandons JSX, which is how React is universally written and taught; (b) Babel standalone compiling in the browser is not viable for a deployed application. Vite ships no runtime code — the deployed artifact is plain HTML, CSS, and JavaScript. |
| ~~React Router~~ — **removed 2026-09-21** | — | Replaced by a hand-written module over the browser History API (~70 lines of plain JavaScript). See R-013. Plain JavaScript is officially required, so this removes a dependency rather than adding one. |
| ~~Spring Data JPA~~ — **removed 2026-09-21** | — | Replaced by `spring-boot-starter-jdbc` (JdbcTemplate) writing SQL directly. See R-001. SQL is officially required and JdbcTemplate is part of Spring Boot, so this removes a dependency and increases the use of officially named technologies. |
| **No UI library, no CSS framework** | — | Not a violation; recorded because it is a deliberate constraint. Responsive layout is hand-written CSS3, as the official document names CSS3 and Responsive Web Design but no framework. |

**Not adopted, and deliberately so**: no JWT/token library (Spring Security sessions suffice),
no OpenAPI/Swagger generator (API documentation is hand-written Markdown), no HTTP client
library (browser `fetch`), no state-management library (React's own state), no frontend test
framework (frontend testing is documented manual procedure), no mapping library, no logging
framework beyond Spring Boot's default, no cloud or third-party service of any kind.

## Out of Scope

Confirmed absent from the official document and therefore not planned: reporting exports,
time tracking, billing, calendar or email integration, external or federated sign-in,
multi-tenancy, task templates, recurring tasks, task dependencies, Gantt or timeline views,
file preview or versioning, real-time collaborative editing, mobile native applications, and
audit/activity logging.

**Note on ACTIVITY_LOG**: the official document lists it among *possible* entities, but no
functional requirement in the official document or in `spec.md` needs it. It is therefore not
modelled. If the project owner wants an audit trail, that is a scope decision to take
explicitly, and it would add one entity and one write path.
