import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiGetMasterProducts, apiUploadProductImage } from '../services/api';
import type { Product } from '../services/api';

type AddProductProps = {
  onProductAdded?: (product: any) => void;
};

const AddProduct: React.FC<AddProductProps> = ({ onProductAdded }) => {
  const [masterProducts, setMasterProducts] = useState<Product[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [form, setForm] = useState({
    name: '',
    batch: '',
    manufacturer: '',
    expiry: '',
    packing: '',
    quantity: '',
    manufacturerAddress: '',
    technicalName: '',
    registrationNumber: '',
    manufacturerLicence: '',
    imageUrl: '',
    hazardSymbol: '',
  });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [addedProduct, setAddedProduct] = useState<any>(null);

  useEffect(() => {
    const loadMaster = async () => {
      try {
        const products = await apiGetMasterProducts();
        setMasterProducts(products);
      } catch (err) {
        console.error('Failed to load master products:', err);
      } finally {
        setLoadingMaster(false);
      }
    };
    loadMaster();
  }, []);

  const handleMasterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const masterId = e.target.value;
    setSelectedMasterId(masterId);

    if (!masterId) {
      setForm({ name: '', batch: '', manufacturer: '', expiry: '', packing: '', quantity: '', manufacturerAddress: '', technicalName: '', registrationNumber: '', manufacturerLicence: '', imageUrl: '', hazardSymbol: '' });
      return;
    }

    const master = masterProducts.find(p => p.uniqueId === masterId);
    if (master) {
      setForm({
        name: master.name || '',
        batch: '',
        manufacturer: '',
        expiry: '',
        packing: master.packingSize || '',
        quantity: '',
        manufacturerAddress: master.manufacturerAddress || '',
        technicalName: master.technicalName || '',
        registrationNumber: master.registrationNumber || '',
        manufacturerLicence: master.manufacturerLicence || '',
        imageUrl: master.imageUrl || '',
        hazardSymbol: master.hazardSymbol || '',
      });
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedMasterId) {
      alert('Please select a product from the dropdown.');
      return;
    }
    if (!form.batch.trim()) {
      alert('Please enter a batch number.');
      return;
    }
    const uniqueId = Date.now().toString();
    const product = {
      id: uniqueId,
      uniqueId: uniqueId,
      name: form.name,
      batch: form.batch,
      mfg: form.manufacturer,
      expiry: form.expiry,
      shortUrl: `qr-1.in/a.php?x=${uniqueId}`,
      manufacturer: form.manufacturerAddress ? undefined : '',
      manufacturerAddress: form.manufacturerAddress || '',
      technicalName: form.technicalName || '',
      registrationNumber: form.registrationNumber || '',
      packingSize: form.packing,
      quantity: form.quantity || '',
      manufacturerLicence: form.manufacturerLicence || '',
      imageUrl: form.imageUrl || '',
      hazardSymbol: form.hazardSymbol || '',
      _imageFile: productImageFile,
    };
    
    setAddedProduct(product);
    if (onProductAdded) {
      onProductAdded(product);
    }
    setSelectedMasterId('');
    setProductImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setForm({ name: '', batch: '', manufacturer: '', expiry: '', packing: '', quantity: '', manufacturerAddress: '', technicalName: '', registrationNumber: '', manufacturerLicence: '', imageUrl: '', hazardSymbol: '' });
  };

  return (
    <div className="add-product-wrapper">
      <div className="add-product-header">
        <h1>Add A New Product</h1>
        <div className="header-actions">
          <button type="button" className="secondary-btn">Products List</button>
        </div>
      </div>
      <div className="content-card">
        <div className="card-section-title">Select Product & Enter Batch Details</div>
        <form className="add-product-form" onSubmit={handleSubmit}>
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

          {selectedMasterId && (
            <>
              <div style={{ margin: '16px 0 8px', padding: '12px 16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '13px', color: '#0369a1' }}>
                <strong>Product:</strong> {form.name} &nbsp;|&nbsp;
                {form.technicalName && <><strong>Technical:</strong> {form.technicalName} &nbsp;|&nbsp;</>}
                {form.registrationNumber && <><strong>Reg#:</strong> {form.registrationNumber} &nbsp;|&nbsp;</>}
                {form.packing && <><strong>Packing:</strong> {form.packing}</>}
              </div>

              <div className="card-section-title" style={{ marginTop: '20px' }}>Batch Details</div>

              <div className="form-row">
                <div className="form-group">
                  <label>BATCH NUMBER <span style={{ color: '#ef4444' }}>*</span></label>
                  <input name="batch" value={form.batch} onChange={handleChange} placeholder="Enter batch number" required />
                </div>
                <div className="form-group">
                  <label>QUANTITY</label>
                  <input name="quantity" value={form.quantity} onChange={handleChange} placeholder="e.g. 100, 500 units" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>PACKING SIZE</label>
                  <input name="packing" value={form.packing} onChange={handleChange} placeholder="Enter packing size" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>DATE OF MANUFACTURE</label>
                  <input name="manufacturer" type="date" value={form.manufacturer} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>EXPIRY DATE</label>
                  <input name="expiry" type="date" value={form.expiry} onChange={handleChange} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group single">
                  <label>PRODUCT IMAGE</label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setProductImageFile(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setImagePreview(null);
                      }
                    }}
                    style={{ padding: '8px' }}
                  />
                  {imagePreview && (
                    <div style={{ marginTop: '8px' }}>
                      <img src={imagePreview} alt="Preview" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group single">
                  <label>HAZARD SYMBOL</label>
                  <select name="hazardSymbol" value={form.hazardSymbol} onChange={handleChange}>
                    <option value="">--Select--</option>
                    <option value="☠️ Toxic">☠️ Toxic</option>
                    <option value="⚠️ Health Hazard">⚠️ Health Hazard</option>
                    <option value="🧪 Irritant">🧪 Irritant</option>
                    <option value="🔥 Flammable">🔥 Flammable</option>
                    <option value="⚛️ Reactive">⚛️ Reactive</option>
                    <option value="🌍 Environmental">🌍 Environmental</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="submit-btn">Submit</button>
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
