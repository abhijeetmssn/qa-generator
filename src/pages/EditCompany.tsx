import React, { useState, useEffect, useRef } from 'react';
import { apiGetCompanyById, apiUpdateCompany, apiUploadLogo, apiGetAllCompanies, apiRenewSubscription } from '../services/api';
import Icon from '../components/Icon';
import ToggleSwitch from '../components/ToggleSwitch';
import type { Company } from '../services/api';

interface EditCompanyProps {
  companyId?: number;
  isAdmin?: boolean;
  onSaved: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const EditCompany: React.FC<EditCompanyProps> = ({ companyId, isAdmin, onSaved }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(companyId || null);
  const [formData, setFormData] = useState<Company>({ name: '', address: '', phone: '', email: '', website: '', facebookUrl: '', instagramUrl: '', scanAnalyticsEnabled: true, perPackQrEnabled: false });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all companies for dropdown (admin only)
  useEffect(() => {
    if (!isAdmin) { setLoadingCompanies(false); return; }
    apiGetAllCompanies()
      .then(list => { setCompanies(list); setLoadingCompanies(false); })
      .catch(() => setLoadingCompanies(false));
  }, [isAdmin]);

  // Load selected company details
  useEffect(() => {
    if (!selectedCompanyId) return;
    setLoading(true);
    setError('');
    setLogoFile(null);
    setLogoPreview(null);
    setCurrentLogoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    apiGetCompanyById(selectedCompanyId)
      .then(async company => {
        setFormData({ name: company.name || '', address: company.address || '', phone: company.phone || '', email: company.email || '', website: company.website || '', facebookUrl: company.facebookUrl || '', instagramUrl: company.instagramUrl || '', scanAnalyticsEnabled: company.scanAnalyticsEnabled !== false, perPackQrEnabled: company.perPackQrEnabled === true });
        setSubscriptionExpiresAt(company.subscriptionExpiresAt || null);
        const logoUrl = `${API_BASE}/companies/${selectedCompanyId}/logo`;
        const res = await fetch(logoUrl);
        if (res.ok) setCurrentLogoUrl(logoUrl + '?t=' + Date.now());
      })
      .catch(() => setError('Failed to load company details.'))
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    setError('');
    setSuccess(false);
    if (!formData.name?.trim()) { setError('Company name is required.'); return; }
    setSaving(true);
    try {
      const payload: Partial<Company> = { name: formData.name, address: formData.address, phone: formData.phone, email: formData.email, website: formData.website, facebookUrl: formData.facebookUrl, instagramUrl: formData.instagramUrl };
      if (isAdmin) payload.scanAnalyticsEnabled = formData.scanAnalyticsEnabled; // scan analytics is admin-only
      if (isAdmin) payload.perPackQrEnabled = formData.perPackQrEnabled; // per-pack QR access is admin-only
      await apiUpdateCompany(selectedCompanyId, payload);
      if (logoFile) {
        await apiUploadLogo(logoFile, selectedCompanyId);
        setCurrentLogoUrl(`${API_BASE}/companies/${selectedCompanyId}/logo?t=` + Date.now());
        setLogoFile(null);
        setLogoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      // Update company name in dropdown list
      setCompanies(prev => prev.map(c => c.id === selectedCompanyId ? { ...c, name: formData.name } : c));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingCompanies) {
    return (
      <div className="add-product-wrapper">
        <div className="page-header">
        <div>
          <h1>Edit Company</h1>
          <p className="page-subtitle">Company details and customer-care contacts shown on the product page.</p>
        </div>
      </div>
        <div className="content-card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#64748b' }}>Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="add-product-wrapper">
      <div className="page-header">
        <div>
          <h1>Edit Company</h1>
          <p className="page-subtitle">Company details and customer-care contacts shown on the product page.</p>
        </div>
      </div>

      <div className="content-card">

        {/* Company Selector — admin only */}
        {isAdmin && (
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>Select Company</label>
            <select
              value={selectedCompanyId ?? ''}
              onChange={e => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-- Select a company to edit --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Company Form */}
        {selectedCompanyId ? (
          loading ? (
            <div className="empty-state">Loading company details...</div>
          ) : (
            <>
              <div className="card-section-title">Company Details</div>

              {error && (
                <div className="alert is-danger">{error}</div>
              )}
              {success && (
                <div className="alert is-success">Company details saved successfully.</div>
              )}

              <form className="add-product-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>COMPANY NAME <span className="required">*</span></label>
                    <input name="name" value={formData.name} onChange={handleChange} placeholder="Enter company name" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>ADDRESS</label>
                    <input name="address" value={formData.address || ''} onChange={handleChange} placeholder="Enter company address" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>PHONE</label>
                    <input name="phone" value={formData.phone || ''} onChange={handleChange} placeholder="Enter phone number" />
                  </div>
                  <div className="form-group">
                    <label>EMAIL</label>
                    <input name="email" type="email" value={formData.email || ''} onChange={handleChange} placeholder="Enter email address" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>WEBSITE</label>
                    <input name="website" type="text" value={formData.website || ''} onChange={handleChange} placeholder="www.example.com" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>FACEBOOK LINK</label>
                    <input name="facebookUrl" type="text" value={formData.facebookUrl || ''} onChange={handleChange} placeholder="https://facebook.com/yourpage" />
                  </div>
                  <div className="form-group">
                    <label>INSTAGRAM LINK</label>
                    <input name="instagramUrl" type="text" value={formData.instagramUrl || ''} onChange={handleChange} placeholder="https://instagram.com/yourhandle" />
                  </div>
                </div>

                {/* Maintenance / Subscription */}
                <div className="form-row">
                  <div className="form-group">
                    <label>MAINTENANCE SUBSCRIPTION</label>
                    {(() => {
                      const days = subscriptionExpiresAt
                        ? Math.ceil((new Date(subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : null;
                      const tone = days === null ? 'neutral' : days <= 0 ? 'danger' : days <= 10 ? 'warning' : 'success';
                      return (
                        <div className="subscription-row">
                          <span className={`badge is-${tone}`}>
                            {days === null
                              ? 'No expiry set'
                              : days <= 0
                              ? 'Expired'
                              : `${days} day${days !== 1 ? 's' : ''} remaining`}
                          </span>
                          {subscriptionExpiresAt && (
                            <div className="field-hint" style={{ margin: 0 }}>
                              Expires: {new Date(subscriptionExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              disabled={renewing}
                              onClick={async () => {
                                if (!selectedCompanyId) return;
                                setRenewing(true);
                                try {
                                  const updated = await apiRenewSubscription(selectedCompanyId);
                                  setSubscriptionExpiresAt(updated.subscriptionExpiresAt || null);
                                } catch {
                                  setError('Failed to renew subscription.');
                                } finally {
                                  setRenewing(false);
                                }
                              }}
                              className="secondary-btn"
                            >
                              <Icon name="refresh" size={15} />
                              {renewing ? 'Renewing...' : 'Renew 1 Month'}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Scan Analytics Toggle — admin only */}
                {isAdmin && (
                <div className="form-row">
                  <div className="form-group">
                    <label>SCAN ANALYTICS</label>
                    <ToggleSwitch
                      checked={!!formData.scanAnalyticsEnabled}
                      onChange={() => setFormData(prev => ({ ...prev, scanAnalyticsEnabled: !prev.scanAnalyticsEnabled }))}
                      onLabel="Enabled — QR scan events will be tracked"
                      offLabel="Disabled — scans will not be recorded"
                    />
                  </div>
                </div>
                )}

                {/* One QR per pack — admin only */}
                {isAdmin && (
                <div className="form-row">
                  <div className="form-group">
                    <label>ONE QR PER PACK</label>
                    <ToggleSwitch
                      checked={!!formData.perPackQrEnabled}
                      onChange={() => setFormData(prev => ({ ...prev, perPackQrEnabled: !prev.perPackQrEnabled }))}
                      onLabel="Allowed — new batches can get a unique QR for every pack"
                      offLabel="Not allowed — one QR per batch only"
                    />
                  </div>
                </div>
                )}

                {/* Logo Section */}
                <div className="card-section-title" style={{ marginTop: '8px' }}>Company Logo</div>
                <div className="logo-editor">
                  <div className="logo-editor-preview">
                    <div className="logo-box">
                      {logoPreview ? (
                        <img src={logoPreview} alt="New logo preview" />
                      ) : currentLogoUrl ? (
                        <img src={currentLogoUrl} alt="Current logo" />
                      ) : (
                        <Icon name="building" size={36} strokeWidth={1.4} />
                      )}
                    </div>
                    <span className="logo-caption">
                      {logoPreview ? 'New logo (unsaved)' : currentLogoUrl ? 'Current logo' : 'No logo'}
                    </span>
                  </div>
                  <div className="logo-editor-actions">
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoSelect} style={{ display: 'none' }} id="logo-file-input" />
                    <div className="logo-editor-buttons">
                      <label htmlFor="logo-file-input" className="secondary-btn">
                        <Icon name="upload" size={15} /> {logoFile ? 'Change Logo' : 'Upload Logo'}
                      </label>
                      {logoPreview && (
                        <button type="button" onClick={handleRemoveLogo} className="secondary-btn is-danger">
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="field-hint" style={{ margin: 0 }}>PNG, JPG or WebP · Max 5MB</p>
                    {logoFile && <p className="field-hint" style={{ margin: 0, color: 'var(--success-700)' }}>Selected: {logoFile.name}</p>}
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="submit-btn" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </>
          )
        ) : (
          !isAdmin && (
            <div className="empty-state">No company assigned to your account.</div>
          )
        )}
      </div>
    </div>
  );
};

export default EditCompany;
