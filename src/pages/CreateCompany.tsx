import React, { useState, useRef } from 'react';
import { apiCreateCompany, apiUploadLogo } from '../services/api';
import ToggleSwitch from '../components/ToggleSwitch';
import type { Company } from '../services/api';

interface CreateCompanyProps {
  onCompanyCreated: (company: Company) => void;
  onCancel: () => void;
}

const CreateCompany: React.FC<CreateCompanyProps> = ({ onCompanyCreated, onCancel }) => {
  const [formData, setFormData] = useState<Company>({
    name: '',
    logo: undefined,
    address: '',
    phone: '',
    email: '',
    website: '',
    facebookUrl: '',
    instagramUrl: '',
    scanAnalyticsEnabled: true,
    perPackQrEnabled: false,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.name?.trim()) {
        setError('Company name is required');
        return;
      }

      const createdCompany = await apiCreateCompany(formData);
      
      // Upload logo if provided
      if (logoFile && createdCompany.id) {
        try {
          setLogoUploading(true);
          await apiUploadLogo(logoFile, createdCompany.id);
        } catch (logoErr: any) {
          console.error('Logo upload error (non-fatal):', logoErr.message);
        } finally {
          setLogoUploading(false);
        }
      }

      setFormData({
        name: '',
        logo: undefined,
        address: '',
        phone: '',
        email: '',
        website: '',
        scanAnalyticsEnabled: true,
        perPackQrEnabled: false,
      });
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      onCompanyCreated(createdCompany);
    } catch (err: any) {
      setError(err.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page">
      <div className="form-page-inner">
        <div className="page-header">
          <div>
            <h1>Create New Company</h1>
            <p className="page-subtitle">Add a company and its customer-care details shown on the product page.</p>
          </div>
        </div>

        {error && (
          <div className="alert is-danger">{error}</div>
        )}

        <div className="content-card">
          <form onSubmit={handleSubmit} className="field-grid">
        {/* Company Name */}
        <div className="field is-full">
          <label className="field-label">
            Company Name <span className="required">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name || ''}
            onChange={handleChange}
            placeholder="Enter company name"
            required
            disabled={loading}
          />
        </div>

        {/* Address */}
        <div className="field is-full">
          <label className="field-label">
            Address
          </label>
          <textarea
            name="address"
            value={formData.address || ''}
            onChange={handleChange}
            placeholder="Enter company address"
            disabled={loading}
            rows={4}
            style={{
              resize: 'vertical',
            }}
          />
        </div>

        {/* Phone */}
        <div className="field">
          <label className="field-label">
            Phone
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone || ''}
            onChange={handleChange}
            placeholder="Enter phone number"
            disabled={loading}
          />
        </div>

        {/* Email */}
        <div className="field">
          <label className="field-label">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email || ''}
            onChange={handleChange}
            placeholder="Enter company email"
            disabled={loading}
          />
        </div>

        {/* Logo Upload */}
        <div className="field">
          <label className="field-label">
            Company Logo
          </label>
          <div className="logo-upload-row">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleLogoSelect}
              disabled={loading}
            />
            {logoUploading && <span className="field-hint">Uploading...</span>}
            {logoPreview && !logoUploading && (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="logo-preview"
              />
            )}
          </div>
        </div>

        {/* Website */}
        <div className="field">
          <label className="field-label">
            Website
          </label>
          <input
            type="text"
            name="website"
            value={formData.website || ''}
            onChange={handleChange}
            placeholder="www.example.com"
            disabled={loading}
          />
        </div>

        {/* Facebook */}
        <div className="field">
          <label className="field-label">
            Facebook Link
          </label>
          <input
            type="text"
            name="facebookUrl"
            value={formData.facebookUrl || ''}
            onChange={handleChange}
            placeholder="https://facebook.com/yourpage"
            disabled={loading}
          />
        </div>

        {/* Instagram */}
        <div className="field">
          <label className="field-label">
            Instagram Link
          </label>
          <input
            type="text"
            name="instagramUrl"
            value={formData.instagramUrl || ''}
            onChange={handleChange}
            placeholder="https://instagram.com/yourhandle"
            disabled={loading}
          />
        </div>

        {/* Scan Analytics Toggle */}
        <div className="field is-full">
          <label className="field-label">
            Scan Analytics
          </label>
          <ToggleSwitch
            checked={!!formData.scanAnalyticsEnabled}
            onChange={() => setFormData(prev => ({ ...prev, scanAnalyticsEnabled: !prev.scanAnalyticsEnabled }))}
            disabled={loading}
            onLabel="Enabled — QR scan events will be tracked"
            offLabel="Disabled — scans will not be recorded"
          />
        </div>

        {/* One QR per pack Toggle */}
        <div className="field is-full">
          <label className="field-label">
            One QR per Pack
          </label>
          <ToggleSwitch
            checked={!!formData.perPackQrEnabled}
            onChange={() => setFormData(prev => ({ ...prev, perPackQrEnabled: !prev.perPackQrEnabled }))}
            disabled={loading}
            onLabel="Allowed — new batches can get a unique QR for every pack"
            offLabel="Not allowed — one QR per batch only"
          />
        </div>

        {/* Buttons */}
        <div className="form-actions is-full">
          <button type="button" className="secondary-btn" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={loading || logoUploading}>
            {loading || logoUploading ? 'Creating...' : 'Create Company'}
          </button>
        </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCompany;
