import React, { useState, useEffect } from 'react';
import BrandMark from './BrandMark';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  companyId?: number;
  companyName?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', showText = true, companyId, companyName }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      fetch(`${API_BASE}/companies/${companyId}/logo`)
        .then(res => {
          if (res.ok) {
            return res.blob();
          }
          return null;
        })
        .then(blob => {
          if (blob && blob.size > 100) {
            setLogoUrl(URL.createObjectURL(blob));
          }
        })
        .catch(err => console.error('Failed to load logo:', err));
    }
  }, [companyId]);
  // If company has a logo, display it
  if (logoUrl) {
    return (
      <div className="brand-company">
        <div className="brand-company-logo">
          <img src={logoUrl} alt={companyName || 'Company Logo'} />
        </div>
        {showText && companyName && <div className="brand-company-name">{companyName}</div>}
      </div>
    );
  }

  // Otherwise the APAS brand: shield mark + wordmark
  const markSize = { small: 28, medium: 38, large: 52 }[size];
  return (
    <div className="brand-lockup">
      <BrandMark size={markSize} />
      {showText && (
        <div className="brand-wordmark">
          <div className="brand-name">APAS</div>
          <div className="brand-tagline">Agri Product Authentication</div>
        </div>
      )}
    </div>
  );
};

export default Logo;
