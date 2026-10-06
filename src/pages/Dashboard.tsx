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
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { apiGetProducts, apiAddProduct, apiUpdateProduct, apiDeleteProduct, apiUploadProductImage, apiExportDatabase, apiGetCompanyById, apiGetAllCompanies, apiRenewSubscription } from '../services/api';
import type { Product, Company } from '../services/api';
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
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 3000);
  };

  const [exportingDb, setExportingDb] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [scanAnalyticsEnabled, setScanAnalyticsEnabled] = useState<boolean>(false);
  const [perPackQrEnabled, setPerPackQrEnabled] = useState<boolean>(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [renewingId, setRenewingId] = useState<number | null>(null);

  const sortByExpiry = (list: Company[]) =>
    [...list].sort((a, b) => {
      const ta = a.subscriptionExpiresAt ? new Date(a.subscriptionExpiresAt).getTime() : Infinity;
      const tb = b.subscriptionExpiresAt ? new Date(b.subscriptionExpiresAt).getTime() : Infinity;
      return ta - tb;
    });

  const handleRenew = async (c: Company) => {
    if (!c.id) return;
    if (!window.confirm(`Renew subscription for "${c.name}" by 1 month?`)) return;
    setRenewingId(c.id);
    try {
      const updated = await apiRenewSubscription(c.id);
      setCompanies(prev => sortByExpiry(prev.map(x => x.id === c.id ? { ...x, subscriptionExpiresAt: updated.subscriptionExpiresAt } : x)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to renew subscription');
    } finally {
      setRenewingId(null);
    }
  };

  useEffect(() => {
    if (user.companyId) {
      apiGetCompanyById(user.companyId)
        .then(c => {
          setSubscriptionExpiresAt(c.subscriptionExpiresAt || null);
          setScanAnalyticsEnabled(c.scanAnalyticsEnabled !== false);
          setPerPackQrEnabled(c.perPackQrEnabled === true);
        })
        .catch(console.error);
    }
  }, [user.companyId]);

  const getDaysRemaining = (expiresAt: string | null): number => {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Admins see all companies + their subscription expiry on the dashboard
  useEffect(() => {
    if (user.role !== 'admin') return;
    setLoadingCompanies(true);
    apiGetAllCompanies()
      .then(list => setCompanies(sortByExpiry(list))) // soonest to expire first
      .catch(console.error)
      .finally(() => setLoadingCompanies(false));
  }, [user.role]);

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
    if (hash.startsWith('#p/') || hash.startsWith('#product/')) {
      const productId = hash.startsWith('#p/') ? hash.replace('#p/', '') : hash.replace('#product/', '');
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
      showToast('Changes saved successfully');
    } catch (error) {
      console.error('Failed to update product:', error);
      alert('Failed to update product');
    }
  };

  const handleProductAdded = async (newProduct: any) => {
    const imageFile = newProduct._imageFile;
    delete newProduct._imageFile;
    // packCodes is only set when the batch was created with one QR per pack
    const { packCodes, ...saved } = await apiAddProduct(newProduct);
    // Upload image if provided
    if (imageFile && saved.uniqueId) {
      try {
        const imgResult = await apiUploadProductImage(saved.uniqueId, imageFile);
        saved.productImage = imgResult.productImage;
      } catch (imgErr) {
        console.error('Failed to upload product image:', imgErr);
      }
    }
    setAllProducts(prev => [saved, ...prev]);
    return packCodes ? { ...saved, packCodes } : saved;
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
        return <AddProduct onProductAdded={handleProductAdded} onProductsList={() => setPage('list')} isAdmin={user.role === 'admin'} perPackQrAllowed={perPackQrEnabled} />;
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
        ) : user.role === 'editor' && user.companyId ? (
          <EditCompany companyId={user.companyId} isAdmin={false} onSaved={() => {}} />
        ) : <div className="page-placeholder">You don't have permission to edit company details.</div>;
      case 'hazards':
        return <ManageHazards />;
      case 'scan-analytics':
        return scanAnalyticsEnabled
          ? <ScanAnalytics />
          : <div className="page-placeholder">Scan Analytics is not enabled for your company.</div>;
      case 'trash':
        return <Trash canEdit={canEdit} isAdmin={user.role === 'admin'} onRestored={async () => {
          const products = await apiGetProducts();
          setAllProducts(products);
        }} />;
      default:
        return (
          <div className="dashboard-home">
            <div className="page-header">
              <div>
                <h1>Dashboard</h1>
                <p className="page-subtitle">{user.companyName ? `Overview for ${user.companyName}` : "Overview of your account"}</p>
              </div>
            </div>

            {/* Subscription status */}
            {subscriptionExpiresAt && (() => {
              const days = getDaysRemaining(subscriptionExpiresAt);
              const daysSinceExpiry = days <= 0 ? Math.abs(days) : 0;
              const dataDeletesIn = Math.max(0, 15 - daysSinceExpiry);
              const tone = days <= 0 ? "danger" : days <= 10 ? "warning" : "success";
              return (
                <div className={`notice is-${tone}`}>
                  <div className="notice-icon"><Icon name={days <= 0 ? "alert" : "clock"} size={20} /></div>
                  <div className="notice-body">
                    <div className="notice-title">
                      {days <= 0 ? "Subscription Expired" : `${days} Day${days !== 1 ? "s" : ""} Remaining`}
                    </div>
                    <p>
                      {days <= 0
                        ? dataDeletesIn > 0
                          ? `Your data will be permanently deleted in ${dataDeletesIn} day${dataDeletesIn !== 1 ? "s" : ""}. Please pay your subscription to avoid data loss.`
                          : "Your data deletion period has passed. Please contact admin immediately to recover your account."
                        : days <= 10
                          ? "Your maintenance subscription is expiring soon. Please contact admin to renew."
                          : "Your maintenance subscription is active."}
                    </p>
                    <p className="notice-meta">
                      {days <= 0 ? "Expired on: " : "Renewal due on: "}
                      {new Date(subscriptionExpiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-icon"><Icon name="package" size={22} /></div>
                <div>
                  <div className="stat-label">Total Products</div>
                  <div className="stat-value">
                    {loadingProducts
                      ? <Spinner size="small" />
                      : allProducts.length}
                  </div>
                </div>
              </div>
            </div>

            {user.role === "admin" && (
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Companies &amp; Subscriptions</h2>
                    <p className="panel-subtitle">Soonest to expire first</p>
                  </div>
                </div>
                {loadingCompanies ? (
                  <div className="panel-body"><Spinner size="small" /></div>
                ) : companies.length === 0 ? (
                  <div className="panel-body"><p className="muted-text">No companies found.</p></div>
                ) : (
                  <div className="table-scroll-wrapper">
                    <table className="companies-table">
                      <thead>
                        <tr><th>Company</th><th>Subscription Expiry</th><th>Status</th><th></th></tr>
                      </thead>
                      <tbody>
                        {companies.map(c => {
                          const days = getDaysRemaining(c.subscriptionExpiresAt || null);
                          const tone = days <= 0 ? "danger" : days <= 10 ? "warning" : "success";
                          const label = !c.subscriptionExpiresAt ? "—" : days <= 0 ? "Expired" : `${days}d left`;
                          return (
                            <tr key={c.id}>
                              <td className="cell-strong">{c.name}</td>
                              <td>{c.subscriptionExpiresAt ? new Date(c.subscriptionExpiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                              <td><span className={`badge is-${c.subscriptionExpiresAt ? tone : "neutral"}`}>{label}</span></td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  type="button"
                                  className="renew-btn"
                                  onClick={() => handleRenew(c)}
                                  disabled={renewingId === c.id}
                                >
                                  {renewingId === c.id ? "Renewing…" : "Renew"}
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
            )}
            {user.role === "admin" && (
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Database Export</h2>
                    <p className="panel-subtitle">Download a full .sql backup of all tables and data. Use it to restore or migrate the database.</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleExportDb}
                    disabled={exportingDb}
                  >
                    <Icon name="database" size={16} />
                    {exportingDb ? "Exporting..." : "Export Database (.sql)"}
                  </button>
                </div>
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
            <span className="nav-icon"><Icon name="dashboard" /></span>
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
            <span className="nav-icon"><Icon name="plus" /></span>
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
            <span className="nav-icon"><Icon name="list" /></span>
            Products List
          </a>
          {scanAnalyticsEnabled && (
            <a
              href="#"
              className={page === 'scan-analytics' ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                setPage('scan-analytics');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><Icon name="scan" /></span>
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
              <span className="nav-icon"><Icon name="trash" /></span>
              Trash
            </a>
          )}
          {user.role === 'editor' && user.companyId && (
            <a
              href="#"
              className={page === 'edit-company' ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                setPage('edit-company');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><Icon name="edit" /></span>
              Edit Company
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
                <span className="nav-icon"><Icon name="users" /></span>
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
                <span className="nav-icon"><Icon name="building" /></span>
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
                <span className="nav-icon"><Icon name="edit" /></span>
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
                <span className="nav-icon"><Icon name="upload" /></span>
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
                <span className="nav-icon"><Icon name="alert" /></span>
                Manage Hazards
              </a>
            </>
          )}
        </nav>
        <div className="powered-by">
          {user.companyName ? (
            <>
              <div className="powered-by-company">{user.companyName}</div>
              {user.companyAddress && (
                <div className="powered-by-address">{user.companyAddress}</div>
              )}
              <div className="powered-by-brand">
                Powered by <a href="#">APAS</a>
              </div>
            </>
          ) : (
            <div className="powered-by-brand">Powered by <a href="#">APAS</a></div>
          )}
        </div>
      </aside>
      <main className="main-content">
        <header className="header">
          <button type="button" className="menu-icon" aria-label="Open menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Icon name="menu" size={22} />
          </button>
          <div className="header-right">
            {subscriptionExpiresAt && (() => {
              const days = getDaysRemaining(subscriptionExpiresAt);
              const tone = days <= 0 ? 'danger' : days <= 10 ? 'warning' : 'success';
              const daysSinceExpiry = days <= 0 ? Math.abs(days) : 0;
              const dataDeletesIn = Math.max(0, 15 - daysSinceExpiry);
              const expiryDate = new Date(subscriptionExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <div title={`Renewal due on ${expiryDate}`} className={`header-pill is-${tone}`}>
                  <Icon name={days > 0 ? 'clock' : 'alert'} size={14} strokeWidth={2} />
                  {days > 0 ? `${days}d left · ${expiryDate}` : dataDeletesIn > 0 ? `Data deletes in ${dataDeletesIn}d` : 'Data at risk'}
                </div>
              );
            })()}
            {user && (
              <div className="user-profile">
                <button
                  className="admin-dropdown"
                  onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                >
                  <span className="user-avatar">{(user.email || 'U').charAt(0).toUpperCase()}</span>
                  <span className="user-name">{user.email?.split('@')[0] || 'User'}</span>
                  <Icon name="chevron-down" size={16} />
                </button>
                {showLogoutMenu && (
                  <div className="logout-menu">
                    <div className="menu-item-email">{user.email}</div>
                    <button
                      onClick={() => {
                        setShowLogoutMenu(false);
                        setShowChangePassword(true);
                      }}
                      className="menu-item"
                    >
                      <Icon name="key" size={16} /> Change Password
                    </button>
                    <button
                      onClick={() => {
                        setShowLogoutMenu(false);
                        onLogout();
                      }}
                      className="menu-item logout-btn"
                    >
                      <Icon name="logout" size={16} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <section className="dashboard-main">{renderPage()}</section>
      </main>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {toast && <div className="app-toast">{toast}</div>}
    </div>
  );
};

export default Dashboard;
