import React, { useState, useEffect } from 'react';

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
  const sizes = {
    small: { width: 40, height: 40, fontSize: 14 },
    medium: { width: 120, height: 120, fontSize: 24 },
    large: { width: 150, height: 150, fontSize: 32 }
  };

  const s = sizes[size];

  // If company has a logo, display it
  if (logoUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
        <div style={{
          width: `${s.width}px`,
          height: `${s.width}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px',
          border: '2px solid rgba(255,255,255,0.3)',
          backgroundColor: 'rgba(255,255,255,0.1)',
          padding: '8px',
          overflow: 'hidden'
        }}>
          <img
            src={logoUrl}
            alt={companyName || 'Company Logo'}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>
        {showText && companyName && (
          <div style={{
            textAlign: 'center',
            lineHeight: 1.2,
            fontWeight: 'bold',
            fontSize: `${s.fontSize * 0.7}px`,
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            maxWidth: '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {companyName}
          </div>
        )}
      </div>
    );
  }

  // Fall back to AP Solutions SVG if no company logo
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg
        width={s.width}
        height={s.height}
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle for A */}
        <circle cx="45" cy="60" r="32" fill="none" stroke="white" strokeWidth="3" opacity="0.9" />
        <circle cx="45" cy="60" r="28" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.5" />

        {/* A in white */}
        <text
          x="45"
          y="68"
          fontSize="32"
          fontWeight="bold"
          fill="white"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          A
        </text>

        {/* Background circle for P */}
        <circle cx="80" cy="60" r="32" fill="none" stroke="#fbbf24" strokeWidth="3" opacity="0.9" />
        <circle cx="80" cy="60" r="28" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5" />

        {/* P in orange */}
        <text
          x="80"
          y="68"
          fontSize="32"
          fontWeight="bold"
          fill="#fbbf24"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          P
        </text>

        {/* Decorative gear - top left */}
        <circle cx="25" cy="25" r="4" fill="white" opacity="0.8" />

        {/* Decorative sparkles */}
        <path 
          d="M 95 25 L 97 30 L 102 32 L 97 34 L 95 39 L 93 34 L 88 32 L 93 30 Z" 
          fill="#fbbf24" 
          opacity="0.8" 
        />
        <circle cx="25" cy="95" r="2.5" fill="white" opacity="0.7" />
        <circle cx="105" cy="95" r="2.5" fill="#fbbf24" opacity="0.7" />
      </svg>

      {showText && (
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div
            style={{
              fontWeight: 'bold',
              fontSize: `${s.fontSize}px`,
              letterSpacing: '0.5px',
              color: 'white',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            <span style={{ color: 'white' }}>AP</span>
            <span style={{ color: '#fbbf24' }}>Solutions</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logo;
