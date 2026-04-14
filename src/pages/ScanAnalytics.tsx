import React, { useState, useEffect } from 'react';
import { apiGetScanAnalytics } from '../services/api';
import type { ScanSummary } from '../services/api';

const PAGE_SIZE = 10;
const DETAIL_PAGE_SIZE = 5;

const ScanAnalytics: React.FC = () => {
  const [summary, setSummary] = useState<ScanSummary[]>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailPage, setDetailPage] = useState<Record<string, number>>({});

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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

  const filtered = summary.filter(s =>
    s.productName.toLowerCase().includes(search.toLowerCase()) ||
    s.productId.includes(search)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const mostScanned = summary.length > 0
    ? summary.reduce((a, b) => a.totalScans > b.totalScans ? a : b)
    : null;

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    setExpandedProduct(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedProduct(expandedProduct === id ? null : id);
    if (!detailPage[id]) setDetailPage(prev => ({ ...prev, [id]: 1 }));
  };

  const getDetailPage = (id: string) => detailPage[id] || 1;
  const setDetailPageFor = (id: string, p: number) =>
    setDetailPage(prev => ({ ...prev, [id]: p }));

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📲</div>
        <p style={{ color: '#94a3b8', fontSize: '1rem' }}>Loading scan analytics...</p>
      </div>
    );
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
      {/* Header */}
      <div className="products-list-header">
        <h1>📲 Scan Analytics</h1>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={cardStyle('#eff6ff', '#1e40af')}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e40af' }}>{totalScans}</div>
          <div style={{ fontSize: '0.82rem', color: '#3b82f6', fontWeight: 600, marginTop: '2px' }}>TOTAL SCANS</div>
        </div>
        <div style={cardStyle('#f0fdf4', '#166534')}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a' }}>{summary.length}</div>
          <div style={{ fontSize: '0.82rem', color: '#22c55e', fontWeight: 600, marginTop: '2px' }}>PRODUCTS TRACKED</div>
        </div>
        {mostScanned && (
          <div style={{ ...cardStyle('#fefce8', '#854d0e'), flex: '2 1 200px' }}>
            <div style={{ fontSize: '0.82rem', color: '#ca8a04', fontWeight: 600, marginBottom: '4px' }}>MOST SCANNED</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#854d0e' }}>{mostScanned.productName}</div>
            <div style={{ fontSize: '0.8rem', color: '#a16207', marginTop: '2px' }}>
              {mostScanned.totalScans} scan{mostScanned.totalScans !== 1 ? 's' : ''} · ID: {mostScanned.productId}
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search by product name or ID..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: '380px', padding: '9px 14px',
            border: '1px solid #e2e8f0', borderRadius: '8px',
            fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
            background: '#fff', color: '#1e293b',
          }}
        />
        {search && (
          <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#64748b' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="products-table-card">
        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table className="products-table">
            <thead>
              <tr>
                <th style={{ width: '48px' }}>#</th>
                <th>Product Name</th>
                <th style={{ width: '100px' }}>ID</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Scans</th>
                <th>Last Scanned</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                    {search ? 'No products match your search.' : 'No scans recorded yet. Share your QR codes to start tracking.'}
                  </td>
                </tr>
              ) : (
                paginated.map((item, idx) => {
                  const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
                  const isExpanded = expandedProduct === item.productId;
                  const dp = getDetailPage(item.productId);
                  const detailTotal = Math.max(1, Math.ceil(item.recentScans.length / DETAIL_PAGE_SIZE));
                  const detailScans = item.recentScans.slice((dp - 1) * DETAIL_PAGE_SIZE, dp * DETAIL_PAGE_SIZE);

                  return (
                    <React.Fragment key={item.productId}>
                      <tr style={{ background: isExpanded ? '#f0f9ff' : undefined }}>
                        <td style={{ color: '#94a3b8', fontWeight: 600 }}>{globalIdx}</td>
                        <td style={{ fontWeight: 600, color: '#1e293b' }}>{item.productName}</td>
                        <td>
                          <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 7px', borderRadius: '5px', fontSize: '0.82rem' }}>
                            {item.productId}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            background: item.totalScans > 0 ? '#dcfce7' : '#f1f5f9',
                            color: item.totalScans > 0 ? '#166534' : '#94a3b8',
                            fontWeight: 700, padding: '3px 12px',
                            borderRadius: '20px', fontSize: '0.85rem',
                          }}>
                            {item.totalScans}
                          </span>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          {item.lastScanned ? formatDate(item.lastScanned) : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => toggleExpand(item.productId)}
                            style={{
                              padding: '4px 12px', borderRadius: '6px', border: 'none',
                              background: isExpanded ? '#1e40af' : '#e0e7ff',
                              color: isExpanded ? '#fff' : '#1e40af',
                              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {isExpanded ? '▲ Hide' : '▼ View'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0, background: '#f8fafc' }}>
                            <div style={{ padding: '16px 20px' }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Recent Scan Details — showing {detailScans.length} of {item.recentScans.length}
                              </div>

                              {item.recentScans.length === 0 ? (
                                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>No scan details available.</p>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {detailScans.map((scan, i) => {
                                      const locationParts = [scan.city, scan.region, scan.country].filter(Boolean);
                                      const location = locationParts.join(', ') || '—';
                                      return (
                                        <div key={i} style={{
                                          background: '#fff', borderRadius: '8px',
                                          border: '1px solid #e2e8f0', padding: '12px 16px',
                                          display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr',
                                          gap: '12px', alignItems: 'center',
                                        }}>
                                          <div style={{ width: '28px', height: '28px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#1e40af' }}>
                                            {(dp - 1) * DETAIL_PAGE_SIZE + i + 1}
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Date & Time</div>
                                            <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500, marginTop: '1px' }}>{formatDate(scan.scannedAt)}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Location</div>
                                            <div style={{ fontSize: '0.85rem', color: '#1e293b', marginTop: '1px' }}>
                                              {location}
                                              {scan.latitude && scan.longitude && (
                                                <a href={`https://www.google.com/maps?q=${scan.latitude},${scan.longitude}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '5px' }}>📍</a>
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Device</div>
                                            <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }} title={scan.userAgent || ''}>
                                              {scan.userAgent ? parseUserAgent(scan.userAgent) : '—'}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Detail Pagination */}
                                  {detailTotal > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                                      <button onClick={() => setDetailPageFor(item.productId, dp - 1)} disabled={dp === 1} style={paginationBtnStyle(dp === 1)}>‹ Prev</button>
                                      <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Page {dp} of {detailTotal}</span>
                                      <button onClick={() => setDetailPageFor(item.productId, dp + 1)} disabled={dp === detailTotal} style={paginationBtnStyle(dp === detailTotal)}>Next ›</button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} products
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setPage(1)} disabled={page === 1} style={paginationBtnStyle(page === 1)}>«</button>
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={paginationBtnStyle(page === 1)}>‹ Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: '#94a3b8' }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p as number)} style={{
                      ...paginationBtnStyle(false),
                      background: page === p ? '#1e40af' : '#f1f5f9',
                      color: page === p ? '#fff' : '#374151',
                      fontWeight: page === p ? 700 : 500,
                    }}>{p}</button>
                  )
                )}
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} style={paginationBtnStyle(page === totalPages)}>Next ›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={paginationBtnStyle(page === totalPages)}>»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function parseUserAgent(ua: string): string {
  if (/iPhone/i.test(ua)) return '📱 iPhone';
  if (/iPad/i.test(ua)) return '📱 iPad';
  if (/Android/i.test(ua)) return '📱 Android';
  if (/Windows/i.test(ua)) return '🖥️ Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return '🖥️ Mac';
  if (/Linux/i.test(ua)) return '🖥️ Linux';
  return ua.substring(0, 40);
}

function cardStyle(bg: string, borderColor: string): React.CSSProperties {
  return {
    flex: '1 1 130px', background: bg,
    border: `1px solid ${borderColor}22`,
    borderRadius: '12px', padding: '16px 20px',
  };
}

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '5px 12px', borderRadius: '6px', border: '1px solid #e2e8f0',
    background: disabled ? '#f8fafc' : '#f1f5f9',
    color: disabled ? '#cbd5e1' : '#374151',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.85rem', fontWeight: 500,
  };
}

export default ScanAnalytics;
