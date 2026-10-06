import React, { useState, useEffect } from 'react';
import { apiGetTrashProducts, apiRestoreProduct, apiPermanentDeleteProduct } from '../services/api';
import type { Product } from '../services/api';

interface TrashProps {
  canEdit: boolean;
  isAdmin: boolean;
  onRestored?: () => void;
}

const Trash: React.FC<TrashProps> = ({ canEdit, isAdmin, onRestored }) => {
  const [trashProducts, setTrashProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadTrash = async () => {
    try {
      const products = await apiGetTrashProducts();
      setTrashProducts(products);
    } catch (err) {
      console.error('Failed to load trash:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (product: Product) => {
    setActionLoading(product.uniqueId);
    try {
      await apiRestoreProduct(product.uniqueId);
      setTrashProducts((prev) => prev.filter((p) => p.uniqueId !== product.uniqueId));
      onRestored?.();
    } catch (err) {
      console.error('Failed to restore:', err);
      alert('Failed to restore product');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (product: Product) => {
    if (!window.confirm(`Permanently delete "${product.name}"? This cannot be undone.`)) return;
    setActionLoading(product.uniqueId);
    try {
      await apiPermanentDeleteProduct(product.uniqueId);
      setTrashProducts((prev) => prev.filter((p) => p.uniqueId !== product.uniqueId));
    } catch (err) {
      console.error('Failed to permanently delete:', err);
      alert('Failed to delete product');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="empty-state" style={{ width: '100%' }}>Loading trash...</div>;
  }

  return (
    <div className="products-list-page">
      <div className="page-header">
        <div>
          <h1>Trash</h1>
          <p className="page-subtitle">
            {trashProducts.length} deleted product{trashProducts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="products-table-card">
        <div className="table-scroll-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th>S.N.</th>
                <th>Product Name</th>
                <th>Batch</th>
                <th>Mfg</th>
                <th>Expiry</th>
                <th>Unique ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trashProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    Trash is empty
                  </td>
                </tr>
              ) : (
                trashProducts.map((product, idx) => (
                  <tr key={product.uniqueId} style={{ opacity: actionLoading === product.uniqueId ? 0.5 : 1 }}>
                    <td>{idx + 1}</td>
                    <td>{product.name}</td>
                    <td>{product.batch}</td>
                    <td>{product.mfg}</td>
                    <td>{product.expiry}</td>
                    <td>{product.uniqueId}</td>
                    <td>
                      {canEdit && (
                        <button
                          className="icon-btn edit"
                          disabled={actionLoading === product.uniqueId}
                          onClick={() => handleRestore(product)}
                        >
                          ♻️ Restore
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          className="icon-btn delete"
                          disabled={actionLoading === product.uniqueId}
                          onClick={() => handlePermanentDelete(product)}
                        >
                          🗑️ Delete Forever
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Trash;
