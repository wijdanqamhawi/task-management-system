/*
 * SAMPLE DATA — NOT REAL.
 *
 * The Dashboard is not connected to the backend yet. Everything in this file is invented
 * placeholder content used to lay out the screen. (Recent tasks and projects now live in
 * public/data/*.json and are fetched; only the summary figures remain here.) It must be replaced by API data
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
