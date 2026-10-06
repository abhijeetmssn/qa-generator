import React, { useState } from 'react';
import { apiChangePassword } from '../services/api';

const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (next !== confirm) { setError('New passwords do not match.'); return; }
    if (next === current) { setError('New password must be different from the current one.'); return; }
    setSaving(true);
    try {
      await apiChangePassword(current, next);
      setSuccess(true);
      setTimeout(onClose, 1300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-modal" onClick={e => e.stopPropagation()}>
        <h2 className="cp-title">Change Password</h2>
        {success ? (
          <p className="cp-success">Password changed successfully.</p>
        ) : (
          <form onSubmit={submit}>
            <div className="cp-field">
              <label>Current Password</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoFocus required />
            </div>
            <div className="cp-field">
              <label>New Password</label>
              <input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="At least 6 characters" required />
            </div>
            <div className="cp-field">
              <label>Confirm New Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            {error && <p className="cp-error">{error}</p>}
            <div className="cp-actions">
              <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Updating…' : 'Update Password'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordModal;
