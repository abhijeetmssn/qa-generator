import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { apiBulkUploadProducts, apiGetAllCompanies } from '../services/api';
import type { BulkUploadResult, Company } from '../services/api';

interface BulkUploadProps {
  onUploadComplete: () => void;
}

const TEMPLATE_COLUMNS = [
  'Product Name',
  'Batch Number',
  'Manufacturing Date',
  'Expiry Date',
  'Manufacturer',
  'Manufacturer Address',
  'Technical Name',
  'Registration Number',
  'Manufacturer Licence',
];

const BulkUpload: React.FC<BulkUploadProps> = ({ onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');

  useEffect(() => {
    apiGetAllCompanies().then(setCompanies).catch(console.error);
  }, []);

  const handleDownloadTemplate = () => {
    const sampleRow: Record<string, string> = {};
    TEMPLATE_COLUMNS.forEach((col) => (sampleRow[col] = ''));
    // Add one example row
    const example: Record<string, string> = {
      'Product Name': 'Example Product',
      'Batch Number': 'BATCH-001',
      'Manufacturing Date': '2026-01-15',
      'Expiry Date': '2028-01-15',
      'Manufacturer': 'Example Pharma Ltd.',
      'Manufacturer Address': '123 Industrial Area, City',
      'Technical Name': 'Acetaminophen 500mg',
      'Registration Number': 'REG-12345',
      'Manufacturer Licence': 'LIC-9876',
    };

    const ws = XLSX.utils.json_to_sheet([example], { header: TEMPLATE_COLUMNS });
    // Auto-size columns
    ws['!cols'] = TEMPLATE_COLUMNS.map((col) => ({ wch: Math.max(col.length + 2, 20) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'products_upload_template.xlsx');
  };

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Please upload an Excel file (.xlsx, .xls) or CSV file.');
      return;
    }
    setFile(selectedFile);
    setError('');
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedCompanyId) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await apiBulkUploadProducts(file, selectedCompanyId);
      setResult(data);
      if (data.inserted > 0) {
        onUploadComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="bulk-upload-page">
      <h2 style={{ marginBottom: '4px', color: '#1e293b' }}>Bulk Upload Products</h2>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Upload an Excel file to import multiple products at once. Download the template to see the required format.
      </p>

      {/* Step 1: Download Template */}
      <div className="bulk-step">
        <div className="bulk-step-number">1</div>
        <div className="bulk-step-content">
          <h3>Download Template</h3>
          <p>Get the Excel template with the correct column headers.</p>
          <button className="secondary-btn" onClick={handleDownloadTemplate} style={{ marginTop: '8px' }}>
            📥 Download Template
          </button>
        </div>
      </div>

      {/* Step 2: Select Company */}
      <div className="bulk-step">
        <div className="bulk-step-number">2</div>
        <div className="bulk-step-content">
          <h3>Select Company</h3>
          <p>Choose the company these products belong to.</p>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : '')}
            style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', minWidth: '250px' }}
          >
            <option value="">-- Select a Company --</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Step 3: Upload File */}
      <div className="bulk-step">
        <div className="bulk-step-number">3</div>
        <div className="bulk-step-content">
          <h3>Upload Your File</h3>
          <p>Fill in the template and upload it here.</p>

          <div
            className={`bulk-dropzone${dragActive ? ' active' : ''}${file ? ' has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            {file ? (
              <div className="bulk-file-info">
                <span className="bulk-file-icon">📄</span>
                <span className="bulk-file-name">{file.name}</span>
                <span className="bulk-file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                <button
                  className="bulk-file-remove"
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="bulk-dropzone-text">
                <span style={{ fontSize: '2rem' }}>📁</span>
                <p><strong>Drag & drop</strong> your Excel file here</p>
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>or click to browse — .xlsx, .xls, .csv</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 4: Import */}
      <div className="bulk-step">
        <div className="bulk-step-number">4</div>
        <div className="bulk-step-content">
          <h3>Import Products</h3>
          <button
            className="primary-btn"
            onClick={handleUpload}
            disabled={!file || !selectedCompanyId || loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? '⏳ Uploading...' : '🚀 Upload & Import'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bulk-message error">
          ❌ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bulk-result">
          <div className={`bulk-message ${result.inserted > 0 ? 'success' : 'warning'}`}>
            {result.inserted > 0 ? '✅' : '⚠️'} {result.message}
          </div>

          <div className="bulk-stats">
            <div className="bulk-stat">
              <span className="bulk-stat-value">{result.totalRows}</span>
              <span className="bulk-stat-label">Total Rows</span>
            </div>
            <div className="bulk-stat success">
              <span className="bulk-stat-value">{result.inserted}</span>
              <span className="bulk-stat-label">Imported</span>
            </div>
            <div className="bulk-stat warning">
              <span className="bulk-stat-value">{result.skipped}</span>
              <span className="bulk-stat-label">Skipped</span>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bulk-errors">
              <h4>Issues:</h4>
              <ul>
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <button className="secondary-btn" onClick={handleReset} style={{ marginTop: '12px' }}>
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
};

export default BulkUpload;
