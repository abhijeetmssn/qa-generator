import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import type { Product, Company } from '../services/api';
import { apiGetAllCompanies } from '../services/api';
import Spinner from '../components/Spinner';

function formatMonthYear(val?: string) {
  if (!val) return '—';
  // Accepts 'YYYY-MM' or 'YYYY-MM-DD'
  const [year, month] = val.split('-');
  if (!year || !month) return val;
  return `${month}/${year.slice(-2)}`;
}

function formatISTDate(val?: string) {
  if (!val) return '—';
  const d = new Date(val);
  // Only show date in DD/MM/YYYY format
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface ProductsListProps {
  products: Product[];
  goAdd: () => void;
  onView: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  canEdit?: boolean;
  isAdmin?: boolean;
  deletingId?: string | null;
}

const ProductsList: React.FC<ProductsListProps> = ({ products, goAdd, onView, onEdit, onDelete, canEdit = true, isAdmin = false, deletingId = null }) => {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companySearch, setCompanySearch] = useState('');

  useEffect(() => {
    if (isAdmin) {
      apiGetAllCompanies().then(setCompanies).catch(console.error);
    }
  }, [isAdmin]);

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const q = companySearch.toLowerCase();
    return companies.filter(c => c.name.toLowerCase().includes(q));
  }, [companies, companySearch]);

  // Filter products by selected company (admin only)
  const companyFilteredProducts = useMemo(() => {
    if (!isAdmin || !selectedCompanyId) return products;
    return products.filter(p => p.companyId === selectedCompanyId);
  }, [products, selectedCompanyId, isAdmin]);

  // Filter products by search term
  const filtered = useMemo(() => {
    if (!search.trim()) return companyFilteredProducts;
    const q = search.toLowerCase();
    return companyFilteredProducts.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.uniqueId?.toLowerCase().includes(q) ||
        p.batch?.toLowerCase().includes(q) ||
        p.mfg?.toLowerCase().includes(q) ||
        p.expiry?.toLowerCase().includes(q) ||

        p.manufacturer?.toLowerCase().includes(q)
    );
  }, [companyFilteredProducts, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to page 1 when search or pageSize changes
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };
  const handlePageSizeChange = (val: number) => {
    setPageSize(val);
    setCurrentPage(1);
  };

  const handleExport = () => {
    const rows = companyFilteredProducts.map((p, i) => ({
      'S.N.': i + 1,
      'Unique Id': p.uniqueId,
      'Product Name': p.name,
      'Batch Number': p.batch,
      'Manufacturing Date': p.mfg,
      'Expiry Date': p.expiry,
      'Packing Size': p.packingSize || '',
      'Manufacturer': p.manufacturer || '',
      'Manufacturer Address': p.manufacturerAddress || '',
      'Technical Name': p.technicalName || '',
      'Registration Number': p.registrationNumber || '',
      'Manufacturer Licence': p.manufacturerLicence || '',
      'Created Date': formatISTDate(p.createdDate),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key]).length)) + 2,
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `products_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="products-list-page">
      <div className="products-list-header">
        <h1>Product List</h1>
        <div className="products-list-actions">
          <button className="export-btn" onClick={handleExport}>Export</button>
          <button className="primary-btn" onClick={goAdd}>Add Product +</button>
        </div>
      </div>

      {/* Company filter for admin */}
      {isAdmin && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <label style={{ fontWeight: 600, fontSize: '14px', color: '#334155', marginBottom: '8px', display: 'block' }}>
            Filter by Company
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search company..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
              />
            </div>
            <select
              value={selectedCompanyId ?? ''}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value ? Number(e.target.value) : null);
                setCurrentPage(1);
              }}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', minWidth: '200px', outline: 'none' }}
            >
              <option value="">All Companies</option>
              {filteredCompanies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {selectedCompanyId && (
              <button
                onClick={() => { setSelectedCompanyId(null); setCompanySearch(''); setCurrentPage(1); }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f1f5f9', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div className="products-table-card">
        <div className="table-top">
          <label>
            Show
            <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            entries
          </label>
          <input
            className="search-input"
            placeholder="Search by name, batch, ID..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div style={{overflowX: 'auto', width: '100%', flex: 1, WebkitOverflowScrolling: 'touch'}}>
          <table className="products-table">
            <thead>
              <tr>
                <th>S.N.</th>
                <th>Unique Id</th>
                <th>Product Name</th>
                <th>Batch Number</th>
                <th>Manufacturing Date</th>
                <th>Expiry Date</th>
                <th>Packing Size</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    {search ? 'No products match your search.' : 'No products found.'}
                  </td>
                </tr>
              ) : (
                paged.map((product, idx) => (
                  <tr key={product.id}>
                    <td>{(safePage - 1) * pageSize + idx + 1}</td>
                    <td>{product.uniqueId}</td>
                    <td>{product.name}</td>
                    <td>{product.batch}</td>
                      <td>{formatMonthYear(product.mfg)}</td>
                      <td>{formatMonthYear(product.expiry)}</td>
                    <td>{product.packingSize || '—'}</td>
                    <td>{formatISTDate(product.createdDate)}</td>
                    <td>
                      <button className="icon-btn view" onClick={() => onView(product)}>View</button>
                      {canEdit && <button className="icon-btn edit" onClick={() => onEdit?.(product)}>Edit</button>}
                      {canEdit && (
                        <button
                          className="icon-btn delete"
                          disabled={deletingId === product.uniqueId}
                          onClick={() => {
                            if (window.confirm(`Move "${product.name}" to trash?`)) {
                              onDelete?.(product);
                            }
                          }}
                        >
                          {deletingId === product.uniqueId
                            ? <Spinner size="small" />
                            : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', fontSize: '13px', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
          <span>
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries
            {search && ` (filtered from ${products.length} total)`}
          </span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(safePage - 1)}
                style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', cursor: safePage <= 1 ? 'default' : 'pointer', opacity: safePage <= 1 ? 0.5 : 1 }}
              >
                ‹ Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .map((p, i, arr) => (
                  <React.Fragment key={p}>
                    {i > 0 && arr[i - 1] !== p - 1 && <span style={{ padding: '4px 6px' }}>…</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: p === safePage ? '#4f46e5' : '#e2e8f0',
                        background: p === safePage ? '#4f46e5' : '#fff',
                        color: p === safePage ? '#fff' : '#334155',
                        cursor: 'pointer',
                        fontWeight: p === safePage ? 600 : 400,
                      }}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              <button
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(safePage + 1)}
                style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', cursor: safePage >= totalPages ? 'default' : 'pointer', opacity: safePage >= totalPages ? 0.5 : 1 }}
              >
                Next ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsList;
