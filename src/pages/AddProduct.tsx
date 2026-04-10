import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiGetMasterProducts, apiGetHazards } from '../services/api';
import type { Product, Hazard } from '../services/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type AddProductProps = {
  onProductAdded?: (product: any) => Promise<void> | void;
  onProductsList?: () => void;
};

const AddProduct: React.FC<AddProductProps> = ({ onProductAdded, onProductsList }) => {
  const [masterProducts, setMasterProducts] = useState<Product[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [form, setForm] = useState({
    name: '',
    batch: '',
    manufacturer: '',
    expiry: '',
    manufacturerName: '',
    manufacturerAddress: '',
    technicalName: '',
    registrationNumber: '',
    manufacturerLicence: '',
    imageUrl: '',
    hazardId: '',
    packingSize: '',
  });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [addedProduct, setAddedProduct] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [products, hazardList] = await Promise.all([
          apiGetMasterProducts(),
          apiGetHazards(),
        ]);
        setMasterProducts(products);
        setHazards(hazardList);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoadingMaster(false);
      }
    };
    loadData();
  }, []);

  const handleMasterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const masterId = e.target.value;
    setSelectedMasterId(masterId);

    if (!masterId) {
      setForm({ name: '', batch: '', manufacturer: '', expiry: '', manufacturerName: '', manufacturerAddress: '', technicalName: '', registrationNumber: '', manufacturerLicence: '', imageUrl: '', hazardId: '', packingSize: '' });
      return;
    }

    const master = masterProducts.find(p => p.uniqueId === masterId);
    if (master) {
      setForm({
        name: master.name || '',
        batch: '',
        manufacturer: '',
        expiry: '',
        manufacturerName: master.manufacturer || '',
        manufacturerAddress: master.manufacturerAddress || '',
        technicalName: master.technicalName || '',
        registrationNumber: master.registrationNumber || '',
        manufacturerLicence: master.manufacturerLicence || '',
        imageUrl: master.imageUrl || '',
        hazardId: master.hazardId ? String(master.hazardId) : '',
        packingSize: '',
      });
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!selectedMasterId) {
      alert('Please select a product from the dropdown.');
      return;
    }
    if (!form.batch.trim()) {
      alert('Please enter a batch number.');
      return;
    }
    setSubmitting(true);
    const uniqueId = Date.now().toString();
    const product = {
      id: uniqueId,
      uniqueId: uniqueId,
      name: form.name,
      batch: form.batch,
      mfg: form.manufacturer,
      expiry: form.expiry,
      manufacturer: form.manufacturerName || '',
      manufacturerAddress: form.manufacturerAddress || '',
      technicalName: form.technicalName || '',
      registrationNumber: form.registrationNumber || '',
      manufacturerLicence: form.manufacturerLicence || '',
      packingSize: form.packingSize || '',
      imageUrl: form.imageUrl || '',
      hazardSymbol: '',
      hazardId: form.hazardId ? Number(form.hazardId) : undefined,
      _imageFile: productImageFile,
    };

    // Clear form immediately so fields reset right away
    setSelectedMasterId('');
    setProductImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setForm({ name: '', batch: '', manufacturer: '', expiry: '', manufacturerName: '', manufacturerAddress: '', technicalName: '', registrationNumber: '', manufacturerLicence: '', imageUrl: '', hazardId: '', packingSize: '' });
    setAddedProduct(product);

    try {
      if (onProductAdded) await onProductAdded(product);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-product-wrapper">
      <div className="add-product-header">
        <h1>Add A New Product</h1>
        <div className="header-actions">
          <button type="button" className="secondary-btn" onClick={onProductsList}>← Products List</button>
        </div>
      </div>
      <div className="content-card">
        <form className="add-product-form" onSubmit={handleSubmit}>
          {/* Step 1: Product Selection */}
          <div className="form-step">
            <div className="form-step-header">
              <span className="step-number">1</span>
              <span className="step-title">Select Parent Product</span>
            </div>
            <div className="form-row">
              <div className="form-group single">
                <label>SELECT PRODUCT</label>
                {loadingMaster ? (
                  <select disabled><option>Loading products...</option></select>
                ) : masterProducts.length === 0 ? (
                  <select disabled><option>No products available — upload via Bulk Upload first</option></select>
                ) : (
                  <select value={selectedMasterId} onChange={handleMasterSelect}>
                    <option value="">--Select a Product--</option>
                    {masterProducts.map(p => (
                      <option key={p.uniqueId} value={p.uniqueId}>
                        {p.name}{p.manufacturer ? ` (${p.manufacturer})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {selectedMasterId && (
            <>
              {/* Product Info Summary */}
              <div className="product-summary-bar">
                <div className="summary-item"><span className="summary-label">Product</span><span className="summary-value">{form.name}</span></div>
                {form.technicalName && <div className="summary-item"><span className="summary-label">Technical</span><span className="summary-value">{form.technicalName}</span></div>}
                {form.registrationNumber && <div className="summary-item"><span className="summary-label">Reg#</span><span className="summary-value">{form.registrationNumber}</span></div>}
              </div>

              {/* Step 2: Batch Details */}
              <div className="form-step">
                <div className="form-step-header">
                  <span className="step-number">2</span>
                  <span className="step-title">Enter Batch Details</span>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>BATCH NUMBER <span style={{ color: '#ef4444' }}>*</span></label>
                    <input name="batch" value={form.batch} onChange={handleChange} placeholder="Enter batch number" required />
                  </div>
                  <div className="form-group">
                    <label>PACKAGING SIZE</label>
                    <input name="packingSize" value={form.packingSize} onChange={handleChange} placeholder="e.g. 500 ml, 1 kg" />
                  </div>
                  <div className="form-group">
                    <label>DATE OF MANUFACTURE</label>
                    <DatePicker
                      selected={form.manufacturer ? new Date(form.manufacturer + '-01') : null}
                      onChange={(date: Date | null) => {
                        const mfgStr = date ? date.toISOString().slice(0, 7) : '';
                        let expiryStr = '';
                        if (date) {
                          const expDate = new Date(date);
                          expDate.setFullYear(expDate.getFullYear() + 2);
                          expiryStr = expDate.toISOString().slice(0, 7);
                        }
                        setForm(prev => ({ ...prev, manufacturer: mfgStr, expiry: expiryStr }));
                      }}
                      dateFormat="yyyy-MM"
                      showMonthYearPicker
                      showFullMonthYearPicker
                      placeholderText="Select month and year"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>EXPIRY DATE</label>
                    <DatePicker
                      selected={form.expiry ? new Date(form.expiry + '-01') : null}
                      onChange={(date: Date | null) => setForm(prev => ({ ...prev, expiry: date ? date.toISOString().slice(0, 7) : '' }))}
                      dateFormat="yyyy-MM"
                      showMonthYearPicker
                      showFullMonthYearPicker
                      placeholderText="Select month and year"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>HAZARD SYMBOL</label>
                    <select name="hazardId" value={form.hazardId} onChange={handleChange}>
                      <option value="">--Select--</option>
                      {hazards.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? 'Saving...' : '✓ Create Product'}
                </button>
              </div>
            </>
          )}
        </form>
        
        {addedProduct && (
          <div className="qr-code-section" style={{ marginTop: '32px', padding: '24px', backgroundColor: '#f8fafb', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, color: '#222' }}>Product Added Successfully!</h3>
            <p style={{ color: '#666', marginBottom: '16px' }}>Share this QR Code with customers to view product details:</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <QRCodeSVG 
                value={`product/${addedProduct.uniqueId}`}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            <p style={{ color: '#888', fontSize: '0.9rem' }}><strong>Product ID:</strong> {addedProduct.uniqueId}</p>
            <button 
              type="button"
              className="primary-btn"
              onClick={() => setAddedProduct(null)}
              style={{ marginTop: '12px' }}
            >
              Add Another Product
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddProduct;
