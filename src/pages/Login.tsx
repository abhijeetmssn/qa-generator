import React, { useState } from 'react';
import { apiLogin } from '../services/api';
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiLogin(email, password);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
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
                {logoUrl && !logoError ? (
                  <img
                    src={logoUrl}
                    alt={companyInfo.name}
                    onError={() => setLogoError(true)}
                    style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain', marginBottom: '16px', borderRadius: '12px' }}
                  />
                ) : (
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    fontSize: '36px',
                    fontWeight: 700,
                    color: 'white',
                    letterSpacing: '2px',
                  }}>
                    {companyInfo.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <h1 className="login-title">{companyInfo.name}</h1>
                <p className="login-subtitle">Sign in to your company portal</p>
              </>
            ) : (
              <>
                <div className="login-logo">
                  <div className="logo-q">A</div>
                  <div className="logo-a">P</div>
                </div>
                <h1 className="login-title">AP Solutions</h1>
                <p className="login-subtitle">Pharmaceutical Quality Assurance</p>
              </>
            )}
            <div style={{ marginTop: '20px', padding: '12px', background: '#f3f4f6', borderRadius: '8px', fontSize: '13px', color: '#666' }}>
              <strong>Note:</strong> Self-registration is disabled. Please contact your administrator to create an account.
            </div>
          </div>

          <div className="login-features">
            <div className="feature">
              <div className="feature-icon">📦</div>
              <h3>Product Management</h3>
              <p>Manage inventory with ease</p>
            </div>
            <div className="feature">
              <div className="feature-icon">🔍</div>
              <h3>QR Scanning</h3>
              <p>Quick product lookup</p>
            </div>
            <div className="feature">
              <div className="feature-icon">📊</div>
              <h3>Analytics</h3>
              <p>Track expiry & stock</p>
            </div>
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
