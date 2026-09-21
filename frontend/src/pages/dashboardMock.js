/*
 * SAMPLE DATA — NOT REAL.
 *
 * The Dashboard is not connected to the backend yet. Everything in this file is invented
 * placeholder content used to lay out the screen. It must be replaced by API data
 * (and this file deleted) when the dashboard endpoints are wired up.
 *
 * Status and priority values use the official enum names (FR-027) so the shared <Badge>
 * styling applies unchanged.
 */

export const STATUS_LABELS = {
  TO_DO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Completed',
};

export const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

/** Task counts per official status. Totals on the stat cards are derived from these. */
export const SAMPLE_STATUS_COUNTS = {
  TO_DO: 12,
  IN_PROGRESS: 15,
  REVIEW: 6,
  COMPLETED: 15,
};

export const SAMPLE_TOTAL_PROJECTS = 6;
export const SAMPLE_OVERDUE_TASKS = 4;

export const SAMPLE_RECENT_TASKS = [
  { id: 't1', name: 'Design onboarding screens', assignee: 'Sample User A', priority: 'HIGH',   status: 'IN_PROGRESS', due: 'Oct 3, 2026' },
  { id: 't2', name: 'Write API documentation',   assignee: 'Sample User B', priority: 'MEDIUM', status: 'TO_DO',       due: 'Oct 7, 2026' },
  { id: 't3', name: 'Review pull request #24',   assignee: 'Sample User C', priority: 'HIGH',   status: 'REVIEW',      due: 'Oct 2, 2026' },
  { id: 't4', name: 'Set up staging database',   assignee: 'Sample User B', priority: 'LOW',    status: 'COMPLETED',   due: 'Sep 28, 2026' },
  { id: 't5', name: 'Fix login redirect',        assignee: 'Sample User A', priority: 'MEDIUM', status: 'IN_PROGRESS', due: 'Oct 5, 2026' },
  { id: 't6', name: 'Prepare demo slides',       assignee: 'Sample User D', priority: 'LOW',    status: 'TO_DO',       due: 'Oct 12, 2026' },
];

export const SAMPLE_RECENT_PROJECTS = [
  { id: 'p1', name: 'Website Redesign',  status: 'IN_PROGRESS', progress: 68 },
  { id: 'p2', name: 'Mobile App Launch', status: 'IN_PROGRESS', progress: 42 },
  { id: 'p3', name: 'Internal Wiki',     status: 'REVIEW',      progress: 90 },
  { id: 'p4', name: 'Data Migration',    status: 'TO_DO',       progress: 8 },
];
