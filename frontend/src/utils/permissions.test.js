/*
 * Permission helper tests. No framework and no dependencies: run with Node's built-in runner
 *   node --test src/utils/permissions.test.js        (from frontend/)
 * No browser, no network, no database.
 *
 * The role -> permission sets below are the seeded grants (database/seed/rbac_data.sql:
 * ADMIN 23, MANAGER 19, MEMBER 10). The PARITY test compares every helper with the pre-RBAC
 * role-name rules over the whole scenario matrix, so the UI offers exactly what it did before.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PERMISSIONS as P } from '../constants.js';
import { ROUTES, ROUTE_PERMISSIONS } from '../router/routes.js';
import {
  canAdministerUsers, canAssign, canAssignRoles, canChangeStatus, canCreateProject,
  canDeleteAttachment, canDeleteProject, canDeleteTask, canEditTask, canManageMembers,
  canManageProgress, canManageUserStatus, canToggleProgress, canUpdateProject, canViewAllProjects, hasAnyPermission, hasPermission,
  isManagerOf, normalizePermissions,
} from './permissions.js';

const ALL = Object.values(P);
const MEMBER_SET = [P.PROJECT_VIEW, P.TASK_VIEW, P.TASK_CREATE, P.TASK_STATUS_CHANGE,
  P.TASK_DELETE_OWN, P.COMMENT_CREATE, P.SUBTASK_MANAGE, P.PROGRESS_TOGGLE, P.ATTACHMENT_UPLOAD,
  P.ATTACHMENT_DELETE_OWN];
const MANAGER_SET = [...MEMBER_SET, P.PROJECT_CREATE, P.PROJECT_UPDATE, P.PROJECT_DELETE,
  P.PROJECT_MEMBER_MANAGE, P.TASK_EDIT, P.TASK_ASSIGN, P.TASK_DELETE_ANY, P.ATTACHMENT_DELETE_ANY,
  P.PROGRESS_MANAGE];
const GRANTS = { ADMIN: ALL, MANAGER: MANAGER_SET, MEMBER: MEMBER_SET };

const PROJECT = 10;
const user = (id, role, permissions = GRANTS[role]) => ({ userId: id, role, permissions });

// ------------------------------------------------------------------ the seeded sets

test('the role sets are the seeded 23 / 19 / 10 grants and use only existing codes', () => {
  assert.equal(ALL.length, 23);
  assert.equal(new Set(ALL).size, 23);
  assert.equal(MANAGER_SET.length, 19);
  assert.equal(MEMBER_SET.length, 10);
  for (const set of Object.values(GRANTS)) for (const code of set) assert.ok(ALL.includes(code));
});

test('the constants match the codes in the seed file (when the repo is available)', () => {
  const seed = fileURLToPath(new URL('../../../database/seed/rbac_data.sql', import.meta.url));
  let text;
  try { text = readFileSync(seed, 'utf8'); } catch { return; }          // frontend built alone
  const block = text.split('-- ----')[1];
  const codes = [...block.matchAll(/SELECT '([A-Z_]+)'(?: AS permission_code)?,/g)].map((m) => m[1]);
  assert.deepEqual([...codes].sort(), [...ALL].sort());
  const grants = {};
  for (const m of text.matchAll(/SELECT '(ADMIN|MANAGER|MEMBER)'(?: AS role_name)?, '([A-Z_]+)'/g)) {
    (grants[m[1]] ??= []).push(m[2]);
  }
  for (const role of Object.keys(GRANTS)) assert.deepEqual([...grants[role]].sort(), [...GRANTS[role]].sort());
});

// ------------------------------------------------------------------ fail closed

test('hasPermission fails closed for missing, malformed and unknown data', () => {
  for (const bad of [undefined, null, {}, { permissions: null }, { permissions: 'ADMIN' },
    { permissions: {} }, { permissions: [] }, { role: 'ADMIN' }, { role: 'ADMIN', permissions: undefined }]) {
    for (const code of ALL) assert.equal(hasPermission(bad, code), false);
  }
  const admin = user(1, 'ADMIN');
  assert.equal(hasPermission(admin, 'NOT_A_REAL_PERMISSION'), false);
  assert.equal(hasPermission({ permissions: ['NOT_A_REAL_PERMISSION'] }, 'NOT_A_REAL_PERMISSION'), false);
  assert.equal(hasPermission(admin, undefined), false);
  assert.equal(hasPermission(admin, P.PROJECT_VIEW_ALL), true);
});

test('the role name alone never authorizes anything', () => {
  const noPermissions = { userId: 1, role: 'ADMIN', permissions: [] };
  const task = { projectId: PROJECT, assignees: [], createdBy: 1 };
  const all = new Set([PROJECT]);
  assert.equal(canCreateProject(noPermissions), false);
  assert.equal(canViewAllProjects(noPermissions), false);
  assert.equal(canAdministerUsers(noPermissions), false);
  assert.equal(canUpdateProject(noPermissions, PROJECT, all), false);
  assert.equal(canChangeStatus(noPermissions, task, all), false);
  assert.equal(canDeleteTask(noPermissions, task, all), false);
  assert.equal(canDeleteAttachment(noPermissions, { uploadedBy: 1 }, PROJECT, all), false);
  assert.equal(isManagerOf(noPermissions, PROJECT, all), false);          // no permission argument
});

test('normalizePermissions always returns an array of strings', () => {
  assert.deepEqual(normalizePermissions(undefined), []);
  assert.deepEqual(normalizePermissions(null), []);
  assert.deepEqual(normalizePermissions('TASK_VIEW'), []);
  assert.deepEqual(normalizePermissions({ 0: 'TASK_VIEW' }), []);
  assert.deepEqual(normalizePermissions(['TASK_VIEW', 3, null, 'TASK_EDIT']), ['TASK_VIEW', 'TASK_EDIT']);
  assert.equal(hasAnyPermission(user(1, 'MEMBER'), undefined), false);
});

// ------------------------------------------------------------------ named scenarios

test('global gates: project creation, view-all and user administration', () => {
  assert.deepEqual(['ADMIN', 'MANAGER', 'MEMBER'].map((r) => canCreateProject(user(1, r))), [true, true, false]);
  assert.deepEqual(['ADMIN', 'MANAGER', 'MEMBER'].map((r) => canViewAllProjects(user(1, r))), [true, false, false]);
  assert.deepEqual(['ADMIN', 'MANAGER', 'MEMBER'].map((r) => canAdministerUsers(user(1, r))), [true, false, false]);
});

test('users screen: either user permission reaches it, each action is gated separately', () => {
  const onlyRoles = { userId: 1, permissions: [P.USER_ROLE_ASSIGN] };
  const onlyStatus = { userId: 1, permissions: [P.USER_STATUS_MANAGE] };
  assert.ok(hasAnyPermission(onlyRoles, ROUTE_PERMISSIONS[ROUTES.USERS]));
  assert.ok(hasAnyPermission(onlyStatus, ROUTE_PERMISSIONS[ROUTES.USERS]));
  assert.equal(canAssignRoles(onlyRoles), true);
  assert.equal(canManageUserStatus(onlyRoles), false);
  assert.equal(canAssignRoles(onlyStatus), false);
  assert.equal(canManageUserStatus(onlyStatus), true);
  assert.equal(canAdministerUsers(onlyRoles) && canAdministerUsers(onlyStatus), true);
});

test('route authorization, navigation and page gates agree for every permission subset of the two codes', () => {
  const codes = [P.USER_ROLE_ASSIGN, P.USER_STATUS_MANAGE, P.PROJECT_CREATE];
  for (let mask = 0; mask < 1 << codes.length; mask += 1) {
    const u = { userId: 1, permissions: codes.filter((_, i) => mask & (1 << i)) };
    const route = hasAnyPermission(u, ROUTE_PERMISSIONS[ROUTES.USERS]);
    assert.equal(canAdministerUsers(u), route);                         // nav link === route guard
    assert.equal(route, canAssignRoles(u) || canManageUserStatus(u));   // page reachable iff some action
  }
  assert.deepEqual(Object.keys(ROUTE_PERMISSIONS), [ROUTES.USERS]);     // only /users is restricted
});

test('manager scope: a MANAGER manages only projects they belong to; ADMIN manages all', () => {
  const mgr = user(2, 'MANAGER');
  const admin = user(1, 'ADMIN');
  const inProject = new Set([PROJECT]);
  const none = new Set();
  assert.equal(canUpdateProject(mgr, PROJECT, inProject), true);
  assert.equal(canDeleteProject(mgr, PROJECT, inProject), true);
  assert.equal(canManageMembers(mgr, PROJECT, inProject), true);
  assert.equal(canEditTask(mgr, PROJECT, inProject), true);
  assert.equal(canAssign(mgr, PROJECT, inProject), true);
  for (const fn of [canUpdateProject, canDeleteProject, canManageMembers, canEditTask, canAssign]) {
    assert.equal(fn(mgr, PROJECT, none), false);                        // manager of another project
    assert.equal(fn(mgr, PROJECT, undefined), false);
    assert.equal(fn(admin, PROJECT, none), true);                       // PROJECT_MANAGE_ALL bypass
  }
});

test('a MEMBER of the project is never a manager, whatever the project set says', () => {
  const mem = user(4, 'MEMBER');
  const inProject = new Set([PROJECT]);
  for (const fn of [canUpdateProject, canDeleteProject, canManageMembers, canEditTask, canAssign]) {
    assert.equal(fn(mem, PROJECT, inProject), false);
  }
});

test('status: admin, an assignee of THAT task, or a manager of its project; not another member', () => {
  const inProject = new Set([PROJECT]);
  const task = { projectId: PROJECT, assignees: [{ userId: 4 }], createdBy: 2 };
  assert.equal(canChangeStatus(user(1, 'ADMIN'), task, new Set()), true);          // ADMIN, not a member
  assert.equal(canChangeStatus(user(4, 'MEMBER'), task, inProject), true);         // the assignee
  assert.equal(canChangeStatus(user(5, 'MEMBER'), task, inProject), false);        // another member
  assert.equal(canChangeStatus(user(5, 'MEMBER'), { ...task, assignees: [] }, inProject), false);
  assert.equal(canChangeStatus(user(2, 'MANAGER'), task, inProject), true);        // manager of project
  assert.equal(canChangeStatus(user(3, 'MANAGER'), task, new Set()), false);       // manager elsewhere
  assert.equal(canChangeStatus(user(6, 'MEMBER'), task, new Set()), false);        // non-member
  // MEMBER holds TASK_STATUS_CHANGE but, without the permission, even an assignee is refused.
  const revoked = user(4, 'MEMBER', MEMBER_SET.filter((c) => c !== P.TASK_STATUS_CHANGE));
  assert.equal(canChangeStatus(revoked, task, inProject), false);
  assert.equal(canChangeStatus(user(4, 'MEMBER'), undefined, inProject), false);
  assert.equal(canChangeStatus(undefined, task, inProject), false);
});

test('delete task: manager of the project, or the creator; assignment and membership do not matter', () => {
  const inProject = new Set([PROJECT]);
  const task = { projectId: PROJECT, assignees: [{ userId: 4 }], createdBy: 5 };
  assert.equal(canDeleteTask(user(2, 'MANAGER'), task, inProject), true);
  assert.equal(canDeleteTask(user(1, 'ADMIN'), task, new Set()), true);
  assert.equal(canDeleteTask(user(5, 'MEMBER'), task, inProject), true);          // creator
  assert.equal(canDeleteTask(user(4, 'MEMBER'), task, inProject), false);         // assignee, not creator
  assert.equal(canDeleteTask(user(3, 'MANAGER'), task, new Set()), false);
  assert.equal(canDeleteTask(user(5, 'MEMBER', []), task, inProject), false);     // no TASK_DELETE_OWN
  assert.equal(canDeleteTask(user(7, 'MEMBER'), { ...task, createdBy: undefined }, inProject), false);
});

test('delete attachment: the uploader, or a manager of the project', () => {
  const inProject = new Set([PROJECT]);
  const file = { uploadedBy: 5 };
  assert.equal(canDeleteAttachment(user(5, 'MEMBER'), file, PROJECT, inProject), true);   // uploader
  assert.equal(canDeleteAttachment(user(4, 'MEMBER'), file, PROJECT, inProject), false);  // other member
  assert.equal(canDeleteAttachment(user(2, 'MANAGER'), file, PROJECT, inProject), true);
  assert.equal(canDeleteAttachment(user(3, 'MANAGER'), file, PROJECT, new Set()), false);
  assert.equal(canDeleteAttachment(user(1, 'ADMIN'), file, PROJECT, new Set()), true);
  assert.equal(canDeleteAttachment(user(5, 'MEMBER', []), file, PROJECT, inProject), false);
});

test('progress manage: ADMIN, or a MANAGER of that project; never a MEMBER', () => {
  const inProject = new Set([PROJECT]);
  assert.equal(canManageProgress(user(1, 'ADMIN'), PROJECT, new Set()), true);
  assert.equal(canManageProgress(user(2, 'MANAGER'), PROJECT, inProject), true);
  assert.equal(canManageProgress(user(3, 'MANAGER'), PROJECT, new Set()), false);      // manager elsewhere
  assert.equal(canManageProgress(user(4, 'MEMBER'), PROJECT, inProject), false);
  assert.equal(canManageProgress({ userId: 1, role: 'ADMIN', permissions: [] }, PROJECT, inProject), false);
});

test('progress toggle: managers and admin, or an assignee of THAT task; permission required', () => {
  const inProject = new Set([PROJECT]);
  const task = { projectId: PROJECT, assignees: [{ userId: 4 }] };
  assert.equal(canToggleProgress(user(1, 'ADMIN'), task, new Set()), true);
  assert.equal(canToggleProgress(user(2, 'MANAGER'), task, inProject), true);
  assert.equal(canToggleProgress(user(3, 'MANAGER'), task, new Set()), false);         // manager elsewhere
  assert.equal(canToggleProgress(user(4, 'MEMBER'), task, inProject), true);           // the assignee
  assert.equal(canToggleProgress(user(5, 'MEMBER'), task, inProject), false);          // not assigned
  assert.equal(canToggleProgress(user(4, 'MEMBER', MEMBER_SET.filter((c) => c !== P.PROGRESS_TOGGLE)), task, inProject), false);
  assert.equal(canToggleProgress(user(4, 'MEMBER'), undefined, inProject), false);
  assert.equal(canToggleProgress(undefined, task, inProject), false);
});

// ------------------------------------------------------------------ parity with the pre-RBAC rules

/** The rules the UI used before RBAC (utils/permissions.js, Project.jsx), by role name. */
const legacy = {
  isManagerOf: (u, projectId, ids) => u.role === 'ADMIN' || (u.role === 'MANAGER' && ids.has(projectId)),
  canCreateProject: (u) => u.role === 'ADMIN' || u.role === 'MANAGER',
  canChangeStatus(u, task, ids) {
    if (u.role === 'ADMIN') return true;
    if (task.assignees.some((a) => a.userId === u.userId)) return true;
    return legacy.isManagerOf(u, task.projectId, ids);
  },
  canDeleteTask: (u, task, ids) => legacy.isManagerOf(u, task.projectId, ids) || task.createdBy === u.userId,
  canDeleteAttachment: (u, file, projectId, ids) => file.uploadedBy === u.userId || legacy.isManagerOf(u, projectId, ids),
};

test('PARITY: every helper gives the pre-RBAC answer for every role and scenario', () => {
  const others = 99;
  const users = [
    user(1, 'ADMIN'), user(2, 'MANAGER'), user(3, 'MANAGER'), user(4, 'MEMBER'), user(5, 'MEMBER'),
  ];
  let checked = 0;
  for (const u of users) {
    for (const ids of [new Set([PROJECT]), new Set(), new Set([PROJECT + 1])]) {
      for (const assignees of [[], [{ userId: u.userId }], [{ userId: others }], [{ userId: others }, { userId: u.userId }]]) {
        for (const createdBy of [u.userId, others]) {
          for (const uploadedBy of [u.userId, others]) {
            const task = { projectId: PROJECT, assignees, createdBy };
            const file = { uploadedBy };
            const ctx = `${u.role}#${u.userId} ids=[${[...ids]}] assignees=${assignees.length} created=${createdBy} uploaded=${uploadedBy}`;
            const manager = legacy.isManagerOf(u, PROJECT, ids);
            assert.equal(canCreateProject(u), legacy.canCreateProject(u), ctx);
            assert.equal(canViewAllProjects(u), u.role === 'ADMIN', ctx);
            assert.equal(canAdministerUsers(u), u.role === 'ADMIN', ctx);
            assert.equal(canAssignRoles(u) && canManageUserStatus(u), u.role === 'ADMIN', ctx);
            for (const fn of [canUpdateProject, canDeleteProject, canManageMembers, canEditTask, canAssign]) {
              assert.equal(fn(u, PROJECT, ids), manager, `${fn.name} ${ctx}`);
            }
            assert.equal(canChangeStatus(u, task, ids), legacy.canChangeStatus(u, task, ids), ctx);
            assert.equal(canDeleteTask(u, task, ids), legacy.canDeleteTask(u, task, ids), ctx);
            assert.equal(canDeleteAttachment(u, file, PROJECT, ids), legacy.canDeleteAttachment(u, file, PROJECT, ids), ctx);
            checked += 1;
          }
        }
      }
    }
  }
  assert.equal(checked, 5 * 3 * 4 * 2 * 2);
});
