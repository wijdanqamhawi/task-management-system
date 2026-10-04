/* User administration (Admin only): roles and activation. FR-004, FR-006, FR-008a. */
import { useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { Badge, Button, Select, Table, TextInput } from '../components/index.jsx';
import { Async, ConfirmDialog, Notice, PageHeader, Pagination } from '../components/common.jsx';
import { useApi } from '../hooks/useApi.js';
import { useSession } from '../auth/SessionContext.jsx';
import { activateUser, deactivateUser, listUsers, setRole } from '../api/users.js';
import { ROLES, ROLE_LABELS } from '../constants.js';
import { errorMessage } from '../utils/format.js';

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

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

  const columns = [
    { key: 'fullName', header: 'Name', render: (u) => <strong>{u.fullName}</strong> },
    { key: 'username', header: 'Username' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role',
      render: (u) => (
        <Select aria-label={`Role of ${u.fullName}`} value={u.role} options={ROLE_OPTIONS}
                disabled={u.userId === me.userId || busyId === u.userId}
                onChange={(e) => run(u.userId, () => setRole(u.userId, e.target.value),
                                     `${u.fullName} is now ${ROLE_LABELS[e.target.value]}.`)} />
      ) },
    { key: 'isActive', header: 'Status',
      render: (u) => (u.isActive
        ? <Badge value="ACTIVE">Active</Badge>
        : <Badge kind="inactive">Deactivated</Badge>) },
    { key: 'actions', header: '',
      render: (u) => (u.isActive
        ? <Button type="button" disabled={u.userId === me.userId || busyId === u.userId}
                  title={u.userId === me.userId ? 'You cannot deactivate yourself' : undefined}
                  onClick={() => setConfirm(u)}>Deactivate</Button>
        : <Button type="button" disabled={busyId === u.userId}
                  onClick={() => run(u.userId, () => activateUser(u.userId), `${u.fullName} was reactivated.`)}>Activate</Button>) },
  ];

  return (
    <AppLayout title="Users">
      <PageHeader title="User administration" subtitle="Assign roles and activate or deactivate accounts." />
      <Notice kind="error" onClose={() => setError('')}>{error}</Notice>
      <Notice kind="success" onClose={() => setNotice('')}>{notice}</Notice>

      <section className="panel">
        <form className="row" role="search" onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(search.trim()); }}>
          <div className="spacer" style={{ minWidth: 200 }}>
            <TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                       placeholder="Search by name, username or email" aria-label="Search users" />
          </div>
          <Button type="submit">Search</Button>
          {applied && <Button type="button" onClick={() => { setSearch(''); setApplied(''); setPage(0); }}>Clear</Button>}
        </form>
        <br />
        <Async state={state}>
          {(data) => (
            <>
              <Table columns={columns} rows={data.content.map((u) => ({ ...u, id: u.userId }))}
                     empty={applied ? 'No users match your search.' : 'No users yet.'} />
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPage={setPage} />
            </>
          )}
        </Async>
      </section>

      {confirm && (
        <ConfirmDialog title="Deactivate account" danger confirmLabel="Deactivate" busy={busyId === confirm.userId}
          message={`${confirm.fullName} will be signed out on their next request and cannot sign in until reactivated. Their tasks stay in place.`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(confirm.userId, () => deactivateUser(confirm.userId), `${confirm.fullName} was deactivated.`)} />
      )}
    </AppLayout>
  );
}
