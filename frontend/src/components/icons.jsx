/* Inline SVG icons: no icon library, no new dependency (Constitution II). */
const icon = (children) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const DashboardIcon = () => icon(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>);
export const ProjectsIcon  = () => icon(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />);
export const TasksIcon     = () => icon(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m9 12 2 2 4-4" /></>);
export const MyTasksIcon   = () => icon(<><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></>);
export const TeamIcon      = () => icon(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4A6 6 0 0 1 21 20" /></>);
export const SearchIcon    = () => icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const BellIcon      = () => icon(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></>);
export const MenuIcon      = () => icon(<path d="M4 6h16M4 12h16M4 18h16" />);
export const CloseIcon     = () => icon(<path d="M6 6l12 12M18 6 6 18" />);
export const CheckCircleIcon = () => icon(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>);
export const ClockIcon     = () => icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const AlertIcon     = () => icon(<><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17.5v.01" /></>);
