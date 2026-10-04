# testing

> Placeholder created by T007. The full testing documentation is written in Phase 13 (T154).

## Backend test run (T146)

**Date**: 2026-10-04 | **Command**: `python -m pytest` in `backend/` | **Database**: the real Oracle
schema (Oracle Database Free 23ai) with the demo seed data and both PL/SQL package bodies installed.

| Result | Count |
|--------|-------|
| Passed | 68 |
| Failed | 0 |
| Skipped / disabled | 0 |

Composition: 14 unit tests that need no database (`tests/test_unit.py`) and 54 integration and
contract tests that drive the HTTP API against Oracle (`tests/test_auth_users.py`,
`test_projects.py`, `test_tasks.py`, `test_task_detail.py`, `test_dashboard_notifications.py`).
Integration tests create only `ZZTEST`-prefixed rows and remove them afterwards; the scheduler
idempotence test removes the notifications it causes. The suite was run three times with the same
result.

Not yet recorded here: quickstart scenarios V1 to V11, the authorization matrix (T141), the
search performance test against 10,000 tasks (T125), the responsive checks, and the demos.

## Frontend verification run (final)

**Date**: 2026-10-04 | **Build**: `npm run build` succeeds with no errors | **Backend suite**: 68 passed, 0 failed
(re-run after the frontend fixes below).

Driven in a real browser (Microsoft Edge, headless, Playwright, with the scripts kept outside the
repository) against the live FastAPI backend (port 8080) and the Vite dev server, signed in as Admin
(`admin@example.org`), Manager (`m.saleh@example.org`), Member (`a.hassan@example.org`) and other demo
accounts. Database-side assertions (notification counts, orphan rows, dashboard figures) were read
directly from Oracle. Every row the run created was `ZZTEST`-prefixed and removed afterwards; the demo
data is unchanged (7 users, 3 projects, 40 tasks, 5 comments, 10 subtasks, 10 scheduler notifications).

| Suite | Result |
|-------|--------|
| Quickstart V1 to V8, plus editing a project and a task through the forms | 42 of 43 checks passed in the full run; the one miss (V5.4) was a read that raced a list reload in the script, and it passed, with its API check, when re-run in isolation (2 of 2) |
| V6 (dashboard), V7 (search and filters), V9 (responsive), V11 (navigation), query strings | 39 of 39 checks passed |
| V10 authorization sweep over the live API | 128 of 128 refusals matched exactly |

### Defects found by this run and fixed

1. **Sidebar links did a full page reload** (V11.1). `AppLayout` passes `onClick` to `Link`, and `Link`
   spread it after its own handler, replacing the single-page navigation. `Link` now runs a caller's
   `onClick` first and still navigates in place. Earlier runs missed it because they navigated with
   `pushState`, not by clicking.
2. **Saving the profile lost its confirmation.** `refresh()` set the session to `loading`, which
   unmounted the Profile screen behind the route guard, so "Profile updated." never showed. `refresh`
   now takes `{ silent: true }`, used by Profile.

Test-script issues (not product defects) were also corrected: an ambiguous password placeholder on the
Register screen, a locator matching both "Tasks" and "My Tasks", paged lists checked on page one only,
and one read that raced a list reload (V5.4 was re-run in isolation and passes).

### Quickstart scenario results

| Scenario | Result | Evidence |
|----------|--------|----------|
| **V1** secure access and user administration | Pass (8 of 8) | Registration through the form creates an active MEMBER; wrong password and unknown account return the same 401 message; profile edit persists after reload; Admin changes the role to MANAGER and the user's "New project" button appears on their next request; deactivation makes the user's existing session 401 on the next request and bounces them to login, and a fresh login fails; reactivation restores login |
| **V2** projects and membership | Pass | Project created with dates; end before start rejected with a clear message; two members plus a third test user added through the picker; members see the project, a non-member does not; removing a member who held an assignment unassigns them in that project and names the task |
| **V3** tasks | Pass | Created with title, description, priority and dates, status To Do; due before start rejected; two assignees both see it under Assigned to me; a Member gets no assignee picker and the API answers 403; edited through the form and persisted; delete removes it from lists, filters, the dashboard count (31 to 30) and every nested resource |
| **V4** workflow | Pass | To Do, In Progress, Review, Completed (and back) each succeed and the project manager sees each change; status `ARCHIVED` is 400; a task outside your projects is 404 not 403; Shared with me shows only unassigned project tasks, every row badged, never in Assigned |
| **V5** subtasks, attachments, comments | Pass | Two subtasks, one completed, persists; attachment upload then download returns identical bytes; a user outside the project gets 404; two comments listed oldest first with author and time; deleting the parent leaves no row in subtasks, comments, attachments, assignees or notifications |
| **V6** dashboard | Pass | For Admin, a member of one project and a member of two projects, all five totals and the status and priority breakdowns match direct SQL, both in the API and in the on-screen tiles; the one-project member's figures shrink to that project |
| **V7** search and filtering | Pass | Each filter alone (project, assignee, status, priority, due range, title in the wrong case, overdue) shows exactly the expected count, and every visible row satisfies it; combined filters narrow correctly; a search matching nothing shows a message and the API returns 200 with an empty list; a non-member filtering by a foreign project gets nothing |
| **V8** notifications | Pass | Assignment: one per assignee; update: one per involved user, none to the editor; comment: one per assignee, and a mentioned user gets one not two; due in 24 hours: one DEADLINE and none on a second job run; overdue: one OVERDUE after two runs; an event involving a deactivated user creates no notification for them while an active assignee still gets one |
| **V9** responsive | Pass | 360, 768 and 1280 px: no horizontal page scroll on Login, Register, Forgot Password, Dashboard, Projects, Project, Tasks, Task, My Tasks, Notifications, Profile, Users and the not-found page (17 or 18 screens and dialogs per width, including the New task and New project dialogs, whose submit buttons are reachable); mobile menu opens with its links |
| **V10** authorization sweep | Pass (128 of 128) | See the matrix below |
| **V11** navigation | **5 of 6 steps pass; step 6 not run** | Clicking through 9 screens never reloads the page; Back then Forward restores each screen; a deep link in a fresh tab loads; Member and Manager deep links to `/users` show the permission message; a logged-out deep link goes to login and, after login, lands on the original screen; Login, Register and Forgot Password navigate in place. **Step 6 (reload on a deep link in the deployed build) cannot be verified yet**: deployment has not started and the backend does not yet serve the built frontend. Reload on a deep link does work on the Vite dev server |

Query-string navigation (part of V11): `/tasks?projectId=&status=` applies and survives a reload; the
top-bar search sets `/tasks?title=`; Back and Forward restore the previous and next search on the same
screen; the project's "All tasks" link pre-selects the project.

### Known limitations observed

- Changing a filter **dropdown** on the Tasks screen does not update the URL (only the top-bar search and
  incoming links do), so Back does not step through dropdown changes and a filter set from the dropdowns
  is lost on reload.
- At 360 px the data tables (Users, Tasks and others) scroll horizontally inside their own container, by
  the shared Table's design (SC-010). On the Users table the Role and Deactivate columns need that
  in-table scroll to be reached.
- After registering, the Register screen goes straight to Login with no confirmation message.
- Not yet done: the 10,000-task search performance test (T125), timing targets (T144), the first-time-user
  observation (T145), and the deployed-build reload check (V11 step 6).

### V10 authorization matrix

Every row is an endpoint and the exact HTTP status each kind of caller received. Only callers that
**should be refused** were exercised (successes are covered by the suites above). "Member outside the
project" and "manager outside the project" are a different project's users; a resource they may not see
is **404**, not 403, so its existence is not disclosed (FR-053).

| Endpoint | Status received, by caller |
|----------|----------------------------|
| `POST /api/auth/logout` | **401** not signed in |
| `GET /api/auth/me` | **401** not signed in |
| `GET /api/users` | **401** not signed in |
| `GET /api/users/{id}` | **401** not signed in |
| `GET /api/projects` | **401** not signed in |
| `GET /api/tasks` | **401** not signed in |
| `GET /api/tasks/assigned-to-me` | **401** not signed in |
| `GET /api/tasks/shared-with-me` | **401** not signed in |
| `GET /api/dashboard` | **401** not signed in |
| `GET /api/notifications` | **401** not signed in |
| `GET /api/notifications/unread-count` | **401** not signed in |
| `PUT /api/notifications/{id}/read` | **401** not signed in; **404** admin, manager, member outside the project |
| `PUT /api/notifications/read-all` | **401** not signed in |
| `PUT /api/users/me` | **401** not signed in |
| `PUT /api/users/{id}/role` | **401** not signed in; **403** manager, member of the project, member outside the project, member, not assignee/uploader |
| `PUT /api/users/{id}/activate` | **401** not signed in; **403** manager, member of the project, member outside the project, member, not assignee/uploader |
| `PUT /api/users/{id}/deactivate` | **401** not signed in; **403** manager, member of the project, member outside the project, member, not assignee/uploader |
| `POST /api/projects` | **401** not signed in; **403** member of the project, member outside the project |
| `GET /api/projects/{id}` | **401** not signed in; **404** manager outside the project, member outside the project |
| `GET /api/projects/{id}/members` | **401** not signed in; **404** manager outside the project, member outside the project |
| `GET /api/projects/{id}/progress` | **401** not signed in; **404** manager outside the project, member outside the project |
| `PUT /api/projects/{id}` | **401** not signed in; **403** member of the project, member, not assignee/uploader; **404** manager outside the project, member outside the project |
| `DELETE /api/projects/{id}` | **401** not signed in; **403** member of the project, member, not assignee/uploader; **404** manager outside the project, member outside the project |
| `POST /api/projects/{id}/members` | **401** not signed in; **403** member of the project, member, not assignee/uploader; **404** manager outside the project, member outside the project |
| `DELETE /api/projects/{id}/members/{id}` | **401** not signed in; **403** member of the project, member, not assignee/uploader; **404** manager outside the project, member outside the project |
| `GET /api/tasks/{id}` | **401** not signed in; **404** manager outside the project, member outside the project |
| `POST /api/tasks` | **401** not signed in; **403** member of the project; **404** manager outside the project, member outside the project |
| `PUT /api/tasks/{id}` | **401** not signed in; **404** manager outside the project, member outside the project |
| `PATCH /api/tasks/{id}/status` | **401** not signed in; **403** member, not assignee/uploader; **404** manager outside the project, member outside the project |
| `DELETE /api/tasks/{id}` | **401** not signed in; **403** member of the project, member, not assignee/uploader; **404** manager outside the project, member outside the project |
| `POST /api/tasks/{id}/assignees` | **401** not signed in; **403** member of the project, member, not assignee/uploader; **404** manager outside the project, member outside the project |
| `DELETE /api/tasks/{id}/assignees/{id}` | **401** not signed in; **403** member of the project, member, not assignee/uploader; **404** manager outside the project, member outside the project |
| `GET /api/tasks/{id}/subtasks` | **401** not signed in; **404** manager outside the project, member outside the project |
| `POST /api/tasks/{id}/subtasks` | **401** not signed in; **404** manager outside the project, member outside the project |
| `GET /api/tasks/{id}/comments` | **401** not signed in; **404** manager outside the project, member outside the project |
| `POST /api/tasks/{id}/comments` | **401** not signed in; **404** manager outside the project, member outside the project |
| `GET /api/tasks/{id}/attachments` | **401** not signed in; **404** manager outside the project, member outside the project |
| `PUT /api/subtasks/{id}` | **401** not signed in; **404** manager outside the project, member outside the project |
| `DELETE /api/subtasks/{id}` | **401** not signed in; **404** manager outside the project, member outside the project |
| `GET /api/attachments/{id}` | **401** not signed in; **404** manager outside the project, member outside the project |
| `POST /api/tasks/{id}/attachments` | **401** not signed in; **404** manager outside the project, member outside the project |
| `DELETE /api/attachments/{id}` | **401** not signed in; **403** member, not assignee/uploader; **404** manager outside the project, member outside the project |
