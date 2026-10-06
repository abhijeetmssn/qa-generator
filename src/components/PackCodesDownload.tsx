import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiDownloadPackCodesCsv, apiGetPackCodes } from '../services/api';
import Icon from './Icon';
import '../ViewProduct.css';

const MAX_CSV_ROWS = 100000;
const MAX_PRINT_LABELS = 500;

type PackCodesDownloadProps = {
  product: { uniqueId: string; name: string; batch: string };
  lastSerial: number; // highest pack number of the batch
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const fileSlug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';

// Download (CSV for a label printer) or print the pack QR codes of a batch, by pack number range.
const PackCodesDownload: React.FC<PackCodesDownloadProps> = ({ product, lastSerial }) => {
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState(String(lastSerial));
  const [busy, setBusy] = useState<'csv' | 'print' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate the range; returns null (and shows why) when it isn't usable
  const readRange = (max: number, what: string): { start: number; end: number } | null => {
    const start = Number(from);
    const end = Number(to);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lastSerial) {
      setError(`Enter pack numbers between 1 and ${lastSerial.toLocaleString('en-IN')}.`);
      return null;
    }
    if (end - start + 1 > max) {
      setError(`${what} up to ${max.toLocaleString('en-IN')} packs at a time.`);
      return null;
    }
    setError(null);
    return { start, end };
  };

  const handleDownloadCsv = async () => {
    const range = readRange(MAX_CSV_ROWS, 'Download');
    if (!range) return;
    setBusy('csv');
    try {
      const blob = await apiDownloadPackCodesCsv(product.uniqueId, range.start, range.end);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pack-qr-codes-${fileSlug(product.name)}-${fileSlug(product.batch)}-${range.start}-${range.end}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download pack QR codes');
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    const range = readRange(MAX_PRINT_LABELS, 'Print');
    if (!range) return;
    // Open the window during the click so pop-up blockers allow it; fill it once the codes arrive
    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) {
      setError('Please allow pop-ups for this site to print labels.');
      return;
    }
    printWindow.document.write('<p style="font-family: Arial, sans-serif; padding: 20px;">Preparing labels…</p>');
    setBusy('print');
    try {
      const [codes, { renderToStaticMarkup }] = await Promise.all([
        apiGetPackCodes(product.uniqueId, range.start, range.end),
        import('react-dom/server'),
      ]);
      const name = escapeHtml(product.name);
      const batch = escapeHtml(product.batch);
      const labels = codes.map((c) => `
        <div class="label">
          ${renderToStaticMarkup(<QRCodeSVG value={c.url} size={128} level="M" marginSize={2} />)}
          <div class="name">${name}</div>
          <div class="meta">Batch ${batch} · Pack ${c.serialNo}</div>
          <div class="code">${c.code}</div>
        </div>`).join('');

      printWindow.document.open();
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Pack QR Labels - ${name} - Batch ${batch}</title>
            <style>
              @page { margin: 8mm; }
              body { font-family: Arial, sans-serif; margin: 0; background: white; }
              .sheet { display: grid; grid-template-columns: repeat(auto-fill, 42mm); gap: 3mm; }
              .label { border: 1px dashed #cbd5e1; padding: 2mm; text-align: center; break-inside: avoid; }
              .label svg { width: 32mm; height: 32mm; display: block; margin: 0 auto; }
              .name { font-size: 7pt; font-weight: bold; margin-top: 1mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              .meta { font-size: 7pt; color: #334155; }
              .code { font-family: monospace; font-size: 8pt; letter-spacing: 0.5px; }
            </style>
          </head>
          <body><div class="sheet">${labels}</div></body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => { printWindow.focus(); printWindow.print(); }, 250);
    } catch (err) {
      printWindow.close();
      setError(err instanceof Error ? err.message : 'Failed to prepare labels');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pack-codes-download">
      <div className="pack-codes-range">
        <label>
          From pack no.
          <input type="number" min={1} max={lastSerial} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To pack no.
          <input type="number" min={1} max={lastSerial} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="qr-button-group">
        <button type="button" className="download-qr-btn" onClick={handleDownloadCsv} disabled={busy !== null}>
          <Icon name="download" size={16} /> {busy === 'csv' ? 'Preparing…' : 'Download CSV'}
        </button>
        <button type="button" className="print-qr-btn" onClick={handlePrint} disabled={busy !== null}>
          <Icon name="printer" size={16} /> {busy === 'print' ? 'Preparing…' : 'Print Labels'}
        </button>
      </div>
      <p className="field-hint" style={{ margin: 0 }}>
        CSV: give this file to your label printer (up to {MAX_CSV_ROWS.toLocaleString('en-IN')} packs per file).
        Print: up to {MAX_PRINT_LABELS} labels at a time.
      </p>
      {error && <p className="field-hint is-error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
};

export default PackCodesDownload;
