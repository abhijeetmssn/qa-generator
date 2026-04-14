import React, { useState, useRef } from 'react';
import { apiCreateCompany, apiUploadLogo } from '../services/api';
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
    scanAnalyticsEnabled: true,
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
    <div style={{ width: '100%', padding: '20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '30px', fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
          Create New Company
        </h1>

        {error && (
          <div style={{
            padding: '16px',
            marginBottom: '24px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '8px',
            border: '1px solid #fecaca',
            fontSize: '14px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
          <form onSubmit={handleSubmit}>
        {/* Company Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
            Company Name <span style={{ color: '#ef4444' }}>*</span>
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
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
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
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
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
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
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
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
            Company Logo
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleLogoSelect}
              disabled={loading}
              style={{
                flex: 1,
                fontSize: '13px',
                padding: '8px',
              }}
            />
            {logoUploading && <span style={{ fontSize: '13px', color: '#6366f1' }}>⏳ Uploading...</span>}
            {logoPreview && !logoUploading && (
              <img
                src={logoPreview}
                alt="Logo preview"
                style={{
                  width: '50px',
                  height: '50px',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                }}
              />
            )}
          </div>
        </div>

        {/* Website */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
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

        {/* Scan Analytics Toggle */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
            Scan Analytics
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, scanAnalyticsEnabled: !prev.scanAnalyticsEnabled }))}
              disabled={loading}
              style={{
                width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
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

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '12px 28px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#f3f4f6')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || logoUploading}
            style={{
              padding: '12px 28px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              cursor: (loading || logoUploading) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              opacity: (loading || logoUploading) ? 0.7 : 1,
            }}
            onMouseEnter={(e) => !(loading || logoUploading) && (e.currentTarget.style.backgroundColor = '#2563eb')}
            onMouseLeave={(e) => !(loading || logoUploading) && (e.currentTarget.style.backgroundColor = '#3b82f6')}
          >
            {loading || logoUploading ? '⏳ Creating...' : '✓ Create Company'}
          </button>
        </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCompany;
