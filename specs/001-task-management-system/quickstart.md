# Quickstart & Validation Guide: Task Management System

**Feature**: `001-task-management-system` | **Date**: 2026-09-21 | **Plan**: [plan.md](./plan.md)

How to run the system from a clean checkout and prove each user story works. Written to be
followed during the **Demo** stage of each cycle (Constitution VII) and to seed
`docs/testing.md`, required deliverable 10.

The scenarios reference [`contracts/rest-api.md`](./contracts/rest-api.md) for payload shapes
and [`data-model.md`](./data-model.md) for entity rules rather than repeating them.

## Prerequisites

| Requirement | Version | Why |
|-------------|---------|-----|
| JDK | 21 (LTS) | Backend |
| Maven | 3.9+ | Backend build (or the bundled `mvnw`) |
| Node.js | 20 LTS+ | Frontend build only (Vite) — not a runtime dependency; the deployed frontend is plain HTML/CSS/JS |
| Oracle Database | 19c / 21c / XE | Required database **[OFFICIAL]** |
| Git | any recent | **[OFFICIAL]** |
| Docker | any recent | **[OFFICIAL]** deployment basics — Deployment phase only; nothing in cycles 0–8 needs it |

An Oracle user/schema for the application with `CREATE TABLE`, `CREATE SEQUENCE`, and
`CREATE PROCEDURE` privileges is required before first run.

## First-time setup

### 1. Database

Run the DDL in dependency order, then the PL/SQL packages, then the seed data:

```bash
cd database
sqlplus tms_user/<password>@//localhost:1521/XEPDB1 @ddl/run_all.sql
sqlplus tms_user/<password>@//localhost:1521/XEPDB1 @plsql/run_all.sql
sqlplus tms_user/<password>@//localhost:1521/XEPDB1 @seed/reference_data.sql
```

`seed/reference_data.sql` inserts the immutable reference rows: three roles, the four task
statuses in workflow order, and the three priorities. The system will not start correctly
without them.

Verify: `SELECT status_code FROM task_status ORDER BY sort_order;` must return exactly
`TO_DO, IN_PROGRESS, REVIEW, COMPLETED` — four rows, no more (Constitution VI).

### 2. Backend

Configuration comes from environment variables; no credential is committed.

```bash
export TMS_DB_URL=jdbc:oracle:thin:@//localhost:1521/XEPDB1
export TMS_DB_USER=tms_user
export TMS_DB_PASSWORD=<password>
export TMS_ATTACHMENT_DIR=/var/tms/attachments

cd backend
./mvnw spring-boot:run
```

Backend starts on `http://localhost:8080`. There is no ORM and no schema generation: the
application reads and writes the hand-written schema through `JdbcTemplate` (R-001). A column
that does not match its SQL fails at query time with a plain Oracle error naming the column.

Verify: `curl -i http://localhost:8080/api/auth/me` → `401` (not yet authenticated).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on `http://localhost:5173`, proxying `/api` to the backend (dev only; in
deployment the backend serves the built assets from one origin — R-012).

### 4. Seed a demo dataset

```bash
sqlplus tms_user/<password>@//localhost:1521/XEPDB1 @seed/demo_data.sql
```

Creates one Admin, two Managers, four Members, three projects, and roughly forty tasks spread
across every status, every priority, several assignees, and a handful of past due dates — the
fixture SC-005 and SC-012 are validated against.

## Validation scenarios

One per user story. Each is independently runnable and maps to that story's acceptance
scenarios in [`spec.md`](./spec.md).

### V1 — Secure access and user administration (US1, P1)

1. Register a new account → lands with the `MEMBER` role, active.
2. Log in with correct credentials → succeeds. Log in with a wrong password → `401` with a
   message that does not reveal which credential was wrong.
3. View and edit own profile → changes persist.
4. As Admin, change that user's role to `MANAGER` → their permitted actions change on their
   next request.
5. As Admin, deactivate the user → their **existing session** is refused on the next request
   (`401`), and a fresh login fails.
6. Reactivate → login succeeds again.

**Expected**: steps 5 and 6 satisfy SC-008. Step 5 failing only at next login, rather than
immediately, is a defect (FR-007).

### V2 — Projects and membership (US2, P2)

1. As Manager, create a project with dates → `201`.
2. Create one with `endDate` before `startDate` → `400` with a clear message.
3. Add two Members → they each see the project; a third user who is not a member does not.
4. Remove a member who holds task assignments → their assignments in that project are removed
   and the response says what was unassigned.

### V3 — Tasks: create, assign, edit, delete (US3, P3)

1. Create a task with title, description, priority, dates → `201`, status `TO_DO`.
2. Create with `dueDate` before `startDate` → `400`.
3. Assign to two users → both see it under **assigned to me**.
4. As a Member (not Manager), attempt to assign a task to someone else → `403` (FR-032).
5. Edit, then delete → deleted task is absent from every list, filter, and dashboard count.

### V4 — Workflow and progress (US4, P4)

1. Move a task `TO_DO → IN_PROGRESS → REVIEW → COMPLETED` → each `204`, each visible to the
   project's manager.
2. `PATCH` a status of `"ARCHIVED"` → `400` (Constitution VI).
3. Attempt a status change on a task whose project you are not in → `404`, not `403`.
4. Check **shared with me**: it shows tasks in your projects that are not assigned to you, and
   they are visually distinguishable from your own (FR-035a).

### V5 — Subtasks, attachments, comments (US5, P5)

1. Add two subtasks, complete one → state persists.
2. Upload an attachment, download it back → bytes match.
3. Request that attachment as a user outside the project → `404`.
4. Post two comments → both shown with author and time, in order.
5. Delete the parent task → subtasks, attachments, and comments all gone; no orphan is
   reachable (SC-011).

### V6 — Dashboard (US6, P6)

Against the demo dataset, compare every figure from `GET /api/dashboard` with the equivalent
SQL count run directly in SQL*Plus.

**Expected**: all nine figures match exactly — SC-005 requires 100%. Then log in as a Member
who belongs to one project only and confirm every figure shrinks to that project's data
(FR-045). A dashboard figure that counts a task the user cannot see is a defect.

### V7 — Search and filtering (US7, P7)

1. Apply each of the six filters individually → each narrows correctly.
2. Apply project + status + priority together → results satisfy all three (FR-052).
3. Search a partial title in the wrong case → still matches (FR-051).
4. Search for something that matches nothing → `200` with an empty array, not `404`.
5. As a non-member, filter by a project you do not belong to → empty, never a leak (FR-053).

### V8 — Notifications (US8, P8) **[CLARIFIED — optional in the official document]**

1. Assign a task to another user → they get one assignment notification.
2. Update that task → involved users get one update notification each, not one per assignee.
3. Comment on their task → they get one comment notification.
4. Set a task's due date to 24 hours away and run the scheduled job → assignees get one
   deadline notification; run the job again → **no second notification** (R-007 idempotence).
5. Set a due date in the past on an incomplete task, run the job twice → exactly one overdue
   notification.
6. Deactivate a user, trigger an event involving them → no notification is created (FR-061).

**Expected**: step 4 and 5 running twice without duplicating is the single most important
assertion in this scenario — it is what the uniqueness constraint exists for.

### V9 — Responsive interface (cross-cutting, US1–US8)

Load every screen at three widths — 360px, 768px, 1280px — and confirm: no horizontal page
scrolling, no clipped content, every action reachable (SC-010, Constitution VIII). Run this in
every cycle's Testing stage, not once at the end.

### V11 — Navigation (cross-cutting, hand-written router — R-013)

Because routing is hand-written rather than a library, these checks are not optional:

1. Navigate between all eleven screens by clicking → the URL changes and the page does **not**
   do a full reload.
2. Press browser **back**, then **forward** → the correct screen is restored each time.
3. Paste a deep link (e.g. `/projects/12`) into a fresh tab → that screen loads directly.
4. Deep-link to a screen your role may not use → redirected, never rendered.
5. Deep-link while logged out → redirected to login, and after logging in you land on the
   screen you originally asked for.
6. Reload on a deep link in the deployed build → still loads, proving the catch-all rewrite to
   `index.html` is configured (R-012).

**Expected**: all six pass. These are the exact failure modes R-013 accepted when dropping
React Router, so they are checked explicitly rather than assumed.

### V10 — Authorization sweep (cross-cutting)

For each role — Admin, Manager, Member — attempt every endpoint in
[`contracts/rest-api.md`](./contracts/rest-api.md) that the role should not reach.

**Expected**: 100% refused (SC-007). This is the highest-value test in the suite, because it is
the one whose failure is invisible in normal use. Record the full matrix in `docs/testing.md`.

## Running the tests

```bash
cd backend
./mvnw test                      # unit + integration + contract tests
./mvnw test -Dtest=*ContractTest # REST contract tests alone
```

Backend tests run against a real Oracle schema (R-011). Frontend validation is the documented
manual procedure above; there is no frontend test runner, which is a known limitation flagged
in `research.md` R-011.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| A query fails with `ORA-00904: invalid identifier` | The DDL and a repository's SQL disagree — fix whichever is wrong; the DDL is the source of truth (R-001) |
| Every request returns `401` after logging in | Session cookie blocked — check the dev proxy is forwarding cookies |
| Dashboard figures all zero | `PKG_DASHBOARD` not installed, or reference data not seeded |
| Status change returns `400` for a valid status | `TASK_STATUS` reference rows missing or misspelled |
| Attachment upload fails | `TMS_ATTACHMENT_DIR` unset or not writable |
| Deadline notifications never appear | Scheduled job disabled, or no task sits within the 24-hour window |
