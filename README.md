# Task Management System

A full-stack Task Management System for teams and departments, built as a training project
for the Computer Center.

> **Repository status: planning, scaffolding, and environment setup.**
> The specification, plan, and task breakdown are complete, and initial project scaffolding
> and environment setup have been carried out. **Full feature implementation has not started**
> and is intentionally paused for instructor review.
> See [Current Repository Status](#15-current-repository-status).

---

## 1. Project Overview

The system helps teams and departments manage **projects, tasks, assignments, deadlines, and
progress** in one place. Managers create projects and assign members; team members are given
tasks with priorities and due dates, move them through a fixed workflow, and collaborate on
them through subtasks, attachments, and comments. Dashboards report how much work exists, how
much is done, what is late, and how it is distributed across statuses, priorities, and people.

It is designed so that it can be extended and used as the foundation for a real Task
Management solution within the Computer Center.

## 2. Project Objectives

- Provide a complete solution for managing projects and tasks across teams and departments.
- Assign work to one or more people and track who is responsible for what.
- Monitor deadlines and surface work that is approaching its due date or already overdue.
- Track progress through a single, consistent task workflow.
- Control access through authentication and role-based permissions.
- Deliver a responsive web interface backed by a RESTful API over a relational Oracle database.
- Practise a full development lifecycle end to end: requirements, analysis, database design,
  UI design, development, API integration, testing, code review, deployment, documentation.

## 3. Required Functional Scope

| Area | Summary |
|------|---------|
| **User Management** | Registration and login, user profiles, roles and permissions, user activation and deactivation. |
| **Project Management** | Create and manage projects; assign project members; project description and information; project status; start and end dates. |
| **Task Management** | Create, edit, and delete tasks; assign to one or more users; priority; status; start and due dates; description; subtasks; attachments; comments. |
| **Task Workflow** | The fixed progression **To Do → In Progress → Review → Completed**. |
| **Task Sharing** | View tasks assigned to you, view tasks shared with you, assign tasks to team members according to your permissions, track progress, update status. |
| **Dashboard & Reporting** | Total projects, total tasks, completed, pending, overdue, tasks by status, tasks by priority, tasks per user, and project progress. |
| **Search & Filtering** | Search and filter tasks by project, user, status, priority, due date, and task title. |
| **Notifications** | New task assignments, task updates, approaching deadlines, overdue tasks, and comments or mentions. *(Optional in the official requirements; this project has committed to delivering all five triggers in-app — see [Clarified Project Decisions](#7-clarified-project-decisions).)* |

## 4. Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- React
- Responsive Web Design
- REST API Integration

### Backend

- Java 21
- Spring Boot / Spring MVC
- RESTful APIs
- Authentication and Authorization
- **JDBC / `JdbcTemplate`** as the data-access approach — SQL and PL/SQL are written by hand.
  No ORM is used.

### Database

- Oracle Database
- SQL
- PL/SQL

### Development and Deployment

- Git and GitHub
- Testing and debugging
- Docker basics — **deployment only**. No application code depends on Docker; the system
  builds, runs, and is tested identically with or without it.

### Supporting Build Tools

These are **implementation tools chosen by the project**, not instructor-mandated technologies:

- **Maven** — build and dependency management for the Java backend.
- **Vite** — frontend build step only. It ships no runtime code; the deployed frontend is plain
  HTML, CSS, and JavaScript.

> **Deliberately not used**: no ORM (JPA/Hibernate), no router library, no UI component library,
> no CSS framework, no HTTP client library, no state-management library, no token library, and
> no API-documentation generator. Each exclusion is recorded with its rationale in
> [`research.md`](specs/001-task-management-system/research.md).

## 5. Spec-Driven Development Workflow

This project was planned using a spec-driven workflow. Each stage produced a durable artifact
that the next stage builds on.

| Stage | Produced | What it established |
|-------|----------|---------------------|
| **Constitution** | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Eight binding principles — scope fidelity, the fixed technology stack, the REST layer boundary, relational data design, authentication and authorization, task-status integrity, the code-review and testing gates, and the responsive interface. Currently at **v2.1.0**. |
| **Specify** | [`spec.md`](specs/001-task-management-system/spec.md) | 8 prioritized user stories, 65 functional requirements, 13 success criteria, 12 key entities, and the edge cases. Written without naming any technology. |
| **Clarify** | `spec.md` § Clarifications | Resolved the four questions the official document left open, each recorded as a project decision rather than an official requirement. |
| **Plan** | [`plan.md`](specs/001-task-management-system/plan.md), [`research.md`](specs/001-task-management-system/research.md), [`data-model.md`](specs/001-task-management-system/data-model.md), [`contracts/rest-api.md`](specs/001-task-management-system/contracts/rest-api.md), [`quickstart.md`](specs/001-task-management-system/quickstart.md) | Technical approach, 15 technical decisions with rejected alternatives, the ERD and validation rules, the full REST contract, and the run-and-validate guide. |
| **Tasks** | [`tasks.md`](specs/001-task-management-system/tasks.md) | 159 implementation tasks across 13 phases, each traceable to the requirements it satisfies. |
| **Analyze** | — | Two cross-artifact consistency passes covering coverage gaps, duplication, ambiguity, constitution alignment, and terminology drift. All findings resolved. |

## 6. Development Methodology

An Agile/Scrum-inspired approach. The project is divided into small features and tasks, and
every development cycle follows the official ordering:

```text
Planning → Development → Code Review → Testing → Demo → Feedback
```

Note that **testing follows development** — this is the official cycle ordering and is applied
consistently across all eight user-story phases in `tasks.md`.

The project as a whole follows the official lifecycle:

```text
Requirements → Analysis → Database Design → UI Design → Development →
API Integration → Testing → Code Review → Deployment → Documentation
```

Git and GitHub are used for source-code management and team collaboration. Branching, commit
format, and pull-request review requirements are documented in
[`docs/git-workflow.md`](docs/git-workflow.md).

## 7. Clarified Project Decisions

The following are **project decisions**, not official requirements. Each was taken because the
official project document does not contain enough information to make a requirement
implementable and testable. They are recorded as decisions everywhere they appear.

| # | Decision | Why it was needed |
|---|----------|-------------------|
| 1 | **Roles: Admin, Manager, Member.** Admin manages users, roles, and activation. Manager creates and manages projects, assigns members, and assigns tasks within their projects. Member works on assigned tasks, updates their status, and adds comments, subtasks, and attachments. | The official document requires "roles and permissions" but names no role and defines no permission. |
| 2 | **Shared task definition.** A task is *shared with* a user when that user is a member of the task's project but is **not** one of its assignees. Sharing is derived from project membership; there is no separate share action. | The official document lists "tasks assigned to them" and "tasks shared with them" as separate capabilities without defining sharing. |
| 3 | **In-app notifications, all five official triggers.** New assignment, task update, approaching deadline, overdue task, and comment or mention — delivered inside the application. | The official document says the system *may* provide notifications; the project committed to building them. |
| 4 | **Approaching deadline = 24 hours** before the due date. A single fixed threshold, not configurable. | The official document requires notifying users of an "approaching" deadline without quantifying it. |
| 5 | **Free movement among the four official statuses.** Any transition between To Do, In Progress, Review, and Completed is permitted; only values outside the four are rejected. | The official document specifies the four statuses and their progression but states no forward-only restriction, so none is invented. |
| 6 | **Last-write-wins for concurrent updates.** No version column, no optimistic locking, no conflict response. If two users edit the same task simultaneously, the later save overwrites the earlier one. | The official document does not address concurrent editing. Conflict detection would be unrequested scope. |
| 7 | **A parent task may be Completed with incomplete subtasks.** No warning, no block. | The official document defines no relationship between subtask completion and parent status. |
| 8 | **Removing a project member removes that user's task assignments within that project**, returning a summary of what was removed. | A task must not remain assigned to someone who can no longer see its project. |

## 8. Task Workflow

```text
To Do  →  In Progress  →  Review  →  Completed
```

These four statuses are fixed by the official requirements. No fifth status exists anywhere in
the specification, the database schema, the API, or the planned interface. Status changes are
applied through the backend so that progress is reflected consistently in dashboards,
filtering, and notifications.

## 9. Database Design

The database is designed up front, with entities and their relationships identified before any
persistence code is written. Twelve entities are modelled:

| Entity | Purpose |
|--------|---------|
| `ROLES` | The three roles and their permissions. |
| `USERS` | Identity, credentials, profile, active/inactive state, role. |
| `PROJECTS` | Name, description, status, start and end dates. |
| `PROJECT_MEMBERS` | Join table — users ↔ projects (many-to-many). |
| `TASK_STATUS` | Reference table, exactly four rows in workflow order. |
| `TASK_PRIORITY` | Reference table of priority values. |
| `TASKS` | Title, description, status, priority, start and due dates. |
| `TASK_ASSIGNEES` | Join table — tasks ↔ users (many-to-many). |
| `SUBTASKS` | Breakdown of a parent task, with its own completion state. |
| `COMMENTS` | Discussion on a task, with author and timestamp. |
| `ATTACHMENTS` | Files stored against a task. |
| `NOTIFICATIONS` | Messages raised for a user, with trigger type and read state. |

The two many-to-many relationships are modelled with explicit join tables, so a task can be
assigned to several users and a project can have several members.

📄 **Full ERD, field-level detail, validation rules, state transitions, and indexes**:
[`specs/001-task-management-system/data-model.md`](specs/001-task-management-system/data-model.md)

## 10. Repository Structure

```text
├── backend/     Java 21 + Spring Boot REST API. Source, configuration, and tests.
├── frontend/    React single-page application. Components, pages, styles, API modules.
├── database/    Hand-written SQL DDL, PL/SQL packages, seed data, and ERD source.
│                The schema's single source of truth — nothing generates it.
├── docs/        Project deliverables: API documentation, ERD, testing documentation,
│                deployment guide, final report, and the Git/GitHub workflow.
├── specs/       Spec-driven artifacts for each feature: specification, plan, research
│                decisions, data model, REST contract, quickstart, and task breakdown.
└── .specify/    Spec Kit tooling — the project constitution, templates, and scripts.
```

## 11. Planning Status

| Item | Status |
|------|--------|
| Specification and planning | ✅ Complete |
| Requirements coverage | ✅ **100% (78/78)** — 65 functional requirements + 13 success criteria |
| Implementation tasks defined | ✅ **159 tasks** across 13 phases |
| Cross-artifact analysis | ✅ **No outstanding findings** — zero CRITICAL, HIGH, MEDIUM, or LOW |
| Repository and environment setup | 🔄 **In progress** |
| Initial scaffolding (project skeletons, build config) | ✅ Complete |
| Full feature implementation | ⬜ **Not started** — intentionally paused for instructor review |

## 12. Local Development Environment

The following are installed and verified on the development machine:

| Component | Version | Purpose |
|-----------|---------|---------|
| **JDK 21** (Eclipse Temurin) | 21.0.12.1 LTS | Backend runtime and compiler |
| **Apache Maven** | 3.9.16 | Backend build and dependency management |
| **Oracle Database Free** | 23ai — service running | Application database |
| **SQL\*Plus** | 23.26.3.0.0 | Running DDL, PL/SQL packages, and seed scripts |
| **Node.js / npm** | v24.13.0 / 11.6.2 | Frontend build toolchain (Vite) |
| **Git** | 2.51.0 | Source-code management |

Docker is **not** required at this stage. It is needed only for the deployment phase.

Configuration is supplied through environment variables; no credential is committed. See
[`.env.example`](.env.example) for the required keys and
[`quickstart.md`](specs/001-task-management-system/quickstart.md) for setup and validation steps.

## 13. Documentation

| Document | Contents |
|----------|----------|
| [Constitution](.specify/memory/constitution.md) | The eight governing principles and the amendment process. |
| [Specification](specs/001-task-management-system/spec.md) | User stories, functional requirements, success criteria, edge cases, and the clarified decisions. |
| [Implementation Plan](specs/001-task-management-system/plan.md) | Technical context, constitution check, project structure, lifecycle mapping, screen inventory, and delivery order. |
| [Research Decisions](specs/001-task-management-system/research.md) | 15 technical decisions, each with its rationale and the alternatives rejected. |
| [Data Model & ERD](specs/001-task-management-system/data-model.md) | Entities, relationships, validation rules, state transitions, and indexes. |
| [REST API Contract](specs/001-task-management-system/contracts/rest-api.md) | Every endpoint with its access rule, payloads, status codes, and the requirement it serves. |
| [Quickstart & Validation](specs/001-task-management-system/quickstart.md) | How to run the system from a clean checkout and the validation scenarios per user story. |
| [Task Breakdown](specs/001-task-management-system/tasks.md) | All 159 tasks, phased, dependency-ordered, and traceable to requirements. |
| [Requirements Checklist](specs/001-task-management-system/checklists/requirements.md) | Specification quality validation and its results. |
| [Git & GitHub Workflow](docs/git-workflow.md) | Branching, commit format, and pull-request review requirements. |

## 14. Planned Deliverables

The completed project is required to include: a fully functional Task Management System; a
responsive web interface; a RESTful backend API; the Oracle database; authentication and
authorization; user and project management; task assignment and tracking; dashboard and
reporting; search and filtering; testing documentation; database design / ERD; API
documentation; source code on GitHub; deployment on the designated server; and a final project
presentation.

## 15. Current Repository Status

**This repository is in the planning, scaffolding, and environment-setup stage. Full feature
implementation has not started and is intentionally paused for instructor review.**

The task runner was invoked once and completed only the initial setup and scaffolding tasks
(9 of 159) before being stopped deliberately. **No functional user, project, or task management
feature has been implemented.**

What exists today:

- The complete specification, plan, and 159-task breakdown, all cross-checked for consistency.
- Project skeletons: `backend/pom.xml`, the frontend Vite/React scaffold, and the directory
  structure for the database and documentation. These are **setup, build, and configuration
  skeletons only** — they contain no implemented application features.
- Environment configuration templates and the documented Git/GitHub workflow.
- A verified local development environment (Section 12).

What does **not** exist yet:

- No implemented backend features — no entities, repositories, services, or controllers. The
  only backend files present are the Maven build file and the application configuration.
- No implemented frontend features — no components, pages, or screens. The only frontend files
  present are the Vite build configuration, `package.json`, and the HTML entry point.
- No database schema installed — the DDL and PL/SQL scripts have not yet been written or run.
- No tests, no deployment, and none of the documentation deliverables in `docs/` beyond the
  Git workflow.

Nothing in this repository should be read as a claim that any feature is working. Feature
implementation begins at Phase 2 of [`tasks.md`](specs/001-task-management-system/tasks.md)
when work resumes after review.
