<!--
SYNC IMPACT REPORT
==================
Version change: 2.0.0 → 2.1.0
Rationale: MINOR. Governance synchronization only, resolving finding D1 of the
/speckit-analyze report of 2026-09-21. Principle II's technology list omitted Docker,
testing/debugging, and Responsive Web Design, all of which the official project
requirements document names. Governance requires that where this constitution conflicts
with the official document, the official document wins and this document be amended to
match. Existing guidance is expanded, none is removed or redefined, and no previously
compliant work becomes non-compliant — hence MINOR, not MAJOR.

Modified principles:
  - II. Fixed Technology Stack → unchanged in name and intent. Added to its prescribed
    list: Responsive Web Design (frontend), testing and debugging, and Docker basics
    (deployment only). Added a binding constraint that application code MUST NOT depend
    on Docker and that the system MUST build, run, and be tested identically without it.

Unchanged: Principles I, III, IV, V, VI, VII, VIII; Required Functional Scope;
Development Methodology and Lifecycle; Governance. No functional requirement, project
decision, role, workflow, notification decision, or implementation plan was touched.

Added sections: none
Removed sections: none

Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no change needed (Constitution Check gate is
    derived dynamically from this file)
  - .specify/templates/spec-template.md ✅ no change needed
  - .specify/templates/tasks-template.md ✅ RESOLVED — previously flagged ⚠ pending in
    v2.0.0 because the template orders tests before implementation while Principle VII
    requires Development → Code Review → Testing. The concern is closed: the delivered
    specs/001-task-management-system/tasks.md was generated to the official ordering, with
    every user story phase structured Development → Code Review → Testing → Demo, and
    states that departure explicitly. The template file itself is left untouched; the
    binding artifact is tasks.md, and Principle VII governs any future generation.
  - .specify/templates/checklist-template.md ✅ no change needed
  - .claude/skills/speckit-*/SKILL.md ✅ no outdated agent-specific references found

Downstream artifacts re-verified against this amendment (no edits required):
  - specs/001-task-management-system/plan.md — Constitution Check item 1 flagged exactly
    this gap; the flag is now satisfied. Docker confined to Phase 12.
  - specs/001-task-management-system/tasks.md — Docker appears only in T149 and T151, both
    in the Deployment phase; no application task depends on it.

Follow-up TODOs: none
-->

# Full Stack Task Management System Constitution

## Core Principles

### I. Scope Fidelity (NON-NEGOTIABLE)

The official project requirements document is the sole source of scope. Technologies,
features, architectural layers, and constraints that do not appear in that document MUST
NOT be introduced. Requirements stated as mandatory ("must", "should support", "the system
should provide") MUST be delivered; requirements stated as optional ("may provide") MAY be
delivered but MUST NOT displace mandatory work.

Rationale: This is a training project evaluated against a fixed specification. Additions
outside the document consume effort that the evaluation does not credit and risk leaving
required deliverables incomplete.

### II. Fixed Technology Stack

The stack is prescribed and MUST NOT be substituted or supplemented:

- **Frontend**: HTML5, CSS3, JavaScript, React, applying Responsive Web Design and consuming
  the backend via REST API integration.
- **Backend**: Java with Spring Boot / Spring MVC, exposing RESTful APIs, with
  authentication and authorization.
- **Database**: Oracle Database, using SQL and PL/SQL.
- **Source control**: Git, hosted on GitHub.
- **Testing and debugging**: part of the prescribed toolset, exercised through the Testing
  stage of every development cycle (Principle VII).
- **Deployment**: Docker basics, **for deployment only**.

No alternative framework, language, runtime, or database engine MAY be adopted for any
layer. Supporting libraries are permitted only where they serve a required functional area
and do not replace a prescribed technology.

**Docker is constrained to deployment.** Application code MUST NOT depend on Docker: the
system MUST build, run, and be tested identically whether or not Docker is present. Docker
MUST NOT appear as a runtime dependency, an import, a configuration requirement of the
application itself, or a precondition for any development or testing task. Its use is
confined to packaging and deploying the delivered artifact to the designated server.

Rationale: The stack is itself a learning objective of the project, not an implementation
detail left to the team. The Docker constraint exists because deployment tooling that leaks
into application code makes the system impossible to run, debug, or demonstrate without it —
which would obstruct the Demo stage every cycle depends on.

### III. REST API as the Layer Boundary

The React frontend and the Java backend communicate exclusively over RESTful HTTP APIs. The
frontend MUST NOT access the Oracle database directly. Every backend capability the
frontend depends on MUST be exposed as a documented REST endpoint, and API documentation is
a required deliverable that MUST be kept current with the implemented endpoints.

Rationale: The separation of a RESTful backend from a REST-consuming frontend is an
explicit requirement and the basis of the API documentation and API integration
deliverables.

### IV. Relational Data Design Integrity

The database MUST be designed up front, with entities and the relationships between them
identified and captured in an ERD, which is a required deliverable. The design covers the
entities the project identifies: USERS, ROLES, PROJECTS, PROJECT_MEMBERS, TASKS,
TASK_ASSIGNEES, TASK_STATUS, TASK_PRIORITY, SUBTASKS, COMMENTS, ATTACHMENTS, NOTIFICATIONS,
and ACTIVITY_LOG. Relationships that the functional requirements imply MUST be modeled
relationally rather than denormalized away — in particular, a task MUST be assignable to
one or more users, and a project MUST support multiple members.

Rationale: Database design and the identification of entity relationships are called out as
the students' own design responsibility and are directly assessed via the ERD deliverable.

### V. Authentication, Authorization, and Role-Based Access

Every user-facing capability MUST be behind authentication. Authorization MUST be enforced
on the backend according to the user's roles and permissions, not only hidden in the
frontend. Specifically:

- Users register, log in, and hold profiles.
- Roles and permissions govern what a user may do.
- Users MUST be able to be activated and deactivated; a deactivated user MUST NOT retain
  access.
- Task assignment to other team members MUST be permitted only where the acting user's
  permissions allow it.

Rationale: Authentication and authorization are both a required functional area and a
required final deliverable; frontend-only enforcement would satisfy neither.

### VI. Task Status Workflow Integrity

The task lifecycle MUST follow the prescribed workflow:

**To Do → In Progress → Review → Completed**

Status values outside this set MUST NOT be introduced. Status transitions MUST be applied
through the backend so that task progress can be tracked and reflected consistently in
dashboards, filtering, and notifications.

Rationale: The workflow is specified exactly; dashboards that report "tasks by status" and
"project progress" depend on a single consistent definition of status.

### VII. Code Review and Testing Gates

Each development cycle MUST follow the prescribed sequence:

**Planning → Development → Code Review → Testing → Demo → Feedback**

No feature is complete until it has passed code review and testing. Testing MUST be
documented, as testing documentation is a required deliverable. Code review MUST occur
through Git/GitHub collaboration on the shared repository.

Rationale: The cycle, code review, and testing documentation are explicit requirements;
skipping a stage forfeits a graded deliverable.

### VIII. Responsive Web Interface

The web interface MUST be responsive and usable across screen sizes, using responsive web
design as prescribed. Responsiveness is verified as part of the Testing stage, not deferred
to the end of the project.

Rationale: Responsive web design is named as a required technology and a responsive web
interface is a required final deliverable.

## Required Functional Scope

The system MUST deliver these functional areas. Items marked optional follow the official
document's own wording.

1. **User Management** — registration and login, user profiles, roles and permissions, user
   activation/deactivation.
2. **Project Management** — create and manage projects, assign project members, project
   description and information, project status, project start and end dates.
3. **Task Management** — create, edit, and delete tasks; assign tasks to one or more users;
   task priority; task status; start date and due date; task description; subtasks;
   attachments; comments.
4. **Task Status Workflow** — To Do → In Progress → Review → Completed.
5. **Task Sharing** — view assigned tasks, view tasks shared with them, assign tasks to
   other team members according to permissions, track task progress, update task status.
6. **Dashboard** — total projects, total tasks, completed tasks, pending tasks, overdue
   tasks, tasks by status, tasks by priority, tasks assigned to each user, project progress.
7. **Search and Filtering** — search and filter tasks by project, user, status, priority,
   due date, and task title.
8. **Notifications** (optional) — new task assignments, task updates, approaching
   deadlines, overdue tasks, comments and mentions.

Required final deliverables, all of which MUST be complete before the project is considered
done: a fully functional Task Management System; a responsive web interface; a RESTful
backend API; the Oracle database; authentication and authorization; user and project
management; task assignment and tracking; dashboard and reporting; search and filtering;
testing documentation; database design/ERD; API documentation; source code on GitHub;
deployment on the designated server; and the final project presentation.

The system MUST be designed so that it can be extended and used as a foundation for a real
Task Management solution within the Computer Center.

## Development Methodology and Lifecycle

The team follows an Agile/Scrum-inspired approach. The project MUST be divided into small
features and tasks, and each development cycle MUST follow:

**Planning → Development → Code Review → Testing → Demo → Feedback**

Git and GitHub MUST be used for source-code management and team collaboration.

The project as a whole follows this lifecycle, and phases MUST NOT be started before the
phases they depend on are complete:

**Requirements → Analysis → Database Design → UI Design → Development → API Integration →
Testing → Code Review → Deployment → Documentation**

In particular, database design precedes development, and UI design precedes development.

## Governance

This constitution supersedes all other practices, conventions, and defaults for this
project. Where this document conflicts with any other guidance, this document wins. Where
this document conflicts with the official project requirements document, the official
requirements document wins and this constitution MUST be amended to match.

**Amendment procedure**: Amendments are proposed as an explicit change to this file via
`/speckit-constitution`, MUST state the rationale and the impact on existing artifacts, and
MUST be accompanied by an updated Sync Impact Report. An amendment that adds scope MUST
cite the clause of the official requirements document that justifies it.

**Versioning policy** (semantic versioning of this document):

- **MAJOR**: a principle is removed or redefined in a backward-incompatible way, or
  governance rules change such that previously compliant work becomes non-compliant.
- **MINOR**: a new principle or mandatory section is added, or existing guidance is
  materially expanded.
- **PATCH**: clarification, wording, or typo fixes that do not change what is required.

**Compliance review**: Every plan MUST complete the Constitution Check gate before Phase 0
research and again after Phase 1 design. Code review MUST verify compliance with these
principles and MUST cite the principle by number when rejecting a change. Any deviation
MUST be recorded in the plan's Complexity Tracking table with the reason the required
approach was insufficient.

**Version**: 2.1.0 | **Ratified**: 2026-09-21 | **Last Amended**: 2026-09-21
