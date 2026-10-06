import React, { useState, useEffect } from 'react';
import { apiViewProduct, apiViewPackProduct, apiGetCompanyPublic } from '../services/api';
import type { Product } from '../services/api';
import type { ScanCoords } from '../components/LocationGate';
import { formatProductDate } from '../utils/dates';
import { assetUrl } from '../utils/assetUrl';
import { getDeviceId } from '../utils/device';
import Icon from '../components/Icon';
import '../ViewProduct.css';

type PublicProductProps = {
  uniqueId?: string;  // batch QR: #p/<uniqueId>
  packCode?: string;  // pack QR (one QR per pack): #c/<code>
  coords: ScanCoords; // mandatory — this page is only shown behind LocationGate
};

const PublicProduct: React.FC<PublicProductProps> = ({ uniqueId, packCode, coords }) => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const [product, setProduct] = useState<Product | null>(null);
  const [company, setCompany] = useState<{ id: number; name: string; phone?: string; email?: string; website?: string; address?: string; facebookUrl?: string; instagramUrl?: string; scanAnalyticsEnabled?: boolean; subscriptionExpiresAt?: string } | null>(null);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        // The server logs the scan with these coordinates (when Scan Analytics is on)
        const prod = packCode
          ? await apiViewPackProduct(packCode, { ...coords, deviceId: getDeviceId() })
          : await apiViewProduct(uniqueId!, coords);
        if (prod) {
          setProduct(prod);
          setError(null);
          if (prod.companyId) {
            apiGetCompanyPublic(prod.companyId).then(co => {
              setCompany(co);
              // Check if subscription is expired
              if (co.subscriptionExpiresAt && new Date(co.subscriptionExpiresAt).getTime() < Date.now()) {
                setSubscriptionExpired(true);
              }
            }).catch(console.error);
          }
          // Preload images before showing page
          const imagesToLoad: string[] = [];
          const preloadImg = assetUrl(prod.productImage);
          if (preloadImg) imagesToLoad.push(preloadImg);
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
  }, [uniqueId, packCode, coords]);

  if (subscriptionExpired) {
    return (
      <div className="public-state">
        <div className="public-state-card">
          <div className="public-state-icon is-danger"><Icon name="alert" size={26} /></div>
          <h2 className="public-state-title is-danger">
            Monthly Subscription Expired
          </h2>
          <p className="public-state-text">
            This product's QR verification is currently unavailable. The company's maintenance subscription has expired. Please contact the company to resolve this.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="public-state">
        <div className="public-state-card">
          <div className="public-spinner" />
          <p className="public-state-muted">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="public-state">
        <div className="public-state-card">
          <div className="public-state-icon is-danger"><Icon name="search" size={26} /></div>
          <h2 className="public-state-title is-danger">Product Not Found</h2>
          <p className="public-state-text">{error || 'The product you are looking for does not exist.'}</p>
        </div>
      </div>
    );
  }

  const logoUrl = product.companyId ? `${API_BASE}/companies/${product.companyId}/logo` : undefined;

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
            <p>{formatProductDate(product.mfg)}</p>
          </div>


          <div className="view-info-group">
            <label>EXPIRY DATE</label>
            <p>{formatProductDate(product.expiry)}</p>
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
                    src={assetUrl(product.productImage, { small: true }) || product.imageUrl}
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
              {company?.address && <p><Icon name="map-pin" size={16} /> <span>Regd. Office: {company.address}</span></p>}
              {company?.phone && <p><Icon name="phone" size={16} /> <a href={`tel:${company.phone}`}>{company.phone}</a></p>}
              {company?.email && <p><Icon name="mail" size={16} /> <a href={`mailto:${company.email}`}>{company.email}</a></p>}
              {company?.website && <p className="website-link"><Icon name="globe" size={16} /> <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer">{company.website}</a></p>}
              {(company?.facebookUrl || company?.instagramUrl) && (
                <div className="social-links">
                  {company?.facebookUrl && (
                    <a href={company.facebookUrl.startsWith('http') ? company.facebookUrl : `https://${company.facebookUrl}`} target="_blank" rel="noopener noreferrer" className="fb-btn">Facebook</a>
                  )}
                  {company?.instagramUrl && (
                    <a href={company.instagramUrl.startsWith('http') ? company.instagramUrl : `https://${company.instagramUrl}`} target="_blank" rel="noopener noreferrer" className="ig-btn">Instagram</a>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="view-info-group">
            <label>NAME OF THE MANUFACTURER</label>
            <p>{product.manufacturer || product.companyName || company?.name || '—'}</p>
            <small>{product.manufacturerAddress || ''}</small>
          </div>

          <div className="view-info-group">
            <label>LEAFLETS INFORMATION</label>
            {product.leafletUrl ? (
              <p>
                <a
                  href={assetUrl(product.leafletUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  CLICK TO VIEW INFORMATION
                </a>
              </p>
            ) : (
              <p style={{ color: '#94a3b8' }}>Not available</p>
            )}
          </div>
        </div>
      </div>

      <div className="view-footer">
        <p>Developed by <a href="#">APAS</a></p>
      </div>
    </div>
  );
};

export default PublicProduct;
