import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiGetMasterProducts, apiGetHazards } from '../services/api';
import type { Product, Hazard } from '../services/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import SearchableSelect from '../components/SearchableSelect';
import { formatByPrecision, parseDateStr, type DatePrecision } from '../utils/dates';
import { assetUrl } from '../utils/assetUrl';
import PackCodesDownload from '../components/PackCodesDownload';
import Icon from '../components/Icon';

const MAX_PACKS_PER_BATCH = 100000;

type AddProductProps = {
  onProductAdded?: (product: any) => Promise<any>;
  onProductsList?: () => void;
  isAdmin?: boolean;
  perPackQrAllowed?: boolean; // admin has allowed this company one QR per pack
};

const AddProduct: React.FC<AddProductProps> = ({ onProductAdded, onProductsList, isAdmin = false, perPackQrAllowed = false }) => {
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
  // Photo + leaflet inherited from the selected parent (master) product — shown for reference.
  const [masterAssets, setMasterAssets] = useState<{ image?: string; leaflet?: string }>({});
  const [addedProduct, setAddedProduct] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [datePrecision, setDatePrecision] = useState<DatePrecision>('month');
  // 'batch' = one QR for the whole batch (default); 'pack' = one QR per pack
  const [qrMode, setQrMode] = useState<'batch' | 'pack'>('batch');
  const [packCount, setPackCount] = useState('');

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
      setMasterAssets({});
      return;
    }

    const master = masterProducts.find(p => p.uniqueId === masterId);
    if (master) {
      setMasterAssets({ image: master.productImage, leaflet: master.leafletUrl });
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
    const perPack = perPackQrAllowed && qrMode === 'pack';
    const packs = Number(packCount);
    if (perPack && (!Number.isInteger(packs) || packs < 1 || packs > MAX_PACKS_PER_BATCH)) {
      alert(`Please enter the number of packs in this batch (1 to ${MAX_PACKS_PER_BATCH.toLocaleString('en-IN')}).`);
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
      ...(perPack && { packCount: packs }),
    };

    try {
      if (onProductAdded) {
        const saved = await onProductAdded(product);
        // Clear form only after confirmed successful save
        setAddedProduct(saved ?? product);
        setSelectedMasterId('');
        setMasterAssets({});
        setProductImageFile(null);
        if (imageInputRef.current) imageInputRef.current.value = '';
        setForm({ name: '', batch: '', manufacturer: '', expiry: '', manufacturerName: '', manufacturerAddress: '', technicalName: '', registrationNumber: '', manufacturerLicence: '', imageUrl: '', hazardId: '', packingSize: '', marketedBy: '' });
        setQrMode('batch');
        setPackCount('');
      }
    } catch (err) {
      console.error('Failed to save product:', err);
      // Pack QR errors (e.g. access turned off by the admin) come with a reason worth showing
      alert(perPack && err instanceof Error && err.message
        ? `Failed to save product: ${err.message}`
        : 'Failed to save product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-product-wrapper">
      <div className="add-product-header">
        <h1>Add A New Product</h1>
        <div className="header-actions">
          <button type="button" className="secondary-btn" onClick={onProductsList}><Icon name="arrow-left" size={16} /> Products List</button>
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

              {/* Product photo + leaflet (inherited from the selected product) */}
              <div className="product-media-bar">
                {masterAssets.image ? (
                  <img className="product-media-photo" src={assetUrl(masterAssets.image, { small: true })} alt={form.name} />
                ) : (
                  <div className="product-media-photo is-empty">No photo</div>
                )}
                <div className="product-media-info">
                  <span className="product-media-label">Product Photo &amp; Leaflet</span>
                  {masterAssets.leaflet ? (
                    <a className="leaflet-pill" href={assetUrl(masterAssets.leaflet)} target="_blank" rel="noopener noreferrer">
                      <span aria-hidden="true">📄</span> View Leaflet
                    </a>
                  ) : (
                    <span className="leaflet-pill is-empty"><span aria-hidden="true">📄</span> No leaflet</span>
                  )}
                  <p className="product-media-hint">
                    This batch inherits the product's photo &amp; leaflet — set a batch-specific one later by editing the product.
                  </p>
                </div>
              </div>

              {/* Step 2: Batch Details */}
              <div className="form-step">
                <div className="form-step-header">
                  <span className="step-number">2</span>
                  <span className="step-title">Enter Batch Details</span>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>BATCH NUMBER <span className="required">*</span></label>
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

              {/* Step 3: QR codes — only for companies the admin has allowed one QR per pack */}
              {perPackQrAllowed && (
                <div className="form-step">
                  <div className="form-step-header">
                    <span className="step-number">3</span>
                    <span className="step-title">QR Codes</span>
                  </div>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>QR CODE TYPE</label>
                      <div className="date-precision-track" role="group" aria-label="QR code type">
                        <button
                          type="button"
                          className={`date-precision-seg${qrMode === 'batch' ? ' is-active' : ''}`}
                          aria-pressed={qrMode === 'batch'}
                          onClick={() => setQrMode('batch')}
                        >
                          One QR for the whole batch
                        </button>
                        <button
                          type="button"
                          className={`date-precision-seg${qrMode === 'pack' ? ' is-active' : ''}`}
                          aria-pressed={qrMode === 'pack'}
                          onClick={() => setQrMode('pack')}
                        >
                          One QR per pack
                        </button>
                      </div>
                    </div>
                    {qrMode === 'pack' && (
                      <div className="form-group">
                        <label>NUMBER OF PACKS IN THIS BATCH <span className="required">*</span></label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_PACKS_PER_BATCH}
                          step={1}
                          value={packCount}
                          onChange={e => setPackCount(e.target.value)}
                          placeholder="e.g. 2000"
                          required
                        />
                        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                          A unique QR code is created for every pack. You can download or print them after saving.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? 'Saving...' : '✓ Create Product'}
                </button>
              </div>
            </>
          )}
        </form>
        
        {addedProduct?.packCodes && (
          <div className="qr-code-section success-panel">
            <h3 className="success-panel-title">Product Added Successfully!</h3>
            <p className="success-panel-text">
              Created <strong>{addedProduct.packCodes.count.toLocaleString('en-IN')}</strong> pack QR codes for batch{' '}
              <strong>{addedProduct.batch}</strong> (Pack No. {addedProduct.packCodes.fromSerial.toLocaleString('en-IN')} – {addedProduct.packCodes.toSerial.toLocaleString('en-IN')}).
              Download or print them below — you can also do this later from the product page.
            </p>
            <PackCodesDownload
              product={{ uniqueId: addedProduct.uniqueId, name: addedProduct.name, batch: addedProduct.batch }}
              lastSerial={addedProduct.packCodes.toSerial}
            />
            <p className="success-panel-meta"><strong>Product ID:</strong> {addedProduct.uniqueId}</p>
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                className="primary-btn"
                onClick={() => setAddedProduct(null)}
                style={{ marginTop: '12px' }}
              >
                Add Another Product
              </button>
            </div>
          </div>
        )}

        {addedProduct && !addedProduct.packCodes && (
          <div className="qr-code-section success-panel">
            <h3 className="success-panel-title">Product Added Successfully!</h3>
            <p className="success-panel-text">Share this QR Code with customers to view product details:</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <QRCodeSVG
                value={`https://apasqr.com/#p/${addedProduct.uniqueId}`}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="success-panel-meta"><strong>Product ID:</strong> {addedProduct.uniqueId}</p>
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
