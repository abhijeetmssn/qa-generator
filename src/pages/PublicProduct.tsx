import React, { useState, useEffect } from 'react';
import { apiGetProductByUniqueId, apiGetCompanyById } from '../services/api';
import type { Product, Company } from '../services/api';
import '../ViewProduct.css';

type PublicProductProps = {
  uniqueId: string;
};

const PublicProduct: React.FC<PublicProductProps> = ({ uniqueId }) => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const [product, setProduct] = useState<Product | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        const prod = await apiGetProductByUniqueId(uniqueId);
        if (prod) {
          setProduct(prod);
          setError(null);
          if (prod.companyId) {
            apiGetCompanyById(prod.companyId).then(setCompany).catch(console.error);
          }
          // Preload images before showing page
          const imagesToLoad: string[] = [];
          if (prod.productImage) imagesToLoad.push(`${API_BASE.replace('/api', '')}${prod.productImage}`);
          else if (prod.imageUrl) imagesToLoad.push(prod.imageUrl);
          if (prod.hazardId) imagesToLoad.push(`${API_BASE}/hazards/${prod.hazardId}/image`);

          if (imagesToLoad.length > 0) {
            await Promise.race([
              Promise.all(imagesToLoad.map(src => new Promise<void>(resolve => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = src;
              }))),
              new Promise<void>(resolve => setTimeout(resolve, 3000)),
            ]);
          }
        } else {
          setError('Product not found');
        }
      } catch (err) {
        console.error('Error loading product:', err);
        setError('Failed to load product details');
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [uniqueId]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fb 0%, #e8eef8 100%)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', color: '#666', fontWeight: '500' }}>Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fb 0%, #e8eef8 100%)',
        padding: '20px',
      }}>
        <div style={{
          textAlign: 'center',
          background: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ color: '#dc2626', marginTop: 0 }}>Product Not Found</h2>
          <p style={{ color: '#666' }}>{error || 'The product you are looking for does not exist.'}</p>
        </div>
      </div>
    );
  }

  const logoUrl = product.companyId ? `${API_BASE}/companies/${product.companyId}/logo` : undefined;

  return (
    <div className="view-product-page">
      <div className="view-product-header">
        <div className="view-logo-section">
          {logoUrl && !logoError ? (
            <img src={logoUrl} alt={product.companyName || 'Company Logo'} className="view-logo-img" onError={() => setLogoError(true)} />
          ) : (
            <div className="view-logo">{product.companyName?.substring(0, 3).toUpperCase() || 'FAS'}</div>
          )}
        </div>
        <h1>Agri Input Information System (AIIS)</h1>
      </div>

      <div className="view-product-content">
        <div className="view-info-grid">
          <div className="view-info-column">
            <div className="view-info-group">
              <label>NAME OF THE MANUFACTURER</label>
              <p>{product.manufacturer || product.companyName || company?.name || '—'}</p>
              <small>{product.manufacturerAddress || ''}</small>
            </div>

            <div className="view-info-group">
              <label>NAME OF THE PRODUCT</label>
              <p>{product.name}</p>
            </div>

            <div className="view-info-group">
              <label>BATCH NUMBER</label>
              <p>{product.batch}</p>
            </div>

            <div className="view-info-group">
              <label>EXPIRY DATE</label>
              <p>{product.expiry}</p>
            </div>

            <div className="view-info-group">
              <label>MANUFACTURER LICENCE NO.</label>
              <p>{product.manufacturerLicence || 'PB/AGRI/PP/2021/4'}</p>
            </div>

            <div className="view-info-group">
              <label>CAUTIONARY SYMBOL AS PER THE TOXICITY CLASSIFICATION</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {product.hazardId ? (
                  <div style={{ background: '#fff', padding: '4px', borderRadius: '6px', display: 'inline-block' }}>
                    <img
                      src={`${API_BASE}/hazards/${product.hazardId}/image`}
                      alt="Hazard Symbol"
                      style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                ) : (
                  <div className="safety-symbol">
                    <div className="symbol-yellow">⚠️</div>
                    <p>YELLOW</p>
                  </div>
                )}
                {(product.productImage || product.imageUrl) && (
                  <img
                    src={product.productImage ? `${API_BASE.replace('/api', '')}${product.productImage}` : product.imageUrl}
                    alt={product.name}
                    style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafb' }}
                  />
                )}
              </div>
            </div>

            <div className="view-info-group">
              <label>LEAFLETS INFORMATION</label>
              <p><a href="#">CLICK TO VIEW INFORMATION</a></p>
            </div>
          </div>

          <div className="view-info-column">
            <div className="view-info-group">
              <label>UNIQUE PRODUCT IDENTIFICATION NUMBER</label>
              <p>{product.uniqueId}</p>
            </div>

            <div className="view-info-group">
              <label>TECHNICAL NAME</label>
              <p>{product.technicalName || 'Emamectin Benzoate 5% SG'}</p>
            </div>

            <div className="view-info-group">
              <label>MANUFACTURING DATE</label>
              <p>{product.mfg}</p>
            </div>

            <div className="view-info-group">
              <label>REGISTRATION NUMBER</label>
              <p>{product.registrationNumber || 'CIR-1B7889/2021-Emamectin Benzoate (SG) (4325)-2288'}</p>
            </div>

            <div className="view-info-group">
              <label>PACKING SIZE</label>
              <p>{product.packingSize || '1 KG'}</p>
            </div>

            <div className="view-info-group">
              <label>CUSTOMER CARE CONTACT DETAILS</label>
              <div className="contact-details">
                {product.manufacturerAddress && <p><strong>🏢</strong> {product.manufacturerAddress}</p>}
                <p><strong>📞</strong> {company?.phone || '—'}</p>
                <p><strong>📧</strong> {company?.email || '—'}</p>
                <p><strong>🌐</strong> {company?.website ? <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer">{company.website}</a> : '—'}</p>
                <div className="social-links">
                  <a href="#" className="fb-btn">Facebook</a>
                  <a href="#" className="ig-btn">Instagram</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="view-footer">
        <p>Developed by <strong>AP Solutions</strong></p>
      </div>
    </div>
  );
};

export default PublicProduct;
