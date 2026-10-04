/*
 * UI-side permission hints (FR-005, FR-008a-c). These only decide what the interface OFFERS.
 * The API enforces the real rule on every request (Constitution V), so a stale or wrong hint
 * here can never grant access; at worst it shows a button the server then refuses.
 */
export const isAdmin = (user) => user?.role === 'ADMIN';
export const canCreateProject = (user) => user?.role === 'ADMIN' || user?.role === 'MANAGER';

/**
 * Manager of a project = Admin, or a Manager who belongs to it. `managedProjectIds` is the set
 * of project ids visible to the user: for a Manager that is exactly the projects they belong to.
 */
export function isManagerOf(user, projectId, managedProjectIds) {
  if (isAdmin(user)) return true;
  return user?.role === 'MANAGER' && managedProjectIds?.has(projectId) === true;
}

export const canAssign = isManagerOf;

export function canChangeStatus(user, task, managedProjectIds) {
  if (!user || !task) return false;
  if (isAdmin(user)) return true;
  if (task.assignees?.some((a) => a.userId === user.userId)) return true;
  return isManagerOf(user, task.projectId, managedProjectIds);
}

export function canDeleteTask(user, task, managedProjectIds) {
  return isManagerOf(user, task.projectId, managedProjectIds) || task.createdBy === user?.userId;
}
