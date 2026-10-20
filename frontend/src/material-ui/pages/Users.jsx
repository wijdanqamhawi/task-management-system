import { useState } from 'react';
import { MenuItem, Paper, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Chip, Stack } from '@mui/material';
import { ROLES, users as initialUsers } from '../mockData.js';
import { PageHeader, UserAvatar } from '../shared.jsx';

export default function Users() {
  // Local-only edits; the preview never calls the backend.
  const [users, setUsers] = useState(initialUsers);
  const update = (id, patch) => setUsers((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  return (
    <>
      <PageHeader title="Users" subtitle="Manage roles and account access" />
      <TableContainer component={Paper} sx={{ border: 1, borderColor: 'divider', boxShadow: '0 2px 8px rgba(31, 41, 51, 0.06)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Full name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.5} sx={{ fontWeight: 600, alignItems: 'center' }}>
                    <UserAvatar userId={u.id} size={32} />
                    <span>{u.fullName}</span>
                  </Stack>
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <TextField select size="small" value={u.role} onChange={(e) => update(u.id, { role: e.target.value })} sx={{ minWidth: 140 }}>
                    {ROLES.map((r) => (
                      <MenuItem key={r} value={r}>{r}</MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={u.active ? 'Active' : 'Inactive'} color={u.active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <Switch checked={u.active} onChange={(e) => update(u.id, { active: e.target.checked })} slotProps={{ input: { 'aria-label': `Toggle ${u.fullName}` } }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
