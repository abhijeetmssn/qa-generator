import React, { useState, useRef, useEffect } from 'react';
import type { Product } from '../services/api';
import Icon from '../components/Icon';
import { apiUploadProductImage, apiDeleteProductImage, apiUploadProductLeaflet, apiDeleteProductLeaflet, apiGetHazards } from '../services/api';
import type { Hazard } from '../services/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { formatByPrecision, parseDateStr, hasDayPart, type DatePrecision } from '../utils/dates';
import { assetUrl } from '../utils/assetUrl';

interface EditProductProps {
  product: Product;
  onSave: (uniqueId: string, updates: Partial<Product>) => void;
  onCancel: () => void;
}

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
  // productImage / leafletUrl may be an absolute S3 URL or a relative /api path — assetUrl handles both.
  const existingImageUrl = assetUrl(product.productImage) ?? null;
  const [imagePreview, setImagePreview] = useState<string | null>(existingImageUrl);
  const [removeImage, setRemoveImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Leaflet (PDF) — upload / replace / remove.
  const existingLeafletUrl = assetUrl(product.leafletUrl) ?? null;
  const [leafletFile, setLeafletFile] = useState<File | null>(null);
  const leafletExists = !!existingLeafletUrl;
  const [removeLeaflet, setRemoveLeaflet] = useState(false);
  const leafletInputRef = useRef<HTMLInputElement>(null);

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

  // Warn before removing an asset — especially for a master, whose asset is
  // inherited by every batch that hasn't set its own.
  const confirmRemove = (asset: 'image' | 'leaflet'): boolean => {
    const label = asset === 'image' ? 'image' : 'leaflet';
    const msg = isMaster
      ? `⚠️ Remove the master ${label} for "${product.name}"?\n\nEvery batch that inherits this ${label} will stop showing it. Batches that have their own ${label} are not affected.\n\nThis takes effect when you click Save.`
      : `Remove this batch's ${label}?\n\nIt will revert to the master product ${label} (if the master has one).`;
    return window.confirm(msg);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Image + leaflet apply to both master (cascades to children via inheritance)
      // and child (batch-specific override) products.
      if (imageFile) {
        try {
          await apiUploadProductImage(product.uniqueId, imageFile);
        } catch (imgErr) {
          console.error('Failed to upload image:', imgErr);
        }
      } else if (removeImage && product.hasOwnImage) {
        try {
          await apiDeleteProductImage(product.uniqueId);
        } catch (imgErr) {
          console.error('Failed to remove image:', imgErr);
          alert(imgErr instanceof Error ? imgErr.message : 'Failed to remove image');
        }
      }
      try {
        if (leafletFile) {
          await apiUploadProductLeaflet(product.uniqueId, leafletFile);
        } else if (removeLeaflet && product.hasOwnLeaflet) {
          await apiDeleteProductLeaflet(product.uniqueId);
        }
      } catch (pdfErr) {
        console.error('Failed to save leaflet:', pdfErr);
        alert(pdfErr instanceof Error ? pdfErr.message : 'Failed to save leaflet');
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
            <Icon name="arrow-left" size={16} /> Back to List
          </button>
        </div>
      </div>

      {isMaster && (
        <div className="alert is-info" style={{ marginBottom: 0 }}>
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
              </>
            )}

            {/* ── SHARED: PRODUCT IMAGE + LEAFLET (master cascades to children; child overrides master) ── */}
                <div className="form-group">
                  <label>Product Image</label>
                  {imagePreview && !removeImage && (
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <img src={imagePreview} alt="Product" style={{ maxWidth: '150px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                      {!imageFile && !product.hasOwnImage && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>(inherited from master)</span>
                      )}
                      {!imageFile && product.hasOwnImage && (
                        <button
                          type="button"
                          onClick={() => { if (!confirmRemove('image')) return; setRemoveImage(true); setImageFile(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                  {removeImage && !imageFile && (
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#dc2626' }}>Image will be removed on save.</span>
                      <button
                        type="button"
                        onClick={() => setRemoveImage(false)}
                        style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0 }}
                      >
                        Undo
                      </button>
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
                        setRemoveImage(false);
                        const reader = new FileReader();
                        reader.onloadend = () => setImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ padding: '8px' }}
                  />
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                    {isMaster
                      ? 'Shown for every batch of this product that has not set its own image.'
                      : product.hasOwnImage
                        ? 'This batch has its own image. Upload to replace it, or remove it to use the master product image.'
                        : imagePreview
                          ? 'Currently inherited from the master product. Upload to set a batch-specific image.'
                          : 'Upload a batch-specific image (otherwise the master product image is used).'}
                  </p>
                </div>
                <div className="form-group">
                  <label>Leaflet (PDF)</label>
                  {leafletExists && !leafletFile && !removeLeaflet && existingLeafletUrl && (
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <a href={existingLeafletUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, fontSize: '13px' }}>
                        📄 View current leaflet
                      </a>
                      {!product.hasOwnLeaflet && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>(inherited from master)</span>
                      )}
                      {product.hasOwnLeaflet && (
                        <button
                          type="button"
                          onClick={() => { if (!confirmRemove('leaflet')) return; setRemoveLeaflet(true); setLeafletFile(null); if (leafletInputRef.current) leafletInputRef.current.value = ''; }}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                  {removeLeaflet && !leafletFile && (
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#dc2626' }}>Leaflet will be removed on save.</span>
                      <button
                        type="button"
                        onClick={() => setRemoveLeaflet(false)}
                        style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0 }}
                      >
                        Undo
                      </button>
                    </div>
                  )}
                  {leafletFile && (
                    <div style={{ marginBottom: '8px', fontSize: '13px', color: '#166534' }}>
                      Selected: {leafletFile.name}
                    </div>
                  )}
                  <input
                    ref={leafletInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setLeafletFile(file);
                      if (file) setRemoveLeaflet(false);
                    }}
                    style={{ padding: '8px' }}
                  />
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                    {leafletExists
                      ? 'Choose a PDF to replace the current leaflet, or remove it. Max 25 MB.'
                      : 'Upload a PDF leaflet (max 25 MB). Shown to customers via the “Leaflets Information” link.'}
                  </p>
                </div>
          </div>

          <div className="form-actions" style={{ marginTop: '24px' }}>
            <button type="button" className="secondary-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Read-only info */}
      <div className="meta-strip">
        <div className="meta-strip-row">
          <span><strong>Unique ID:</strong> {product.uniqueId}</span>
          {isMaster && <span><strong>Type:</strong> Master Product</span>}
        </div>
      </div>
    </div>
  );
};

export default EditProduct;
