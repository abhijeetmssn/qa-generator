import React, { useState, useEffect } from 'react';
import { apiGetProductByUniqueId } from '../services/api';
import type { Product } from '../services/api';
import '../ViewProduct.css';

type PublicProductProps = {
  uniqueId: string;
};

const PublicProduct: React.FC<PublicProductProps> = ({ uniqueId }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        const product = await apiGetProductByUniqueId(uniqueId);
        if (product) {
          setProduct(product);
          setError(null);
        } else {
          setError('Product not found');
        }
      } catch (err) {
        console.error('Error loading product:', err);
        setError('Failed to load product details');
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [uniqueId]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fb 0%, #e8eef8 100%)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px', animation: 'spin 2s linear infinite' }}>
            ⏳
          </div>
          <p style={{ fontSize: '18px', color: '#666', fontWeight: '500' }}>Loading product...</p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fb 0%, #e8eef8 100%)',
        padding: '20px',
      }}>
        <div style={{
          textAlign: 'center',
          background: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2 style={{ color: '#dc2626', marginTop: 0 }}>Product Not Found</h2>
          <p style={{ color: '#666' }}>{error || 'The product you are looking for does not exist.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f8fafb', minHeight: '100vh', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        color: 'white',
        padding: '24px 16px',
        textAlign: 'center',
      }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>{product.name}</h1>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>ID: {product.uniqueId}</p>
      </div>

      {/* Product Image */}
      {(product.productImage || product.imageUrl) && (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
          <img 
            src={product.productImage || product.imageUrl} 
            alt={product.name}
            style={{
              width: '100%',
              maxHeight: '400px',
              objectFit: 'cover',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              marginBottom: '16px',
            }}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        {/* Hazard Symbol Alert */}
        {product.hazardSymbol && (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '2px solid #dc2626',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
              {product.hazardSymbol.split(' ')[0]}
            </div>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#dc2626' }}>
              {product.hazardSymbol}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#666' }}>
              Handle with care — see precautions
            </p>
          </div>
        )}

        {/* Product Details */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
            PRODUCT DETAILS
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Batch Number</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>{product.batch || '—'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Mfg Date</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>{product.mfg || '—'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Expiry Date</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>{product.expiry || '—'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Packing Size</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>{product.packingSize || '—'}</p>
            </div>
          </div>
        </div>

        {/* Manufacturer Info */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
            MANUFACTURER
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Manufacturer Name</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>{product.manufacturer || '—'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Address</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                {product.manufacturerAddress || '—'}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Registration</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>
                  {product.registrationNumber?.slice(0, 20) || '—'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Licence</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>
                  {product.manufacturerLicence || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {product.technicalName && (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
              ADDITIONAL INFO
            </h2>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Technical Name</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>{product.technicalName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '20px 16px',
        color: '#888',
        fontSize: '14px',
      }}>
        <p style={{ margin: 0 }}>Powered by <strong>AP Solutions</strong></p>
      </div>
    </div>
  );
};

export default PublicProduct;
