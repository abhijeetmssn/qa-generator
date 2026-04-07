import React, { useRef, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import '../ViewProduct.css';
import type { Product, Company } from '../services/api';
import { apiGetCompanyById } from '../services/api';

type ViewProductProps = {
  product: Product;
  goBack: () => void;
  companyId?: number;
  companyName?: string;
};

const ViewProduct: React.FC<ViewProductProps> = ({ product, goBack, companyId, companyName }) => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const logoUrl = companyId ? `${API_BASE}/companies/${companyId}/logo` : undefined;
  const qrRef = useRef<HTMLDivElement>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [imagesReady, setImagesReady] = useState(false);

  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (companyId) {
      apiGetCompanyById(companyId).then(setCompany).catch(console.error);
    }
  }, [companyId]);

  // Preload product and hazard images before showing page
  useEffect(() => {
    const imagesToLoad: string[] = [];
    if (product.productImage) imagesToLoad.push(`${API_BASE.replace('/api', '')}${product.productImage}`);
    else if (product.imageUrl) imagesToLoad.push(product.imageUrl);
    if (product.hazardId) imagesToLoad.push(`${API_BASE}/hazards/${product.hazardId}/image`);

    if (imagesToLoad.length === 0) { setImagesReady(true); return; }

    let loaded = 0;
    const onDone = () => { loaded++; if (loaded >= imagesToLoad.length) setImagesReady(true); };
    imagesToLoad.forEach(src => {
      const img = new Image();
      img.onload = onDone;
      img.onerror = onDone;
      img.src = src;
    });
    // Fallback: show page after 3s even if images fail
    const timer = setTimeout(() => setImagesReady(true), 3000);
    return () => clearTimeout(timer);
  }, [product, API_BASE]);

  // Build the public product view URL
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
            .print-container {
              text-align: center;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 20px;
              color: #333;
            }
            .product-info {
              margin-bottom: 20px;
              font-size: 14px;
              color: #666;
            }
            svg {
              border: 2px solid #ccc;
              padding: 10px;
              background: white;
            }
            .product-url {
              margin-top: 20px;
              font-size: 12px;
              color: #999;
              word-break: break-all;
            }
            @media print {
              body {
                background: white;
              }
            }
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

  if (!imagesReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: '18px', color: '#666', fontWeight: '500' }}>Loading product details...</p>
      </div>
    );
  }

  return (
    <div className="view-product-page">
      <div className="view-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
      </div>
      
      <div className="view-product-header">
        <div className="view-logo-section">
          {logoUrl && !logoError ? (
            <img src={logoUrl} alt={companyName || 'Company Logo'} className="view-logo-img" onError={() => setLogoError(true)} />
          ) : (
            <div className="view-logo">{companyName?.substring(0, 3).toUpperCase() || 'FAS'}</div>
          )}
        </div>
        <h1>Agri Input Information System (AIIS)</h1>
      </div>

      <div className="view-product-content">
        <div className="view-info-grid">
          <div className="view-info-column">
            <div className="view-info-group">
              <label>NAME OF THE MANUFACTURER</label>
              <p>{product.manufacturer || companyName || '—'}</p>
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

export default ViewProduct;
