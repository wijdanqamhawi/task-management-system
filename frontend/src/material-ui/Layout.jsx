import { useState } from 'react';
import {
  AppBar, Avatar, Badge, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, useMediaQuery,
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

const DRAWER_WIDTH = 248;

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { key: 'projects', label: 'Projects', icon: <FolderIcon /> },
  { key: 'tasks', label: 'Tasks', icon: <TaskIcon /> },
  { key: 'my-tasks', label: 'My Tasks', icon: <AssignmentIcon /> },
  { key: 'notifications', label: 'Notifications', icon: <NotificationsIcon /> },
  { key: 'users', label: 'Users', icon: <PeopleIcon /> },
  { key: 'profile', label: 'Profile', icon: <PersonIcon /> },
];

export default function Layout({ page, onNavigate, unread, user, children }) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);

  // Detail pages highlight their parent section.
  const activeKey = page === 'project' ? 'projects' : page === 'task' ? 'tasks' : page;

  const go = (key) => {
    setOpen(false);
    onNavigate(key);
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
        {NAV.map((item) => (
          <ListItemButton
            key={item.key}
            selected={activeKey === item.key}
            onClick={() => go(item.key)}
            sx={{ borderRadius: 2, mb: 0.5, '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.main' }, '&.Mui-selected .MuiListItemIcon-root': { color: 'primary.main' } }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {item.key === 'notifications' ? (
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
        <ListItemButton sx={{ borderRadius: 2 }} onClick={() => go('logout')}>
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
            Material UI Preview
          </Typography>
          <IconButton onClick={() => go('notifications')} aria-label="Notifications">
            <Badge badgeContent={unread} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <Box sx={{ ml: 1.5, textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="body2" fontWeight={600}>
              {user.fullName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.role}
            </Typography>
          </Box>
          <Avatar sx={{ ml: 1.5, bgcolor: 'primary.main' }}>{user.fullName[0]}</Avatar>
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
        {children}
      </Box>
    </Box>
  );
}
