# REST API Contract: Task Management System

**Feature**: `001-task-management-system` | **Date**: 2026-09-21 | **Plan**: [plan.md](./plan.md)

This is the contract between the React frontend and the Spring Boot backend. Constitution
Principle III makes it the **only** boundary between them: the frontend never reaches the
database, and every backend capability the frontend uses appears here. This file is the source
for required deliverable 12 (API documentation, published as `docs/api.md`).

## Conventions

- **Base path**: `/api`
- **Format**: JSON request and response bodies; `UTF-8`; `Content-Type: application/json`
  (except attachment upload, which is `multipart/form-data`, and download, which returns the
  file).
- **Authentication**: session cookie (`JSESSIONID`), established by `POST /api/auth/login`
  (R-002). Every endpoint except `POST /api/auth/register` and `POST /api/auth/login` requires
  an authenticated, **active** user.
- **Authorization**: enforced server-side on every endpoint (FR-005, Constitution V). The
  **Access** column states the rule. "Member of project" means a row in PROJECT_MEMBERS;
  "Assignee" means a row in TASK_ASSIGNEES. Admin may do anything an endpoint permits.
- **Dates**: `YYYY-MM-DD`. **Timestamps**: ISO-8601 local, `YYYY-MM-DDTHH:mm:ss`.
- **Paging**: list endpoints accept `page` (0-based, default 0) and `size` (default 20, max
  100), and return `{ content: [...], page, size, totalElements, totalPages }`.
- **Visibility**: every endpoint returning tasks applies the visibility predicate from R-004 —
  a user sees a task only if they are a member of its project. This is not optional per
  endpoint; it is a single shared predicate (FR-053, FR-045).

### Status codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created — `Location` header set |
| 204 | No content (successful delete or status change with no body) |
| 400 | Validation failure |
| 401 | Not authenticated, or the account has been deactivated |
| 403 | Authenticated but not permitted (FR-005, SC-007) |
| 404 | Not found, **or** found but not visible to this user |
| 409 | Conflict — duplicate username or email |

**404 vs 403**: a task the user may not see returns **404**, not 403, so that the existence of
invisible tasks is not disclosed (FR-053).

**Concurrency**: concurrent updates to the same resource are **last-write-wins**. The API does
not detect, report, or prevent a concurrent modification, and `409` is never returned for one.
*(Project decision, not an official requirement — the official document does not address
concurrent editing. There is no version field, ETag, or `If-Match` header anywhere in this
contract.)*

### Error body

All non-2xx responses share one shape:

```json
{
  "timestamp": "2026-09-21T14:32:10",
  "status": 400,
  "error": "Validation failed",
  "message": "Due date must not be earlier than start date",
  "path": "/api/tasks",
  "fieldErrors": { "dueDate": "must not be earlier than start date" }
}
```

`fieldErrors` is present only for 400.

---

## Authentication — `/api/auth`

| Method | Path | Purpose | Access | Requirement |
|--------|------|---------|--------|-------------|
| POST | `/api/auth/register` | Register an account | Public | FR-001 |
| POST | `/api/auth/login` | Authenticate, establish session | Public | FR-002 |
| POST | `/api/auth/logout` | End session | Authenticated | FR-002 |
| GET | `/api/auth/me` | Current user, role, permissions | Authenticated | FR-003 |

**`POST /api/auth/register`** → `201`

```json
{ "username": "a.hassan", "email": "a.hassan@example.org",
  "password": "••••••••", "fullName": "A. Hassan" }
```

Returns the created user without `password`. `409` if username or email is taken. New accounts
receive the `MEMBER` role and `isActive: true` **[CLARIFIED, FR-008]**.

**`POST /api/auth/login`** → `200` with the user body and a `Set-Cookie` session header.
`401` on bad credentials **and** on a deactivated account, with the same message either way
(US1 scenario 2: never reveal which credential was wrong; FR-007).

---

## Users — `/api/users`

| Method | Path | Purpose | Access | Requirement |
|--------|------|---------|--------|-------------|
| GET | `/api/users` | List users (paged, `?search=`) | Authenticated | FR-047, FR-014 |
| GET | `/api/users/{id}` | One user's profile | Authenticated | FR-003 |
| PUT | `/api/users/me` | Update own profile | Self | FR-003 |
| PUT | `/api/users/{id}/role` | Assign a role | **Admin** | FR-004, FR-008a |
| PUT | `/api/users/{id}/activate` | Activate | **Admin** | FR-006 |
| PUT | `/api/users/{id}/deactivate` | Deactivate | **Admin** | FR-006, FR-007 |

`PUT /api/users/{id}/role` body: `{ "role": "ADMIN" | "MANAGER" | "MEMBER" }` — the three
**[CLARIFIED]** roles; any other value is `400`.

Deactivation invalidates the user's active sessions immediately, so their next request returns
`401` (FR-007, SC-008). A user may not deactivate themselves → `400`.

---

## Projects — `/api/projects`

| Method | Path | Purpose | Access | Requirement |
|--------|------|---------|--------|-------------|
| GET | `/api/projects` | Projects visible to me (paged) | Authenticated | FR-015 |
| POST | `/api/projects` | Create | **Manager, Admin** | FR-009, FR-008b |
| GET | `/api/projects/{id}` | Detail with members | Member of project | FR-011 |
| PUT | `/api/projects/{id}` | Update name, description, status, dates | **Manager** of project, Admin | FR-010–FR-013 |
| DELETE | `/api/projects/{id}` | Delete | **Manager** of project, Admin | FR-010 |
| GET | `/api/projects/{id}/members` | List members | Member of project | FR-014 |
| POST | `/api/projects/{id}/members` | Add member | **Manager** of project, Admin | FR-014 |
| DELETE | `/api/projects/{id}/members/{userId}` | Remove member | **Manager** of project, Admin | FR-014 |
| GET | `/api/projects/{id}/progress` | Progress for one project | Member of project | FR-044 |

**`POST /api/projects`** → `201`

```json
{ "name": "Payroll Migration", "description": "…",
  "status": "ACTIVE", "startDate": "2026-10-01", "endDate": "2026-12-15" }
```

`400` if `endDate < startDate` (US2 scenario 5).

Removing a member also removes their task assignments within that project and returns a
summary of what was unassigned — the edge case recorded in `spec.md` (a task must not stay
assigned to someone who can no longer see its project).

---

## Tasks — `/api/tasks`

| Method | Path | Purpose | Access | Requirement |
|--------|------|---------|--------|-------------|
| GET | `/api/tasks` | **Search and filter** (paged) | Authenticated | FR-046–FR-053 |
| POST | `/api/tasks` | Create | Member of project | FR-016 |
| GET | `/api/tasks/{id}` | Detail | Member of project | FR-017 |
| PUT | `/api/tasks/{id}` | Update title, description, priority, dates | Member of project | FR-017 |
| DELETE | `/api/tasks/{id}` | Delete | **Manager** of project, Admin, creator | FR-018 |
| PATCH | `/api/tasks/{id}/status` | Change status | Assignee, Manager of project, Admin | FR-021, FR-027–FR-029, FR-034 |
| GET | `/api/tasks/assigned-to-me` | My assigned tasks | Authenticated | FR-030 |
| GET | `/api/tasks/shared-with-me` | Tasks in my projects, not assigned to me | Authenticated | FR-031 **[CLARIFIED]** |
| POST | `/api/tasks/{id}/assignees` | Assign user(s) | **Manager** of project, Admin | FR-019, FR-032 |
| DELETE | `/api/tasks/{id}/assignees/{userId}` | Unassign | **Manager** of project, Admin | FR-019 |

### `GET /api/tasks` — the single search-and-filter endpoint

All parameters optional; all combined with **AND** (FR-052). One endpoint, one code path, one
visibility check (R-009).

| Parameter | Type | Requirement |
|-----------|------|-------------|
| `projectId` | number | FR-046 |
| `userId` | number — assigned to this user | FR-047 |
| `status` | `TO_DO`\|`IN_PROGRESS`\|`REVIEW`\|`COMPLETED` | FR-048 |
| `priority` | `LOW`\|`MEDIUM`\|`HIGH` | FR-049 |
| `dueDateFrom`, `dueDateTo` | date | FR-050 |
| `title` | string, case-insensitive substring | FR-051 |
| `overdue` | boolean | FR-040 |
| `page`, `size`, `sort` | paging | — |

An unmatched search returns `200` with an empty `content` array — never `404` (spec Edge Cases).

### `PATCH /api/tasks/{id}/status`

```json
{ "status": "IN_PROGRESS" }
```

→ `204`. Any value outside the four official statuses → `400` (FR-027, Constitution VI). This
is the **only** endpoint that changes status; `PUT /api/tasks/{id}` rejects a status field
(R-005).

### `POST /api/tasks` → `201`

```json
{ "projectId": 12, "title": "Migrate payroll tables",
  "description": "…", "priority": "HIGH",
  "startDate": "2026-10-01", "dueDate": "2026-10-15",
  "assigneeIds": [3, 7] }
```

Created with status `TO_DO` (US3 scenario 1). `400` if `dueDate < startDate`. `403` if the
caller may not assign to others but supplied `assigneeIds` (FR-032, FR-008c).

---

## Subtasks, comments, attachments — nested under a task

| Method | Path | Access | Requirement |
|--------|------|--------|-------------|
| GET | `/api/tasks/{id}/subtasks` | Member of project | FR-024 |
| POST | `/api/tasks/{id}/subtasks` | Member of project | FR-024 |
| PUT | `/api/subtasks/{subtaskId}` | Member of project | FR-024 |
| DELETE | `/api/subtasks/{subtaskId}` | Member of project | FR-024 |
| GET | `/api/tasks/{id}/comments` | Member of project | FR-026 |
| POST | `/api/tasks/{id}/comments` | Member of project | FR-026 |
| GET | `/api/tasks/{id}/attachments` | Member of project | FR-025 |
| POST | `/api/tasks/{id}/attachments` | Member of project | FR-025 |
| GET | `/api/attachments/{attachmentId}` | Member of task's project | FR-025 |
| DELETE | `/api/attachments/{attachmentId}` | Uploader, Manager of project, Admin | FR-025 |

`POST /api/tasks/{id}/attachments` is `multipart/form-data` with one `file` part. `413` if the
file exceeds the configured limit; `415` for a disallowed type. No attachment row is written
unless the file stored successfully (spec Edge Cases).

`GET /api/attachments/{attachmentId}` streams the file through the backend after the same
visibility check as its task — never a direct storage URL (Constitution III, R-008).

---

## Dashboard — `/api/dashboard`

One endpoint returning all nine officially required figures in a single response, computed by
`PKG_DASHBOARD` (R-006) and scoped to what the caller may see (FR-045).

**`GET /api/dashboard`** → `200`

```json
{
  "totalProjects": 7,
  "totalTasks": 214,
  "completedTasks": 96,
  "pendingTasks": 118,
  "overdueTasks": 12,
  "tasksByStatus":   { "TO_DO": 54, "IN_PROGRESS": 41, "REVIEW": 23, "COMPLETED": 96 },
  "tasksByPriority": { "LOW": 62, "MEDIUM": 101, "HIGH": 51 },
  "tasksByUser":     [ { "userId": 3, "fullName": "A. Hassan", "taskCount": 18 } ],
  "projectProgress": [ { "projectId": 12, "name": "Payroll Migration",
                         "totalTasks": 40, "completedTasks": 22, "percentComplete": 55 } ]
}
```

| Field | Requirement |
|-------|-------------|
| `totalProjects` | FR-036 |
| `totalTasks` | FR-037 |
| `completedTasks` | FR-038 |
| `pendingTasks` | FR-039 — every task not `COMPLETED` |
| `overdueTasks` | FR-040 — past due and not `COMPLETED` |
| `tasksByStatus` | FR-041 |
| `tasksByPriority` | FR-042 |
| `tasksByUser` | FR-043 |
| `projectProgress` | FR-044 — completed ÷ total |

Figures are computed per request and never cached (FR-045, R-006).

---

## Notifications — `/api/notifications` **[CLARIFIED]**

This whole section exists because the project chose to build notifications; the official
document marks them optional. If cut, these four endpoints and the frontend's notification
screen disappear, and no other endpoint changes.

| Method | Path | Purpose | Access | Requirement |
|--------|------|---------|--------|-------------|
| GET | `/api/notifications` | My notifications (paged, `?unreadOnly=`) | Self only | FR-054–FR-059 |
| GET | `/api/notifications/unread-count` | Unread badge count | Self only | FR-060, SC-013 |
| PUT | `/api/notifications/{id}/read` | Mark one read | Recipient only | FR-060 |
| PUT | `/api/notifications/read-all` | Mark all read | Self only | FR-060 |

A notification body carries `triggerType` (one of the five official triggers), `message`,
`taskId`, `createdAt`, `isRead`. A user can read only their own notifications — requesting
another user's returns `404` (FR-061).

---

## Coverage check

Every functional requirement that needs a network call has an endpoint:

| Area | Requirements | Endpoints |
|------|--------------|-----------|
| User management | FR-001 – FR-008c | `/api/auth/*`, `/api/users/*` |
| Project management | FR-009 – FR-015 | `/api/projects/*` |
| Task management | FR-016 – FR-026 | `/api/tasks/*`, `/api/subtasks/*`, `/api/attachments/*` |
| Status workflow | FR-027 – FR-029 | `PATCH /api/tasks/{id}/status` |
| Task sharing | FR-030 – FR-035a | `/api/tasks/assigned-to-me`, `/api/tasks/shared-with-me`, `/api/tasks/{id}/assignees` |
| Dashboard | FR-036 – FR-045 | `GET /api/dashboard`, `GET /api/projects/{id}/progress` |
| Search & filtering | FR-046 – FR-053 | `GET /api/tasks` |
| Notifications | FR-054 – FR-061 | `/api/notifications/*` |

No endpoint exists that does not serve a listed requirement (Constitution Principle I).
