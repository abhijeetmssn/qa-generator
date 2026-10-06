// Database service — PostgreSQL powered
import { randomBytes } from 'crypto';
import pool from './pool';

// ── Company type ──
export interface Company {
  id?: number;
  name: string;
  logo?: Buffer | string;  // Binary image data or base64 string
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  scanAnalyticsEnabled?: boolean;
  perPackQrEnabled?: boolean; // admin has allowed one QR per pack for this company
  subscriptionExpiresAt?: string;
  createdAt?: string;
}

// ── Product type ──
export interface Product {
  id: number | string;
  uniqueId: string;
  name: string;
  batch: string;
  mfg: string;
  expiry: string;
  manufacturer?: string;
  manufacturerAddress?: string;
  technicalName?: string;
  registrationNumber?: string;
  packingSize?: string;
  manufacturerLicence?: string;
  marketedBy?: string;
  imageUrl?: string;
  hazardSymbol?: string; // e.g. '☠️ Toxic', '🔥 Flammable'
  hazardId?: number;
  productImage?: string; // effective image URL — the product's own, else inherited from its master
  leafletUrl?: string; // effective leaflet URL — the product's own, else inherited from its master
  hasOwnImage?: boolean; // true when this product has its own image (not inherited from master)
  hasOwnLeaflet?: boolean; // true when this product has its own leaflet (not inherited from master)
  owner_uid?: string;
  active?: string; // 'Y' or 'N'
  companyId?: number;
  companyName?: string;
  is_master?: boolean;
  createdDate?: string;
  updatedDate?: string;
}

// ── User type ──
export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  uid: string;
  email: string;
  password: string; // hashed
  createdAt: string;
  companyId?: number;
  role?: UserRole;
  failedLoginAttempts?: number;
  lockedAt?: string | null;
}

// ── Helper: map a DB row to Product ──
// Image/leaflet resolution: use the product's own asset when present, otherwise
// fall back to its master product's asset (master info comes from the LEFT JOIN
// aliased `m` — master_unique_id / master_product_image_url / master_leaflet_url).
function rowToProduct(row: any): Product {
  const masterUid = row.master_unique_id;
  const canInherit = !row.is_master && !!masterUid;

  // Both image and leaflet links come straight from their *_url column (absolute
  // S3 URL, or a relative /api path for the Postgres fallback). A child with none
  // of its own inherits the master's.
  const ownImageUrl: string | null = row.product_image_url || null;
  const ownImage = !!ownImageUrl;
  const productImage = ownImageUrl
    ? ownImageUrl
    : canInherit && row.master_product_image_url
      ? (row.master_product_image_url as string)
      : undefined;

  const ownLeafletUrl: string | null = row.leaflet_url || null;
  const ownLeaflet = !!ownLeafletUrl;
  const leafletUrl = ownLeafletUrl
    ? ownLeafletUrl
    : canInherit && row.master_leaflet_url
      ? (row.master_leaflet_url as string)
      : undefined;

  return {
    id: row.id,
    uniqueId: row.unique_id,
    name: row.name,
    batch: row.batch,
    mfg: row.mfg,
    expiry: row.expiry,
    manufacturer: row.manufacturer,
    manufacturerAddress: row.manufacturer_address,
    technicalName: row.technical_name,
    registrationNumber: row.registration_number,
    packingSize: row.packing_size,
    manufacturerLicence: row.manufacturer_licence,
    marketedBy: row.marketed_by,
    imageUrl: row.image_url,
    // hazard_name comes from LEFT JOIN hazards — falls back to legacy hazard_symbol text
    hazardSymbol: row.hazard_name ?? row.hazard_symbol,
    hazardId: row.hazard_id ?? undefined,
    productImage,
    leafletUrl,
    hasOwnImage: ownImage,
    hasOwnLeaflet: ownLeaflet,
    owner_uid: row.owner_uid,
    active: row.active || 'Y',
    is_master: row.is_master ?? false,
    companyId: row.company_id ?? undefined,
    companyName: row.company_name ?? undefined,
    createdDate: row.created_date ?? undefined,
    updatedDate: row.updated_date ?? undefined,
  };
}

// ── Products ──
export async function getProducts(companyId?: number, isAdmin?: boolean): Promise<Product[]> {
  const masterFilter = isAdmin
    ? 'p.is_master = true'
    : '(p.is_master = false OR p.is_master IS NULL)';
  if (companyId) {
    const { rows } = await pool.query(
      `SELECT p.*, c.name as company_name, h.name as hazard_name,
              m.unique_id AS master_unique_id,
              m.product_image_url AS master_product_image_url,
              m.leaflet_url AS master_leaflet_url
       FROM products p
       LEFT JOIN companies c ON p.company_id = c.id
       LEFT JOIN hazards h ON h.id = p.hazard_id
       LEFT JOIN products m ON m.is_master = true AND m.name = p.name AND m.company_id = p.company_id AND m.id <> p.id
       WHERE p.active = 'Y' AND ${masterFilter} AND p.company_id = $1
       ORDER BY p.created_date DESC`,
      [companyId]
    );
    return rows.map(rowToProduct);
  }
  const { rows } = await pool.query(
    `SELECT p.*, c.name as company_name, h.name as hazard_name,
            m.unique_id AS master_unique_id,
            m.product_image_url AS master_product_image_url,
            m.leaflet_url AS master_leaflet_url
     FROM products p
     LEFT JOIN companies c ON p.company_id = c.id
     LEFT JOIN hazards h ON h.id = p.hazard_id
     LEFT JOIN products m ON m.is_master = true AND m.name = p.name AND m.company_id = p.company_id AND m.id <> p.id
     WHERE p.active = 'Y' AND ${masterFilter}
     ORDER BY p.created_date DESC`
  );
  return rows.map(rowToProduct);
}

export async function getMasterProducts(companyId?: number): Promise<Product[]> {
  if (companyId) {
    const { rows } = await pool.query(
      `SELECT p.*, c.name as company_name, h.name as hazard_name FROM products p
       LEFT JOIN companies c ON p.company_id = c.id
       LEFT JOIN hazards h ON h.id = p.hazard_id
       WHERE p.active = 'Y' AND p.is_master = true AND p.company_id = $1
       ORDER BY p.name`,
      [companyId]
    );
    return rows.map(rowToProduct);
  }
  const { rows } = await pool.query(
    `SELECT p.*, h.name as hazard_name FROM products p
     LEFT JOIN hazards h ON h.id = p.hazard_id
     WHERE p.active = 'Y' AND p.is_master = true ORDER BY p.name`
  );
  return rows.map(rowToProduct);
}

export async function getTrashProducts(companyId?: number): Promise<Product[]> {
  if (companyId) {
    const { rows } = await pool.query(
      `SELECT p.*, c.name as company_name, h.name as hazard_name FROM products p
       LEFT JOIN companies c ON p.company_id = c.id
       LEFT JOIN hazards h ON h.id = p.hazard_id
       WHERE p.active = 'N' AND p.company_id = $1
       ORDER BY p.created_date DESC`,
      [companyId]
    );
    return rows.map(rowToProduct);
  }
  const { rows } = await pool.query(
    `SELECT p.*, h.name as hazard_name FROM products p
     LEFT JOIN hazards h ON h.id = p.hazard_id
     WHERE p.active = 'N' ORDER BY p.created_date DESC`
  );
  return rows.map(rowToProduct);
}

export async function getProductByUniqueId(uniqueId: string): Promise<Product | undefined> {
  const { rows } = await pool.query(
    `SELECT p.*,
       c.name as company_name,
       h.name as hazard_name,
       m.unique_id AS master_unique_id,
       m.product_image_url AS master_product_image_url,
       m.leaflet_url AS master_leaflet_url,
       COALESCE(NULLIF(TRIM(p.manufacturer_licence), ''), m.manufacturer_licence) as manufacturer_licence,
       COALESCE(NULLIF(TRIM(p.technical_name), ''), m.technical_name) as technical_name,
       COALESCE(NULLIF(TRIM(p.registration_number), ''), m.registration_number) as registration_number,
       COALESCE(NULLIF(TRIM(p.manufacturer), ''), m.manufacturer) as manufacturer,
       COALESCE(NULLIF(TRIM(p.manufacturer_address), ''), m.manufacturer_address) as manufacturer_address,
       COALESCE(NULLIF(TRIM(p.marketed_by), ''), m.marketed_by) as marketed_by
     FROM products p
     LEFT JOIN companies c ON p.company_id = c.id
     LEFT JOIN hazards h ON h.id = p.hazard_id
     LEFT JOIN products m ON m.is_master = true AND m.name = p.name AND m.company_id = p.company_id AND m.id <> p.id
     WHERE p.unique_id = $1`,
    [uniqueId]
  );
  return rows.length > 0 ? rowToProduct(rows[0]) : undefined;
}

/**
 * Generate a unique product ID that does not already exist in the database.
 * Starts at 6 digits. After 10 failed attempts expands to 7 digits, and after
 * 15 failed attempts expands to 8 digits, so it never exhausts.
 */
export async function generateUniqueId(): Promise<string> {
  const MAX_ATTEMPTS = 20;
  let digits = 6;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt >= 15) digits = 8;
    else if (attempt >= 10) digits = 7;

    const min = Math.pow(10, digits - 1);
    const range = Math.pow(10, digits) - min;
    const candidate = String(Math.floor(min + Math.random() * range));

    const { rows } = await pool.query(
      'SELECT 1 FROM products WHERE unique_id = $1',
      [candidate]
    );

    if (rows.length === 0) return candidate;
  }

  // Ultimate fallback: timestamp suffix guaranteed to be unique enough
  return String(Date.now()).slice(-9);
}

export async function addProduct(product: Product & { is_master?: boolean }): Promise<Product> {
  const { rows } = await pool.query(
    `INSERT INTO products (unique_id, name, batch, mfg, expiry, manufacturer, manufacturer_address, technical_name, registration_number, packing_size, manufacturer_licence, marketed_by, image_url, hazard_symbol, hazard_id, owner_uid, is_master, company_id, created_date, updated_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, NOW() AT TIME ZONE 'Asia/Kolkata', NOW() AT TIME ZONE 'Asia/Kolkata')
     RETURNING *`,
    [
      product.uniqueId,
      product.name,
      product.batch,
      product.mfg,
      product.expiry,
      product.manufacturer || null,
      product.manufacturerAddress || null,
      product.technicalName || null,
      product.registrationNumber || null,
      product.packingSize || null,
      product.manufacturerLicence || null,
      product.marketedBy || null,
      product.imageUrl || null,
      product.hazardSymbol || null,
      product.hazardId || null,
      product.owner_uid || null,
      product.is_master || false,
      product.companyId || null,
    ]
  );
  const saved = rowToProduct(rows[0]);

  // A newly created child inherits its master's image/leaflet at read time
  // (see rowToProduct), so nothing needs to be copied onto the child here.

  return saved;
}

export async function updateProduct(uniqueId: string, updates: Partial<Product>): Promise<Product | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;

  const columnMap: Record<string, string> = {
    name: 'name',
    batch: 'batch',
    mfg: 'mfg',
    expiry: 'expiry',
    shortUrl: 'short_url',
    manufacturer: 'manufacturer',
    manufacturerAddress: 'manufacturer_address',
    technicalName: 'technical_name',
    registrationNumber: 'registration_number',
    packingSize: 'packing_size',
    manufacturerLicence: 'manufacturer_licence',
    marketedBy: 'marketed_by',
    imageUrl: 'image_url',
    hazardSymbol: 'hazard_symbol',
    hazardId: 'hazard_id',
  };

  for (const [key, col] of Object.entries(columnMap)) {
    if (key in updates) {
      fields.push(`${col} = $${i++}`);
      values.push((updates as any)[key]);
    }
  }

  if (fields.length === 0) return null;

  // Always update the updated_date in IST
  fields.push(`updated_date = NOW() AT TIME ZONE 'Asia/Kolkata'`);

  values.push(uniqueId);
  const { rows } = await pool.query(
    `UPDATE products SET ${fields.join(', ')} WHERE unique_id = $${i} RETURNING *`,
    values
  );
  return rows.length > 0 ? rowToProduct(rows[0]) : null;
}

export async function cascadeHazardToChildren(masterUniqueId: string, hazardId: number): Promise<void> {
  const { rows } = await pool.query(
    'SELECT name, company_id FROM products WHERE unique_id = $1 AND is_master = true',
    [masterUniqueId]
  );
  if (rows.length === 0) return;
  const { name, company_id } = rows[0];
  await pool.query(
    `UPDATE products SET hazard_id = $1
     WHERE name = $2 AND company_id = $3
       AND (is_master = false OR is_master IS NULL) AND active = 'Y'`,
    [hazardId, name, company_id]
  );
}

export async function deleteProduct(uniqueId: string): Promise<boolean> {
  const result = await pool.query("UPDATE products SET active = 'N' WHERE unique_id = $1", [uniqueId]);
  return (result.rowCount ?? 0) > 0;
}

export async function restoreProduct(uniqueId: string): Promise<boolean> {
  const result = await pool.query("UPDATE products SET active = 'Y' WHERE unique_id = $1", [uniqueId]);
  return (result.rowCount ?? 0) > 0;
}

export async function permanentDeleteProduct(uniqueId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM products WHERE unique_id = $1', [uniqueId]);
  return (result.rowCount ?? 0) > 0;
}

// ── Companies ──
export async function addCompany(company: Company): Promise<Company> {
  const { rows } = await pool.query(
    `INSERT INTO companies (name, logo, address, phone, email, website, scan_analytics_enabled, facebook_url, instagram_url, per_pack_qr_enabled, subscription_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '30 days')
     RETURNING id, name, logo, address, phone, email, website, scan_analytics_enabled, facebook_url, instagram_url, per_pack_qr_enabled, subscription_expires_at, created_date`,
    [company.name, company.logo || null, company.address || null, company.phone || null, company.email || null, company.website || null, company.scanAnalyticsEnabled !== false, company.facebookUrl || null, company.instagramUrl || null, company.perPackQrEnabled === true]
  );
  return {
    id: rows[0].id,
    name: rows[0].name,
    logo: rows[0].logo ? `/api/companies/${rows[0].id}/logo` : undefined,
    address: rows[0].address,
    phone: rows[0].phone,
    email: rows[0].email,
    website: rows[0].website,
    scanAnalyticsEnabled: rows[0].scan_analytics_enabled,
    perPackQrEnabled: rows[0].per_pack_qr_enabled === true,
    facebookUrl: rows[0].facebook_url,
    instagramUrl: rows[0].instagram_url,
    subscriptionExpiresAt: rows[0].subscription_expires_at,
    createdAt: rows[0].created_date,
  };
}

export async function getCompanyByName(name: string): Promise<Company | undefined> {
  const { rows } = await pool.query('SELECT * FROM companies WHERE name = $1', [name]);
  if (rows.length === 0) return undefined;
  return {
    id: rows[0].id,
    name: rows[0].name,
    logo: rows[0].logo ? `/api/companies/${rows[0].id}/logo` : undefined,
    address: rows[0].address,
    phone: rows[0].phone,
    email: rows[0].email,
    website: rows[0].website,
    scanAnalyticsEnabled: rows[0].scan_analytics_enabled,
    perPackQrEnabled: rows[0].per_pack_qr_enabled === true,
    facebookUrl: rows[0].facebook_url,
    instagramUrl: rows[0].instagram_url,
    subscriptionExpiresAt: rows[0].subscription_expires_at,
    createdAt: rows[0].created_date,
  };
}

export async function getCompanyById(id: number): Promise<Company | undefined> {
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
  if (rows.length === 0) return undefined;
  return {
    id: rows[0].id,
    name: rows[0].name,
    logo: rows[0].logo ? `/api/companies/${rows[0].id}/logo` : undefined,
    address: rows[0].address,
    phone: rows[0].phone,
    email: rows[0].email,
    website: rows[0].website,
    scanAnalyticsEnabled: rows[0].scan_analytics_enabled,
    perPackQrEnabled: rows[0].per_pack_qr_enabled === true,
    facebookUrl: rows[0].facebook_url,
    instagramUrl: rows[0].instagram_url,
    subscriptionExpiresAt: rows[0].subscription_expires_at,
    createdAt: rows[0].created_date,
  };
}

export async function getAllCompanies(): Promise<Company[]> {
  const { rows } = await pool.query('SELECT * FROM companies ORDER BY name');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    logo: row.logo ? `/api/companies/${row.id}/logo` : undefined,
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    scanAnalyticsEnabled: row.scan_analytics_enabled,
    perPackQrEnabled: row.per_pack_qr_enabled === true,
    facebookUrl: row.facebook_url,
    instagramUrl: row.instagram_url,
    subscriptionExpiresAt: row.subscription_expires_at,
    createdAt: row.created_date,
  }));
}

export async function updateCompany(id: number, updates: Partial<Company>): Promise<Company | null> {
  const fields = [];
  const values = [];
  let i = 1;

  const columnMap: Record<string, string> = {
    name: 'name',
    logo: 'logo',
    address: 'address',
    phone: 'phone',
    email: 'email',
    website: 'website',
    facebookUrl: 'facebook_url',
    instagramUrl: 'instagram_url',
    scanAnalyticsEnabled: 'scan_analytics_enabled',
    perPackQrEnabled: 'per_pack_qr_enabled',
  };

  for (const [key, col] of Object.entries(columnMap)) {
    if (key in updates) {
      fields.push(`${col} = $${i}`);
      values.push((updates as any)[key]);
      i++;
    }
  }

  if (fields.length === 0) return null;

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE companies SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  
  if (rows.length === 0) return null;
  
  return {
    id: rows[0].id,
    name: rows[0].name,
    logo: rows[0].logo ? `/api/companies/${rows[0].id}/logo` : undefined,
    address: rows[0].address,
    phone: rows[0].phone,
    email: rows[0].email,
    website: rows[0].website,
    scanAnalyticsEnabled: rows[0].scan_analytics_enabled,
    perPackQrEnabled: rows[0].per_pack_qr_enabled === true,
    facebookUrl: rows[0].facebook_url,
    instagramUrl: rows[0].instagram_url,
    subscriptionExpiresAt: rows[0].subscription_expires_at,
    createdAt: rows[0].created_date,
  };
}

export async function renewCompanySubscription(id: number): Promise<Company | null> {
  // Read current expiry so renewal stays anchored to its day-of-month.
  const { rows: cur } = await pool.query('SELECT subscription_expires_at FROM companies WHERE id = $1', [id]);
  if (cur.length === 0) return null;

  // Advance by whole calendar months (keeping the same day) until it's in the future.
  // e.g. expiry Jul 15 renewed on Jul 20 → Aug 15 (a monthly cycle, not "30 days from now").
  const now = new Date();
  const next = cur[0].subscription_expires_at ? new Date(cur[0].subscription_expires_at) : new Date(now);
  do {
    next.setMonth(next.getMonth() + 1);
  } while (next.getTime() <= now.getTime());

  const { rows } = await pool.query(
    `UPDATE companies SET subscription_expires_at = $1 WHERE id = $2 RETURNING *`,
    [next.toISOString(), id]
  );
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    name: rows[0].name,
    logo: rows[0].logo ? `/api/companies/${rows[0].id}/logo` : undefined,
    address: rows[0].address,
    phone: rows[0].phone,
    email: rows[0].email,
    website: rows[0].website,
    scanAnalyticsEnabled: rows[0].scan_analytics_enabled,
    perPackQrEnabled: rows[0].per_pack_qr_enabled === true,
    facebookUrl: rows[0].facebook_url,
    instagramUrl: rows[0].instagram_url,
    subscriptionExpiresAt: rows[0].subscription_expires_at,
    createdAt: rows[0].created_date,
  };
}

export async function updateCompanyLogo(id: number, logoBuffer: Buffer): Promise<boolean> {
  try {
    console.log('[DB] updateCompanyLogo - ID:', id, 'Buffer size:', logoBuffer.length);
    console.log('[DB] Buffer encoding test:', logoBuffer.toString('utf8', 0, 4), 'vs hex:', logoBuffer.toString('hex', 0, 4));
    
    // Use bytea escape format: prepend \x to hex string
    const result = await pool.query(
      {
        text: 'UPDATE companies SET logo = $1 WHERE id = $2',
        values: [logoBuffer, id],
      }
    );
    
    console.log('[DB] updateCompanyLogo - Rows affected:', result.rowCount);
    return (result.rowCount ?? 0) > 0;
  } catch (err: any) {
    console.error('[DB] updateCompanyLogo error:', err.message);
    console.error('[DB] Full error:', err);
    throw err;
  }
}

export async function getCompanyLogo(id: number): Promise<Buffer | null> {
  try {
    const { rows } = await pool.query('SELECT logo FROM companies WHERE id = $1', [id]);
    console.log('[DB] getCompanyLogo - ID:', id, 'Has data:', !!rows[0]?.logo);
    if (rows.length === 0 || !rows[0].logo) return null;
    return rows[0].logo;
  } catch (err) {
    console.error('[DB] getCompanyLogo error:', err);
    throw err;
  }
}

export async function deleteCompany(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM companies WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ── Users ──
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (rows.length === 0) return undefined;
  return {
    uid: rows[0].uid,
    email: rows[0].email,
    password: rows[0].password,
    createdAt: rows[0].created_date,
    companyId: rows[0].company_id,
    role: rows[0].role || 'user',
    failedLoginAttempts: rows[0].failed_login_attempts ?? 0,
    lockedAt: rows[0].locked_at ?? null,
  };
}

export async function incrementFailedAttempts(email: string): Promise<number> {
  const { rows } = await pool.query(
    `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE email = $1
     RETURNING failed_login_attempts`,
    [email]
  );
  return rows[0]?.failed_login_attempts ?? 0;
}

export async function lockUser(email: string): Promise<void> {
  await pool.query(
    `UPDATE users SET locked_at = NOW() WHERE email = $1`,
    [email]
  );
}

export async function unlockUser(uid: string): Promise<void> {
  await pool.query(
    `UPDATE users SET locked_at = NULL, failed_login_attempts = 0 WHERE uid = $1`,
    [uid]
  );
}

export async function resetFailedAttempts(email: string): Promise<void> {
  await pool.query(
    `UPDATE users SET failed_login_attempts = 0, locked_at = NULL WHERE email = $1`,
    [email]
  );
}

export async function getLockedUsers(companyId?: number): Promise<{ uid: string; email: string; lockedAt: string; companyId?: number }[]> {
  const query = companyId
    ? `SELECT uid, email, locked_at, company_id FROM users WHERE locked_at IS NOT NULL AND company_id = $1 ORDER BY locked_at DESC`
    : `SELECT uid, email, locked_at, company_id FROM users WHERE locked_at IS NOT NULL ORDER BY locked_at DESC`;
  const { rows } = await pool.query(query, companyId ? [companyId] : []);
  return rows.map(r => ({
    uid: r.uid,
    email: r.email,
    lockedAt: r.locked_at,
    companyId: r.company_id,
  }));
}

export async function getAllUsers(companyId?: number): Promise<{ uid: string; email: string; role: string; companyId?: number; companyName?: string; lockedAt: string | null; createdDate: string }[]> {
  const query = companyId
    ? `SELECT u.uid, u.email, u.role, u.company_id, c.name as company_name, u.locked_at, u.created_date
       FROM users u LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.company_id = $1 ORDER BY u.created_date DESC`
    : `SELECT u.uid, u.email, u.role, u.company_id, c.name as company_name, u.locked_at, u.created_date
       FROM users u LEFT JOIN companies c ON c.id = u.company_id
       ORDER BY u.created_date DESC`;
  const { rows } = await pool.query(query, companyId ? [companyId] : []);
  return rows.map(r => ({
    uid: r.uid,
    email: r.email,
    role: r.role,
    companyId: r.company_id,
    companyName: r.company_name,
    lockedAt: r.locked_at ? new Date(r.locked_at).toISOString() : null,
    createdDate: r.created_date ? new Date(r.created_date).toISOString() : '',
  }));
}

export async function addUser(user: User): Promise<User> {
  await pool.query(
    'INSERT INTO users (uid, email, password, company_id, role) VALUES ($1, $2, $3, $4, $5)',
    [user.uid, user.email, user.password, user.companyId || null, user.role || 'user']
  );
  return user;
}

export async function updateUserPassword(uid: string, hashedPassword: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE users SET password = $1, updated_date = NOW() AT TIME ZONE 'Asia/Kolkata' WHERE uid = $2`,
    [hashedPassword, uid]
  );
  return (result.rowCount ?? 0) > 0;
}

// ── Product Image ──
// Like the leaflet: both backends funnel through product_image_url (the single
// source the read path uses). A child with none inherits its master's at read time.

// S3 path: store the absolute public URL, clear any Postgres blob.
export async function setProductImageUrl(uniqueId: string, url: string): Promise<boolean> {
  const result = await pool.query(
    'UPDATE products SET product_image_url = $1, product_image = NULL WHERE unique_id = $2',
    [url, uniqueId]
  );
  return (result.rowCount ?? 0) > 0;
}

// Postgres fallback (no S3 configured): store the blob and point product_image_url
// at the serve endpoint so the read path resolves uniformly.
export async function updateProductImage(uniqueId: string, imageBuffer: Buffer): Promise<boolean> {
  const result = await pool.query(
    'UPDATE products SET product_image = $1, product_image_url = $2 WHERE unique_id = $3',
    [imageBuffer, `/api/products/${uniqueId}/image`, uniqueId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getProductImage(uniqueId: string): Promise<Buffer | null> {
  const { rows } = await pool.query('SELECT product_image FROM products WHERE unique_id = $1', [uniqueId]);
  if (rows.length === 0 || !rows[0].product_image) return null;
  return rows[0].product_image;
}

// Clears this product's own image (both backends). A child then falls back to its master's.
export async function deleteProductImage(uniqueId: string): Promise<boolean> {
  const result = await pool.query(
    'UPDATE products SET product_image = NULL, product_image_url = NULL WHERE unique_id = $1',
    [uniqueId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ── Product Leaflet (PDF) ──
// Two storage backends, both funnelled through leaflet_url (the single source the
// read path uses). A child with no leaflet_url inherits its master's at read time.

// S3 path: store the absolute public URL, clear any Postgres blob.
export async function setProductLeafletUrl(uniqueId: string, url: string): Promise<boolean> {
  const result = await pool.query(
    'UPDATE products SET leaflet_url = $1, leaflet = NULL WHERE unique_id = $2',
    [url, uniqueId]
  );
  return (result.rowCount ?? 0) > 0;
}

// Postgres fallback (no S3 configured): store the blob and point leaflet_url at
// the serve endpoint so the read path resolves uniformly.
export async function updateProductLeaflet(uniqueId: string, leafletBuffer: Buffer): Promise<boolean> {
  const result = await pool.query(
    'UPDATE products SET leaflet = $1, leaflet_url = $2 WHERE unique_id = $3',
    [leafletBuffer, `/api/products/${uniqueId}/leaflet`, uniqueId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getProductLeaflet(uniqueId: string): Promise<Buffer | null> {
  const { rows } = await pool.query('SELECT leaflet FROM products WHERE unique_id = $1', [uniqueId]);
  if (rows.length === 0 || !rows[0].leaflet) return null;
  return rows[0].leaflet;
}

// Clears this product's own leaflet (both backends). A child then falls back to its master's.
export async function deleteProductLeaflet(uniqueId: string): Promise<boolean> {
  const result = await pool.query(
    'UPDATE products SET leaflet = NULL, leaflet_url = NULL WHERE unique_id = $1',
    [uniqueId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ── Hazards ──
export interface Hazard {
  id?: number;
  name: string;
  hasImage?: boolean;
}

export async function getHazards(): Promise<Hazard[]> {
  const { rows } = await pool.query('SELECT id, name, (image IS NOT NULL) as has_image FROM hazards ORDER BY name');
  return rows.map((r: any) => ({ id: r.id, name: r.name, hasImage: r.has_image }));
}

export async function getHazardById(id: number): Promise<Hazard | null> {
  const { rows } = await pool.query('SELECT id, name, (image IS NOT NULL) as has_image FROM hazards WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return { id: rows[0].id, name: rows[0].name, hasImage: rows[0].has_image };
}

export async function addHazard(name: string, image?: Buffer): Promise<Hazard> {
  const { rows } = await pool.query(
    'INSERT INTO hazards (name, image) VALUES ($1, $2) RETURNING id, name',
    [name, image || null]
  );
  return { id: rows[0].id, name: rows[0].name, hasImage: !!image };
}

export async function updateHazard(id: number, name: string, image?: Buffer | null): Promise<Hazard | null> {
  if (image !== undefined) {
    const { rows } = await pool.query(
      'UPDATE hazards SET name = $1, image = $2 WHERE id = $3 RETURNING id, name',
      [name, image, id]
    );
    if (rows.length === 0) return null;
    return { id: rows[0].id, name: rows[0].name, hasImage: !!image };
  }
  const { rows } = await pool.query(
    'UPDATE hazards SET name = $1 WHERE id = $2 RETURNING id, name, (image IS NOT NULL) as has_image',
    [name, id]
  );
  if (rows.length === 0) return null;
  return { id: rows[0].id, name: rows[0].name, hasImage: rows[0].has_image };
}

export async function deleteHazard(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM hazards WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getHazardImage(id: number): Promise<Buffer | null> {
  const { rows } = await pool.query('SELECT image FROM hazards WHERE id = $1', [id]);
  if (rows.length === 0 || !rows[0].image) return null;
  return rows[0].image;
}

// ── Scan Events ──
export interface ScanEvent {
  id?: number;
  productId: string;
  companyId?: number;
  productName?: string;
  scannedAt?: string;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  packCodeId?: number; // set when a pack QR (one per pack) was scanned
  deviceId?: string;   // anonymous phone ID, sent with pack QR scans
}

export interface ScanSummary {
  productId: string;
  productName: string;
  totalScans: number;
  lastScanned: string | null;
  recentScans: {
    scannedAt: string;
    userAgent: string | null;
    ipAddress: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  }[];
}

export async function logScanEvent(event: ScanEvent): Promise<void> {
  await pool.query(
    `INSERT INTO scan_events (product_id, company_id, product_name, user_agent, ip_address, country, region, city, latitude, longitude, pack_code_id, device_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      event.productId, event.companyId || null, event.productName || null,
      event.userAgent || null, event.ipAddress || null,
      event.country || null, event.region || null, event.city || null,
      event.latitude ?? null, event.longitude ?? null,
      event.packCodeId ?? null, event.deviceId || null,
    ]
  );
}

export async function getScanAnalytics(
  options: { companyId?: number; page?: number; limit?: number; search?: string } = {}
): Promise<{ summary: ScanSummary[]; totalScans: number; totalProducts: number }> {
  const { companyId, page = 1, limit = 10, search = '' } = options;
  const offset = (page - 1) * limit;
  const params: any[] = [];
  let paramIdx = 1;

  const baseWhere = companyId
    ? `WHERE se.company_id = $${paramIdx++} AND c.scan_analytics_enabled = true`
    : 'WHERE c.scan_analytics_enabled = true';
  if (companyId) params.push(companyId);

  const searchClause = search
    ? ` AND (se.product_name ILIKE $${paramIdx++} OR se.product_id ILIKE $${paramIdx++})`
    : '';
  if (search) { params.push(`%${search}%`); params.push(`%${search}%`); }

  // Paginated product summary (no recentScans here)
  const summaryParams = [...params, limit, offset];
  const { rows: summaryRows } = await pool.query(
    `SELECT
       se.product_id,
       MAX(se.product_name) as product_name,
       COUNT(*) as total_scans,
       MAX(se.scanned_at) as last_scanned
     FROM scan_events se
     JOIN companies c ON c.id = se.company_id
     ${baseWhere}${searchClause}
     GROUP BY se.product_id
     ORDER BY total_scans DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    summaryParams
  );

  const summary: ScanSummary[] = summaryRows.map((row: any) => ({
    productId: row.product_id,
    productName: row.product_name || row.product_id,
    totalScans: parseInt(row.total_scans),
    lastScanned: row.last_scanned ? new Date(row.last_scanned).toISOString() : null,
    recentScans: [], // fetched separately via getProductScanDetails
  }));

  // Total matching products
  const countParams = [...params];
  const { rows: productCountRows } = await pool.query(
    `SELECT COUNT(DISTINCT se.product_id) as total
     FROM scan_events se
     JOIN companies c ON c.id = se.company_id
     ${baseWhere}${searchClause}`,
    countParams
  );

  // Total scans (all, unfiltered by search)
  const { rows: totalRows } = await pool.query(
    `SELECT COUNT(*) as total FROM scan_events se JOIN companies c ON c.id = se.company_id ${baseWhere}`,
    companyId ? [companyId] : []
  );

  return {
    summary,
    totalScans: parseInt(totalRows[0].total),
    totalProducts: parseInt(productCountRows[0].total),
  };
}

export async function getProductScanDetails(
  productId: string,
  options: { companyId?: number; page?: number; limit?: number } = {}
): Promise<{ scans: ScanSummary['recentScans']; total: number }> {
  const { companyId, page = 1, limit = 5 } = options;
  const offset = (page - 1) * limit;
  const params: any[] = [productId];
  let paramIdx = 2;

  const companyClause = companyId ? ` AND se.company_id = $${paramIdx++}` : '';
  if (companyId) params.push(companyId);

  const { rows } = await pool.query(
    `SELECT se.scanned_at, se.user_agent, se.ip_address,
            se.country, se.region, se.city, se.latitude, se.longitude
     FROM scan_events se
     JOIN companies c ON c.id = se.company_id
     WHERE se.product_id = $1 AND c.scan_analytics_enabled = true${companyClause}
     ORDER BY se.scanned_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) as total
     FROM scan_events se
     JOIN companies c ON c.id = se.company_id
     WHERE se.product_id = $1 AND c.scan_analytics_enabled = true${companyClause}`,
    params
  );

  return {
    scans: rows.map((r: any) => ({
      scannedAt: new Date(r.scanned_at).toISOString(),
      userAgent: r.user_agent || null,
      ipAddress: r.ip_address || null,
      country: r.country || null,
      region: r.region || null,
      city: r.city || null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
    })),
    total: parseInt(countRows[0].total),
  };
}

// ── Pack Codes (one QR per pack of a batch) ──
// Codes use an alphabet without look-alike characters (no 0/O, 1/I). 32 symbols ×
// 10 characters ≈ 50 bits, so codes cannot be guessed or enumerated.
const PACK_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const PACK_CODE_LENGTH = 10;
export const PACK_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{10}$/;
export const MAX_PACKS_PER_BATCH = 100000;

function randomPackCode(): string {
  const bytes = randomBytes(PACK_CODE_LENGTH);
  let code = '';
  // 256 is a multiple of 32, so masking the low 5 bits has no modulo bias
  for (const b of bytes) code += PACK_CODE_ALPHABET[b & 31];
  return code;
}

export interface PackCode {
  id: number;
  code: string;
  productId: string;
  companyId?: number;
  serialNo: number;
}

/**
 * Create `quantity` pack codes for a batch, numbered from 1 (or after its highest existing
 * pack number). All-or-nothing: either every code is created or none is.
 */
export async function generatePackCodes(
  productId: string,
  companyId: number | undefined,
  quantity: number
): Promise<{ fromSerial: number; toSerial: number; count: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialise runs per batch so two requests can't take the same pack numbers
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pack_codes:${productId}`]);
    const { rows } = await client.query(
      'SELECT COALESCE(MAX(serial_no), 0)::int AS max FROM pack_codes WHERE product_id = $1',
      [productId]
    );
    const fromSerial = rows[0].max + 1;
    const CHUNK = 5000;

    for (let start = fromSerial; start < fromSerial + quantity; start += CHUNK) {
      const end = Math.min(start + CHUNK, fromSerial + quantity);
      let pending = Array.from({ length: end - start }, (_, i) => start + i);
      // A random code can (very rarely) collide with an existing one — retry just those packs
      while (pending.length > 0) {
        const { rows: inserted } = await client.query(
          `INSERT INTO pack_codes (code, product_id, company_id, serial_no)
           SELECT t.code, $3, $4, t.serial_no FROM unnest($1::text[], $2::int[]) AS t(code, serial_no)
           ON CONFLICT (code) DO NOTHING
           RETURNING serial_no`,
          [pending.map(randomPackCode), pending, productId, companyId ?? null]
        );
        const done = new Set(inserted.map((r: any) => r.serial_no));
        pending = pending.filter((s) => !done.has(s));
      }
    }

    await client.query('COMMIT');
    return { fromSerial, toSerial: fromSerial + quantity - 1, count: quantity };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPackCodeByCode(code: string): Promise<PackCode | undefined> {
  const { rows } = await pool.query(
    'SELECT id, code, product_id, company_id, serial_no FROM pack_codes WHERE code = $1',
    [code]
  );
  if (rows.length === 0) return undefined;
  return {
    id: rows[0].id,
    code: rows[0].code,
    productId: rows[0].product_id,
    companyId: rows[0].company_id ?? undefined,
    serialNo: rows[0].serial_no,
  };
}

export async function getPackCodeSummary(productId: string): Promise<{ total: number; lastSerial: number }> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total, COALESCE(MAX(serial_no), 0)::int AS last_serial
     FROM pack_codes WHERE product_id = $1`,
    [productId]
  );
  return { total: rows[0].total, lastSerial: rows[0].last_serial };
}

export async function getPackCodesInRange(
  productId: string,
  fromSerial: number,
  toSerial: number
): Promise<{ serialNo: number; code: string }[]> {
  const { rows } = await pool.query(
    `SELECT serial_no, code FROM pack_codes
     WHERE product_id = $1 AND serial_no BETWEEN $2 AND $3
     ORDER BY serial_no`,
    [productId, fromSerial, toSerial]
  );
  return rows.map((r: any) => ({ serialNo: r.serial_no, code: r.code }));
}
