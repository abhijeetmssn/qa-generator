import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import * as XLSX from 'xlsx';
import {
  getProducts,
  getTrashProducts,
  getProductByUniqueId,
  addProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  permanentDeleteProduct,
  findUserByEmail,
  getMasterProducts,
  updateProductImage,
  setProductImageUrl,
  getProductImage,
  deleteProductImage,
  updateProductLeaflet,
  setProductLeafletUrl,
  getProductLeaflet,
  deleteProductLeaflet,
  generateUniqueId,
  generatePackCodes,
  MAX_PACKS_PER_BATCH,
  getScanAnalytics,
  getProductScanDetails,
  getCompanyById,
  cascadeHazardToChildren,
  getHazards,
} from '../db';
import { authenticateToken, requireRole } from '../middleware';
import { s3Enabled, uploadLeaflet, deleteLeaflet, uploadImage, deleteImage } from '../s3';
import { recordScan, isCoordinate } from '../scanLog';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import pool from '../pool';

const router = Router();

// Multer: store uploaded file in memory
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Multer for product image upload — accept up to 15MB (large phone photos);
// the image is aggressively downscaled/re-encoded before storing.
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed (png, jpg, jpeg, webp)'));
  },
});

// Multer for product leaflet upload — PDF only (25MB limit)
const leafletUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      path.extname(file.originalname).toLowerCase() === '.pdf' ||
      file.mimetype === 'application/pdf';
    if (isPdf) cb(null, true);
    else cb(new Error('Only PDF files are allowed for leaflets'));
  },
});

// GET /api/products — list products filtered by user's company
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const decoded = (_req as any).user;
    const user = decoded?.email ? await findUserByEmail(decoded.email) : null;
    const companyId = user?.companyId;
    const isAdmin = user?.role === 'admin';
    console.log('[GET /products] user:', user?.email, 'companyId:', companyId, 'isAdmin:', isAdmin);
    const products = await getProducts(companyId, isAdmin);
    console.log('[GET /products] returned', products.length, 'products');
    return res.json({ products });
  } catch (err) {
    console.error('Get products error:', err);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/trash/list — get soft-deleted products filtered by company (MUST come before /:uniqueId)
router.get('/trash/list', authenticateToken, async (_req, res) => {
  try {
    const decoded = (_req as any).user;
    const user = decoded?.email ? await findUserByEmail(decoded.email) : null;
    const companyId = user?.companyId;
    const products = await getTrashProducts(companyId);
    return res.json({ products });
  } catch (err) {
    console.error('Get trash error:', err);
    return res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

// GET /api/products/debug — check products table schema and data (temporary)
router.get('/debug', async (_req, res) => {
  try {
    const { rows: columns } = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position"
    );
    const { rows: counts } = await pool.query(
      "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_master = true) as master, COUNT(*) FILTER (WHERE is_master = false OR is_master IS NULL) as non_master, COUNT(*) FILTER (WHERE active = 'Y') as active FROM products"
    );
    const { rows: recent } = await pool.query(
      "SELECT id, unique_id, name, batch, is_master, owner_uid, active, created_at FROM products ORDER BY id DESC LIMIT 10"
    );
    return res.json({ columns, counts: counts[0], recent });
  } catch (err: any) {
    return res.json({ error: err.message });
  }
});

// GET /api/products/master — list master catalog products (for dropdown, filtered by user's company)
router.get('/master', authenticateToken, async (_req, res) => {
  try {
    const decoded = (_req as any).user;
    const user = decoded?.email ? await findUserByEmail(decoded.email) : null;
    const companyId = user?.companyId;
    const products = await getMasterProducts(companyId);
    return res.json({ products });
  } catch (err) {
    console.error('Get master products error:', err);
    return res.status(500).json({ error: 'Failed to fetch master products' });
  }
});

// POST /api/products/:uniqueId/upload-image — upload product image
router.post(
  '/:uniqueId/upload-image',
  authenticateToken,
  (req: Request, res: Response, next: NextFunction) => {
    // Wrap multer so validation errors (wrong type / too large) return JSON, not an HTML 500
    productImageUpload.single('productImage')(req, res, (err: any) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image too large (max 15 MB)' : (err.message || 'Image upload failed');
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
  try {
    const uniqueId = req.params.uniqueId as string;
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const product = await getProductByUniqueId(uniqueId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    // Shrink before storing: cap at 600×600 (aspect preserved, never upscaled)
    // and re-encode as WebP q70 to keep the stored/served file small.
    const resizedBuffer = await sharp(req.file.buffer)
      .rotate() // honour EXIF orientation so phone photos aren't sideways
      .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    console.log(`[upload-image] ${uniqueId}: ${req.file.size} bytes → ${resizedBuffer.length} bytes`);

    let productImage: string;
    let success: boolean;
    if (s3Enabled) {
      productImage = await uploadImage(uniqueId, resizedBuffer, Date.now());
      success = await setProductImageUrl(uniqueId, productImage);
    } else {
      success = await updateProductImage(uniqueId, resizedBuffer);
      productImage = `/api/products/${uniqueId}/image`;
    }
    if (!success) {
      return res.status(500).json({ error: 'Failed to save image' });
    }
    return res.json({ message: 'Product image uploaded successfully', productImage });
  } catch (err) {
    console.error('Upload product image error:', err);
    return res.status(500).json({ error: 'Failed to upload product image' });
  }
});

// GET /api/products/:uniqueId/image — serve product image
router.get('/:uniqueId/image', async (req: Request, res: Response) => {
  try {
    const imageBuffer = await getProductImage(req.params.uniqueId);
    if (!imageBuffer) {
      return res.status(404).json({ error: 'No image found' });
    }

    // Reduce resolution by 50% if ?quality=50 is passed
    const quality = req.query.quality;
    if (quality === '50') {
      try {
        const sharp = (await import('sharp')).default;
        const metadata = await sharp(imageBuffer).metadata();
        const newWidth = Math.round((metadata.width || 400) / 2);
        const resized = await sharp(imageBuffer)
          .resize(newWidth)
          .jpeg({ quality: 60 })
          .toBuffer();
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(resized);
      } catch {
        // Fallback to original if sharp fails
      }
    }

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(imageBuffer);
  } catch (err) {
    console.error('Get product image error:', err);
    return res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// DELETE /api/products/:uniqueId/image — remove product image (admin or editor only)
router.delete('/:uniqueId/image', authenticateToken, requireRole('admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const uniqueId = req.params.uniqueId as string;
    if (s3Enabled) {
      try { await deleteImage(uniqueId); } catch (e) { console.error('S3 image delete failed:', e); }
    }
    const deleted = await deleteProductImage(uniqueId);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ message: 'Product image removed' });
  } catch (err) {
    console.error('Delete product image error:', err);
    return res.status(500).json({ error: 'Failed to remove product image' });
  }
});

// POST /api/products/:uniqueId/upload-leaflet — upload leaflet PDF (admin or editor only)
router.post(
  '/:uniqueId/upload-leaflet',
  authenticateToken,
  requireRole('admin', 'editor'),
  (req: Request, res: Response, next: NextFunction) => {
    // Wrap multer so validation errors (wrong type / too large) return JSON, not an HTML 500
    leafletUpload.single('leaflet')(req, res, (err: any) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Leaflet too large (max 25 MB)' : (err.message || 'Leaflet upload failed');
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const uniqueId = req.params.uniqueId as string;
      if (!req.file) {
        return res.status(400).json({ error: 'No leaflet file uploaded' });
      }
      const product = await getProductByUniqueId(uniqueId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      let leafletUrl: string;
      let success: boolean;
      if (s3Enabled) {
        // Store in S3; DB keeps the absolute public URL.
        leafletUrl = await uploadLeaflet(uniqueId, req.file.buffer, Date.now());
        success = await setProductLeafletUrl(uniqueId, leafletUrl);
      } else {
        // Fallback: store the PDF in Postgres, served via GET /:id/leaflet.
        success = await updateProductLeaflet(uniqueId, req.file.buffer);
        leafletUrl = `/api/products/${uniqueId}/leaflet`;
      }
      if (!success) {
        return res.status(500).json({ error: 'Failed to save leaflet' });
      }
      return res.json({ message: 'Leaflet uploaded successfully', leafletUrl });
    } catch (err) {
      console.error('Upload leaflet error:', err);
      return res.status(500).json({ error: 'Failed to upload leaflet' });
    }
  }
);

// DELETE /api/products/:uniqueId/leaflet — remove leaflet PDF (admin or editor only)
router.delete('/:uniqueId/leaflet', authenticateToken, requireRole('admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const uniqueId = req.params.uniqueId as string;
    if (s3Enabled) {
      // Best-effort S3 cleanup; DB is the source of truth for whether a leaflet exists.
      try { await deleteLeaflet(uniqueId); } catch (e) { console.error('S3 leaflet delete failed:', e); }
    }
    const deleted = await deleteProductLeaflet(uniqueId);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ message: 'Leaflet removed' });
  } catch (err) {
    console.error('Delete leaflet error:', err);
    return res.status(500).json({ error: 'Failed to remove leaflet' });
  }
});

// GET /api/products/:uniqueId/leaflet — serve leaflet PDF (public)
router.get('/:uniqueId/leaflet', async (req: Request, res: Response) => {
  try {
    const uniqueId = req.params.uniqueId as string;
    const leafletBuffer = await getProductLeaflet(uniqueId);
    if (!leafletBuffer) {
      return res.status(404).json({ error: 'No leaflet found' });
    }
    res.set('Content-Type', 'application/pdf');
    // inline → browsers open it in the PDF viewer / new tab; mobile devices download it
    res.set('Content-Disposition', `inline; filename="leaflet-${uniqueId}.pdf"`);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(leafletBuffer);
  } catch (err) {
    console.error('Get leaflet error:', err);
    return res.status(500).json({ error: 'Failed to fetch leaflet' });
  }
});

// GET /api/products/scan-analytics — auth required — paginated scan analytics for company
router.get('/scan-analytics', authenticateToken, async (req, res) => {
  try {
    const decoded = (req as any).user;
    const user = decoded?.email ? await findUserByEmail(decoded.email) : null;
    const companyId = user?.companyId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search = (req.query.search as string) || '';
    const data = await getScanAnalytics({ companyId, page, limit, search });
    return res.json(data);
  } catch (err) {
    console.error('Scan analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch scan analytics' });
  }
});

// GET /api/products/scan-analytics/:productId/scans — paginated scan detail for one product
router.get('/scan-analytics/:productId/scans', authenticateToken, async (req, res) => {
  try {
    const decoded = (req as any).user;
    const user = decoded?.email ? await findUserByEmail(decoded.email) : null;
    const companyId = user?.companyId;
    const productId = req.params.productId as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 5));
    const data = await getProductScanDetails(productId, { companyId, page, limit });
    return res.json(data);
  } catch (err) {
    console.error('Product scan details error:', err);
    return res.status(500).json({ error: 'Failed to fetch scan details' });
  }
});

// GET /api/products/:uniqueId — get single product (logged-in users; the public QR page uses POST /:uniqueId/view)
router.get('/:uniqueId', authenticateToken, async (_req, res) => {
  try {
    const product = await getProductByUniqueId(_req.params.uniqueId as string);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ product });
  } catch (err) {
    console.error('Get product error:', err);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products — add a new product (admin or editor only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body;
    const user = (req as any).user;
    console.log('[POST /products] user from JWT:', JSON.stringify(user));
    console.log('[POST /products] body:', JSON.stringify(body));
    
    // Resolve user's company_id
    const dbUser = user?.email ? await findUserByEmail(user.email) : null;
    const companyId = dbUser?.companyId || undefined;

    // Optional: one QR per pack — only for companies an admin has given access to
    const wantsPackCodes = body.packCount !== undefined && body.packCount !== null && body.packCount !== '';
    const packCount = Number(body.packCount);
    if (wantsPackCodes) {
      if (!Number.isInteger(packCount) || packCount < 1 || packCount > MAX_PACKS_PER_BATCH) {
        return res.status(400).json({ error: `Number of packs must be a whole number from 1 to ${MAX_PACKS_PER_BATCH.toLocaleString('en-IN')}` });
      }
      const company = companyId ? await getCompanyById(companyId) : undefined;
      if (!company?.perPackQrEnabled) {
        return res.status(403).json({ error: 'One QR per pack is not enabled for your company. Please contact the admin.' });
      }
    }

    const product = {
      id: Date.now(),
      uniqueId: await generateUniqueId(),
      name: body.name,
      batch: body.batch,
      mfg: body.mfg,
      expiry: body.expiry,
      manufacturer: body.manufacturer,
      manufacturerAddress: body.manufacturerAddress,
      technicalName: body.technicalName,
      registrationNumber: body.registrationNumber,
      packingSize: body.packingSize,
      manufacturerLicence: body.manufacturerLicence,
      marketedBy: body.marketedBy,
      imageUrl: body.imageUrl,
      hazardSymbol: body.hazardSymbol,
      hazardId: body.hazardId ? Number(body.hazardId) : undefined,
      quantity: body.quantity,
      owner_uid: user.uid,
      companyId: companyId,
    };

    const saved = await addProduct(product);
    console.log('[POST /products] saved product:', JSON.stringify(saved));

    if (wantsPackCodes) {
      try {
        const packCodes = await generatePackCodes(saved.uniqueId, companyId, packCount);
        console.log(`[POST /products] created ${packCodes.count} pack QR codes for ${saved.uniqueId}`);
        return res.status(201).json({ product: saved, packCodes });
      } catch (err) {
        // Don't leave behind a batch whose pack QR codes were never created
        await permanentDeleteProduct(saved.uniqueId);
        throw err;
      }
    }
    return res.status(201).json({ product: saved });
  } catch (err) {
    console.error('Add product error:', err);
    return res.status(500).json({ error: 'Failed to add product' });
  }
});

// PUT /api/products/:uniqueId — update a product (admin or editor only)
router.put('/:uniqueId', authenticateToken, requireRole('admin', 'editor'), async (req, res) => {
  try {
    const uniqueId = req.params.uniqueId as string;
    const updated = await updateProduct(uniqueId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }
    // Cascade hazard change to all child products when master product is updated
    if (req.body.hazardId && updated.is_master) {
      await cascadeHazardToChildren(uniqueId, Number(req.body.hazardId));
    }
    return res.json({ product: updated });
  } catch (err) {
    console.error('Update product error:', err);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:uniqueId — soft delete a product (set active='N')
router.delete('/:uniqueId', authenticateToken, requireRole('admin', 'editor'), async (req, res) => {
  try {
    const deleted = await deleteProduct(req.params.uniqueId as string);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ message: 'Product moved to trash' });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

// POST /api/products/:uniqueId/restore — restore a soft-deleted product
router.post('/:uniqueId/restore', authenticateToken, requireRole('admin', 'editor'), async (req, res) => {
  try {
    const restored = await restoreProduct(req.params.uniqueId as string);
    if (!restored) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ message: 'Product restored' });
  } catch (err) {
    console.error('Restore product error:', err);
    return res.status(500).json({ error: 'Failed to restore product' });
  }
});

// DELETE /api/products/:uniqueId/permanent — permanently delete
router.delete('/:uniqueId/permanent', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const deleted = await permanentDeleteProduct(req.params.uniqueId as string);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ message: 'Product permanently deleted' });
  } catch (err) {
    console.error('Permanent delete error:', err);
    return res.status(500).json({ error: 'Failed to permanently delete product' });
  }
});

// GET /api/products/search?q=query — search products
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const query = (req.query.q as string || '').toLowerCase();
    const allProducts = await getProducts();
    const products = allProducts.filter(
      p =>
        p.name.toLowerCase().includes(query) ||
        p.manufacturer?.toLowerCase().includes(query) ||
        p.technicalName?.toLowerCase().includes(query)
    );
    return res.json({ products });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

// Detect color from hazard name (matches actual hazard images)
function hazardColor(name: string): { bg: string; fontColor: string; label: string } {
  const n = name.toUpperCase();
  if (n.includes('RED'))    return { bg: 'FFFFCDD2', fontColor: 'FFB71C1C', label: 'Red' };
  if (n.includes('YELLOW')) return { bg: 'FFFFF9C4', fontColor: 'FFF57F17', label: 'Yellow' };
  if (n.includes('GREEN') || n.includes('CAUTION')) return { bg: 'FFC8E6C9', fontColor: 'FF1B5E20', label: 'Green' };
  if (n.includes('BLUE') || n.includes('DANGER'))   return { bg: 'FFBBDEFB', fontColor: 'FF0D47A1', label: 'Blue' };
  if (n.includes('ORANGE')) return { bg: 'FFFFE0B2', fontColor: 'FFE65100', label: 'Orange' };
  if (n.includes('PURPLE') || n.includes('VIOLET')) return { bg: 'FFEDE7F6', fontColor: 'FF4A148C', label: 'Purple' };
  if (n.includes('WHITE'))  return { bg: 'FFF5F5F5', fontColor: 'FF212121', label: 'White' };
  if (n.includes('BLACK'))  return { bg: 'FF424242', fontColor: 'FFFFFFFF', label: 'Black' };
  // fallback: cycle a safe palette
  const FALLBACK = ['FFFFF9C4','FFC8E6C9','FFBBDEFB','FFFFE0B2','FFEDE7F6'];
  const idx = Math.abs(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % FALLBACK.length;
  return { bg: FALLBACK[idx], fontColor: 'FF212121', label: 'Custom' };
}

// GET /api/products/bulk-upload/template — download Excel template with hazard dropdown + colors
router.get('/bulk-upload/template', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const hazards = await getHazards();
    const hazardNames = hazards.map(h => h.name);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');

    // Hazard column index (1-based): 8th column
    const HAZARD_COL = 8;

    ws.columns = [
      { header: 'Product Name',         key: 'name',                width: 25 },
      { header: 'Marketed By',           key: 'marketedBy',          width: 22 },
      { header: 'Manufacturer',          key: 'manufacturer',        width: 22 },
      { header: 'Manufacturer Address',  key: 'manufacturerAddress', width: 30 },
      { header: 'Technical Name',        key: 'technicalName',       width: 22 },
      { header: 'Registration Number',   key: 'registrationNumber',  width: 22 },
      { header: 'Manufacturer Licence',  key: 'manufacturerLicence', width: 22 },
      { header: 'Hazard',                key: 'hazard',              width: 26 },
    ];

    // Style header row
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF1565C0' } } };
    });
    ws.getRow(1).height = 20;

    // Example row
    const exampleHazard = hazardNames[0] || '';
    ws.addRow({
      name: 'Example Product',
      marketedBy: 'Example Co.',
      manufacturer: 'Example Mfg Ltd.',
      manufacturerAddress: '123 Industrial Area, City',
      technicalName: 'Acetaminophen 500mg',
      registrationNumber: 'REG-12345',
      manufacturerLicence: 'LIC-9876',
      hazard: exampleHazard,
    });
    // ── Build Hazard Reference sheet FIRST so the Products dropdown can reference it ──
    const refWs = wb.addWorksheet('Hazard Reference');
    refWs.columns = [
      { header: 'Hazard Name', key: 'name',  width: 30 },
      { header: 'Color',       key: 'color', width: 16 },
      { header: 'Note',        key: 'note',  width: 52 },
    ];
    refWs.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF37474F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    refWs.getRow(1).height = 22;

    hazards.forEach(h => {
      const { bg, fontColor, label } = hazardColor(h.name);
      const refRow = refWs.addRow({ name: h.name, color: label, note: `← Select "${h.name}" from dropdown in Products sheet` });
      refRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { bold: true, color: { argb: fontColor } };
        cell.alignment = { vertical: 'middle' };
      });
      refRow.height = 20;
    });

    // Color the example hazard cell
    if (exampleHazard) {
      const { bg, fontColor } = hazardColor(exampleHazard);
      const exCell = ws.getCell(2, HAZARD_COL);
      exCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      exCell.font = { bold: true, color: { argb: fontColor } };
    }

    // Dropdown referencing the Hazard Reference sheet column A (avoids comma-string formula issues)
    if (hazardNames.length > 0) {
      const refLastRow = hazards.length + 1; // +1 for header row
      const dropdownFormula = `'Hazard Reference'!$A$2:$A$${refLastRow}`;
      const hazardColLetter = String.fromCharCode(64 + HAZARD_COL); // 12 → 'L'

      // Apply dropdown to each data row referencing the Hazard Reference sheet range
      for (let row = 2; row <= 1000; row++) {
        ws.getCell(row, HAZARD_COL).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [dropdownFormula],
          showErrorMessage: true,
          errorTitle: 'Invalid Hazard',
          error: 'Please select a hazard from the dropdown list.',
        };
      }

      // Conditional formatting: each hazard gets its actual color
      ws.addConditionalFormatting({
        ref: `${hazardColLetter}2:${hazardColLetter}1000`,
        rules: hazards.map((h, i) => {
          const { bg } = hazardColor(h.name);
          return {
            type: 'containsText' as const,
            operator: 'containsText' as const,
            text: h.name,
            priority: i + 1,
            style: {
              fill: { type: 'pattern' as const, pattern: 'solid' as const, bgColor: { argb: bg } },
              font: { bold: true },
            },
          };
        }),
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="products_upload_template.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Template generation error:', err);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// POST /api/products/bulk-upload — bulk import from Excel (admin only)
router.post('/bulk-upload', authenticateToken, requireRole('admin'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Use companyId from form data (admin selects company), fall back to admin's own company
    const formCompanyId = req.body?.companyId ? Number(req.body.companyId) : undefined;
    const dbUser = user?.email ? await findUserByEmail(user.email) : null;
    const companyId = formCompanyId || dbUser?.companyId || undefined;
    console.log('[bulk-upload] user email:', user?.email, 'formCompanyId:', formCompanyId, 'dbUser companyId:', dbUser?.companyId, 'resolved companyId:', companyId);

    // Parse the Excel file from memory buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'Excel file has no sheets' });
    }

    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Excel file has no data rows' });
    }

    // Normalise header keys (trim, lowercase) for flexible matching
    const normalise = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    const headerMap: Record<string, string> = {
      productname: 'name',
      name: 'name',
      batchnumber: 'batch',
      batch: 'batch',
      batchno: 'batch',
      manufacturingdate: 'mfg',
      mfgdate: 'mfg',
      mfg: 'mfg',
      expirydate: 'expiry',
      expiry: 'expiry',
      exp: 'expiry',
      shorturl: 'ignore',
      url: 'ignore',
      manufacturer: 'manufacturer',
      manufactureraddress: 'manufacturerAddress',
      address: 'manufacturerAddress',
      technicalname: 'technicalName',
      technical: 'technicalName',
      registrationnumber: 'registrationNumber',
      regno: 'registrationNumber',
      registration: 'registrationNumber',
      packingsize: 'packingSize',
      packing: 'packingSize',
      manufacturerlicence: 'manufacturerLicence',
      licence: 'manufacturerLicence',
      license: 'manufacturerLicence',
      marketedby: 'marketedBy',
      marketed: 'marketedBy',
      hazard: 'hazardName',
      hazardname: 'hazardName',
      hazardsymbol: 'hazardName',
    };

    // Pre-load hazards for name → ID resolution
    const allHazards = await getHazards();

    const results = { inserted: 0, skipped: 0, errors: [] as string[] };

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const mapped: Record<string, string> = {};

      // Map Excel columns to product fields
      for (const key of Object.keys(raw)) {
        const norm = normalise(key);
        const field = headerMap[norm];
        if (field) {
          mapped[field] = String(raw[key]).trim();
        }
      }

      // Require at least a product name
      if (!mapped.name) {
        results.errors.push(`Row ${i + 2}: Missing product name — skipped`);
        results.skipped++;
        continue;
      }

      try {
        // Resolve hazard name → ID
        let hazardId: number | undefined;
        if (mapped.hazardName) {
          const matched = allHazards.find(h => h.name.toLowerCase() === mapped.hazardName.trim().toLowerCase());
          if (matched) {
            hazardId = matched.id;
          } else {
            results.errors.push(`Row ${i + 2}: Hazard "${mapped.hazardName}" not found — product saved without hazard. Valid options: ${allHazards.map(h => h.name).join(', ')}`);
          }
        }

        await addProduct({
          id: Date.now() + i,
          uniqueId: await generateUniqueId(),
          name: mapped.name,
          batch: mapped.batch || '',
          mfg: mapped.mfg || '',
          expiry: mapped.expiry || '',
          manufacturer: mapped.manufacturer || undefined,
          manufacturerAddress: mapped.manufacturerAddress || undefined,
          technicalName: mapped.technicalName || undefined,
          registrationNumber: mapped.registrationNumber || undefined,
          packingSize: mapped.packingSize || undefined,
          manufacturerLicence: mapped.manufacturerLicence || undefined,
          marketedBy: mapped.marketedBy || undefined,
          hazardId: hazardId || undefined,
          owner_uid: user.uid,
          is_master: true,
          companyId: companyId,
        });
        results.inserted++;
      } catch (err: any) {
        results.errors.push(`Row ${i + 2}: ${err.message}`);
        results.skipped++;
      }
    }

    return res.json({
      message: `Imported ${results.inserted} products, ${results.skipped} skipped`,
      inserted: results.inserted,
      skipped: results.skipped,
      errors: results.errors,
      totalRows: rows.length,
      resolvedCompanyId: companyId || null,
    });
  } catch (err) {
    console.error('Bulk upload error:', err);
    return res.status(500).json({ error: 'Failed to process Excel file' });
  }
});

// POST /api/products/:uniqueId/view — public, no auth — the product page a QR scan opens.
// Location is mandatory: product details are only returned with the scanner's GPS
// coordinates, and the scan is logged with them.
router.post('/:uniqueId/view', async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const bodyLat = req.body?.latitude;
    const bodyLon = req.body?.longitude;
    if (!isCoordinate(bodyLat, 90) || !isCoordinate(bodyLon, 180)) {
      return res.status(400).json({ error: 'Location is required to view this product' });
    }

    const product = await getProductByUniqueId(uniqueId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Respond first — logging waits on reverse geocoding, which shouldn't slow the page
    res.json({ product });
    await recordScan(req, product, { latitude: bodyLat, longitude: bodyLon });
  } catch (err) {
    console.error('Product view error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to fetch product' });
  }
});

export default router;
