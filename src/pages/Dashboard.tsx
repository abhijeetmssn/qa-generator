import React, { useState, useEffect } from 'react';
import '../Dashboard.css';
import AddProduct from './AddProduct';
import EditProduct from './EditProduct';
import ProductsList from './ProductsList';
import ViewProduct from './ViewProduct';
import ManageUsers from './ManageUsers';
import BulkUpload from './BulkUpload';
import CreateCompany from './CreateCompany';
import EditCompany from './EditCompany';
import ManageHazards from './ManageHazards';
import Trash from './Trash';
import ScanAnalytics from './ScanAnalytics';
import Logo from '../components/Logo';
import Spinner from '../components/Spinner';
import { apiGetProducts, apiAddProduct, apiUpdateProduct, apiDeleteProduct, apiUploadProductImage, apiExportDatabase, apiGetCompanyById } from '../services/api';
import type { Product } from '../services/api';
import type { UserRole } from '../services/api';

type Page = 'dashboard' | 'add' | 'edit' | 'list' | 'trash' | 'view' | 'users' | 'bulk-upload' | 'create-company' | 'edit-company' | 'hazards' | 'scan-analytics';

interface User {
  email: string;
  uid: string;
  companyName?: string;
  companyId?: number;
  companyAddress?: string;
  role?: UserRole;
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [page, setPage] = useState<Page>('dashboard');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [exportingDb, setExportingDb] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (user.companyId) {
      apiGetCompanyById(user.companyId)
        .then(c => setSubscriptionExpiresAt(c.subscriptionExpiresAt || null))
        .catch(console.error);
    }
  }, [user.companyId]);

  const getDaysRemaining = (expiresAt: string | null): number => {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const products = await apiGetProducts();
        setAllProducts(products);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    // Check if URL contains a product ID to view (from QR code scan)
    const hash = window.location.hash;
    if (hash.startsWith('#product/')) {
      const productId = hash.replace('#product/', '');
      const product = allProducts.find(p => p.uniqueId === productId);
      if (product) {
        setSelectedProduct(product);
        setPage('view');
      }
    }
  }, [allProducts]);

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setPage('view');
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setPage('edit');
  };

  const handleDeleteProduct = async (product: Product) => {
    setDeletingId(product.uniqueId);
    try {
      await apiDeleteProduct(product.uniqueId);
      setAllProducts(prev => prev.filter(p => p.uniqueId !== product.uniqueId));
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Failed to delete product');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveProduct = async (uniqueId: string, updates: Partial<Product>) => {
    try {
      const updated = await apiUpdateProduct(uniqueId, updates);
      setAllProducts(prev => prev.map(p => p.uniqueId === uniqueId ? updated : p));
      setPage('list');
    } catch (error) {
      console.error('Failed to update product:', error);
      alert('Failed to update product');
    }
  };

  const handleProductAdded = async (newProduct: any) => {
    const imageFile = newProduct._imageFile;
    delete newProduct._imageFile;
    const saved = await apiAddProduct(newProduct);
    // Upload image if provided
    if (imageFile && saved.uniqueId) {
      try {
        const imgResult = await apiUploadProductImage(saved.uniqueId, imageFile);
        saved.productImage = imgResult.productImage;
      } catch (imgErr) {
        console.error('Failed to upload product image:', imgErr);
      }
    }
    setAllProducts(prev => [...prev, saved]);
    return saved;
  };

  const handleExportDb = async () => {
    setExportingDb(true);
    try {
      await apiExportDatabase();
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setExportingDb(false);
    }
  };

  const canEdit = user.role === 'admin' || user.role === 'editor';

  const renderPage = () => {
    switch (page) {
      case 'add':
        return <AddProduct onProductAdded={handleProductAdded} onProductsList={() => setPage('list')} />;
      case 'edit':
        return canEdit && selectedProduct ? (
          <EditProduct product={selectedProduct} onSave={handleSaveProduct} onCancel={() => setPage('list')} />
        ) : <div className="page-placeholder">You don't have permission to edit products.</div>;
      case 'list':
        return <ProductsList products={allProducts} goAdd={() => setPage('add')} onView={handleViewProduct} onEdit={handleEditProduct} onDelete={handleDeleteProduct} canEdit={canEdit} isAdmin={user.role === 'admin'} deletingId={deletingId} />;
      case 'view':
        return selectedProduct ? (
          <ViewProduct product={selectedProduct} goBack={() => setPage('list')} companyId={selectedProduct.companyId || user.companyId} companyName={selectedProduct.companyName || user.companyName} />
        ) : null;
      case 'users':
        return <ManageUsers adminCompanyName={user.companyName} />;
      case 'create-company':
        return user.role === 'admin' ? (
          <CreateCompany onCompanyCreated={() => setPage('dashboard')} onCancel={() => setPage('dashboard')} />
        ) : <div className="page-placeholder">Only admins can create companies.</div>;
      case 'bulk-upload':
        return <BulkUpload onUploadComplete={async () => {
          const products = await apiGetProducts();
          setAllProducts(products);
        }} />;
      case 'edit-company':
        return user.role === 'admin' ? (
          <EditCompany companyId={user.companyId} isAdmin={true} onSaved={() => {}} />
        ) : <div className="page-placeholder">Only admins can edit company details.</div>;
      case 'hazards':
        return <ManageHazards />;
      case 'scan-analytics':
        return canEdit
          ? <ScanAnalytics />
          : <div className="page-placeholder">You don't have permission to view scan analytics.</div>;
      case 'trash':
        return <Trash canEdit={canEdit} isAdmin={user.role === 'admin'} onRestored={async () => {
          const products = await apiGetProducts();
          setAllProducts(products);
        }} />;
      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            {/* Subscription warning card */}
            {subscriptionExpiresAt && (() => {
              const days = getDaysRemaining(subscriptionExpiresAt);
              if (days > 10) return null;
              return (
                <div className="card" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '6px', background: days <= 0 ? '#fef2f2' : days <= 5 ? '#fff7ed' : '#fffbeb', borderLeft: `4px solid ${days <= 0 ? '#ef4444' : days <= 5 ? '#f97316' : '#f59e0b'}` }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: days <= 0 ? '#dc2626' : '#92400e' }}>
                    {days <= 0 ? '⚠️ Subscription Expired' : `⏳ ${days} Day${days !== 1 ? 's' : ''} Left`}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#78350f' }}>
                    {days <= 0
                      ? 'Your maintenance subscription has expired. Please contact admin to renew.'
                      : 'Your maintenance subscription is expiring soon. Please contact admin to renew.'}
                  </p>
                </div>
              );
            })()}
            <div className="card">
              <div className="card-icon">📋</div>
              <div>
                <div className="card-title">Total Products</div>
                <div className="card-value">
                  {loadingProducts
                    ? <Spinner size="small" />
                    : allProducts.length}
                </div>
              </div>
            </div>
            {user.role === 'admin' && (
              <div className="card" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '1rem' }}>🗄️ Database Export</div>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>Download a full .sql backup of all tables and data. Use it to restore or migrate the database.</p>
                <button
                  type="button"
                  className="export-btn"
                  onClick={handleExportDb}
                  disabled={exportingDb}
                  style={{ marginTop: '4px' }}
                >
                  {exportingDb ? '⏳ Exporting...' : '⬇ Export Database (.sql)'}
                </button>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="dashboard-container">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="logo-section">
          <Logo 
            size="medium" 
            showText={true}
            companyId={user.companyId}
            companyName={user.companyName}
          />
        </div>
        <nav className="sidebar-nav">
          <a
            href="#"
            className={page === 'dashboard' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              setPage('dashboard');
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </a>
          <a
            href="#"
            className={page === 'add' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              setPage('add');
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon">➕</span>
            Add Products
          </a>
          <a
            href="#"
            className={page === 'list' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              setPage('list');
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon">📋</span>
            Products List
          </a>
          {canEdit && (
            <a
              href="#"
              className={page === 'scan-analytics' ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                setPage('scan-analytics');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">📲</span>
              Scan Analytics
            </a>
          )}
          {canEdit && (
            <a
              href="#"
              className={page === 'trash' ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                setPage('trash');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">🗑️</span>
              Trash
            </a>
          )}
          {user.role === 'admin' && (
            <>
              <a
                href="#"
                className={page === 'users' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setPage('users');
                  setSidebarOpen(false);
                }}
              >
                <span className="nav-icon">👥</span>
                Manage Users
              </a>
              <a
                href="#"
                className={page === 'create-company' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setPage('create-company');
                  setSidebarOpen(false);
                }}
              >
                <span className="nav-icon">🏢</span>
                Create Company
              </a>
              <a
                href="#"
                className={page === 'edit-company' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setPage('edit-company');
                  setSidebarOpen(false);
                }}
              >
                <span className="nav-icon">✏️</span>
                Edit Company
              </a>
              <a
                href="#"
                className={page === 'bulk-upload' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setPage('bulk-upload');
                  setSidebarOpen(false);
                }}
              >
                <span className="nav-icon">📤</span>
                Bulk Upload
              </a>
              <a
                href="#"
                className={page === 'hazards' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setPage('hazards');
                  setSidebarOpen(false);
                }}
              >
                <span className="nav-icon">⚠️</span>
                Manage Hazards
              </a>
            </>
          )}
        </nav>
        <div className="powered-by">
          {user.companyName ? (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                {user.companyName}
              </div>
              {user.companyAddress && (
                <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
                  {user.companyAddress}
                </div>
              )}
              {subscriptionExpiresAt && (() => {
                const days = getDaysRemaining(subscriptionExpiresAt);
                const color = days <= 5 ? '#ef4444' : days <= 10 ? '#f59e0b' : '#22c55e';
                return (
                  <div style={{ fontSize: '11px', marginBottom: '8px', padding: '4px 8px', borderRadius: '6px', background: days <= 5 ? '#fef2f2' : days <= 10 ? '#fffbeb' : '#f0fdf4', color, fontWeight: 600, textAlign: 'center' }}>
                    {days > 0 ? `⏳ ${days} day${days !== 1 ? 's' : ''} left` : '⚠️ Subscription expired'}
                  </div>
                );
              })()}
              <div style={{ borderTop: '1px solid #ddd', paddingTop: '8px', marginTop: '8px', fontSize: '11px', color: '#999' }}>
                Powered By <a href="#">APAS</a>
              </div>
            </>
          ) : (
            <>Powered By <a href="#">APAS</a></>
          )}
        </div>
      </aside>
      <main className="main-content">
        <header className="header">
          <div className="menu-icon" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</div>
          <div className="header-right">
            {user && (
              <div className="user-profile">
                <button
                  className="admin-dropdown"
                  onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                >
                  👤 {user.email?.split('@')[0] || 'User'} ▼
                </button>
                {showLogoutMenu && (
                  <div className="logout-menu">
                    <div className="menu-item-email">{user.email}</div>
                    <button
                      onClick={() => {
                        setShowLogoutMenu(false);
                        onLogout();
                      }}
                      className="menu-item logout-btn"
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <section className="dashboard-main">{renderPage()}</section>
      </main>
    </div>
  );
};

export default Dashboard;
