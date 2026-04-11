import React, { useState, useEffect } from 'react';
import { apiGetProductByUniqueId, apiGetCompanyPublic } from '../services/api';
import type { Product } from '../services/api';
import '../ViewProduct.css';

type PublicProductProps = {
  uniqueId: string;
};

const PublicProduct: React.FC<PublicProductProps> = ({ uniqueId }) => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const [product, setProduct] = useState<Product | null>(null);
  const [company, setCompany] = useState<{ id: number; name: string; phone?: string; email?: string; website?: string; address?: string } | null>(null);
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
            apiGetCompanyPublic(prod.companyId).then(setCompany).catch(console.error);
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

  function formatMonthYear(val?: string) {
    if (!val) return '—';
    const [year, month] = val.split('-');
    if (!year || !month) return val;
    return `${month}/${year.slice(-2)}`;
  }

  return (
    <div className="view-product-page public-product-page">
      <div className="view-product-header public-header">
        <div className="public-header-logo">
          {logoUrl && !logoError ? (
            <img src={logoUrl} alt={product.companyName || 'Company Logo'} className="public-logo-img" onError={() => setLogoError(true)} />
          ) : (
            <div className="public-logo-fallback">{(product.companyName || company?.name || 'C').substring(0, 3).toUpperCase()}</div>
          )}
        </div>
        <span className="public-company-name">{product.companyName || company?.name || ''}</span>
        <h1>Agri Input Information System (AIIS)</h1>
      </div>

      <div className="view-product-content public-content">
        <div className="public-info-list">
          <div className="view-info-group">
            <label>MARKETED BY</label>
            <p>{product.marketedBy || product.companyName || company?.name || product.manufacturer || '\u2014'}</p>
          </div>

          <div className="view-info-group">
            <label>NAME OF THE PRODUCT</label>
            <p>{product.name}</p>
          </div>

          <div className="view-info-group">
            <label>TECHNICAL NAME</label>
            <p>{product.technicalName || '—'}</p>
          </div>

          <div className="view-info-group">
            <label>BATCH NUMBER</label>
            <p>{product.batch}</p>
          </div>

          {product.packingSize && (
            <div className="view-info-group">
              <label>PACKAGING SIZE</label>
              <p>{product.packingSize}</p>
            </div>
          )}

          <div className="view-info-group">
            <label>MANUFACTURING DATE</label>
            <p>{formatMonthYear(product.mfg)}</p>
          </div>

          <div className="view-info-group">
            <label>EXPIRY DATE</label>
            <p>{formatMonthYear(product.expiry)}</p>
          </div>

          <div className="view-info-group">
            <label>REGISTRATION NUMBER</label>
            <p>{product.registrationNumber || '—'}</p>
          </div>

          <div className="view-info-group">
            <label>MANUFACTURER LICENCE NO.</label>
            <p>{product.manufacturerLicence || '—'}</p>
          </div>

          <div className="view-info-group">
            <label>CAUTIONARY SYMBOL AS PER THE TOXICITY CLASSIFICATION</label>
            <div className="cautionary-symbol-row">
              {product.hazardId ? (
                <div className="hazard-symbol-box">
                  <img
                    src={`${API_BASE}/hazards/${product.hazardId}/image`}
                    alt="Hazard Symbol"
                    className="hazard-symbol-img"
                  />
                </div>
              ) : (
                <div className="hazard-symbol-box hazard-fallback">
                  <div className="symbol-triangle">
                    <span>DANGER</span>
                  </div>
                  <p className="symbol-label">YELLOW</p>
                </div>
              )}
              {(product.productImage || product.imageUrl) && (
                <div className="product-image-box">
                  <img
                    src={product.productImage ? `${API_BASE.replace('/api', '')}${product.productImage}?quality=50` : product.imageUrl}
                    alt={product.name}
                    className="product-detail-img"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="view-info-group">
            <label>CUSTOMER CARE CONTACT DETAILS</label>
            <div className="contact-details">
              {product.manufacturerAddress && <p>🏠 - Regd. Office: {product.manufacturerAddress}</p>}
              {company?.phone && <p>📱 - <a href={`tel:${company.phone}`}>{company.phone}</a></p>}
              {company?.email && <p>✉️ - <a href={`mailto:${company.email}`}>{company.email}</a></p>}
              {company?.website && <p className="website-link">🌐 <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer">{company.website}</a></p>}
              <div className="social-links" style={{ display: 'flex', gap: '14px', marginTop: '12px' }}>
                <a href="https://www.facebook.com/share/15dP3RRYwS/" target="_blank" rel="noopener noreferrer" className="fb-btn" style={{ padding: '12px 32px', borderRadius: '24px', color: '#fff', background: 'linear-gradient(135deg, #4a90d9, #1877f2)', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>Facebook</a>
                <a href="https://www.instagram.com/aborizen?igsh=MWF6NWZlN3RhcWN2eA==" target="_blank" rel="noopener noreferrer" className="ig-btn" style={{ padding: '12px 32px', borderRadius: '24px', color: '#fff', background: 'linear-gradient(135deg, #f77737, #e1306c)', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>Instagram</a>
              </div>
            </div>
          </div>

          <div className="view-info-group">
            <label>NAME OF THE MANUFACTURER</label>
            <p>{product.manufacturer || product.companyName || company?.name || '—'}</p>
            <small>{product.manufacturerAddress || ''}</small>
          </div>

          <div className="view-info-group">
            <label>LEAFLETS INFORMATION</label>
            <p><a href="#">CLICK TO VIEW INFORMATION</a></p>
          </div>
        </div>
      </div>

      <div className="view-footer">
        <p>Developed by <a href="#" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>APAS</a></p>
      </div>
    </div>
  );
};

export default PublicProduct;
