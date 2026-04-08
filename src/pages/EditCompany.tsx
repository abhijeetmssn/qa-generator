import React, { useState, useEffect, useRef } from 'react';
import { apiGetCompanyById, apiUpdateCompany, apiUploadLogo } from '../services/api';
import type { Company } from '../services/api';

interface EditCompanyProps {
  companyId: number;
  onSaved: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const EditCompany: React.FC<EditCompanyProps> = ({ companyId, onSaved }) => {
  const [formData, setFormData] = useState<Company>({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const company = await apiGetCompanyById(companyId);
        setFormData({
          name: company.name || '',
          address: company.address || '',
          phone: company.phone || '',
          email: company.email || '',
          website: company.website || '',
        });
        // Check if logo exists
        const logoUrl = `${API_BASE}/companies/${companyId}/logo`;
        const res = await fetch(logoUrl);
        if (res.ok) {
          setCurrentLogoUrl(logoUrl + '?t=' + Date.now());
        }
      } catch (err) {
        console.error('Failed to load company:', err);
        setError('Failed to load company details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

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
    setError('');
    setSuccess(false);

    if (!formData.name?.trim()) {
      setError('Company name is required.');
      return;
    }

    setSaving(true);
    try {
      await apiUpdateCompany(companyId, {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        website: formData.website,
      });

      if (logoFile) {
        await apiUploadLogo(logoFile, companyId);
        setCurrentLogoUrl(`${API_BASE}/companies/${companyId}/logo?t=` + Date.now());
        setLogoFile(null);
        setLogoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="add-product-wrapper">
        <div className="add-product-header"><h1>Edit Company</h1></div>
        <div className="content-card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: '#64748b' }}>Loading company details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="add-product-wrapper">
      <div className="add-product-header">
        <h1>Edit Company</h1>
      </div>

      <div className="content-card">
        <div className="card-section-title">Company Details</div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', marginBottom: '16px', fontSize: '0.9rem' }}>
            {error}
          </div>
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
              <input name="website" value={formData.website || ''} onChange={handleChange} placeholder="https://example.com" />
            </div>
          </div>

          {/* Logo Section */}
          <div className="card-section-title" style={{ marginTop: '8px' }}>Company Logo</div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
            {/* Current / Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '120px', height: '120px', borderRadius: '12px', border: '2px dashed #cbd5e1',
                background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
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

            {/* Upload controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '200px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoSelect}
                style={{ display: 'none' }}
                id="logo-file-input"
              />
              <label htmlFor="logo-file-input" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                background: 'white', border: '1.5px solid #4caf50', borderRadius: '10px',
                padding: '10px 18px', color: '#4caf50', fontWeight: 600, fontSize: '0.9rem',
                transition: 'all 0.2s', width: 'fit-content',
              }}>
                📁 {logoFile ? 'Change Logo' : 'Upload Logo'}
              </label>
              {logoPreview && (
                <button type="button" onClick={handleRemoveLogo} style={{
                  background: 'white', border: '1.5px solid #ef4444', borderRadius: '10px',
                  padding: '10px 18px', color: '#ef4444', fontWeight: 600, fontSize: '0.9rem',
                  cursor: 'pointer', width: 'fit-content',
                }}>
                  ✕ Remove
                </button>
              )}
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                PNG, JPG or WebP · Max 5MB
              </p>
              {logoFile && (
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#15803d', fontWeight: 500 }}>
                  Selected: {logoFile.name}
                </p>
              )}
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: '8px' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditCompany;
