import { useState } from 'react';
import {
  AppBar, Avatar, Badge, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import FolderIcon from '@mui/icons-material/FolderOutlined';
import TaskIcon from '@mui/icons-material/TaskAltOutlined';
import AssignmentIcon from '@mui/icons-material/AssignmentIndOutlined';
import NotificationsIcon from '@mui/icons-material/NotificationsOutlined';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import ChecklistIcon from '@mui/icons-material/Checklist';
import { useSession } from '../auth/SessionContext.jsx';
import { useUnread } from '../notifications/UnreadContext.jsx';
import { useRouter } from '../router/Router.jsx';
import { ROUTES } from '../router/routes.js';
import { ROLE_LABELS } from '../constants.js';
import { canAdministerUsers } from '../utils/permissions.js';
import { initials } from '../utils/format.js';

const DRAWER_WIDTH = 248;

const NAV = [
  { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: <DashboardIcon /> },
  { to: ROUTES.PROJECTS, label: 'Projects', icon: <FolderIcon /> },
  { to: ROUTES.TASKS, label: 'Tasks', icon: <TaskIcon /> },
  { to: ROUTES.MY_TASKS, label: 'My Tasks', icon: <AssignmentIcon /> },
  { to: ROUTES.NOTIFICATIONS, label: 'Notifications', icon: <NotificationsIcon />, badge: true },
  { to: ROUTES.USERS, label: 'Users', icon: <PeopleIcon />, needsUserAdmin: true },
  { to: ROUTES.PROFILE, label: 'Profile', icon: <PersonIcon /> },
];

export default function Layout({ children }) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const { user, logout } = useSession();
  const { unread } = useUnread();
  const { pathname, navigate } = useRouter();

  // Detail pages highlight their parent section.
  const isActive = (to) => pathname === to || pathname.startsWith(`${to}/`);
  // Same rule as the Users route: either user-administration permission.
  const items = NAV.filter((item) => !item.needsUserAdmin || canAdministerUsers(user));

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  // Once the session is cleared the route guard sends the user to the login screen.
  const signOut = async () => {
    setOpen(false);
    try { await logout(); } catch { /* the guard re-checks the session either way */ }
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1.5, px: 2.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
          <ChecklistIcon fontSize="small" />
        </Avatar>
        <Typography variant="h6" noWrap>
          Task Management
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {items.map((item) => (
          <ListItemButton
            key={item.to}
            selected={isActive(item.to)}
            onClick={() => go(item.to)}
            sx={{ borderRadius: 2, mb: 0.5, '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.main' }, '&.Mui-selected .MuiListItemIcon-root': { color: 'primary.main' } }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {item.badge ? (
                <Badge badgeContent={unread} color="error">
                  {item.icon}
                </Badge>
              ) : (
                item.icon
              )}
            </ListItemIcon>
            <ListItemText primary={item.label} slotProps={{ primary: { fontWeight: 600 } }} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <List sx={{ px: 1.5, py: 1.5 }}>
        <ListItemButton sx={{ borderRadius: 2 }} onClick={signOut}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Logout" slotProps={{ primary: { fontWeight: 600 } }} />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ ml: { md: `${DRAWER_WIDTH}px` }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          {!desktop && (
            <IconButton edge="start" onClick={() => setOpen(true)} sx={{ mr: 1 }} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flex: 1 }}>
            Task Management System
          </Typography>
          <IconButton onClick={() => go(ROUTES.NOTIFICATIONS)} aria-label="Notifications">
            <Badge badgeContent={unread} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <Box sx={{ ml: 1.5, textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="body2" fontWeight={600}>
              {user.fullName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ROLE_LABELS[user.role] ?? user.role}
            </Typography>
          </Box>
          <Avatar sx={{ ml: 1.5, bgcolor: 'primary.main' }}>{initials(user.fullName)}</Avatar>
          <Tooltip title="Sign out">
            <IconButton onClick={signOut} sx={{ ml: 0.5 }} aria-label="Sign out">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={desktop ? 'permanent' : 'temporary'}
          open={desktop || open}
          onClose={() => setOpen(false)}
          slotProps={{
            root: { keepMounted: true },
            paper: { sx: { width: DRAWER_WIDTH, borderRight: 1, borderColor: 'divider' } },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 4 } }}>
        <Toolbar />
        <Box sx={{ maxWidth: 1280, mx: 'auto' }}>{children}</Box>
      </Box>
    </Box>
  );
}
