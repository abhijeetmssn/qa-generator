import React, { useState, useEffect, useRef } from 'react';
import { apiGetCompanyById, apiUpdateCompany, apiUploadLogo, apiGetAllCompanies } from '../services/api';
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
  const [formData, setFormData] = useState<Company>({ name: '', address: '', phone: '', email: '', website: '', scanAnalyticsEnabled: true });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
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
        setFormData({ name: company.name || '', address: company.address || '', phone: company.phone || '', email: company.email || '', website: company.website || '', scanAnalyticsEnabled: company.scanAnalyticsEnabled !== false });
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
      await apiUpdateCompany(selectedCompanyId, { name: formData.name, address: formData.address, phone: formData.phone, email: formData.email, website: formData.website, scanAnalyticsEnabled: formData.scanAnalyticsEnabled });
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
        <div className="add-product-header"><h1>Edit Company</h1></div>
        <div className="content-card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#64748b' }}>Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="add-product-wrapper">
      <div className="add-product-header"><h1>Edit Company</h1></div>

      <div className="content-card">

        {/* Company Selector — admin only */}
        {isAdmin && (
          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '14px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Select Company
            </label>
            <select
              value={selectedCompanyId ?? ''}
              onChange={e => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', background: '#f8f9fb', color: '#111827', cursor: 'pointer' }}
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
            <p style={{ color: '#64748b', textAlign: 'center', padding: '32px 0' }}>Loading company details...</p>
          ) : (
            <>
              <div className="card-section-title">Company Details</div>

              {error && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>
              )}
              {success && (
                <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 16px', color: '#15803d', marginBottom: '16px', fontSize: '0.9rem', fontWeight: 600 }}>
                  ✓ Company details saved successfully!
                </div>
              )}

              <form className="add-product-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>COMPANY NAME <span style={{ color: '#ef4444' }}>*</span></label>
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

                {/* Scan Analytics Toggle */}
                <div className="form-row">
                  <div className="form-group">
                    <label>SCAN ANALYTICS</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, scanAnalyticsEnabled: !prev.scanAnalyticsEnabled }))}
                        style={{
                          width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                          background: formData.scanAnalyticsEnabled ? '#22c55e' : '#d1d5db',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: '3px',
                          left: formData.scanAnalyticsEnabled ? '27px' : '3px',
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: '#fff', transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                      <span style={{ fontSize: '14px', color: formData.scanAnalyticsEnabled ? '#15803d' : '#6b7280' }}>
                        {formData.scanAnalyticsEnabled ? 'Enabled — QR scan events will be tracked' : 'Disabled — scans will not be recorded'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logo Section */}
                <div className="card-section-title" style={{ marginTop: '8px' }}>Company Logo</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '120px', height: '120px', borderRadius: '12px', border: '2px dashed #cbd5e1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="New logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px' }} />
                      ) : currentLogoUrl ? (
                        <img src={currentLogoUrl} alt="Current logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px' }} />
                      ) : (
                        <span style={{ fontSize: '2.5rem', color: '#cbd5e1' }}>🏢</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {logoPreview ? 'New logo (unsaved)' : currentLogoUrl ? 'Current logo' : 'No logo'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '200px' }}>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoSelect} style={{ display: 'none' }} id="logo-file-input" />
                    <label htmlFor="logo-file-input" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'white', border: '1.5px solid #4caf50', borderRadius: '10px', padding: '10px 18px', color: '#4caf50', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s', width: 'fit-content' }}>
                      📁 {logoFile ? 'Change Logo' : 'Upload Logo'}
                    </label>
                    {logoPreview && (
                      <button type="button" onClick={handleRemoveLogo} style={{ background: 'white', border: '1.5px solid #ef4444', borderRadius: '10px', padding: '10px 18px', color: '#ef4444', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', width: 'fit-content' }}>
                        ✕ Remove
                      </button>
                    )}
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>PNG, JPG or WebP · Max 5MB</p>
                    {logoFile && <p style={{ margin: 0, fontSize: '0.82rem', color: '#15803d', fontWeight: 500 }}>Selected: {logoFile.name}</p>}
                  </div>
                </div>

                <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: '8px' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </>
          )
        ) : (
          !isAdmin && (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '32px 0' }}>No company assigned to your account.</p>
          )
        )}
      </div>
    </div>
  );
};

export default EditCompany;
