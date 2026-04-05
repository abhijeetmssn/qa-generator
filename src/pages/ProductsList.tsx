import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { Product } from '../services/api';

interface ProductsListProps {
  products: Product[];
  goAdd: () => void;
  onView: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  canEdit?: boolean;
}

const ProductsList: React.FC<ProductsListProps> = ({ products, goAdd, onView, onEdit, onDelete, canEdit = true }) => {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter products by search term
  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.uniqueId?.toLowerCase().includes(q) ||
        p.batch?.toLowerCase().includes(q) ||
        p.mfg?.toLowerCase().includes(q) ||
        p.expiry?.toLowerCase().includes(q) ||
        p.shortUrl?.toLowerCase().includes(q) ||
        p.manufacturer?.toLowerCase().includes(q)
    );
  }, [products, search]);

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
    const rows = products.map((p, i) => ({
      'S.N.': i + 1,
      'Unique Id': p.uniqueId,
      'Product Name': p.name,
      'Batch Number': p.batch,
      'Manufacturing Date': p.mfg,
      'Expiry Date': p.expiry,
      'Short Url': p.shortUrl,
      'Manufacturer': p.manufacturer || '',
      'Manufacturer Address': p.manufacturerAddress || '',
      'Technical Name': p.technicalName || '',
      'Registration Number': p.registrationNumber || '',
      'Packing Size': p.packingSize || '',
      'Quantity': p.quantity || '',
      'Manufacturer Licence': p.manufacturerLicence || '',
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
                <th>Quantity</th>
                <th>Manufacturing Date</th>
                <th>Expiry Date</th>
                <th>Short Url</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
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
                    <td>{product.quantity || '-'}</td>
                    <td>{product.mfg}</td>
                    <td>{product.expiry}</td>
                    <td>
                      {product.shortUrl} <button className="icon-btn copy">Copy</button>
                    </td>
                    <td>
                      <button className="icon-btn view" onClick={() => onView(product)}>View</button>
                      {canEdit && <button className="icon-btn edit" onClick={() => onEdit?.(product)}>Edit</button>}
                      {canEdit && <button className="icon-btn delete" onClick={() => {
                        if (window.confirm(`Move "${product.name}" to trash?`)) {
                          onDelete?.(product);
                        }
                      }}>Delete</button>}
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
