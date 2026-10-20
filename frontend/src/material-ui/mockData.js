// Mock data for the isolated Material UI preview. Nothing here talks to the backend.

export const ROLES = ['ADMIN', 'MANAGER', 'MEMBER'];
export const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const STATUS_LABEL = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

export const currentUser = {
  id: 1,
  fullName: 'Amir Hassan',
  email: 'amir.hassan@example.com',
  role: 'MANAGER',
  active: true,
};

export const users = [
  currentUser,
  { id: 2, fullName: 'Sara Khalil', email: 'sara.khalil@example.com', role: 'ADMIN', active: true },
  { id: 3, fullName: 'Omar Nasser', email: 'omar.nasser@example.com', role: 'MEMBER', active: true },
  { id: 4, fullName: 'Lina Haddad', email: 'lina.haddad@example.com', role: 'MEMBER', active: true },
  { id: 5, fullName: 'Yousef Darwish', email: 'yousef.darwish@example.com', role: 'MEMBER', active: false },
  { id: 6, fullName: 'Noor Salem', email: 'noor.salem@example.com', role: 'MANAGER', active: true },
];

export const projects = [
  {
    id: 1,
    title: 'Website Redesign',
    description: 'Refresh the public website with a new design system and improved accessibility.',
    status: 'ACTIVE',
    progress: 68,
    members: [1, 2, 3, 4],
  },
  {
    id: 2,
    title: 'Mobile App Launch',
    description: 'Plan, build and release the first version of the companion mobile application.',
    status: 'ACTIVE',
    progress: 42,
    members: [1, 3, 6],
  },
  {
    id: 3,
    title: 'Data Migration',
    description: 'Move legacy reporting data to the new Oracle schema with validation checks.',
    status: 'ON_HOLD',
    progress: 25,
    members: [2, 6],
  },
  {
    id: 4,
    title: 'Customer Onboarding',
    description: 'Streamline the onboarding flow and documentation for new customers.',
    status: 'COMPLETED',
    progress: 100,
    members: [1, 4, 6],
  },
];

export const tasks = [
  { id: 101, title: 'Design new landing page', projectId: 1, status: 'IN_PROGRESS', priority: 'HIGH', assignees: [3, 4], due: '2026-11-02', description: 'Create high-fidelity mockups for the new landing page, including mobile and tablet breakpoints.' },
  { id: 102, title: 'Audit accessibility issues', projectId: 1, status: 'TODO', priority: 'MEDIUM', assignees: [1], due: '2026-11-10', description: 'Run an accessibility audit and list WCAG violations on the main pages.' },
  { id: 103, title: 'Migrate blog content', projectId: 1, status: 'DONE', priority: 'LOW', assignees: [4], due: '2026-10-05', description: 'Move existing blog posts to the new content structure.' },
  { id: 104, title: 'Set up CI pipeline', projectId: 2, status: 'IN_PROGRESS', priority: 'URGENT', assignees: [1, 3], due: '2026-10-12', description: 'Configure automated builds and tests for the mobile app repository.' },
  { id: 105, title: 'Write push notification service', projectId: 2, status: 'TODO', priority: 'HIGH', assignees: [3], due: '2026-11-20', description: 'Implement the service that sends push notifications for task updates.' },
  { id: 106, title: 'Validate migrated records', projectId: 3, status: 'BLOCKED', priority: 'HIGH', assignees: [2, 6], due: '2026-10-15', description: 'Compare row counts and checksums between legacy and new tables.' },
  { id: 107, title: 'Update onboarding guide', projectId: 4, status: 'DONE', priority: 'MEDIUM', assignees: [4, 6], due: '2026-09-30', description: 'Revise the onboarding documentation with the latest screenshots.' },
  { id: 108, title: 'Review sprint backlog', projectId: 2, status: 'TODO', priority: 'LOW', assignees: [1], due: '2026-10-28', description: 'Prioritize backlog items for the upcoming sprint.' },
  { id: 109, title: 'Prepare release notes', projectId: 1, status: 'IN_PROGRESS', priority: 'MEDIUM', assignees: [1, 2], due: '2026-10-10', description: 'Draft release notes summarizing the redesign changes.' },
];

export const taskExtras = {
  subtasks: [
    { id: 1, title: 'Collect brand assets', done: true },
    { id: 2, title: 'Draft wireframes', done: true },
    { id: 3, title: 'Create high-fidelity mockups', done: false },
    { id: 4, title: 'Review with stakeholders', done: false },
  ],
  comments: [
    { id: 1, userId: 2, text: 'Please make sure the hero section works on small screens.', at: '2026-10-14 09:20' },
    { id: 2, userId: 3, text: 'Updated the wireframes, ready for review.', at: '2026-10-15 14:05' },
  ],
  attachments: [
    { id: 1, name: 'wireframes-v2.pdf', size: '1.4 MB' },
    { id: 2, name: 'brand-guidelines.png', size: '860 KB' },
  ],
  activity: [
    { id: 1, text: 'Sara Khalil created this task', at: '2026-10-10 08:00' },
    { id: 2, text: 'Omar Nasser changed status to In Progress', at: '2026-10-13 11:30' },
    { id: 3, text: 'Lina Haddad was assigned', at: '2026-10-13 11:32' },
  ],
};

export const notifications = [
  { id: 1, type: 'ASSIGNMENT', text: 'You were assigned to "Set up CI pipeline"', at: '5 min ago', read: false },
  { id: 2, type: 'COMMENT', text: 'Sara Khalil commented on "Design new landing page"', at: '1 hour ago', read: false },
  { id: 3, type: 'DEADLINE', text: '"Prepare release notes" is due tomorrow', at: '3 hours ago', read: false },
  { id: 4, type: 'OVERDUE', text: '"Validate migrated records" is overdue', at: 'Yesterday', read: true },
  { id: 5, type: 'UPDATE', text: 'Omar Nasser moved "Write push notification service" to To Do', at: 'Yesterday', read: true },
  { id: 6, type: 'UPDATE', text: 'Project "Customer Onboarding" was marked completed', at: '2 days ago', read: true },
];
