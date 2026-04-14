import React, { useState, useEffect } from 'react';
import { apiCreateUser, apiGetAllCompanies, apiGetAllUsers, apiUnlockUser, apiLockUser } from '../services/api';
import type { UserRole, Company, ManagedUser } from '../services/api';

interface ManageUsersProps {
  adminCompanyName?: string;
}

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  admin:  { bg: '#fef3c7', color: '#92400e' },
  editor: { bg: '#dbeafe', color: '#1e40af' },
  viewer: { bg: '#f1f5f9', color: '#475569' },
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
      <h2 style={{ marginBottom: '8px', color: '#1e293b' }}>Create New User</h2>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Add a new user account with specific permissions.
      </p>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
          background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          fontSize: '14px',
        }}>
          {message.type === 'success' ? '✅ ' : '❌ '}{message.text}
        </div>
      )}

      <form className="add-product-form" onSubmit={handleCreateUser}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Select Company *</label>
            <select
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: 'white' }}
              disabled={companiesLoading}
              required
            >
              <option value="">-- Select a company --</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {companiesLoading && <p style={{ fontSize: '13px', color: '#6366f1', marginTop: '4px' }}>Loading companies...</p>}
            {!companiesLoading && companies.length === 0 && (
              <p style={{ fontSize: '13px', color: '#dc2626', marginTop: '4px' }}>No companies available. Create a company first.</p>
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

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>User Role *</label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
              {(['viewer', 'editor', 'admin'] as UserRole[]).map(r => (
                <label key={r} style={{
                  flex: '1', minWidth: '160px', display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s ease',
                  border: role === r ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                  background: role === r ? '#eef2ff' : '#fff',
                }}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} style={{ marginTop: '3px' }} />
                  <div>
                    <div style={{ fontWeight: 600, textTransform: 'capitalize', color: '#1e293b', fontSize: '14px' }}>
                      {r === 'viewer' ? '👁️ Viewer' : r === 'editor' ? '✏️ Editor' : '🔑 Admin'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{roleDescriptions[r]}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? '⏳ Creating...' : '➕ Create User'}
          </button>
        </div>
      </form>

      {/* All Users Table */}
      <div style={{ marginTop: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ marginBottom: '4px', color: '#1e293b' }}>All Users</h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              {users.length} user{users.length !== 1 ? 's' : ''} · {users.filter(u => u.lockedAt).length} locked
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by email, role, company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', width: '220px', outline: 'none' }}
            />
            <button
              onClick={fetchUsers}
              disabled={usersLoading}
              style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151' }}
            >
              {usersLoading ? '⏳' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {usersLoading ? (
          <p style={{ color: '#6366f1', fontSize: '14px' }}>Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '20px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '14px', textAlign: 'center' }}>
            {search ? 'No users match your search.' : 'No users found.'}
          </div>
        ) : (
          <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, idx) => {
                  const isLocked = !!u.lockedAt;
                  const rc = ROLE_COLOR[u.role] || ROLE_COLOR.viewer;
                  return (
                    <tr key={u.uid} style={{ borderBottom: '1px solid #f1f5f9', background: isLocked ? '#fff5f5' : '#fff' }}>
                      <td style={tdStyle}>{idx + 1}</td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: '#1e293b' }}>{u.email}</td>
                      <td style={tdStyle}>
                        <span style={{ background: rc.bg, color: rc.color, padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: '#64748b' }}>{u.companyName || '—'}</td>
                      <td style={tdStyle}>
                        {isLocked ? (
                          <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '13px' }}>
                            🔒 Locked
                            <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                              {new Date(u.lockedAt!).toLocaleString()}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>✅ Active</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleLock(u)}
                          disabled={togglingUid === u.uid}
                          style={{
                            padding: '5px 16px', borderRadius: '7px', border: 'none', fontWeight: 600, fontSize: '13px',
                            cursor: togglingUid === u.uid ? 'not-allowed' : 'pointer',
                            background: togglingUid === u.uid ? '#e2e8f0' : isLocked ? '#dcfce7' : '#fee2e2',
                            color: togglingUid === u.uid ? '#94a3b8' : isLocked ? '#166534' : '#991b1b',
                          }}
                        >
                          {togglingUid === u.uid ? '...' : isLocked ? '🔓 Unlock' : '🔒 Lock'}
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

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: '12px',
  fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em',
};
const tdStyle: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' };

export default ManageUsers;
