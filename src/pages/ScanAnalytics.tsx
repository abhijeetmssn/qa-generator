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
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading scan data...</div>;
  }

  if (error) {
    return (
      <div className="products-list-page">
        <div className="products-list-header"><h1>📲 Scan Analytics</h1></div>
        <div className="products-table-card">
          <div style={{ padding: '24px', color: '#dc2626' }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="products-list-page">
      <div className="products-list-header">
        <h1>📲 Scan Analytics</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          {totalScans} total scan{totalScans !== 1 ? 's' : ''} across {summary.length} product{summary.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="products-table-card">
        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table className="products-table">
            <thead>
              <tr>
                <th>S.N.</th>
                <th>Product Name</th>
                <th>Product ID</th>
                <th>Total Scans</th>
                <th>Last Scanned</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No scans recorded yet. Share your product QR codes to start tracking.
                  </td>
                </tr>
              ) : (
                summary.map((item, idx) => (
                  <React.Fragment key={item.productId}>
                    <tr>
                      <td>{idx + 1}</td>
                      <td>{item.productName}</td>
                      <td>{item.productId}</td>
                      <td>
                        <span style={{
                          background: '#dcfce7', color: '#166534',
                          fontWeight: 700, padding: '2px 10px',
                          borderRadius: '20px', fontSize: '0.85rem',
                        }}>
                          {item.totalScans}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        {item.lastScanned ? formatDate(item.lastScanned) : '—'}
                      </td>
                      <td>
                        <button
                          className="icon-btn edit"
                          onClick={() => setExpandedProduct(expandedProduct === item.productId ? null : item.productId)}
                        >
                          {expandedProduct === item.productId ? '▲ Hide' : '▼ View'}
                        </button>
                      </td>
                    </tr>

                    {expandedProduct === item.productId && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, background: '#f8fafc' }}>
                          {item.recentScans.length === 0 ? (
                            <div style={{ padding: '16px 24px', color: '#94a3b8', fontSize: '0.88rem' }}>
                              No recent scan details available.
                            </div>
                          ) : (
                            <table className="products-table" style={{ margin: 0, borderTop: '1px solid #e2e8f0' }}>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Date & Time</th>
                                  <th>Location</th>
                                  <th>IP Address</th>
                                  <th>Device / Browser</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.recentScans.map((scan, i) => {
                                  const locationParts = [scan.city, scan.region, scan.country].filter(Boolean);
                                  const location = locationParts.length > 0 ? locationParts.join(', ') : '—';
                                  return (
                                    <tr key={i}>
                                      <td>{i + 1}</td>
                                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(scan.scannedAt)}</td>
                                      <td>
                                        {location}
                                        {scan.latitude && scan.longitude && (
                                          <a
                                            href={`https://www.google.com/maps?q=${scan.latitude},${scan.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ marginLeft: '6px', fontSize: '0.85rem' }}
                                          >
                                            📍
                                          </a>
                                        )}
                                      </td>
                                      <td>{scan.ipAddress || '—'}</td>
                                      <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {scan.userAgent || '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ScanAnalytics;
