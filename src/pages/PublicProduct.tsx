import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
  const qrRef = useRef<HTMLDivElement>(null);

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
  const productUrl = `${window.location.origin}/#product/${product.uniqueId}`;

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `QR-${product.name}-${product.uniqueId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrintQR = () => {
    const printWindow = window.open('', '', 'width=600,height=700');
    if (!printWindow) return;

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Code - ${product.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              background: white;
            }
            .print-container { text-align: center; }
            h1 { font-size: 24px; margin-bottom: 20px; color: #333; }
            .product-info { margin-bottom: 20px; font-size: 14px; color: #666; }
            svg { border: 2px solid #ccc; padding: 10px; background: white; }
            .product-url { margin-top: 20px; font-size: 12px; color: #999; word-break: break-all; }
            @media print { body { background: white; } }
          </style>
        </head>
        <body>
          <div class="print-container">
            <h1>QR Code</h1>
            <div class="product-info">
              <p><strong>${product.name}</strong></p>
              <p>Batch: ${product.batch}</p>
              <p>ID: ${product.uniqueId}</p>
            </div>
            ${svgData}
            <div class="product-url">${productUrl}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

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
                <div className="safety-symbol">
                  <div className="symbol-yellow">⚠️</div>
                  <p>YELLOW</p>
                </div>
                {(product.productImage || product.imageUrl) && (
                  <img
                    src={product.productImage ? `${API_BASE.replace('/api', '')}${product.productImage}` : product.imageUrl}
                    alt={product.name}
                    style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #e2e8f0' }}
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

            {/* QR Code Section */}
            <div className="view-info-group qr-section">
              <label>PRODUCT QR CODE</label>
              <div ref={qrRef} className="qr-code-box">
                <QRCodeSVG
                  value={productUrl}
                  size={180}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#1e3a8a"
                />
              </div>
              <p className="qr-url">{productUrl}</p>
              <div className="qr-button-group">
                <button
                  type="button"
                  className="download-qr-btn"
                  onClick={handleDownloadQR}
                >
                  ⬇ Download QR Code
                </button>
                <button
                  type="button"
                  className="print-qr-btn"
                  onClick={handlePrintQR}
                >
                  🖨 Print QR Code
                </button>
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
