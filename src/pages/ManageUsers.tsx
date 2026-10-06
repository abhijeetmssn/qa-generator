import React, { useState, useEffect } from 'react';
import { apiCreateUser, apiGetAllCompanies, apiGetAllUsers, apiUnlockUser, apiLockUser } from '../services/api';
import type { UserRole, Company, ManagedUser } from '../services/api';
import Icon from '../components/Icon';

interface ManageUsersProps {
  adminCompanyName?: string;
}

const ROLE_BADGE: Record<string, string> = {
  admin: 'is-warning',
  editor: 'is-info',
  viewer: 'is-neutral',
};

const ManageUsers: React.FC<ManageUsersProps> = ({ adminCompanyName }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState<number | string>('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await apiGetAllUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to fetch users:', err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    const fetchCompanies = async () => {
      setCompaniesLoading(true);
      try {
        const data = await apiGetAllCompanies();
        setCompanies(data);
        if (data.length > 0 && adminCompanyName) {
          const adminCompany = data.find(c => c.name === adminCompanyName);
          if (adminCompany?.id) setCompanyId(adminCompany.id);
        }
      } catch (err: any) {
        console.error('Failed to fetch companies:', err.message);
      } finally {
        setCompaniesLoading(false);
      }
    };
    fetchCompanies();
    fetchUsers();
  }, [adminCompanyName]);

  const handleToggleLock = async (user: ManagedUser) => {
    setTogglingUid(user.uid);
    try {
      if (user.lockedAt) {
        await apiUnlockUser(user.uid);
        setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, lockedAt: null } : u));
      } else {
        await apiLockUser(user.uid);
        setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, lockedAt: new Date().toISOString() } : u));
      }
    } catch (err: any) {
      console.error('Failed to toggle lock:', err.message);
    } finally {
      setTogglingUid(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!email || !password) return setMessage({ type: 'error', text: 'Email and password are required.' });
    if (password.length < 6) return setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
    if (!companyId) return setMessage({ type: 'error', text: 'Please select a company.' });

    setLoading(true);
    try {
      const result = await apiCreateUser(email, password, Number(companyId), role);
      setMessage({ type: 'success', text: `User "${result.user.email}" created as ${role}!` });
      setEmail(''); setPassword(''); setRole('viewer'); setCompanyId('');
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create user.' });
    } finally {
      setLoading(false);
    }
  };

  const roleDescriptions: Record<UserRole, string> = {
    admin: 'Full access — manage users, bulk upload, add/edit/delete products',
    editor: 'Can add, edit, and delete products',
    viewer: 'View-only — can only browse existing products',
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="manage-users-page">
      <div className="section-heading">
        <h2>Create New User</h2>
        <p>Add a new user account with specific permissions.</p>
      </div>

      {message && (
        <div className={`alert is-${message.type === 'success' ? 'success' : 'danger'}`}>
          {message.text}
        </div>
      )}

      <form className="add-product-form" onSubmit={handleCreateUser}>
        <div className="form-grid">
          <div className="form-group full-width">
            <label>Select Company *</label>
            <select
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              disabled={companiesLoading}
              required
            >
              <option value="">-- Select a company --</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {companiesLoading && <p className="field-hint">Loading companies...</p>}
            {!companiesLoading && companies.length === 0 && (
              <p className="field-hint is-error">No companies available. Create a company first.</p>
            )}
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required minLength={6} />
          </div>

          <div className="form-group full-width">
            <label>User Role *</label>
            <div className="role-options">
              {(['viewer', 'editor', 'admin'] as UserRole[]).map(r => (
                <label key={r} className={`role-option${role === r ? ' is-selected' : ''}`}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                  <div>
                    <div className="role-option-title">
                      {r === 'viewer' ? 'Viewer' : r === 'editor' ? 'Editor' : 'Admin'}
                    </div>
                    <div className="role-option-desc">{roleDescriptions[r]}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="primary-btn" disabled={loading}>
            <Icon name="plus" size={16} />
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>

      {/* All Users Table */}
      <div className="section-block">
        <div className="section-heading-row">
          <div className="section-heading">
            <h2>All Users</h2>
            <p>
              {users.length} user{users.length !== 1 ? 's' : ''} · {users.filter(u => u.lockedAt).length} locked
            </p>
          </div>
          <div className="filter-bar-row">
            <input
              type="text"
              className="search-input"
              placeholder="Search by email, role, company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="secondary-btn" onClick={fetchUsers} disabled={usersLoading}>
              <Icon name="refresh" size={15} />
              {usersLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {usersLoading ? (
          <p className="muted-text">Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            {search ? 'No users match your search.' : 'No users found.'}
          </div>
        ) : (
          <div className="table-frame">
            <table className="products-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, idx) => {
                  const isLocked = !!u.lockedAt;
                  return (
                    <tr key={u.uid} className={isLocked ? 'is-locked' : undefined}>
                      <td className="cell-muted">{idx + 1}</td>
                      <td className="cell-strong">{u.email}</td>
                      <td>
                        <span className={`badge ${ROLE_BADGE[u.role] || ROLE_BADGE.viewer}`} style={{ textTransform: 'capitalize' }}>
                          {u.role}
                        </span>
                      </td>
                      <td className="cell-muted">{u.companyName || '—'}</td>
                      <td>
                        {isLocked ? (
                          <span className="badge is-danger" title={new Date(u.lockedAt!).toLocaleString()}>Locked</span>
                        ) : (
                          <span className="badge is-success">Active</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className={`icon-btn ${isLocked ? 'view' : 'delete'}`}
                          onClick={() => handleToggleLock(u)}
                          disabled={togglingUid === u.uid}
                        >
                          {togglingUid === u.uid ? '...' : isLocked ? 'Unlock' : 'Lock'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageUsers;
