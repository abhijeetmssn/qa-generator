import React, { useState, useEffect, useCallback } from 'react';
import { apiGetScanAnalytics, apiGetProductScanDetails } from '../services/api';
import type { ScanSummary, ScanRecentEntry } from '../services/api';
import Icon from '../components/Icon';

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
        <div className="page-header"><div><h1>Scan Analytics</h1></div></div>
        <div className="products-table-card">
          <div className="table-empty" style={{ color: 'var(--danger-600)' }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="products-list-page">
      <div className="page-header">
        <div>
          <h1>Scan Analytics</h1>
          <p className="page-subtitle">Where and when your product QR codes are scanned</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><Icon name="scan" size={22} /></div>
          <div>
            <div className="stat-label">Total Scans</div>
            <div className="stat-value">{totalScans}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="package" size={22} /></div>
          <div>
            <div className="stat-label">Products Tracked</div>
            <div className="stat-value">{totalProducts}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="products-table-card">
        <div className="table-top">
          <div className="filter-bar-row">
            <input
              type="text"
              className="search-input"
              placeholder="Search by product name or ID..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button className="primary-btn" onClick={handleSearch}>
              <Icon name="search" size={16} /> Search
            </button>
            {search && (
              <button className="secondary-btn" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}>
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="table-scroll-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th style={{ width: '48px' }}>#</th>
                <th>Product Name</th>
                <th style={{ width: '110px' }}>ID</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Scans</th>
                <th>Last Scanned</th>
                <th style={{ textAlign: 'right' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-empty">Loading...</td>
                </tr>
              ) : summary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
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
                      <tr className={isExpanded ? 'is-expanded' : undefined}>
                        <td className="cell-muted">{globalIdx}</td>
                        <td className="cell-strong">{item.productName}</td>
                        <td><span className="mono-chip">{item.productId}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${item.totalScans > 0 ? 'is-success' : 'is-neutral'}`}>{item.totalScans}</span>
                        </td>
                        <td className="cell-muted">
                          {item.lastScanned ? formatDate(item.lastScanned) : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="icon-btn view" onClick={() => toggleExpand(item.productId)}>
                            {isExpanded ? 'Hide' : 'View'}
                            <Icon name="chevron-down" size={14} className={isExpanded ? 'rotate-180' : undefined} />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <tr className="detail-row">
                          <td colSpan={6}>
                            <div className="scan-detail">
                              {det?.loading ? (
                                <p className="muted-text">Loading scan details...</p>
                              ) : !det || det.scans.length === 0 ? (
                                <p className="muted-text">No scan details available.</p>
                              ) : (
                                <>
                                  <div className="scan-detail-caption">
                                    Showing {(det.page - 1) * DETAIL_PAGE_SIZE + 1}–{Math.min(det.page * DETAIL_PAGE_SIZE, det.total)} of {det.total} scans
                                  </div>

                                  <div className="scan-detail-list">
                                    {det.scans.map((scan, i) => {
                                      const locationParts = [scan.city, scan.region, scan.country].filter(Boolean);
                                      const location = locationParts.join(', ') || '—';
                                      return (
                                        <div key={i} className="scan-detail-item">
                                          <div className="scan-detail-index">
                                            {(det.page - 1) * DETAIL_PAGE_SIZE + i + 1}
                                          </div>
                                          <div>
                                            <div className="detail-label">Date & Time</div>
                                            <div className="detail-value">{formatDate(scan.scannedAt)}</div>
                                          </div>
                                          <div>
                                            <div className="detail-label">Location</div>
                                            <div className="detail-value">
                                              {location}
                                              {scan.latitude && scan.longitude && (
                                                <a className="map-link" href={`https://www.google.com/maps?q=${scan.latitude},${scan.longitude}`} target="_blank" rel="noopener noreferrer">Map</a>
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="detail-label">IP Address</div>
                                            <div className="detail-value mono">{scan.ipAddress || '—'}</div>
                                          </div>
                                          <div>
                                            <div className="detail-label">Device</div>
                                            <div className="detail-value truncate" title={scan.userAgent || ''}>
                                              {scan.userAgent ? parseUserAgent(scan.userAgent) : '—'}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Detail Pagination */}
                                  {detTotal > 1 && (
                                    <div className="pager" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
                                      <button className="pager-btn" onClick={() => loadDetail(item.productId, det.page - 1)} disabled={det.page === 1}>‹ Prev</button>
                                      <span className="pager-gap">Page {det.page} of {detTotal}</span>
                                      <button className="pager-btn" onClick={() => loadDetail(item.productId, det.page + 1)} disabled={det.page === detTotal}>Next ›</button>
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
          <div className="table-footer">
            <span>
              Page {page} of {totalPages} · {totalProducts} products
            </span>
            <div className="pager">
              <button className="pager-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
              <button className="pager-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹ Prev</button>
              {pageNumbers(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="pager-gap">…</span>
                ) : (
                  <button key={p} className={`pager-btn${page === p ? ' is-active' : ''}`} onClick={() => setPage(p as number)}>{p}</button>
                )
              )}
              <button className="pager-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next ›</button>
              <button className="pager-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
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
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return ua.substring(0, 40);
}

export default ScanAnalytics;
