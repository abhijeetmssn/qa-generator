import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  findUserByEmail,
  getProductByUniqueId,
  getPackCodeByCode,
  getPackCodeSummary,
  getPackCodesInRange,
  PACK_CODE_PATTERN,
} from '../db';
import type { Product } from '../db';
import { authenticateToken } from '../middleware';
import { recordScan, isCoordinate } from '../scanLog';

const router = Router();

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || 'https://apasqr.com').replace(/\/$/, '');
const MAX_CSV_EXPORT = 100000; // rows per CSV download
const MAX_JSON_CODES = 1000;   // codes per JSON request (label printing)

const packUrl = (code: string) => `${PUBLIC_APP_URL}/#c/${code}`;

// Load :uniqueId and make sure it belongs to the user's company. Sends the error response itself.
async function loadCompanyProduct(req: Request, res: Response): Promise<Product | null> {
  const decoded = (req as any).user;
  const user = decoded?.email ? await findUserByEmail(decoded.email) : null;
  const product = await getProductByUniqueId(req.params.uniqueId as string);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return null;
  }
  if (user?.companyId && product.companyId && product.companyId !== user.companyId) {
    res.status(403).json({ error: 'This product belongs to another company' });
    return null;
  }
  return product;
}

// GET /api/pack-codes/product/:uniqueId — how many pack QR codes a batch has
router.get('/product/:uniqueId', authenticateToken, async (req, res) => {
  try {
    const product = await loadCompanyProduct(req, res);
    if (!product) return;
    return res.json(await getPackCodeSummary(product.uniqueId));
  } catch (err) {
    console.error('Pack code summary error:', err);
    return res.status(500).json({ error: 'Failed to fetch pack codes' });
  }
});

// GET /api/pack-codes/product/:uniqueId/codes?from=1&to=500&format=csv|json — codes by pack number
router.get('/product/:uniqueId/codes', authenticateToken, async (req, res) => {
  try {
    const from = parseInt(req.query.from as string);
    const to = parseInt(req.query.to as string);
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const max = format === 'csv' ? MAX_CSV_EXPORT : MAX_JSON_CODES;
    if (!(from >= 1) || !(to >= from)) {
      return res.status(400).json({ error: 'Enter a valid pack number range' });
    }
    if (to - from + 1 > max) {
      return res.status(400).json({ error: `At most ${max.toLocaleString('en-IN')} codes at a time` });
    }
    const product = await loadCompanyProduct(req, res);
    if (!product) return;

    const codes = await getPackCodesInRange(product.uniqueId, from, to);

    if (format === 'csv') {
      const cell = (v: unknown) => {
        const s = String(v ?? '');
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        'Pack No,Code,QR Link,Product,Batch',
        ...codes.map((c) => [c.serialNo, c.code, packUrl(c.code), product.name, product.batch].map(cell).join(',')),
      ];
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="pack-qr-codes-${product.uniqueId}-${from}-${to}.csv"`);
      // BOM so Excel opens the file as UTF-8
      return res.send('﻿' + lines.join('\r\n'));
    }

    return res.json({ codes: codes.map((c) => ({ ...c, url: packUrl(c.code) })) });
  } catch (err) {
    console.error('Pack codes export error:', err);
    return res.status(500).json({ error: 'Failed to fetch pack codes' });
  }
});

// POST /api/pack-codes/:code/view — public, no auth — the product page a pack QR scan opens.
// Like the batch QR page, location is mandatory; the scan is logged against this pack.
router.post('/:code/view', async (req, res) => {
  try {
    const code = String(req.params.code ?? '').trim().toUpperCase();
    const { latitude, longitude, deviceId } = req.body ?? {};
    if (!isCoordinate(latitude, 90) || !isCoordinate(longitude, 180)) {
      return res.status(400).json({ error: 'Location is required to view this product' });
    }

    const pack = PACK_CODE_PATTERN.test(code) ? await getPackCodeByCode(code) : undefined;
    const product = pack ? await getProductByUniqueId(pack.productId) : undefined;
    if (!pack || !product) return res.status(404).json({ error: 'Product not found' });

    // Respond first — logging waits on reverse geocoding, which shouldn't slow the page
    res.json({ product });
    const validDeviceId = typeof deviceId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(deviceId) ? deviceId : null;
    await recordScan(req, product, { latitude, longitude }, { packCodeId: pack.id, deviceId: validDeviceId });
  } catch (err) {
    console.error('Pack view error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to fetch product' });
  }
});

export default router;
