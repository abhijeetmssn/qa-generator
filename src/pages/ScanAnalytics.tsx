import React, { useState, useEffect, useCallback } from 'react';
import { apiGetScanAnalytics, apiGetProductScanDetails } from '../services/api';
import type { ScanSummary, ScanRecentEntry } from '../services/api';

const PAGE_SIZE = 10;
const DETAIL_PAGE_SIZE = 5;

interface DetailState {
  scans: ScanRecentEntry[];
  total: number;
  page: number;
  loading: boolean;
}

const ScanAnalytics: React.FC = () => {
  const [summary, setSummary] = useState<ScanSummary[]>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});

  const loadSummary = useCallback(async (p: number, s: string) => {
    setLoading(true);
    try {
      const data = await apiGetScanAnalytics({ page: p, limit: PAGE_SIZE, search: s });
      setSummary(data.summary);
      setTotalScans(data.totalScans);
      setTotalProducts(data.totalProducts);
      setTotalPages(Math.max(1, Math.ceil(data.totalProducts / PAGE_SIZE)));
    } catch (err: any) {
      setError(err.message || 'Failed to load scan data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(page, search); }, [page, search]);

  const loadDetail = async (productId: string, p: number) => {
    setDetails(prev => ({ ...prev, [productId]: { ...prev[productId], loading: true, page: p } }));
    try {
      const data = await apiGetProductScanDetails(productId, { page: p, limit: DETAIL_PAGE_SIZE });
      setDetails(prev => ({ ...prev, [productId]: { scans: data.scans, total: data.total, page: p, loading: false } }));
    } catch {
      setDetails(prev => ({ ...prev, [productId]: { ...prev[productId], loading: false } }));
    }
  };

  const toggleExpand = async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(productId);
    if (!details[productId]) await loadDetail(productId, 1);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
    setExpandedProduct(null);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

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
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={cardStyle('#eff6ff', '#1e40af')}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e40af' }}>{totalScans}</div>
          <div style={{ fontSize: '0.82rem', color: '#3b82f6', fontWeight: 600, marginTop: '2px' }}>TOTAL SCANS</div>
        </div>
        <div style={cardStyle('#f0fdf4', '#166534')}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a' }}>{totalProducts}</div>
          <div style={{ fontSize: '0.82rem', color: '#22c55e', fontWeight: 600, marginTop: '2px' }}>PRODUCTS TRACKED</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by product name or ID..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{
            width: '100%', maxWidth: '340px', padding: '9px 14px',
            border: '1px solid #e2e8f0', borderRadius: '8px',
            fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
            background: '#fff', color: '#1e293b',
          }}
        />
        <button
          onClick={handleSearch}
          style={{ padding: '9px 18px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
            style={{ padding: '9px 14px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ✕ Clear
          </button>
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
                <th style={{ width: '90px' }}>ID</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Scans</th>
                <th>Last Scanned</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                    Loading...
                  </td>
                </tr>
              ) : summary.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                    {search ? 'No products match your search.' : 'No scans recorded yet.'}
                  </td>
                </tr>
              ) : (
                summary.map((item, idx) => {
                  const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
                  const isExpanded = expandedProduct === item.productId;
                  const det = details[item.productId];
                  const detTotal = det ? Math.max(1, Math.ceil(det.total / DETAIL_PAGE_SIZE)) : 1;

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
                              {det?.loading ? (
                                <p style={{ color: '#94a3b8', margin: 0 }}>Loading scan details...</p>
                              ) : !det || det.scans.length === 0 ? (
                                <p style={{ color: '#94a3b8', margin: 0 }}>No scan details available.</p>
                              ) : (
                                <>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Showing {(det.page - 1) * DETAIL_PAGE_SIZE + 1}–{Math.min(det.page * DETAIL_PAGE_SIZE, det.total)} of {det.total} scans
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {det.scans.map((scan, i) => {
                                      const locationParts = [scan.city, scan.region, scan.country].filter(Boolean);
                                      const location = locationParts.join(', ') || '—';
                                      return (
                                        <div key={i} style={{
                                          background: '#fff', borderRadius: '8px',
                                          border: '1px solid #e2e8f0', padding: '12px 16px',
                                          display: 'grid',
                                          gridTemplateColumns: '28px 1fr 1fr 1fr 1fr',
                                          gap: '12px', alignItems: 'center',
                                        }}>
                                          {/* Index */}
                                          <div style={{ width: '28px', height: '28px', background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#1e40af' }}>
                                            {(det.page - 1) * DETAIL_PAGE_SIZE + i + 1}
                                          </div>
                                          {/* Date */}
                                          <div>
                                            <div style={labelStyle}>Date & Time</div>
                                            <div style={valueStyle}>{formatDate(scan.scannedAt)}</div>
                                          </div>
                                          {/* Location */}
                                          <div>
                                            <div style={labelStyle}>Location</div>
                                            <div style={valueStyle}>
                                              {location}
                                              {scan.latitude && scan.longitude && (
                                                <a href={`https://www.google.com/maps?q=${scan.latitude},${scan.longitude}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '5px' }}>📍</a>
                                              )}
                                            </div>
                                          </div>
                                          {/* IP Address */}
                                          <div>
                                            <div style={labelStyle}>IP Address</div>
                                            <div style={{ ...valueStyle, fontFamily: 'monospace', fontSize: '0.82rem' }}>{scan.ipAddress || '—'}</div>
                                          </div>
                                          {/* Device */}
                                          <div>
                                            <div style={labelStyle}>Device</div>
                                            <div style={{ ...valueStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }} title={scan.userAgent || ''}>
                                              {scan.userAgent ? parseUserAgent(scan.userAgent) : '—'}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Detail Pagination */}
                                  {detTotal > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                                      <button onClick={() => loadDetail(item.productId, det.page - 1)} disabled={det.page === 1} style={paginationBtnStyle(det.page === 1)}>‹ Prev</button>
                                      <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Page {det.page} of {detTotal}</span>
                                      <button onClick={() => loadDetail(item.productId, det.page + 1)} disabled={det.page === detTotal} style={paginationBtnStyle(det.page === detTotal)}>Next ›</button>
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
              Page {page} of {totalPages} · {totalProducts} products
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setPage(1)} disabled={page === 1} style={paginationBtnStyle(page === 1)}>«</button>
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={paginationBtnStyle(page === 1)}>‹ Prev</button>
              {pageNumbers(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} style={{ padding: '0 4px', color: '#94a3b8' }}>…</span>
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

function pageNumbers(current: number, total: number): (number | '...')[] {
  return Array.from({ length: total }, (_, i) => i + 1)
    .filter(p => p === 1 || p === total || Math.abs(p - current) <= 1)
    .reduce<(number | '...')[]>((acc, p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);
}

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
  return { flex: '1 1 130px', background: bg, border: `1px solid ${borderColor}22`, borderRadius: '12px', padding: '16px 20px' };
}

const labelStyle: React.CSSProperties = { fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' };
const valueStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#1e293b', fontWeight: 500, marginTop: '1px' };

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
