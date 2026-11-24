import { useState } from 'react';
import { Alert, Button, Chip, InputAdornment, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { AsyncView, PagerBar, PageHeader, RoleChip, UserAvatar } from '../shared.jsx';
import { ConfirmDialog } from '../dialogs.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useSession } from '../../auth/SessionContext.jsx';
import { activateUser, deactivateUser, listUsers, setRole } from '../../api/users.js';
import { ROLES, ROLE_LABELS } from '../../constants.js';
import { canAssignRoles, canManageUserStatus } from '../../utils/permissions.js';
import { errorMessage } from '../../utils/format.js';

export default function Users() {
  const { user: me } = useSession();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const state = useApi((signal) => listUsers({ search: applied, page, size: 20 }, { signal }), [applied, page]);

  async function run(userId, action, success) {
    setBusyId(userId);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      state.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Assign roles and activate or deactivate accounts." />
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
      <Stack component="form" direction="row" spacing={1.5} role="search" sx={{ mb: 2 }} onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(search.trim()); }}>
        <TextField
          size="small" placeholder="Search by name, username or email" value={search} sx={{ flex: 1, maxWidth: 420 }}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }, htmlInput: { 'aria-label': 'Search users' } }}
        />
        <Button type="submit" variant="outlined">Search</Button>
        {applied && <Button onClick={() => { setSearch(''); setApplied(''); setPage(0); }}>Clear</Button>}
      </Stack>
      <AsyncView state={state}>
        {(data) => (
          <>
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
                  {data.content.map((u) => {
                    const isMe = u.userId === me.userId;
                    return (
                      <TableRow key={u.userId} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} sx={{ fontWeight: 600, alignItems: 'center' }}>
                            <UserAvatar name={u.fullName} size={32} />
                            <span>{u.fullName}</span>
                          </Stack>
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          {canAssignRoles(me) ? (
                            <TextField
                              select size="small" value={u.role} sx={{ minWidth: 140 }}
                              disabled={isMe || busyId === u.userId}
                              slotProps={{ htmlInput: { 'aria-label': `Role of ${u.fullName}` } }}
                              onChange={(e) => run(u.userId, () => setRole(u.userId, e.target.value), `${u.fullName} is now ${ROLE_LABELS[e.target.value]}.`)}
                            >
                              {ROLES.map((r) => <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>)}
                            </TextField>
                          ) : <RoleChip role={u.role} />}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={u.isActive ? 'Active' : 'Deactivated'} color={u.isActive ? 'success' : 'default'} />
                        </TableCell>
                        <TableCell align="right">
                          {canManageUserStatus(me) && (
                            <Switch
                              checked={u.isActive} disabled={isMe || busyId === u.userId}
                              slotProps={{ input: { 'aria-label': `Toggle ${u.fullName}` } }}
                              onChange={(e) => (e.target.checked
                                ? run(u.userId, () => activateUser(u.userId), `${u.fullName} was reactivated.`)
                                : setConfirm(u))}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {data.content.length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}>{applied ? 'No users match your search.' : 'No users yet.'}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <PagerBar data={data} onPage={setPage} />
          </>
        )}
      </AsyncView>
      {confirm && (
        <ConfirmDialog
          title="Deactivate account" confirmLabel="Deactivate" busy={busyId === confirm.userId} onCancel={() => setConfirm(null)}
          message={`${confirm.fullName} will be signed out on their next request and cannot sign in until reactivated. Their tasks stay in place.`}
          onConfirm={() => run(confirm.userId, () => deactivateUser(confirm.userId), `${confirm.fullName} was deactivated.`)}
        />
      )}
    </>
  );
}
