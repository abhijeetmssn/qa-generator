import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiGetMasterProducts, apiGetHazards } from '../services/api';
import type { Product, Hazard } from '../services/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import SearchableSelect from '../components/SearchableSelect';
import { formatByPrecision, parseDateStr, type DatePrecision } from '../utils/dates';

type AddProductProps = {
  onProductAdded?: (product: any) => Promise<any>;
  onProductsList?: () => void;
  isAdmin?: boolean;
};

const AddProduct: React.FC<AddProductProps> = ({ onProductAdded, onProductsList, isAdmin = false }) => {
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
    marketedBy: '',
  });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [addedProduct, setAddedProduct] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [datePrecision, setDatePrecision] = useState<DatePrecision>('month');

  // Switching precision re-formats any already-picked dates to the new precision
  const handlePrecisionChange = (precision: DatePrecision) => {
    setDatePrecision(precision);
    setForm(prev => {
      const mfgDate = parseDateStr(prev.manufacturer);
      const expDate = parseDateStr(prev.expiry);
      return {
        ...prev,
        manufacturer: mfgDate ? formatByPrecision(mfgDate, precision) : prev.manufacturer,
        expiry: expDate ? formatByPrecision(expDate, precision) : prev.expiry,
      };
    });
  };

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
      setForm({ name: '', batch: '', manufacturer: '', expiry: '', manufacturerName: '', manufacturerAddress: '', technicalName: '', registrationNumber: '', manufacturerLicence: '', imageUrl: '', hazardId: '', packingSize: '', marketedBy: '' });
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
        marketedBy: master.marketedBy || '',
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

    // ID is generated server-side — do not generate or send one from the client
    const product = {
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
      marketedBy: form.marketedBy || '',
      _imageFile: productImageFile,
    };

    try {
      if (onProductAdded) {
        const saved = await onProductAdded(product);
        // Clear form only after confirmed successful save
        setAddedProduct(saved ?? product);
        setSelectedMasterId('');
        setProductImageFile(null);
        if (imageInputRef.current) imageInputRef.current.value = '';
        setForm({ name: '', batch: '', manufacturer: '', expiry: '', manufacturerName: '', manufacturerAddress: '', technicalName: '', registrationNumber: '', manufacturerLicence: '', imageUrl: '', hazardId: '', packingSize: '', marketedBy: '' });
      }
    } catch (err) {
      console.error('Failed to save product:', err);
      alert('Failed to save product. Please try again.');
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
                  <SearchableSelect options={[]} value="" onChange={() => {}} placeholder="Loading products…" disabled />
                ) : masterProducts.length === 0 ? (
                  <SearchableSelect options={[]} value="" onChange={() => {}} placeholder="No products available — upload via Bulk Upload first" disabled />
                ) : (
                  <SearchableSelect
                    options={masterProducts.map(p => ({
                      value: p.uniqueId,
                      label: p.name + (p.manufacturer ? ` (${p.manufacturer})` : ''),
                    }))}
                    value={selectedMasterId}
                    onChange={val => handleMasterSelect({ target: { value: val } } as React.ChangeEvent<HTMLSelectElement>)}
                    placeholder="-- Select a Product --"
                    title="Select Product"
                    emptyMessage="No products match your search"
                  />
                )}
              </div>
            </div>
          </div>

          {selectedMasterId && (
            <>
              {/* Product Info Summary */}
              <div className="product-summary-bar">
                <table className="summary-table">
                  <tbody>
                    <tr>
                      <td className="summary-label">Product Name</td>
                      <td className="summary-value">{form.name}</td>
                    </tr>
                    {form.technicalName && <tr>
                      <td className="summary-label">Technical Name</td>
                      <td className="summary-value">{form.technicalName}</td>
                    </tr>}
                    {form.registrationNumber && <tr>
                      <td className="summary-label">Registration No.</td>
                      <td className="summary-value">{form.registrationNumber}</td>
                    </tr>}
                  </tbody>
                </table>
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
                  <div className="form-group full-width">
                    <label>DATE FORMAT</label>
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
                    <label>DATE OF MANUFACTURE</label>
                    <DatePicker
                      selected={parseDateStr(form.manufacturer)}
                      onChange={(date: Date | null) => {
                        if (!date) { setForm(prev => ({ ...prev, manufacturer: '', expiry: '' })); return; }
                        const expDate = new Date(date);
                        expDate.setFullYear(expDate.getFullYear() + 2);
                        setForm(prev => ({
                          ...prev,
                          manufacturer: formatByPrecision(date, datePrecision),
                          expiry: formatByPrecision(expDate, datePrecision),
                        }));
                      }}
                      dateFormat={datePrecision === 'day' ? 'dd/MM/yyyy' : 'MM/yyyy'}
                      showMonthYearPicker={datePrecision === 'month'}
                      showFullMonthYearPicker={datePrecision === 'month'}
                      placeholderText={datePrecision === 'day' ? 'Select date' : 'Select month and year'}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>EXPIRY DATE</label>
                    <DatePicker
                      selected={parseDateStr(form.expiry)}
                      onChange={(date: Date | null) => setForm(prev => ({ ...prev, expiry: date ? formatByPrecision(date, datePrecision) : '' }))}
                      dateFormat={datePrecision === 'day' ? 'dd/MM/yyyy' : 'MM/yyyy'}
                      showMonthYearPicker={datePrecision === 'month'}
                      showFullMonthYearPicker={datePrecision === 'month'}
                      placeholderText={datePrecision === 'day' ? 'Select date' : 'Select month and year'}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>MARKETED BY</label>
                    <input name="marketedBy" value={form.marketedBy} onChange={handleChange} placeholder="Company that markets this product" />
                  </div>
                  <div className="form-group full-width">
                    <label>HAZARD SYMBOL</label>
                    <div style={{ maxWidth: '50%' }}>
                      <SearchableSelect
                        options={hazards.map(h => ({ value: String(h.id), label: h.name }))}
                        value={form.hazardId}
                        onChange={val => setForm(prev => ({ ...prev, hazardId: val }))}
                        placeholder={isAdmin ? '-- Select --' : '— Set by admin only —'}
                        title="Select Hazard Symbol"
                        emptyMessage="No hazard symbols found"
                        disabled={!isAdmin}
                      />
                      {!isAdmin && (
                        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', marginBottom: 0 }}>
                          Hazard symbol can only be set by an admin.
                        </p>
                      )}
                    </div>
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
                value={`https://apasqr.com/#p/${addedProduct.uniqueId}`}
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
