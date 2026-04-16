import React, { useState } from 'react';
import { apiLogin, SubscriptionExpiredError } from '../services/api';
import type { UserRole } from '../services/api';
import '../styles/Login.css';

interface CompanyInfo {
  id: number;
  name: string;
}

interface LoginProps {
  onLoginSuccess: (user: {
    email: string;
    uid: string;
    companyName?: string;
    companyId?: number;
    companyAddress?: string;
    role?: UserRole;
  }) => void;
  companyInfo?: CompanyInfo | null;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, companyInfo }) => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);

  const getDaysRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubscriptionExpiry(null);
    setLoading(true);

    try {
      const data = await apiLogin(email, password);
      onLoginSuccess(data.user);
    } catch (err: any) {
      if (err instanceof SubscriptionExpiredError) {
        setSubscriptionExpiry(err.subscriptionExpiresAt);
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    }

    setLoading(false);
  };

  const logoUrl = companyInfo ? `${API_BASE}/companies/${companyInfo.id}/logo` : null;

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Left Side - Branding */}
        <div className="login-left">
          <div className="login-branding">
            {companyInfo ? (
              <>
                <div className="login-logo-box">
                  {logoUrl && !logoError ? (
                    <img
                      src={logoUrl}
                      alt={companyInfo.name}
                      onError={() => setLogoError(true)}
                      className="login-logo-img"
                    />
                  ) : (
                    <div className="login-logo-fallback">
                      {companyInfo.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <h1 className="login-title">{companyInfo.name}</h1>
                <p className="login-subtitle">Welcome to your company portal</p>
                <div className="login-divider" />
              </>
            ) : (
              <>
                <div className="login-logo-box">
                  <div className="login-logo-fallback">APAS</div>
                </div>
                <h1 className="login-title">APAS</h1>
                <p className="login-subtitle">Agri Product Authentication System</p>
                <div className="login-divider" />
              </>
            )}
          </div>

          <div className="login-features">
            <div className="feature">
              <div className="feature-icon-wrap">📦</div>
              <div>
                <h3>Product Management</h3>
                <p>Manage inventory with ease</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon-wrap">🔍</div>
              <div>
                <h3>QR Scanning</h3>
                <p>Instant product lookup via QR</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon-wrap">📊</div>
              <div>
                <h3>Analytics</h3>
                <p>Track expiry &amp; stock levels</p>
              </div>
            </div>
          </div>

          <div className="login-note">
            🔒 Access is restricted to authorised users only. Contact your administrator to get an account.
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="login-right">
          <div className="form-card">
            <h2 className="form-title">Sign In</h2>
            <p className="form-subtitle">Sign in to your account</p>

            <form onSubmit={handleLogin}>
              {/* Email Input */}
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Input */}
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Subscription expired warning */}
              {subscriptionExpiry && (() => {
                const days = getDaysRemaining(subscriptionExpiry);
                const daysSince = Math.abs(Math.min(0, days));
                const dataDeletesIn = Math.max(0, 15 - daysSince);
                return (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '14px', marginBottom: '6px' }}>
                      ⚠️ Subscription Expired
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c', lineHeight: '1.5' }}>
                      {dataDeletesIn > 0
                        ? `Your data will be permanently deleted in ${dataDeletesIn} day${dataDeletesIn !== 1 ? 's' : ''}. Please pay your subscription amount to restore access.`
                        : 'Your data deletion period has passed. Please contact your administrator immediately.'}
                    </p>
                  </div>
                );
              })()}

              {/* Error Message */}
              {error && <div className="error-message">{error}</div>}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-login"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            {/* Footer */}
            <div className="login-footer">
              <p>
                Need an account? Contact your administrator for access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
