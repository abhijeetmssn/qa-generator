import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import PublicProduct from './pages/PublicProduct';
import { apiGetMe, apiLogout, apiGetCompanyPublic } from './services/api';
import type { UserRole } from './services/api';
import './App.css';

interface User {
  email: string;
  uid: string;
  companyName?: string;
  companyId?: number;
  companyAddress?: string;
  role?: UserRole;
}

interface CompanyInfo {
  id: number;
  name: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicProductId, setPublicProductId] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [companyNotFound, setCompanyNotFound] = useState(false);

  useEffect(() => {
    // Check if viewing a public product by hash
    const hash = window.location.hash;
    if (hash.startsWith('#product/')) {
      const productId = hash.replace('#product/', '');
      setPublicProductId(productId);
      setLoading(false);
      return;
    }

    // Check if URL path contains a company ID (e.g., /10)
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const possibleCompanyId = pathParts[0];

    const loadCompanyAndAuth = async () => {
      // If path has a numeric company ID, fetch it
      if (possibleCompanyId && /^\d+$/.test(possibleCompanyId)) {
        try {
          const company = await apiGetCompanyPublic(Number(possibleCompanyId));
          setCompanyInfo(company);
        } catch {
          setCompanyNotFound(true);
          setLoading(false);
          return;
        }
      }

      // Verify token with API on load
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const data = await apiGetMe();
          setUser(data.user);
        } catch {
          apiLogout();
        }
      }
      setLoading(false);
    };

    loadCompanyAndAuth();
  }, []);

  // Listen for hash changes to support public product links
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#product/')) {
        const productId = hash.replace('#product/', '');
        setPublicProductId(productId);
      } else {
        setPublicProductId(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    apiLogout();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fb 0%, #e8eef8 100%)',
      }}>
        <div style={{
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px',
            animation: 'spin 2s linear infinite',
          }}>
            ⏳
          </div>
          <p style={{
            fontSize: '18px',
            color: '#666',
            fontWeight: '500',
          }}>
            Loading...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If viewing a public product, show it without requiring login
  if (publicProductId) {
    return <PublicProduct uniqueId={publicProductId} />;
  }

  // If company ID in URL was not found
  if (companyNotFound) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fb 0%, #e8eef8 100%)',
        padding: '20px',
      }}>
        <div style={{
          textAlign: 'center',
          background: 'white',
          padding: '60px 40px',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          maxWidth: '480px',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔗</div>
          <h1 style={{ color: '#dc2626', margin: '0 0 12px', fontSize: '28px' }}>URL Not Found</h1>
          <p style={{ color: '#64748b', fontSize: '16px', lineHeight: '1.6', margin: 0 }}>
            The company you are looking for does not exist. Please check the URL and try again.
          </p>
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{
              marginTop: '24px',
              padding: '12px 32px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} companyInfo={companyInfo} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App
