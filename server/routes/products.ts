import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
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
  getProductImage,
} from '../db';
import { authenticateToken, requireRole } from '../middleware';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import pool from '../pool';

const router = Router();

// Multer: store uploaded file in memory
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Multer for product image upload (5MB limit)
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed (png, jpg, jpeg, webp)'));
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
router.post('/:uniqueId/upload-image', authenticateToken, productImageUpload.single('productImage'), async (req: Request, res: Response) => {
  try {
    const { uniqueId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const product = await getProductByUniqueId(uniqueId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const success = await updateProductImage(uniqueId, req.file.buffer);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save image' });
    }
    return res.json({ message: 'Product image uploaded successfully', productImage: `/api/products/${uniqueId}/image` });
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

// GET /api/products/:uniqueId — get single product
router.get('/:uniqueId', async (_req, res) => {
  try {
    const product = await getProductByUniqueId(_req.params.uniqueId);
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
    
    const product = {
      id: body.id || Date.now(),
      uniqueId: body.uniqueId || uuidv4().replace(/-/g, '').slice(0, 9),
      name: body.name,
      batch: body.batch,
      mfg: body.mfg,
      expiry: body.expiry,
      shortUrl: body.shortUrl || `qr-1.in/a.php?x=${uuidv4().slice(0, 5)}`,
      manufacturer: body.manufacturer,
      manufacturerAddress: body.manufacturerAddress,
      technicalName: body.technicalName,
      registrationNumber: body.registrationNumber,
      packingSize: body.packingSize,
      manufacturerLicence: body.manufacturerLicence,
      imageUrl: body.imageUrl,
      hazardSymbol: body.hazardSymbol,
      hazardId: body.hazardId ? Number(body.hazardId) : undefined,
      quantity: body.quantity,
      owner_uid: user.uid,
      companyId: companyId,
    };

    const saved = await addProduct(product);
    console.log('[POST /products] saved product:', JSON.stringify(saved));
    return res.status(201).json({ product: saved });
  } catch (err) {
    console.error('Add product error:', err);
    return res.status(500).json({ error: 'Failed to add product' });
  }
});

// PUT /api/products/:uniqueId — update a product (admin or editor only)
router.put('/:uniqueId', authenticateToken, requireRole('admin', 'editor'), async (req, res) => {
  try {
    const updated = await updateProduct(req.params.uniqueId as string, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
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
      shorturl: 'shortUrl',
      url: 'shortUrl',
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
    };

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
        await addProduct({
          id: Date.now() + i,
          uniqueId: uuidv4().replace(/-/g, '').slice(0, 9),
          name: mapped.name,
          batch: mapped.batch || '',
          mfg: mapped.mfg || '',
          expiry: mapped.expiry || '',
          shortUrl: mapped.shortUrl || `qr-1.in/a.php?x=${uuidv4().slice(0, 5)}`,
          manufacturer: mapped.manufacturer || undefined,
          manufacturerAddress: mapped.manufacturerAddress || undefined,
          technicalName: mapped.technicalName || undefined,
          registrationNumber: mapped.registrationNumber || undefined,
          packingSize: mapped.packingSize || undefined,
          manufacturerLicence: mapped.manufacturerLicence || undefined,
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

export default router;
