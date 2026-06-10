import React, { useState, useRef, useEffect } from 'react';
import type { Product } from '../services/api';
import { apiUploadProductImage, apiGetHazards } from '../services/api';
import type { Hazard } from '../services/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { formatByPrecision, parseDateStr, hasDayPart, type DatePrecision } from '../utils/dates';

interface EditProductProps {
  product: Product;
  onSave: (uniqueId: string, updates: Partial<Product>) => void;
  onCancel: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const EditProduct: React.FC<EditProductProps> = ({ product, onSave, onCancel }) => {
  const isMaster = product.is_master === true;

  // Master-level fields (template fields — admin only)
  const [masterForm, setMasterForm] = useState({
    name: product.name || '',
    marketedBy: product.marketedBy || '',
    manufacturer: product.manufacturer || '',
    manufacturerAddress: product.manufacturerAddress || '',
    technicalName: product.technicalName || '',
    registrationNumber: product.registrationNumber || '',
    manufacturerLicence: product.manufacturerLicence || '',
  });

  // Child-level fields (batch-specific — editor)
  const [childForm, setChildForm] = useState({
    batch: product.batch || '',
    mfg: product.mfg || '',
    expiry: product.expiry || '',
    packingSize: product.packingSize || '',
  });

  const [hazardId, setHazardId] = useState<string>(product.hazardId ? String(product.hazardId) : '');
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [saving, setSaving] = useState(false);
  const [datePrecision, setDatePrecision] = useState<DatePrecision>(
    hasDayPart(product.mfg) || hasDayPart(product.expiry) ? 'day' : 'month'
  );

  // Switching precision re-formats any already-picked dates to the new precision
  const handlePrecisionChange = (precision: DatePrecision) => {
    setDatePrecision(precision);
    setChildForm(prev => {
      const mfgDate = parseDateStr(prev.mfg);
      const expDate = parseDateStr(prev.expiry);
      return {
        ...prev,
        mfg: mfgDate ? formatByPrecision(mfgDate, precision) : prev.mfg,
        expiry: expDate ? formatByPrecision(expDate, precision) : prev.expiry,
      };
    });
  };
  const [imageFile, setImageFile] = useState<File | null>(null);
  const existingImageUrl = product.productImage
    ? `${API_BASE.replace('/api', '')}${product.productImage}`
    : null;
  const [imagePreview, setImagePreview] = useState<string | null>(existingImageUrl);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiGetHazards().then(setHazards).catch(console.error);
  }, []);

  const handleMasterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMasterForm(prev => ({ ...prev, [name]: value }));
  };

  const handleChildChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setChildForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!isMaster && imageFile) {
        try {
          await apiUploadProductImage(product.uniqueId, imageFile);
        } catch (imgErr) {
          console.error('Failed to upload image:', imgErr);
        }
      }
      if (isMaster) {
        onSave(product.uniqueId, {
          ...masterForm,
          hazardId: hazardId ? Number(hazardId) : undefined,
        });
      } else {
        onSave(product.uniqueId, { ...childForm });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-product-wrapper">
      <div className="add-product-header">
        <h1>{isMaster ? 'Edit Master Product' : 'Edit Product'}</h1>
        <div className="header-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>
            ← Back to List
          </button>
        </div>
      </div>

      {isMaster && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', fontSize: '13px', color: '#1d4ed8' }}>
          Changes to these fields will be inherited by all batch products of <strong>{product.name}</strong>. Hazard change will apply immediately to all batches.
        </div>
      )}

      <div className="content-card">
        <form className="add-product-form" onSubmit={handleSubmit}>
          <div className="form-grid">

            {/* ── MASTER PRODUCT FIELDS ── */}
            {isMaster && (
              <>
                <div className="form-group">
                  <label>Product Name</label>
                  <input name="name" value={masterForm.name} onChange={handleMasterChange} placeholder="Product name" required />
                </div>
                <div className="form-group">
                  <label>Marketed By</label>
                  <input name="marketedBy" value={masterForm.marketedBy} onChange={handleMasterChange} placeholder="Company that markets this product" />
                </div>
                <div className="form-group">
                  <label>Manufacturer</label>
                  <input name="manufacturer" value={masterForm.manufacturer} onChange={handleMasterChange} placeholder="Manufacturer name" />
                </div>
                <div className="form-group">
                  <label>Manufacturer Address</label>
                  <input name="manufacturerAddress" value={masterForm.manufacturerAddress} onChange={handleMasterChange} placeholder="Full address" />
                </div>
                <div className="form-group">
                  <label>Technical Name</label>
                  <input name="technicalName" value={masterForm.technicalName} onChange={handleMasterChange} placeholder="Technical name" />
                </div>
                <div className="form-group">
                  <label>Registration Number</label>
                  <input name="registrationNumber" value={masterForm.registrationNumber} onChange={handleMasterChange} placeholder="Registration #" />
                </div>
                <div className="form-group">
                  <label>Manufacturer Licence</label>
                  <input name="manufacturerLicence" value={masterForm.manufacturerLicence} onChange={handleMasterChange} placeholder="Licence #" />
                </div>
                <div className="form-group">
                  <label>Cautionary / Hazard Symbol</label>
                  <select
                    value={hazardId}
                    onChange={e => setHazardId(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px',
                      border: '1px solid #d1d5db', borderRadius: '8px',
                      fontSize: '14px', background: 'white', color: '#1e293b',
                    }}
                  >
                    <option value="">— No hazard symbol —</option>
                    {hazards.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                    Selecting a hazard will update all batch products automatically.
                  </p>
                </div>
              </>
            )}

            {/* ── CHILD PRODUCT FIELDS ── */}
            {!isMaster && (
              <>
                <div className="form-group">
                  <label>Batch Number</label>
                  <input name="batch" value={childForm.batch} onChange={handleChildChange} placeholder="Batch number" />
                </div>
                <div className="form-group">
                  <label>Date Format</label>
                  <div className="date-precision-track" role="group" aria-label="Date format">
                    <button
                      type="button"
                      className={`date-precision-seg${datePrecision === 'month' ? ' is-active' : ''}`}
                      aria-pressed={datePrecision === 'month'}
                      onClick={() => handlePrecisionChange('month')}
                    >
                      Month &amp; Year
                    </button>
                    <button
                      type="button"
                      className={`date-precision-seg${datePrecision === 'day' ? ' is-active' : ''}`}
                      aria-pressed={datePrecision === 'day'}
                      onClick={() => handlePrecisionChange('day')}
                    >
                      Day · Month · Year
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Manufacturing Date</label>
                  <DatePicker
                    selected={parseDateStr(childForm.mfg)}
                    onChange={(date: Date | null) => {
                      setChildForm(prev => ({ ...prev, mfg: date ? formatByPrecision(date, datePrecision) : '' }));
                    }}
                    dateFormat={datePrecision === 'day' ? 'dd/MM/yyyy' : 'MM/yyyy'}
                    showMonthYearPicker={datePrecision === 'month'}
                    showFullMonthYearPicker={datePrecision === 'month'}
                    placeholderText={datePrecision === 'day' ? 'Select date' : 'Select month and year'}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Expiry Date</label>
                  <DatePicker
                    selected={parseDateStr(childForm.expiry)}
                    onChange={(date: Date | null) => {
                      setChildForm(prev => ({ ...prev, expiry: date ? formatByPrecision(date, datePrecision) : '' }));
                    }}
                    dateFormat={datePrecision === 'day' ? 'dd/MM/yyyy' : 'MM/yyyy'}
                    showMonthYearPicker={datePrecision === 'month'}
                    showFullMonthYearPicker={datePrecision === 'month'}
                    placeholderText={datePrecision === 'day' ? 'Select date' : 'Select month and year'}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Packaging Size</label>
                  <input name="packingSize" value={childForm.packingSize} onChange={handleChildChange} placeholder="e.g. 500 ml, 1 kg" />
                </div>
                <div className="form-group">
                  <label>Cautionary / Hazard Symbol</label>
                  <select
                    value={hazardId}
                    disabled
                    style={{
                      width: '100%', padding: '8px 12px',
                      border: '1px solid #d1d5db', borderRadius: '8px',
                      fontSize: '14px', background: '#f8fafc', color: '#64748b',
                      cursor: 'not-allowed',
                    }}
                  >
                    <option value="">— No hazard symbol —</option>
                    {hazards.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', marginBottom: 0 }}>
                    Hazard symbol can only be changed by an admin on the master product.
                  </p>
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
              </>
            )}
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
          {isMaster && <span><strong>Type:</strong> Master Product</span>}
        </div>
      </div>
    </div>
  );
};

export default EditProduct;
