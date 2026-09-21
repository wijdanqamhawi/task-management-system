# Feature Specification: Task Management System

**Feature Branch**: `001-task-management-system`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "Build a Task Management System for teams and departments to manage projects, tasks, assignments, deadlines, and progress." (full official requirements covering User Management, Project Management, Task Management, Task Status workflow, Task Sharing, Dashboard, Search and Filtering, and optional Notifications)

## Clarifications

The official project requirements document is the source of truth for this feature. The
items below are **project decisions** taken because the official document does not contain
enough information to make a requirement implementable and testable. They are recorded as
decisions, not as official requirements, and are marked as such wherever they appear in this
specification.

### Session 2026-09-21

- Q: The official document requires "Roles and permissions" and task assignment "according to
  their permissions", but names no role and defines no permission. Which roles exist and what
  may each do? → A: Three roles — **Admin**, **Manager**, **Member**. Admin manages users,
  roles, and activation/deactivation. Manager creates and manages projects, assigns project
  members, and assigns tasks within their projects. Member works on tasks assigned to them,
  updates their status, and adds comments, subtasks, and attachments.
- Q: The official document lists "View their assigned tasks" and "View tasks shared with them"
  as two separate capabilities but never defines sharing. What makes a task shared with a
  user? → A: A task is **shared with** a user when the user is a member of the task's project
  but is not one of its assignees. Sharing is derived from project membership; there is no
  separate share action.
- Q: The official document says the system "may provide" notifications and does not list them
  among the required deliverables. Are notifications in scope for this release? → A: **Yes —
  all five triggers, delivered in-app**: new task assignment, task update, approaching
  deadline, overdue task, and comment or mention. Notifications remain the lowest-priority
  work item and MUST NOT displace any mandatory functional area.
- Q: The official document requires notifying users of an "approaching" deadline without
  quantifying it, leaving the requirement untestable. What is the threshold? → A: **24 hours
  before the due date.** A single fixed threshold, not configurable per user.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Access and User Administration (Priority: P1)

A department administrator sets up accounts for team members. New members register or are
registered, log in, and maintain their own profile. The administrator assigns each member a
role that determines what they are allowed to do, and can deactivate a member who leaves the
department so that they can no longer access the system.

**Why this priority**: Nothing else in the system can be used or trusted without identified,
authenticated users whose permissions are known. Every other story depends on knowing who the
acting user is.

**Independent Test**: Can be fully tested by registering a user, logging in, viewing and
editing the profile, assigning a role, deactivating the account, and confirming the
deactivated account is refused access — all without any project or task existing.

**Acceptance Scenarios**:

1. **Given** no existing account for an email address, **When** a person registers with that
   address and a valid password, **Then** an account is created and they can log in with those
   credentials.
2. **Given** a registered active user, **When** they log in with correct credentials, **Then**
   they gain access to the system; **When** they log in with incorrect credentials, **Then**
   access is refused and no indication is given of which credential was wrong.
3. **Given** a logged-in user, **When** they open their profile, **Then** they see their own
   profile information and can update it.
4. **Given** an administrator, **When** they assign a role to a user, **Then** that user's
   permitted actions change to match the role on their next action.
5. **Given** an active user, **When** an administrator deactivates that user, **Then** the
   user can no longer log in and can no longer perform any action in the system.
6. **Given** a deactivated user, **When** an administrator reactivates them, **Then** the user
   can log in again and regains the permissions of their role.

---

### User Story 2 - Project Setup and Membership (Priority: P2)

A manager creates a project for a piece of departmental work, records its description and
supporting information, sets its start and end dates and its status, and assigns the team
members who will work on it. Members see the projects they belong to.

**Why this priority**: Projects are the container that tasks belong to and the boundary that
determines who can see what. Tasks cannot be organised or scoped without them.

**Independent Test**: Can be fully tested by creating a project, editing its details, setting
its status and dates, adding and removing members, and confirming that each member sees the
project and non-members do not — without creating a single task.

**Acceptance Scenarios**:

1. **Given** a user with permission to create projects, **When** they create a project with a
   name, description, status, start date and end date, **Then** the project is saved and
   appears in their project list.
2. **Given** an existing project, **When** an authorised user edits its description,
   information, status, or dates, **Then** the changes are saved and visible to all project
   members.
3. **Given** an existing project, **When** an authorised user assigns a member to it, **Then**
   that member sees the project in their own project list.
4. **Given** a project member, **When** they are removed from the project, **Then** the project
   no longer appears in their project list.
5. **Given** a project with an end date earlier than its start date, **When** the user tries to
   save it, **Then** the system rejects the save and explains why.

---

### User Story 3 - Task Creation and Assignment (Priority: P3)

A project member creates tasks within a project, giving each a title, description, priority,
start date and due date, and assigns each task to one or more team members. Tasks can be
edited as work is understood better, and deleted when created in error.

**Why this priority**: This is the core purpose of the system — capturing work and giving it an
owner and a deadline. It is the first story that delivers the product's headline value.

**Independent Test**: Can be fully tested within a single project by creating tasks with each
priority, assigning one task to a single user and another to several users, editing a task, and
deleting a task — without dashboards, search, or notifications.

**Acceptance Scenarios**:

1. **Given** a project the user belongs to, **When** they create a task with a title,
   description, priority, start date and due date, **Then** the task is saved in that project
   with status "To Do".
2. **Given** an existing task, **When** an authorised user assigns it to two team members,
   **Then** both members appear as assignees and both see the task in their assigned tasks.
3. **Given** an existing task, **When** an authorised user edits its title, description,
   priority, or dates, **Then** the updated values are saved and shown to everyone who can see
   the task.
4. **Given** an existing task, **When** an authorised user deletes it, **Then** the task no
   longer appears in any list, count, or filter result.
5. **Given** a task with a due date earlier than its start date, **When** the user tries to save
   it, **Then** the system rejects the save and explains why.
6. **Given** a user without permission to assign work to others, **When** they attempt to assign
   a task to another member, **Then** the action is refused.

---

### User Story 4 - Task Workflow and Progress Tracking (Priority: P4)

A team member opens their own list of assigned tasks, sees what is due, and moves each task
along the workflow — To Do, then In Progress, then Review, then Completed — as the work
advances. Managers watch the same tasks move and can see how far a project has progressed.

**Why this priority**: Assignment without status tracking gives a to-do list but no visibility
of progress, which is the stated purpose of the system.

**Independent Test**: Can be fully tested by assigning a task, viewing it in the assignee's task
list, advancing it through each of the four statuses, and confirming the current status is
visible to both the assignee and the project manager.

**Acceptance Scenarios**:

1. **Given** a user with assigned tasks, **When** they open their task list, **Then** they see
   every task assigned to them with its project, status, priority, and due date.
2. **Given** a task in status "To Do", **When** an authorised user updates it to "In Progress",
   **Then** the new status is saved and visible to everyone who can see the task.
3. **Given** a task in status "In Progress", **When** an authorised user updates it to "Review"
   and then to "Completed", **Then** each change is saved in turn.
4. **Given** a task shared with a user, **When** they open their task view, **Then** the task
   appears distinguishably from tasks assigned to them.
5. **Given** a user who is neither an assignee nor otherwise permitted to see a task, **When**
   they attempt to view or update it, **Then** access is refused.

---

### User Story 5 - Task Collaboration Detail (Priority: P5)

Team members break a task down into subtasks, attach the files the work depends on, and discuss
the task in comments so that the context of the work lives with the work.

**Why this priority**: These enrich a task that already exists and can be delivered after the
core task lifecycle works end to end.

**Independent Test**: Can be fully tested on a single existing task by adding subtasks and
marking them done, uploading and downloading an attachment, and posting and reading comments.

**Acceptance Scenarios**:

1. **Given** an existing task, **When** a member adds a subtask, **Then** the subtask is listed
   under that task and can be marked complete.
2. **Given** an existing task, **When** a member attaches a file, **Then** the attachment is
   listed against the task and can be downloaded by anyone who can see the task.
3. **Given** an existing task, **When** a member posts a comment, **Then** the comment appears
   against the task with its author and the time it was posted, in order.
4. **Given** a task with subtasks, **When** the task is deleted, **Then** its subtasks,
   attachments, and comments are removed with it.

---

### User Story 6 - Dashboard (Priority: P6)

A manager opens a dashboard and sees, at a glance, how much work exists, how much is done, what
is pending, what is late, how work is distributed across statuses, priorities, and people, and
how far each project has progressed.

**Why this priority**: The dashboard reports on data produced by the earlier stories; it has
nothing to show until tasks are being created, assigned, and progressed.

**Independent Test**: Can be fully tested by seeding a known set of projects and tasks across
statuses, priorities, users, and due dates, then confirming every dashboard figure matches the
seeded data.

**Acceptance Scenarios**:

1. **Given** a set of projects and tasks the user is permitted to see, **When** they open the
   dashboard, **Then** it shows the total number of projects and the total number of tasks.
2. **Given** tasks in various statuses, **When** the dashboard is displayed, **Then** it shows
   the count of completed tasks, the count of pending tasks, and a breakdown of tasks by status.
3. **Given** tasks with due dates in the past that are not completed, **When** the dashboard is
   displayed, **Then** those tasks are counted as overdue.
4. **Given** tasks of differing priorities, **When** the dashboard is displayed, **Then** it
   shows a breakdown of tasks by priority.
5. **Given** several users with assigned tasks, **When** the dashboard is displayed, **Then** it
   shows how many tasks are assigned to each user.
6. **Given** a project with a mix of completed and incomplete tasks, **When** the dashboard is
   displayed, **Then** it shows that project's progress.
7. **Given** a task whose status changes, **When** the dashboard is next displayed, **Then**
   every affected figure reflects the change.

---

### User Story 7 - Search and Filtering (Priority: P7)

A user with many tasks narrows the list down to what matters right now — this project, this
person, this status, this priority, tasks due by a certain date — or searches for a task by its
title.

**Why this priority**: Valuable only once there is enough data that browsing is impractical.

**Independent Test**: Can be fully tested against a seeded set of tasks by applying each filter
individually, applying several together, and searching by full and partial task title.

**Acceptance Scenarios**:

1. **Given** tasks across several projects, **When** the user filters by a project, **Then**
   only that project's tasks are listed.
2. **Given** tasks assigned to several users, **When** the user filters by a user, **Then** only
   tasks assigned to that user are listed.
3. **Given** tasks in several statuses, **When** the user filters by a status, **Then** only
   tasks in that status are listed.
4. **Given** tasks of several priorities, **When** the user filters by a priority, **Then** only
   tasks of that priority are listed.
5. **Given** tasks with various due dates, **When** the user filters by due date, **Then** only
   tasks matching that due date criterion are listed.
6. **Given** tasks with various titles, **When** the user searches for part of a title, **Then**
   only tasks whose titles match are listed.
7. **Given** several filters applied together, **When** the results are shown, **Then** only
   tasks satisfying all of the applied filters are listed.
8. **Given** any search or filter, **When** results are returned, **Then** they never include a
   task the user is not permitted to see.

---

### User Story 8 - Notifications (Priority: P8)

A user is told when work lands on them or changes around them: a task newly assigned to them, an
update to a task they are involved in, a deadline approaching, a task that has gone overdue, and
comments or mentions directed at them.

**Why this priority**: The official requirements state the system *may* provide notifications.
The project has decided to deliver them, but as the only optional area they are built last and
must never displace a mandatory functional area.

**Independent Test**: Can be fully tested by performing each triggering action against a
recipient user and confirming the matching notification is raised and visible to that user.

**Acceptance Scenarios**:

1. **Given** a user, **When** a task is assigned to them, **Then** they receive a notification
   of the new assignment.
2. **Given** a user involved in a task, **When** the task is updated, **Then** they receive a
   notification of the update.
3. **Given** an incomplete task, **When** its due date is 24 hours away, **Then** its assignees
   each receive one approaching-deadline notification.
4. **Given** a task that passes its due date without being completed, **When** it becomes
   overdue, **Then** the assignees receive a notification.
5. **Given** a user, **When** a comment is posted on their task or they are mentioned in a
   comment, **Then** they receive a notification.

---

### Edge Cases

- A user is deactivated while still holding assigned tasks: the tasks remain, keep their
  history, and continue to be counted, but the deactivated user cannot access them.
- A user is removed from a project while assigned to tasks in it: they lose the project, and
  with it their shared-task visibility of that project's other tasks. The system must resolve
  their remaining assignments rather than leaving a task assigned to someone who cannot see its
  project.
- A task is assigned to several users and one of them completes it: status is a property of the
  task, not of each assignee, so a single status change applies to all assignees.
- A task's due date passes while the task sits in "Review": it counts as overdue, because it is
  not completed.
- A project's end date passes while it still has incomplete tasks: those tasks remain open and
  continue to be counted as pending or overdue on their own merits.
- A task is deleted while another user has it open: the second user's next action on it fails
  with a clear message rather than silently succeeding.
- Two users update the same task at the same time: the later write wins and overwrites the
  earlier one. *(Project decision, not an official requirement: the official document does not
  address concurrent editing, and no conflict-detection behaviour is specified anywhere in it.
  No conflict is reported to either user.)*
- A subtask remains incomplete when its parent task is moved to "Completed": the move is
  allowed, with no warning and no block. *(Project decision, not an official requirement: the
  official document defines no relationship between subtask completion and parent status.)*
- An attachment upload fails partway: no partial attachment is recorded against the task.
- A filter or search matches nothing: an empty result is shown with a clear message, not an
  error.
- A user searches or filters across projects they do not belong to: those tasks never appear.
- A task is assigned to several users and then updated: each involved user receives the update
  notification once, not once per assignee.
- A task stays overdue for many days: the overdue notification is raised once when the task
  becomes overdue, not repeatedly every day.
- A user is deactivated while holding unseen notifications: no further notifications are raised
  for them, and existing ones are inaccessible until reactivation.
- A task is deleted: its notifications no longer point at anything and must not be shown as
  broken entries.

## Requirements *(mandatory)*

### Functional Requirements

**User Management**

- **FR-001**: System MUST allow a person to register an account.
- **FR-002**: System MUST authenticate users at login and refuse access when credentials do not
  match an active account.
- **FR-003**: System MUST hold a profile for each user and allow the user to view and update
  their own profile.
- **FR-004**: System MUST support roles, and MUST attach a role to every user.
- **FR-005**: System MUST enforce permissions derived from a user's role on every action the
  user attempts.
- **FR-006**: System MUST allow an authorised user to activate and deactivate user accounts.
- **FR-007**: System MUST deny all access to a deactivated user until the account is
  reactivated.
- **FR-008**: System MUST provide exactly three roles — Admin, Manager, and Member — with the
  permissions set out in FR-008a to FR-008c. *(Project decision, not an official requirement:
  the official document requires "roles and permissions" without naming any role. The role set
  below was chosen as the smallest one that makes every permission-dependent clause of the
  official document enforceable.)*
- **FR-008a**: An **Admin** MUST be able to manage user accounts, assign roles to users, and
  activate and deactivate users.
- **FR-008b**: A **Manager** MUST be able to create and manage projects, assign and remove
  project members, and create, edit, delete, and assign tasks within the projects they manage.
- **FR-008c**: A **Member** MUST be able to view the projects they belong to, view tasks
  assigned to or shared with them, update the status of tasks assigned to them, and add
  comments, subtasks, and attachments to tasks they can see. A Member MUST NOT create projects,
  manage project membership, or assign tasks to other users.

**Project Management**

- **FR-009**: System MUST allow an authorised user to create a project.
- **FR-010**: System MUST allow an authorised user to edit and manage an existing project.
- **FR-011**: System MUST store a description and supporting information for each project.
- **FR-012**: System MUST hold a status for each project.
- **FR-013**: System MUST hold a start date and an end date for each project.
- **FR-014**: System MUST allow an authorised user to assign members to a project and remove
  them from it.
- **FR-015**: System MUST show each user the projects they are a member of.

**Task Management**

- **FR-016**: System MUST allow an authorised user to create a task within a project.
- **FR-017**: System MUST allow an authorised user to edit an existing task.
- **FR-018**: System MUST allow an authorised user to delete a task.
- **FR-019**: System MUST allow a task to be assigned to one or more users.
- **FR-020**: System MUST hold a priority for each task.
- **FR-021**: System MUST hold a status for each task.
- **FR-022**: System MUST hold a start date and a due date for each task.
- **FR-023**: System MUST hold a description for each task.
- **FR-024**: System MUST allow subtasks to be recorded against a task.
- **FR-025**: System MUST allow files to be attached to a task and retrieved from it.
- **FR-026**: System MUST allow comments to be posted against a task and displayed with their
  author and time, in order.

**Task Status Workflow**

- **FR-027**: System MUST support exactly the statuses To Do, In Progress, Review, and
  Completed, and MUST NOT offer any other task status.
- **FR-028**: System MUST support the progression To Do → In Progress → Review → Completed.
- **FR-029**: System MUST record every task's current status and present it wherever the task is
  shown.

**Task Sharing**

- **FR-030**: Users MUST be able to view the tasks assigned to them.
- **FR-031**: Users MUST be able to view the tasks shared with them.
- **FR-032**: Users MUST be able to assign tasks to other team members, and the system MUST
  permit this only where the acting user's permissions allow it.
- **FR-033**: Users MUST be able to track the progress of tasks they can see.
- **FR-034**: Users MUST be able to update the status of tasks they are permitted to update.
- **FR-035**: A task counts as "shared with" a user when that user is a member of the task's
  project and is not one of the task's assignees. The system MUST NOT provide any separate
  per-task share action. *(Project decision, not an official requirement: the official document
  distinguishes assigned tasks from shared tasks without defining sharing. Deriving sharing from
  project membership introduces no entity or action beyond those the official document already
  lists.)*
- **FR-035a**: System MUST present tasks shared with a user distinguishably from tasks assigned
  to that user.

**Dashboard**

- **FR-036**: System MUST display the total number of projects.
- **FR-037**: System MUST display the total number of tasks.
- **FR-038**: System MUST display the number of completed tasks.
- **FR-039**: System MUST display the number of pending tasks.
- **FR-040**: System MUST display the number of overdue tasks, an overdue task being one that is
  past its due date and not Completed.
- **FR-041**: System MUST display a breakdown of tasks by status.
- **FR-042**: System MUST display a breakdown of tasks by priority.
- **FR-043**: System MUST display the number of tasks assigned to each user.
- **FR-044**: System MUST display the progress of each project.
- **FR-045**: Dashboard figures MUST reflect the current state of the data and MUST count only
  data the viewing user is permitted to see.

**Search and Filtering**

- **FR-046**: Users MUST be able to filter tasks by project.
- **FR-047**: Users MUST be able to filter tasks by user.
- **FR-048**: Users MUST be able to filter tasks by status.
- **FR-049**: Users MUST be able to filter tasks by priority.
- **FR-050**: Users MUST be able to filter tasks by due date.
- **FR-051**: Users MUST be able to search tasks by task title.
- **FR-052**: System MUST allow filters to be combined, returning only tasks that satisfy all
  applied criteria.
- **FR-053**: Search and filter results MUST exclude any task the user is not permitted to see.

**Notifications**

*The official document states the system "may provide" notifications and does not list them
among the required deliverables. The project has decided to deliver all five triggers in-app.
The decision to build them is a project decision; the five triggers themselves are taken
verbatim from the official document.*

- **FR-054**: System MUST notify a user when a task is assigned to them.
- **FR-055**: System MUST notify involved users when a task is updated.
- **FR-056**: System MUST notify assignees when a task's deadline is approaching, "approaching"
  meaning 24 hours before the due date. The notification MUST be raised once per task and MUST
  NOT be raised for a task that is already Completed. *(The 24-hour threshold is a project
  decision; the official document says "approaching deadlines" without quantifying it.)*
- **FR-057**: System MUST notify assignees when a task becomes overdue.
- **FR-058**: System MUST notify a user when a comment is posted on their task or when they are
  mentioned in a comment.
- **FR-059**: Notifications MUST be delivered within the application and MUST be visible to
  their recipient only. No delivery channel outside the application is in scope.
- **FR-060**: System MUST record whether a recipient has seen each notification, and MUST allow
  the recipient to see which of their notifications are unseen.
- **FR-061**: Notifications MUST NOT be raised for a deactivated user, and MUST NOT disclose any
  task, project, or comment the recipient is not permitted to see.

### Key Entities *(include if feature involves data)*

- **User**: A person who uses the system. Holds identity, credentials, profile information, an
  active/inactive state, and a role. May be a member of many projects and an assignee of many
  tasks.
- **Role**: A named set of permissions. Determines what actions a user holding it may perform.
  One of Admin, Manager, or Member (see FR-008).
- **Project**: A body of work owned by a team or department. Holds a name, description and
  supporting information, status, start date, and end date. Has many members and many tasks.
- **Project Member**: The association between a user and a project the user works on.
- **Task**: A unit of work within a project. Holds a title, description, priority, status, start
  date, and due date. Has one or more assignees, and may have subtasks, attachments, and
  comments.
- **Task Assignment**: The association between a task and a user responsible for it. A task may
  have several.
- **Task Status**: One of To Do, In Progress, Review, or Completed.
- **Task Priority**: The relative urgency or importance of a task.
- **Subtask**: A smaller unit of work belonging to a single parent task, with its own completion
  state.
- **Comment**: A message posted by a user against a task, with author and timestamp.
- **Attachment**: A file stored against a task, with the information needed to identify and
  retrieve it.
- **Notification**: A message raised for a user about an event affecting them, with its trigger,
  the task or comment it refers to, when it was raised, and whether the recipient has seen it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can register, log in, and reach their task list in under 3 minutes
  without assistance.
- **SC-002**: An authorised user can create a project and assign its members in under 2 minutes.
- **SC-003**: An authorised user can create a task, set its priority and dates, and assign it to
  one or more people in under 90 seconds.
- **SC-004**: A user can move a task from one status to the next in no more than 2 interactions
  from their task list.
- **SC-005**: 100% of dashboard figures match the underlying data when checked against a seeded
  data set covering every status, every priority, overdue tasks, and multiple users.
- **SC-006**: 95% of searches and filters return their results within 2 seconds against a data
  set of at least 10,000 tasks.
- **SC-007**: 100% of attempts to view or modify a task, project, or user outside the acting
  user's permissions are refused.
- **SC-008**: 100% of deactivated users are denied access on their next attempted action.
- **SC-009**: 90% of first-time users successfully create and assign a task on their first
  attempt without assistance.
- **SC-010**: The interface is usable and complete on screen widths from small mobile to
  desktop, with no loss of functionality and no horizontal scrolling of the page.
- **SC-011**: A task and all of its subtasks, attachments, and comments remain consistent after
  any supported operation — no orphaned subtask, attachment, or comment is ever reachable.
- **SC-012**: 100% of the five notification triggers raise exactly one notification to each
  intended recipient, and none to any other user, when exercised against a seeded data set.
- **SC-013**: A user can see how many unseen notifications they have without leaving the page
  they are on.

## Assumptions

- Users of the system are members of teams or departments within a single organisation; there is
  no cross-organisation or public sign-up scenario.
- A single set of projects and tasks is shared by the whole organisation, scoped by project
  membership and permissions rather than by separate tenants.
- Login uses an identifier and a password held by the system; no external or federated sign-in
  provider is assumed.
- Task priority is a fixed, ordered set of values defined by the system rather than free text,
  so that "tasks by priority" can be counted and filtered.
- "Pending tasks" on the dashboard means every task that is not Completed.
- "Overdue tasks" means every task past its due date that is not Completed, regardless of which
  of the other three statuses it sits in.
- "Project progress" is derived from the proportion of a project's tasks that are Completed.
- Deleting a task removes its subtasks, attachments, and comments with it; deactivating a user
  does not delete the tasks assigned to them.
- Deactivation is reversible; there is no requirement to permanently delete a user account.
- Attachments are ordinary working documents; no requirement for versioning, preview, or
  in-place editing of attachments is implied.
- Dates are handled in the organisation's local time; no multi-timezone requirement is implied.
- The system is used through a web browser on both desktop and mobile-sized screens.
- No reporting, exporting, time tracking, billing, calendar integration, or external tool
  integration is in scope — none appears in the official requirements.
