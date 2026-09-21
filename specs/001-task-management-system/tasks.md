---
description: "Implementation tasks for the Task Management System"
---

# Tasks: Task Management System

**Input**: Design documents from `/specs/001-task-management-system/`

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/rest-api.md](./contracts/rest-api.md),
[quickstart.md](./quickstart.md), [constitution v2.1.0](../../.specify/memory/constitution.md)

## Ordering — official, not the Spec Kit default

Constitution Principle VII and the official project document fix the per-cycle sequence as:

**Planning → Development → Code Review → Testing → Demo → Feedback**

Every user story phase below is therefore structured **Development → Code Review → Testing →
Demo**. Tests come *after* the implementation they cover. The Spec Kit template's test-first
ordering is **deliberately not used** — it conflicts with the official document, and the
official document wins.

The whole plan follows the official project lifecycle:

**Requirements → Analysis → Database Design → UI Design → Development → API Integration →
Testing → Code Review → Deployment → Documentation**

Phases 1–2 complete Database Design and UI Design before any Development begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story this task serves (US1–US8); absent in Setup, Foundational,
  Deployment, and Documentation phases
- Every task carries an exact file path and the FR/SC identifiers it satisfies

## Stack (finalized — nothing outside this list)

Frontend: HTML5, CSS3, JavaScript, React 18, Vite (**build tool only**), hand-written History
API router (**no React Router**) · Backend: Java 21, Spring Boot / Spring MVC, Spring Security,
**JdbcTemplate (no JPA/Hibernate)** · Database: Oracle, SQL, PL/SQL · Delivery: Git/GitHub,
Docker (**deployment only**)

---

## Phase 1: Setup — Cycle 0 (Planning)

**Purpose**: Repository, project skeletons, and the Git/GitHub workflow the Code Review gate
depends on.

- [X] T001 Initialize the Git repository at the repo root and add `.gitignore` covering `target/`, `node_modules/`, `dist/`, `*.log`, `.env`, and IDE files
- [ ] T002 Create the GitHub repository, push the initial commit, and enable branch protection requiring one approving review on the default branch (Constitution VII)
- [X] T003 [P] Document the branching and pull-request workflow, one branch per cycle, in `docs/git-workflow.md` (Constitution VII)
- [X] T004 Create the Spring Boot project skeleton in `backend/pom.xml` with Java 21 and starters `web`, `security`, `validation`, `jdbc`, `test`, plus the `ojdbc11` driver — **no `spring-boot-starter-data-jpa`** (R-001)
- [X] T005 [P] Create the React + Vite skeleton in `frontend/package.json`, `frontend/vite.config.js`, and `frontend/index.html` — React and Vite only, **no router or UI library** (R-013)
- [X] T006 [P] Create the database directory tree `database/ddl/`, `database/plsql/`, `database/seed/`, `database/erd/`
- [X] T007 [P] Create the documentation tree `docs/` with empty `api.md`, `erd.md`, `testing.md`, `deployment.md`, `final-report.md`
- [X] T008 Configure the Oracle datasource from environment variables in `backend/src/main/resources/application.yml` — no credential committed (plan § Technical Context)
- [X] T009 [P] Document required environment variables (`TMS_DB_URL`, `TMS_DB_USER`, `TMS_DB_PASSWORD`, `TMS_ATTACHMENT_DIR`) in `.env.example` and `docs/deployment.md`
- [X] T010 [P] Configure the Vite dev proxy forwarding `/api` to `http://localhost:8080` with cookie pass-through in `frontend/vite.config.js` (R-002)
- [ ] T011 Verify a clean checkout builds: `./mvnw package` in `backend/` and `npm install && npm run build` in `frontend/`

**Checkpoint**: Both projects build from a clean checkout; GitHub workflow is in place.

---

## Phase 2: Foundational — Cycle 0 (Database Design + UI Design)

**Purpose**: Everything every user story depends on. Constitution Principle IV requires the
database design to exist **before** persistence code is written, and the official lifecycle
places Database Design and UI Design before Development.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

### Database Design (lifecycle step 3)

- [ ] T012 Write the ERD source in `database/erd/erd.mmd` from [data-model.md](./data-model.md), covering all 12 entities and both many-to-many join tables (Constitution IV, deliverable 11)
- [ ] T013 [P] Export the ERD to `database/erd/erd.png` and write `docs/erd.md` describing every entity and relationship (deliverable 11)
- [ ] T014 Write reference-table DDL in `database/ddl/01_reference.sql` — `ROLES` (ADMIN, MANAGER, MEMBER), `TASK_STATUS` with a check constraint permitting **only** TO_DO, IN_PROGRESS, REVIEW, COMPLETED, and `TASK_PRIORITY` (FR-008, FR-027, Constitution VI)
- [ ] T015 Write `USERS` DDL in `database/ddl/02_users.sql` with unique `username`/`email`, `password_hash`, `role_id` FK, and `is_active CHAR(1) CHECK (is_active IN ('Y','N'))` (FR-001, FR-004, FR-006)
- [ ] T016 Write `PROJECTS` and `PROJECT_MEMBERS` DDL in `database/ddl/03_projects.sql` with the composite PK on (project_id, user_id) and `CHECK (end_date >= start_date)` (FR-009–FR-015)
- [ ] T017 Write `TASKS` and `TASK_ASSIGNEES` DDL in `database/ddl/04_tasks.sql` with the composite PK on (task_id, user_id), `CHECK (due_date >= start_date)`, and FKs to status and priority (FR-016–FR-022)
- [ ] T018 [P] Write `SUBTASKS`, `COMMENTS`, `ATTACHMENTS` DDL in `database/ddl/05_task_detail.sql`, each with `ON DELETE CASCADE` from `TASKS` (FR-024–FR-026, SC-011)
- [ ] T019 [P] Write `NOTIFICATIONS` DDL in `database/ddl/06_notifications.sql` with `trigger_type` constrained to the five official triggers and a unique constraint on (task_id, recipient_id, trigger_type) for DEADLINE and OVERDUE (FR-054–FR-061, R-007)
- [ ] T020 Write index DDL in `database/ddl/07_indexes.sql` — the eight indexes listed in [data-model.md](./data-model.md) § Indexes, including the function-based `UPPER(title)` index (FR-046–FR-051, SC-006)
- [ ] T021 Write `database/ddl/run_all.sql` executing 01–07 in dependency order
- [ ] T022 Write `database/seed/reference_data.sql` inserting the three roles, four statuses in workflow order, and three priorities (FR-008, FR-027)
- [ ] T023 [P] Write `database/seed/demo_data.sql` — 1 Admin, 2 Managers, 4 Members, 3 projects, ~40 tasks spanning every status, every priority, multiple assignees, and past due dates (fixture for SC-005, SC-012)
- [ ] T024 Write the `PKG_DASHBOARD` package specification in `database/plsql/pkg_dashboard.pks` declaring one routine per dashboard figure, each taking the acting user id (FR-036–FR-045, R-006)
- [ ] T025 [P] Write the `PKG_NOTIFICATION` package specification in `database/plsql/pkg_notification.pks` declaring the deadline and overdue generation routines (FR-056, FR-057, R-007)
- [ ] T026 Write `database/plsql/run_all.sql` installing both packages
- [ ] T027 Execute `run_all.sql`, `plsql/run_all.sql`, and `reference_data.sql` against a development schema and verify `SELECT status_code FROM task_status` returns exactly four rows (quickstart § First-time setup)

### UI Design (lifecycle step 4)

- [ ] T028 [P] Define design tokens — colour, spacing, typography scale — in `frontend/src/styles/tokens.css` (CSS3 only, no framework)
- [ ] T029 [P] Define the responsive layout and the three breakpoints (360px, 768px, 1280px) in `frontend/src/styles/layout.css`, guaranteeing no horizontal page scroll (SC-010, Constitution VIII)
- [ ] T030 [P] Build the shared presentational components — button, text input, select, date input, table, modal, badge, empty-state — in `frontend/src/components/` using hand-written CSS3 (Constitution VIII)

### Backend foundation

- [ ] T031 Create `TaskManagementApplication.java` in `backend/src/main/java/com/computercenter/taskmanagement/` with `@EnableScheduling` (R-007)
- [ ] T032 Configure the `JdbcTemplate` and `SimpleJdbcCall` beans in `backend/src/main/java/com/computercenter/taskmanagement/config/DataAccessConfig.java` — **no ORM, no entity annotations** (R-001)
- [ ] T033 Configure Spring Security in `backend/src/main/java/com/computercenter/taskmanagement/config/SecurityConfig.java` — session-based auth, BCrypt `PasswordEncoder`, `HttpOnly`/`SameSite=Lax` cookie, `@EnableMethodSecurity`, all endpoints authenticated except register and login (FR-002, R-002, R-003, Constitution V)
- [ ] T034 [P] Implement the global error handler in `backend/src/main/java/com/computercenter/taskmanagement/common/GlobalExceptionHandler.java` returning the exact error body in [contracts/rest-api.md](./contracts/rest-api.md) § Error body, including `fieldErrors` for 400
- [ ] T035 [P] Implement the paged-response wrapper in `backend/src/main/java/com/computercenter/taskmanagement/common/PageResponse.java` matching the contract's paging shape
- [ ] T036 [P] Implement the acting-user accessor in `backend/src/main/java/com/computercenter/taskmanagement/common/CurrentUser.java` resolving the authenticated user, role, and active state from the session (FR-005, FR-007)
- [ ] T037 Implement the single shared visibility predicate in `backend/src/main/java/com/computercenter/taskmanagement/common/TaskVisibility.java` — a reusable SQL fragment returning tasks whose project the user belongs to, or all tasks for Admin (FR-035, FR-045, FR-053, R-004)

### Frontend foundation

- [ ] T038 Implement the History API router in `frontend/src/router/Router.jsx` — path patterns with parameters, `popstate` handling, initial-load resolution (R-013)
- [ ] T039 [P] Implement `frontend/src/router/Link.jsx` calling `pushState` with `preventDefault`, and `frontend/src/router/RouteGuard.jsx` enforcing role-based access with redirect-back-after-login (R-013, FR-005)
- [ ] T040 [P] Implement the REST client wrapper in `frontend/src/api/client.js` — `fetch` with `credentials: 'include'`, JSON handling, and error normalisation; **the only place `fetch` is called** (Constitution III)
- [ ] T041 Implement the session context in `frontend/src/auth/SessionContext.jsx` loading `GET /api/auth/me` and exposing the current user and role to guards and screens (FR-003, FR-005)
- [ ] T042 [P] Build the application shell and role-aware navigation in `frontend/src/App.jsx` and `frontend/src/components/Nav.jsx`, responsive at all three breakpoints (SC-010)

**Checkpoint**: Schema installed, ERD delivered, design system and router in place. User story
implementation can now begin.

---

## Phase 3: User Story 1 — Secure Access and User Administration (P1) 🎯 MVP

**Goal**: Register, log in, maintain a profile, hold a role, and be activated or deactivated by
an Admin.

**Independent test**: Register → log in → edit profile → assign a role → deactivate → confirm
access is refused → reactivate. No project or task need exist.

### Development

- [ ] T043 [P] [US1] Implement `User` and `Role` records in `backend/src/main/java/com/computercenter/taskmanagement/user/User.java` and `Role.java` — plain Java records, no ORM annotations (R-001)
- [ ] T044 [US1] Implement `UserRepository` with hand-written SQL and an explicit `RowMapper` in `backend/src/main/java/com/computercenter/taskmanagement/user/UserRepository.java` — find by username/email/id, insert, update profile, update role, set active flag (FR-001–FR-007, R-001)
- [ ] T045 [US1] Implement `UserService` in `backend/src/main/java/com/computercenter/taskmanagement/user/UserService.java` — registration with BCrypt hashing and duplicate detection, profile update, role assignment, activation/deactivation with session invalidation, and a guard preventing self-deactivation (FR-001–FR-007, SC-008)
- [ ] T046 [US1] Implement `AuthController` in `backend/src/main/java/com/computercenter/taskmanagement/user/AuthController.java` — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, returning an identical 401 message for bad credentials and for a deactivated account (FR-001, FR-002, FR-007, contract § Authentication)
- [ ] T047 [US1] Implement `UserController` in `backend/src/main/java/com/computercenter/taskmanagement/user/UserController.java` — list, get, `PUT /api/users/me`, and the three Admin-only endpoints guarded by `@PreAuthorize` (FR-003, FR-004, FR-006, FR-008a, contract § Users)
- [ ] T048 [P] [US1] Build the login screen in `frontend/src/pages/Login.jsx` with the login API module `frontend/src/api/auth.js` (FR-002)
- [ ] T049 [P] [US1] Build the profile screen in `frontend/src/pages/Profile.jsx` for viewing and editing own profile (FR-003)
- [ ] T050 [US1] Build the user administration screen in `frontend/src/pages/Users.jsx` with role assignment and activate/deactivate controls, visible only to Admin (FR-004, FR-006, FR-008a)
- [ ] T051 [US1] Wire route guards for `/login`, `/profile`, and `/users` in `frontend/src/router/routes.js`, with `/users` restricted to Admin (FR-005, R-013)

### Code Review

- [ ] T052 [US1] Open a pull request for cycle 1 and complete review, confirming no password is logged or returned, authorization is server-side, and no ORM was introduced (Constitution V, VII, R-001)

### Testing

- [ ] T053 [P] [US1] Unit-test `UserService` registration, duplicate handling, and self-deactivation guard in `backend/src/test/java/com/computercenter/taskmanagement/user/UserServiceTest.java` (FR-001, FR-006)
- [ ] T054 [P] [US1] Integration-test deactivation revoking an **existing session** on the next request, not merely the next login, in `backend/src/test/java/com/computercenter/taskmanagement/user/DeactivationIntegrationTest.java` (FR-007, SC-008)
- [ ] T055 [US1] Contract-test every `/api/auth` and `/api/users` endpoint's status codes and payload shapes with MockMvc in `backend/src/test/java/com/computercenter/taskmanagement/user/UserContractTest.java` (contract §§ Authentication, Users)
- [ ] T056 [US1] Execute quickstart scenario **V1** and record the results in `docs/testing.md` (quickstart § V1)

### Demo & Feedback

- [ ] T057 [US1] Demo cycle 1 against the running system and capture feedback in `docs/testing.md` (Constitution VII)

**Checkpoint**: Authentication, roles, and account lifecycle work end to end. This is the MVP.

---

## Phase 4: User Story 2 — Project Setup and Membership (P2)

**Goal**: Create and manage projects with description, status, dates, and members.

**Independent test**: Create a project, edit it, add and remove members, confirm members see it
and non-members do not — with no tasks in existence.

### Development

- [ ] T058 [P] [US2] Implement the `Project` and `ProjectMember` records in `backend/src/main/java/com/computercenter/taskmanagement/project/` (R-001)
- [ ] T059 [US2] Implement `ProjectRepository` with hand-written SQL and `RowMapper` in `backend/src/main/java/com/computercenter/taskmanagement/project/ProjectRepository.java` — CRUD plus member add/remove/list, managing the join table explicitly (FR-009–FR-015, R-001)
- [ ] T060 [US2] Implement `ProjectService` in `backend/src/main/java/com/computercenter/taskmanagement/project/ProjectService.java` — create, update, delete, membership management, date validation, and the Manager-owns-project membership check (FR-009–FR-015, FR-008b, R-003)
- [ ] T060a [US2] On removing a member from a project, delete that user's `TASK_ASSIGNEES` rows for tasks in **that project only**, and return a summary of the assignments removed, in `ProjectService` and `ProjectController` — behaviour already specified by [contracts/rest-api.md](./contracts/rest-api.md) § Projects and exercised by quickstart V2 step 4 (FR-014, FR-019, spec Edge Cases)
- [ ] T061 [US2] Implement `ProjectController` in `backend/src/main/java/com/computercenter/taskmanagement/project/ProjectController.java` — the nine endpoints in contract § Projects, with `@PreAuthorize` on create, update, delete, and membership changes (FR-009–FR-015)
- [ ] T062 [P] [US2] Build the project list screen in `frontend/src/pages/Projects.jsx` with `frontend/src/api/projects.js` (FR-015)
- [ ] T063 [US2] Build the project detail and membership screen in `frontend/src/pages/Project.jsx`, with create/edit controls shown only to Manager and Admin (FR-010–FR-014)
- [ ] T064 [US2] Add `/projects` and `/projects/:id` routes with guards in `frontend/src/router/routes.js` (R-013)

### Code Review

- [ ] T065 [US2] Open a pull request for cycle 2 and complete review, confirming membership checks are data-dependent and server-side, not role-only (R-003, Constitution V)

### Testing

- [ ] T066 [P] [US2] Unit-test project date validation, the membership permission rules, and that removing a project member deletes that user's task assignments within that project and returns the summary of what was removed, in `backend/src/test/java/com/computercenter/taskmanagement/project/ProjectServiceTest.java` (FR-013, FR-014, FR-019, US2 scenario 5)
- [ ] T067 [US2] Contract-test all `/api/projects` endpoints with MockMvc in `backend/src/test/java/com/computercenter/taskmanagement/project/ProjectContractTest.java` (contract § Projects)
- [ ] T068 [US2] Execute quickstart scenario **V2** and record results in `docs/testing.md`

### Demo & Feedback

- [ ] T069 [US2] Demo cycle 2 and capture feedback in `docs/testing.md` (Constitution VII)

**Checkpoint**: Projects and membership work; visibility scoping is now available to later stories.

---

## Phase 5: User Story 3 — Task Creation and Assignment (P3)

**Goal**: Create, edit, delete tasks with priority and dates, assigned to one or more users.

**Independent test**: Create tasks at each priority, assign one to a single user and another to
several, edit, delete — within one project, with no dashboard or search.

### Development

- [ ] T070 [P] [US3] Implement the `Task` and `TaskAssignee` records in `backend/src/main/java/com/computercenter/taskmanagement/task/` (R-001)
- [ ] T071 [US3] Implement `TaskRepository` with hand-written SQL and `RowMapper` in `backend/src/main/java/com/computercenter/taskmanagement/task/TaskRepository.java` — CRUD plus assignee add/remove/list, applying `TaskVisibility` on every read (FR-016–FR-023, R-001, R-004)
- [ ] T072 [US3] Implement `TaskService` in `backend/src/main/java/com/computercenter/taskmanagement/task/TaskService.java` — create defaulting to status `TO_DO`, update, delete, multi-user assignment, date validation, and the assignment permission rule (FR-016–FR-023, FR-032, FR-008b/c)
- [ ] T073 [US3] Implement `TaskController` in `backend/src/main/java/com/computercenter/taskmanagement/task/TaskController.java` — create, get, update, delete, and the two assignee endpoints; `PUT /api/tasks/{id}` **rejects** any status field (contract § Tasks, R-005)
- [ ] T074 [US3] Return **404 rather than 403** for a task outside the caller's visibility, so invisible tasks are not disclosed, in `TaskController` and `GlobalExceptionHandler` (FR-053, contract § Status codes)
- [ ] T075 [P] [US3] Build the task list screen in `frontend/src/pages/Tasks.jsx` with `frontend/src/api/tasks.js` (FR-016)
- [ ] T076 [US3] Build the task detail and edit screen in `frontend/src/pages/Task.jsx` including the multi-user assignee picker (FR-017, FR-019)
- [ ] T077 [US3] Add `/tasks` and `/tasks/:id` routes with guards in `frontend/src/router/routes.js` (R-013)

### Code Review

- [ ] T078 [US3] Open a pull request for cycle 3 and complete review, confirming every task read passes through `TaskVisibility` and no endpoint bypasses it (R-004, FR-053)

### Testing

- [ ] T079 [P] [US3] Unit-test task date validation, `TO_DO` defaulting, and the assignment permission rule in `backend/src/test/java/com/computercenter/taskmanagement/task/TaskServiceTest.java` (FR-016, FR-019, FR-032)
- [ ] T080 [P] [US3] Integration-test that deleting a task removes it from every list and count in `backend/src/test/java/com/computercenter/taskmanagement/task/TaskDeletionIntegrationTest.java` (FR-018, SC-011)
- [ ] T081 [US3] Contract-test all `/api/tasks` CRUD and assignee endpoints in `backend/src/test/java/com/computercenter/taskmanagement/task/TaskContractTest.java` (contract § Tasks)
- [ ] T082 [US3] Execute quickstart scenario **V3** and record results in `docs/testing.md`

### Demo & Feedback

- [ ] T083 [US3] Demo cycle 3 and capture feedback in `docs/testing.md` (Constitution VII)

**Checkpoint**: The core product works — work can be captured, owned, and scheduled.

---

## Phase 6: User Story 4 — Task Workflow and Progress Tracking (P4)

**Goal**: Move tasks through the four official statuses; see assigned and shared tasks.

**Independent test**: Assign a task, view it in the assignee's list, advance it through all four
statuses, confirm the project manager sees each change.

### Development

- [ ] T084 [US4] Implement the `TaskStatus` enum — exactly `TO_DO`, `IN_PROGRESS`, `REVIEW`, `COMPLETED` — in `backend/src/main/java/com/computercenter/taskmanagement/task/TaskStatus.java` (FR-027, Constitution VI)
- [ ] T085 [US4] Implement status transition handling in `backend/src/main/java/com/computercenter/taskmanagement/task/TaskStatusService.java` — **free movement among the four statuses**, rejecting only values outside the set. Do **not** implement a forward-only restriction: the official document does not specify one (FR-027–FR-029, R-005). A parent task MAY move to `COMPLETED` while subtasks remain incomplete — no warning, no block (R-015).
- [ ] T086 [US4] Implement `PATCH /api/tasks/{id}/status` as the **only** route that changes status, in `TaskController` (FR-021, FR-034, contract § Tasks, R-005)
- [ ] T087 [US4] Implement `GET /api/tasks/assigned-to-me` and `GET /api/tasks/shared-with-me` in `TaskRepository` and `TaskController` — shared meaning a project member who is **not** an assignee (FR-030, FR-031, FR-035, **[CLARIFIED]**)
- [ ] T088 [P] [US4] Build the "My tasks" screen in `frontend/src/pages/MyTasks.jsx` showing assigned and shared tasks in visually distinguishable groups (FR-030, FR-031, FR-035a)
- [ ] T089 [US4] Add the status control to `frontend/src/pages/Task.jsx` and the task list, reachable in at most two interactions from the task list (FR-034, SC-004)
- [ ] T090 [US4] Implement `GET /api/projects/{id}/progress` in `ProjectService` and `ProjectController`, derived from completed ÷ total tasks (FR-033, FR-044)

### Code Review

- [ ] T091 [US4] Open a pull request for cycle 4 and complete review, confirming no fifth status exists anywhere in the code, the database, or the UI (FR-027, Constitution VI)

### Testing

- [ ] T092 [P] [US4] Unit-test that every one of the four statuses is accepted, that transitions in both directions are permitted, that a parent task with an incomplete subtask can still reach `COMPLETED`, and that any other value is rejected, in `backend/src/test/java/com/computercenter/taskmanagement/task/TaskStatusServiceTest.java` (FR-027, FR-028, R-005, R-015)
- [ ] T093 [P] [US4] Integration-test that "shared with me" returns project tasks the user is not assigned to, and never a task outside their projects, in `backend/src/test/java/com/computercenter/taskmanagement/task/SharedTaskVisibilityTest.java` (FR-031, FR-035, FR-053)
- [ ] T094 [US4] Contract-test `PATCH /api/tasks/{id}/status` including a rejected invalid status and a 404 for an invisible task in `backend/src/test/java/com/computercenter/taskmanagement/task/TaskStatusContractTest.java` (contract § Tasks)
- [ ] T095 [US4] Execute quickstart scenario **V4** and record results in `docs/testing.md`

### Demo & Feedback

- [ ] T096 [US4] Demo cycle 4 and capture feedback in `docs/testing.md` (Constitution VII)

**Checkpoint**: The full workflow and task-sharing model work end to end.

---

## Phase 7: User Story 5 — Task Collaboration Detail (P5)

**Goal**: Subtasks, attachments, and comments on a task.

**Independent test**: On one task — add and complete subtasks, upload and download an
attachment, post and read comments.

### Development

- [ ] T097 [P] [US5] Implement `Subtask`, `SubtaskRepository`, and `SubtaskService` in `backend/src/main/java/com/computercenter/taskmanagement/task/subtask/` (FR-024, R-001)
- [ ] T098 [P] [US5] Implement `Comment`, `CommentRepository`, and `CommentService` in `backend/src/main/java/com/computercenter/taskmanagement/comment/`, ordered by `created_at` with author (FR-026, R-001)
- [ ] T099 [US5] Implement `AttachmentService` in `backend/src/main/java/com/computercenter/taskmanagement/attachment/AttachmentService.java` — filesystem storage under `TMS_ATTACHMENT_DIR`, system-generated stored filenames, size and type limits, and **no database row written unless the file stored successfully** (FR-025, R-008, spec Edge Cases)
- [ ] T100 [US5] Implement `SubtaskController`, `CommentController`, and `AttachmentController` in their packages, matching contract § Subtasks, comments, attachments; downloads stream through the backend after the same visibility check as the task (FR-024–FR-026, Constitution III, R-008)
- [ ] T101 [P] [US5] Build the subtask, comment, and attachment panels in `frontend/src/pages/Task.jsx` with `frontend/src/api/taskDetail.js` (FR-024–FR-026)

### Code Review

- [ ] T102 [US5] Open a pull request for cycle 5 and complete review, confirming stored filenames are never taken from user input and downloads cannot bypass visibility (R-008, FR-053)

### Testing

- [ ] T103 [P] [US5] Unit-test attachment filename generation and the failed-upload path leaving no row, in `backend/src/test/java/com/computercenter/taskmanagement/attachment/AttachmentServiceTest.java` (R-008, spec Edge Cases)
- [ ] T104 [US5] Integration-test that deleting a task removes its subtasks, comments, attachments, and assignees with no orphan reachable, in `backend/src/test/java/com/computercenter/taskmanagement/task/CascadeDeletionTest.java` (SC-011)
- [ ] T105 [US5] Contract-test the subtask, comment, and attachment endpoints, including a 404 for an attachment outside the caller's projects, in `backend/src/test/java/com/computercenter/taskmanagement/task/TaskDetailContractTest.java`
- [ ] T106 [US5] Execute quickstart scenario **V5** and record results in `docs/testing.md`

### Demo & Feedback

- [ ] T107 [US5] Demo cycle 5 and capture feedback in `docs/testing.md` (Constitution VII)

**Checkpoint**: A task now carries its full working context.

---

## Phase 8: User Story 6 — Dashboard (P6)

**Goal**: Nine officially required figures, scoped to what the viewer may see.

**Independent test**: Seed a known data set, then confirm every dashboard figure matches it.

### Development

- [ ] T108 [US6] Implement the `PKG_DASHBOARD` package body in `database/plsql/pkg_dashboard.pkb` — total projects, total tasks, completed, pending, overdue, by status, by priority, by user, and project progress, each scoped by the acting user's visibility (FR-036–FR-045, R-006)
- [ ] T109 [US6] Implement `DashboardRepository` in `backend/src/main/java/com/computercenter/taskmanagement/dashboard/DashboardRepository.java` calling the package via `SimpleJdbcCall` (R-001, R-006)
- [ ] T110 [US6] Implement `DashboardService` and `DashboardController` in `backend/src/main/java/com/computercenter/taskmanagement/dashboard/` returning all nine figures in one response, computed per request and never cached (FR-045, contract § Dashboard)
- [ ] T111 [P] [US6] Build the dashboard screen in `frontend/src/pages/Dashboard.jsx` with `frontend/src/api/dashboard.js`, rendering all nine figures responsively (FR-036–FR-044, SC-010)

### Code Review

- [ ] T112 [US6] Open a pull request for cycle 6 and complete review, confirming the aggregation is in PL/SQL and every figure is visibility-scoped (R-006, FR-045)

### Testing

- [ ] T113 [US6] Integration-test all nine figures against `demo_data.sql` by comparing each with a direct SQL count, in `backend/src/test/java/com/computercenter/taskmanagement/dashboard/DashboardAccuracyTest.java` (SC-005 requires 100% accuracy)
- [ ] T114 [P] [US6] Integration-test that a Member belonging to one project sees figures covering only that project, in `backend/src/test/java/com/computercenter/taskmanagement/dashboard/DashboardVisibilityTest.java` (FR-045)
- [ ] T115 [US6] Contract-test `GET /api/dashboard` field-by-field against contract § Dashboard in `backend/src/test/java/com/computercenter/taskmanagement/dashboard/DashboardContractTest.java`
- [ ] T116 [US6] Execute quickstart scenario **V6** and record results in `docs/testing.md`

### Demo & Feedback

- [ ] T117 [US6] Demo cycle 6 and capture feedback in `docs/testing.md` (Constitution VII)

**Checkpoint**: Reporting works and is provably accurate.

---

## Phase 9: User Story 7 — Search and Filtering (P7)

**Goal**: Six filters, combinable, plus title search — never leaking an invisible task.

**Independent test**: Apply each filter alone, several together, and search by partial title.

### Development

- [ ] T118 [US7] Implement dynamic filter SQL in `backend/src/main/java/com/computercenter/taskmanagement/search/TaskSearchRepository.java` — optional predicates for project, user, status, priority, due-date range, title, and overdue, always intersected with `TaskVisibility`, with paging (FR-046–FR-053, R-004, R-009)
- [ ] T119 [US7] Extend `GET /api/tasks` in `TaskController` to accept all filter parameters, combining them with AND (FR-052, contract § GET /api/tasks)
- [ ] T120 [US7] Implement case-insensitive substring title search using the `UPPER(title)` function-based index in `TaskSearchRepository` (FR-051, SC-006)
- [ ] T121 [P] [US7] Build the search and filter panel in `frontend/src/pages/Tasks.jsx` with an empty-result message rather than an error (FR-046–FR-052, spec Edge Cases)

### Code Review

- [ ] T122 [US7] Open a pull request for cycle 7 and complete review, confirming no filter combination can bypass the visibility predicate (FR-053, R-009)

### Testing

- [ ] T123 [P] [US7] Unit-test each filter individually and in combination in `backend/src/test/java/com/computercenter/taskmanagement/search/TaskSearchRepositoryTest.java` (FR-046–FR-052)
- [ ] T124 [P] [US7] Integration-test that a non-member filtering by a project they do not belong to receives an empty result, never a leak, in `backend/src/test/java/com/computercenter/taskmanagement/search/SearchVisibilityTest.java` (FR-053, SC-007)
- [ ] T125 [US7] Performance-test search against at least 10,000 seeded tasks and record timings in `docs/testing.md` (SC-006: 95% under 2 seconds)
- [ ] T126 [US7] Execute quickstart scenario **V7** and record results in `docs/testing.md`

### Demo & Feedback

- [ ] T127 [US7] Demo cycle 7 and capture feedback in `docs/testing.md` (Constitution VII)

**Checkpoint**: The system is usable at realistic data volumes.

---

## Phase 10: User Story 8 — Notifications (P8) **[CLARIFIED — optional in the official document]**

**Goal**: All five official triggers, delivered in-app.

**Independent test**: Perform each triggering action and confirm exactly one matching
notification reaches the right recipient.

> **This is the only cut line.** Notifications are the single area the official document marks
> as optional ("may provide") and they appear in none of the 15 required deliverables. If time
> runs short, this entire phase may be dropped without affecting any official deliverable.

### Development

- [ ] T128 [P] [US8] Implement `Notification`, `NotificationRepository`, and `NotificationService` in `backend/src/main/java/com/computercenter/taskmanagement/notification/`, never creating a notification for an inactive user or referencing an invisible task (FR-054–FR-061, R-001)
- [ ] T129 [US8] Raise assignment, update, and comment/mention notifications **inside the transaction of the action that causes them**, in `TaskService`, `TaskStatusService`, and `CommentService` (FR-054, FR-055, FR-058, R-007)
- [ ] T130 [US8] Implement the `PKG_NOTIFICATION` package body in `database/plsql/pkg_notification.pkb` generating approaching-deadline notifications at **24 hours before due date** and overdue notifications, both skipping completed tasks (FR-056, FR-057, **[CLARIFIED]** threshold, R-007)
- [ ] T131 [US8] Implement the hourly `@Scheduled` job in `backend/src/main/java/com/computercenter/taskmanagement/notification/NotificationScheduler.java` invoking the package, relying on the unique constraint for idempotence (FR-056, FR-057, R-007)
- [ ] T132 [US8] Implement the four notification endpoints in `backend/src/main/java/com/computercenter/taskmanagement/notification/NotificationController.java` per contract § Notifications, with a 404 for another user's notification (FR-059–FR-061)
- [ ] T133 [P] [US8] Build the notifications screen in `frontend/src/pages/Notifications.jsx` and the unread-count badge in `frontend/src/components/Nav.jsx`, visible without leaving the current page (FR-060, SC-013)

### Code Review

- [ ] T134 [US8] Open a pull request for cycle 8 and complete review, confirming the scheduler cannot duplicate notifications and that no notification discloses an invisible task (R-007, FR-061)

### Testing

- [ ] T135 [P] [US8] Unit-test that each of the five triggers produces exactly one notification per intended recipient and none for anyone else, in `backend/src/test/java/com/computercenter/taskmanagement/notification/NotificationServiceTest.java` (FR-054–FR-058, SC-012)
- [ ] T136 [US8] Integration-test idempotence — run the scheduled job twice over a deadline-approaching task and an overdue task and assert exactly one notification each, in `backend/src/test/java/com/computercenter/taskmanagement/notification/NotificationSchedulerTest.java` (R-007; the single most important assertion in this phase)
- [ ] T137 [P] [US8] Integration-test that a deactivated user receives no notifications, in `backend/src/test/java/com/computercenter/taskmanagement/notification/NotificationSuppressionTest.java` (FR-061)
- [ ] T138 [US8] Contract-test the four notification endpoints in `backend/src/test/java/com/computercenter/taskmanagement/notification/NotificationContractTest.java`
- [ ] T139 [US8] Execute quickstart scenario **V8** and record results in `docs/testing.md`

### Demo & Feedback

- [ ] T140 [US8] Demo cycle 8 and capture feedback in `docs/testing.md` (Constitution VII)

**Checkpoint**: All eight user stories are complete.

---

## Phase 11: Cross-Cutting Verification

**Purpose**: The checks that span every story and cannot be done inside one.

- [ ] T141 Execute the authorization sweep — for each of Admin, Manager, Member, attempt every endpoint in [contracts/rest-api.md](./contracts/rest-api.md) the role should not reach — and record the full matrix in `docs/testing.md` (SC-007 requires 100% refused; quickstart § V10)
- [ ] T142 [P] Execute quickstart scenario **V9** — every screen at 360px, 768px, and 1280px, confirming no horizontal page scroll and no clipped content — and record results in `docs/testing.md` (SC-010, Constitution VIII)
- [ ] T143 [P] Execute quickstart scenario **V11** — the six navigation checks for the hand-written router: link clicks, back/forward, deep links, role-guarded deep links, redirect-after-login, and reload on a deep link (R-013)
- [ ] T144 [P] Verify the end-to-end timing targets for account creation, project creation, task creation, and status change, recording measurements in `docs/testing.md` (SC-001–SC-004)
- [ ] T145 Observe 5–10 first-time users attempting to create and assign a task without assistance, and record the success rate and the points where they hesitated in `docs/testing.md` (SC-009)
- [ ] T146 Run the full backend test suite and record the result in `docs/testing.md`; no test may be skipped or disabled to make the suite pass (Constitution VII quality gates)

---

## Phase 12: Deployment (lifecycle step 9)

**Purpose**: Deploy to the designated server. Docker is **[OFFICIAL]** but confined here — no
application code depends on it.

- [ ] T147 Confirm the three deployment-environment facts with the project owner and record them in `docs/deployment.md`: whether Oracle already runs on the designated server, whether Docker is available, and whether a writable persistent directory exists for attachments (R-012, R-008)
- [ ] T148 Configure the frontend production build to output into `backend/src/main/resources/static`, so one artifact is deployed and the API shares an origin with the UI, in `frontend/vite.config.js` (R-012, R-002)
- [ ] T149 Add the catch-all rewrite to `index.html` for unmatched non-API paths in `backend/src/main/java/com/computercenter/taskmanagement/config/WebConfig.java`, so deep links survive a reload (R-013, R-012)
- [ ] T150 Write `backend/Dockerfile` packaging the executable JAR, and `backend/src/main/resources/application-docker.yml` reading all configuration from environment variables (R-012, **[OFFICIAL]** Docker basics)
- [ ] T151 Deploy to the designated server and verify the deployed system against quickstart scenarios **V1** and **V4** (deliverable 14)
- [ ] T152 Write the deployment guide — prerequisites, environment variables, database installation order, build, run, rollback — in `docs/deployment.md` (deliverable 14)

---

## Phase 13: Documentation & Final Delivery (lifecycle step 10)

- [ ] T153 Write the API documentation in `docs/api.md` from [contracts/rest-api.md](./contracts/rest-api.md) — every endpoint, parameters, payloads, status codes, and role access — hand-written Markdown, **no Swagger/springdoc** (deliverable 12, R-010)
- [ ] T154 [P] Complete the testing documentation in `docs/testing.md` — approach, test inventory, the authorization matrix, the responsive checklist, performance measurements, and results (deliverable 10)
- [ ] T155 [P] Finalise `docs/erd.md` with the delivered schema, confirming it matches `database/ddl/` exactly (deliverable 11)
- [ ] T156 Verify every functional requirement FR-001 to FR-061 maps to at least one completed task and one test, recording the traceability matrix in `docs/final-report.md` (Constitution VII quality gate)
- [ ] T157 Write the final project report in `docs/final-report.md` — architecture, database design, technology decisions with the official/clarified/plan provenance, deliverable checklist, and known limitations (deliverable 15)
- [ ] T158 Prepare the final project presentation covering all 15 required deliverables (deliverable 15)

---

## Dependencies

### Phase order

```text
Phase 1 (Setup)
  └─► Phase 2 (Foundational — Database Design + UI Design)   ⚠ BLOCKS EVERYTHING
        ├─► Phase 3  US1 Users/Auth (P1) 🎯 MVP
        │     └─► Phase 4  US2 Projects (P2)
        │           └─► Phase 5  US3 Tasks (P3)
        │                 ├─► Phase 6  US4 Workflow & Sharing (P4)
        │                 │     ├─► Phase 8  US6 Dashboard (P6)
        │                 │     ├─► Phase 9  US7 Search (P7)
        │                 │     └─► Phase 10 US8 Notifications (P8)  ← cut line
        │                 └─► Phase 7  US5 Subtasks/Attachments/Comments (P5)
        └─► Phase 11 (Cross-cutting) ─► Phase 12 (Deployment) ─► Phase 13 (Documentation)
```

### Why the stories are not independent here

The Spec Kit default assumes user stories can be built in any order. In this system they cannot,
and the dependency is real rather than organisational:

- **US2 needs US1** — a project has members, and members are users with roles.
- **US3 needs US2** — every task belongs to a project.
- **US4, US5 need US3** — status, sharing, subtasks, attachments, and comments all attach to a
  task.
- **US6, US7, US8 need US4** — dashboards count by status, search filters by status, and
  notifications fire on assignment and status change.

US5 is the one genuine parallel branch: it can be built alongside US4 by a second developer once
US3 is complete, since they touch different files.

### Within a story

Development → Code Review → Testing → Demo, in that order, per Constitution VII. Tasks marked
**[P]** inside a phase touch different files and may run in parallel.

## Parallel opportunities

| Phase | Parallel tasks | Note |
|-------|----------------|------|
| 1 | T003, T005, T006, T007, T009, T010 | Independent skeletons and docs |
| 2 | T013, T018, T019, T023, T025 · T028, T029, T030 · T034, T035, T036 · T039, T040, T042 | DDL files, design system, backend commons, frontend commons |
| 3 | T043, T048, T049 · T053, T054 | Records and screens; unit and integration tests |
| 4 | T058, T062 · T066 | |
| 5 | T070, T075 · T079, T080 | |
| 6 | T088 · T092, T093 | |
| 7 | T097, T098 in parallel · T101 · T103 | Subtasks and comments are independent modules |
| 8 | T111 · T114 | |
| 9 | T121 · T123, T124 | |
| 10 | T128, T133 · T135, T137 | |
| 11 | T142, T143, T144 | Three independent verification sweeps |
| 13 | T154, T155 | |

**Cross-story parallelism**: US5 (Phase 7) may run concurrently with US4 (Phase 6) once US3 is
complete — different packages, different screens, no shared files.

## Cycle-to-phase mapping

[plan.md](./plan.md) § Delivery Order numbers the work as cycles 0–9; this file numbers it as
phases 1–13. They describe the same work:

| plan.md cycle | tasks.md phase(s) | Content |
|---|---|---|
| 0 | 1–2 | Setup, Database Design, UI Design, foundations |
| 1–8 | 3–10 | User stories US1–US8, one cycle per story |
| 9 | 11–13 | Cross-cutting verification, Deployment, Documentation |

## Implementation strategy

**MVP = Phase 1 + Phase 2 + Phase 3 (US1).** That delivers authentication, roles, profiles, and
account activation — a running, demonstrable, independently valuable system. Every subsequent
phase is a complete increment ending in a demo.

**Recommended sequence**: deliver Phases 3–7 in order (they build on each other), then choose
between Phases 8 and 9 based on what the demo audience most wants to see, then Phase 10 if time
allows.

**If time runs short**, cut in this order:

1. **Phase 10 (US8 Notifications)** — the only officially optional area, absent from all 15
   deliverables. Cutting it costs nothing required, and removes the scheduler and PL/SQL
   notification package, which are the highest-risk items remaining.
2. Nothing else. Phases 3–9 each map to a required final deliverable, and Phases 11–13 are the
   deliverables themselves.

## Traceability

| Requirement range | Area | Tasks |
|-------------------|------|-------|
| FR-001 – FR-008c | User management, roles | T015, T022, T043–T057 |
| FR-009 – FR-015 | Project management | T016, T058–T069 |
| FR-016 – FR-026 | Task management, subtasks, attachments, comments | T017, T018, T070–T083, T097–T107 |
| FR-027 – FR-029 | Status workflow | T014, T084–T086, T092 |
| FR-030 – FR-035a | Task sharing | T037, T087, T088, T093 |
| FR-036 – FR-045 | Dashboard | T024, T108–T117 |
| FR-046 – FR-053 | Search and filtering | T020, T118–T127 |
| FR-054 – FR-061 | Notifications | T019, T025, T128–T140 |
| SC-001 – SC-004 | Timing targets | T144 |
| SC-009 | First-time-user success rate | T145 |
| SC-005 | Dashboard accuracy | T113 |
| SC-006 | Search performance | T125 |
| SC-007, SC-008 | Authorization, deactivation | T054, T141 |
| SC-010 | Responsive interface | T029, T142 |
| SC-011 | Referential consistency | T018, T080, T104 |
| SC-012, SC-013 | Notification correctness | T135–T137 |
| Deliverables 10–15 | Documentation, deployment | T147–T158 |
