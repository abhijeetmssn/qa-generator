import React, { useState, useRef, useEffect } from 'react';
import type { Product } from '../services/api';
import { apiUploadProductImage, apiGetHazards } from '../services/api';
import type { Hazard } from '../services/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface EditProductProps {
  product: Product;
  onSave: (uniqueId: string, updates: Partial<Product>) => void;
  onCancel: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const EditProduct: React.FC<EditProductProps> = ({ product, onSave, onCancel }) => {
  const [form, setForm] = useState({
    name: product.name || '',
    batch: product.batch || '',
    mfg: product.mfg || '',
    expiry: product.expiry || '',
    packingSize: product.packingSize || '',
    manufacturerAddress: product.manufacturerAddress || '',
    technicalName: product.technicalName || '',
    registrationNumber: product.registrationNumber || '',
    manufacturerLicence: product.manufacturerLicence || '',
    marketedBy: product.marketedBy || '',
  });
  const [hazardId, setHazardId] = useState<string>(product.hazardId ? String(product.hazardId) : '');
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const existingImageUrl = product.productImage
    ? `${API_BASE.replace('/api', '')}${product.productImage}`
    : null;
  const [imagePreview, setImagePreview] = useState<string | null>(existingImageUrl);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiGetHazards().then(setHazards).catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (imageFile) {
        try {
          await apiUploadProductImage(product.uniqueId, imageFile);
        } catch (imgErr) {
          console.error('Failed to upload image:', imgErr);
        }
      }
      await onSave(product.uniqueId, { ...form, hazardId: hazardId ? Number(hazardId) : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-product-wrapper">
      <div className="add-product-header">
        <h1>Edit Product</h1>
        <div className="header-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>
            ← Back to List
          </button>
        </div>
      </div>
      <div className="content-card">
        <form className="add-product-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Product Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Product name" required />
            </div>
            <div className="form-group">
              <label>Batch Number</label>
              <input name="batch" value={form.batch} onChange={handleChange} placeholder="Batch number" />
            </div>
            <div className="form-group">
              <label>Manufacturing Date</label>
              <DatePicker
                selected={form.mfg ? new Date(form.mfg + '-01') : null}
                onChange={(date: Date | null) => {
                  setForm(prev => ({ ...prev, mfg: date ? date.toISOString().slice(0, 7) : '' }));
                }}
                dateFormat="yyyy-MM"
                showMonthYearPicker
                showFullMonthYearPicker
                placeholderText="Select month and year"
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label>Expiry Date</label>
              <DatePicker
                selected={form.expiry ? new Date(form.expiry + '-01') : null}
                onChange={(date: Date | null) => {
                  setForm(prev => ({ ...prev, expiry: date ? date.toISOString().slice(0, 7) : '' }));
                }}
                dateFormat="yyyy-MM"
                showMonthYearPicker
                showFullMonthYearPicker
                placeholderText="Select month and year"
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label>Manufacturer Address</label>
              <input name="manufacturerAddress" value={form.manufacturerAddress} onChange={handleChange} placeholder="Full address" />
            </div>
            <div className="form-group">
              <label>Technical Name</label>
              <input name="technicalName" value={form.technicalName} onChange={handleChange} placeholder="Technical name" />
            </div>
            <div className="form-group">
              <label>Registration Number</label>
              <input name="registrationNumber" value={form.registrationNumber} onChange={handleChange} placeholder="Registration #" />
            </div>
            <div className="form-group">
              <label>Manufacturer Licence</label>
              <input name="manufacturerLicence" value={form.manufacturerLicence} onChange={handleChange} placeholder="Licence #" />
            </div>
            <div className="form-group">
              <label>Marketed By</label>
              <input name="marketedBy" value={form.marketedBy} onChange={handleChange} placeholder="Company that markets this product" />
            </div>
            <div className="form-group">
              <label>Packaging Size</label>
              <input name="packingSize" value={form.packingSize} onChange={handleChange} placeholder="e.g. 500 ml, 1 kg" />
            </div>
            <div className="form-group">
              <label>Cautionary / Hazard Symbol</label>
              <select
                value={hazardId}
                onChange={e => setHazardId(e.target.value)}
                disabled={!product.is_master}
                style={{
                  width: '100%', padding: '8px 12px',
                  border: '1px solid #d1d5db', borderRadius: '8px',
                  fontSize: '14px', background: product.is_master ? 'white' : '#f8fafc',
                  color: product.is_master ? '#1e293b' : '#64748b',
                  cursor: product.is_master ? 'default' : 'not-allowed',
                }}
              >
                <option value="">— No hazard symbol —</option>
                {hazards.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              {!product.is_master && (
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Hazard can only be changed on the parent product — it applies to all batches.
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Product Image</label>
              {imagePreview && (
                <div style={{ marginBottom: '8px' }}>
                  <img src={imagePreview} alt="Product" style={{ maxWidth: '150px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                </div>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImageFile(file);
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setImagePreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ padding: '8px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
            <button type="button" className="secondary-btn" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Read-only info */}
      <div className="content-card" style={{ marginTop: '16px', padding: '16px', background: '#f8fafc' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', color: '#64748b' }}>
          <span><strong>Unique ID:</strong> {product.uniqueId}</span>
        </div>
      </div>
    </div>
  );
};

export default EditProduct;
