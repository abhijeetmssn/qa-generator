import React, { useState, useEffect } from 'react';
import { apiGetScanAnalytics } from '../services/api';
import type { ScanSummary } from '../services/api';

const ScanAnalytics: React.FC = () => {
  const [summary, setSummary] = useState<ScanSummary[]>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGetScanAnalytics();
        setSummary(data.summary);
        setTotalScans(data.totalScans);
      } catch (err: any) {
        setError(err.message || 'Failed to load scan data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div style={{ fontSize: '1.1rem', color: '#64748b' }}>Loading scan data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', color: '#dc2626', background: '#fef2f2', borderRadius: '8px' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary card */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1', minWidth: '160px' }}>
          <div className="card-icon">📲</div>
          <div>
            <div className="card-title">Total Scans</div>
            <div className="card-value">{totalScans}</div>
          </div>
        </div>
        <div className="card" style={{ flex: '1', minWidth: '160px' }}>
          <div className="card-icon">📦</div>
          <div>
            <div className="card-title">Products Scanned</div>
            <div className="card-value">{summary.length}</div>
          </div>
        </div>
      </div>

      {summary.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          background: '#f8fafc', borderRadius: '12px',
          color: '#64748b', fontSize: '1rem',
        }}>
          No scans recorded yet. Share your product QR codes to start tracking.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '1rem' }}>
            Scan Details by Product
          </div>
          {summary.map((item) => (
            <div key={item.productId} style={{
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: '10px', overflow: 'hidden',
            }}>
              {/* Row header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', cursor: 'pointer',
                  background: expandedProduct === item.productId ? '#eff6ff' : '#fff',
                }}
                onClick={() => setExpandedProduct(expandedProduct === item.productId ? null : item.productId)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    background: '#dbeafe', color: '#1e40af',
                    fontWeight: 700, fontSize: '0.8rem', padding: '2px 8px', borderRadius: '20px',
                  }}>
                    #{item.productId}
                  </span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{item.productName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{
                    background: '#dcfce7', color: '#166534',
                    fontWeight: 700, padding: '3px 12px', borderRadius: '20px', fontSize: '0.9rem',
                  }}>
                    {item.totalScans} scan{item.totalScans !== 1 ? 's' : ''}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    {item.lastScanned ? `Last: ${formatDate(item.lastScanned)}` : 'No scans yet'}
                  </span>
                  <span style={{ color: '#94a3b8' }}>{expandedProduct === item.productId ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded recent scans */}
              {expandedProduct === item.productId && (
                <div style={{ borderTop: '1px solid #e2e8f0' }}>
                  {item.recentScans.length === 0 ? (
                    <div style={{ padding: '14px 18px', color: '#94a3b8', fontSize: '0.88rem' }}>
                      No recent scan details.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '8px 18px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Date & Time</th>
                          <th style={{ padding: '8px 18px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>IP Address</th>
                          <th style={{ padding: '8px 18px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Device / Browser</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.recentScans.map((scan, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 18px', color: '#334155' }}>{formatDate(scan.scannedAt)}</td>
                            <td style={{ padding: '8px 18px', color: '#64748b' }}>{scan.ipAddress || '—'}</td>
                            <td style={{ padding: '8px 18px', color: '#64748b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {scan.userAgent || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScanAnalytics;
