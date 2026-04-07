// Database service — PostgreSQL powered
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
  shortUrl: string;
  manufacturer?: string;
  manufacturerAddress?: string;
  technicalName?: string;
  registrationNumber?: string;
  packingSize?: string;
  manufacturerLicence?: string;
  imageUrl?: string;
  hazardSymbol?: string; // e.g. '☠️ Toxic', '🔥 Flammable'
  quantity?: string;
  productImage?: string; // URL path to serve the image
  owner_uid?: string;
  active?: string; // 'Y' or 'N'
  companyId?: number;
  companyName?: string;
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
}

// ── Helper: map a DB row to Product ──
function rowToProduct(row: any): Product {
  return {
    id: row.id,
    uniqueId: row.unique_id,
    name: row.name,
    batch: row.batch,
    mfg: row.mfg,
    expiry: row.expiry,
    shortUrl: row.short_url,
    manufacturer: row.manufacturer,
    manufacturerAddress: row.manufacturer_address,
    technicalName: row.technical_name,
    registrationNumber: row.registration_number,
    packingSize: row.packing_size,
    manufacturerLicence: row.manufacturer_licence,
    imageUrl: row.image_url,
    hazardSymbol: row.hazard_symbol,
    quantity: row.quantity,
    productImage: row.product_image ? `/api/products/${row.unique_id}/image` : undefined,
    owner_uid: row.owner_uid,
    active: row.active || 'Y',
    companyId: row.company_id ?? undefined,
    companyName: row.company_name ?? undefined,
  };
}

// ── Products ──
export async function getProducts(companyName?: string): Promise<Product[]> {
  if (companyName) {
    const { rows } = await pool.query(
      `SELECT p.*, u.company_id, c.name as company_name FROM products p
       JOIN users u ON p.owner_uid = u.uid
       JOIN companies c ON u.company_id = c.id
       WHERE p.active = 'Y' AND (p.is_master = false OR p.is_master IS NULL) AND c.name = $1
       ORDER BY p.id`,
      [companyName]
    );
    return rows.map(rowToProduct);
  }
  const { rows } = await pool.query(
    `SELECT p.*, u.company_id, c.name as company_name FROM products p
     LEFT JOIN users u ON p.owner_uid = u.uid
     LEFT JOIN companies c ON u.company_id = c.id
     WHERE p.active = 'Y' AND (p.is_master = false OR p.is_master IS NULL)
     ORDER BY p.id`
  );
  return rows.map(rowToProduct);
}

export async function getMasterProducts(companyName?: string): Promise<Product[]> {
  if (companyName) {
    const { rows } = await pool.query(
      `SELECT p.* FROM products p
       JOIN users u ON p.owner_uid = u.uid
       JOIN companies c ON u.company_id = c.id
       WHERE p.active = 'Y' AND p.is_master = true AND c.name = $1
       ORDER BY p.name`,
      [companyName]
    );
    return rows.map(rowToProduct);
  }
  const { rows } = await pool.query("SELECT * FROM products WHERE active = 'Y' AND is_master = true ORDER BY name");
  return rows.map(rowToProduct);
}

export async function getTrashProducts(companyName?: string): Promise<Product[]> {
  if (companyName) {
    const { rows } = await pool.query(
      `SELECT p.* FROM products p
       JOIN users u ON p.owner_uid = u.uid
       JOIN companies c ON u.company_id = c.id
       WHERE p.active = 'N' AND c.name = $1
       ORDER BY p.id`,
      [companyName]
    );
    return rows.map(rowToProduct);
  }
  const { rows } = await pool.query("SELECT * FROM products WHERE active = 'N' ORDER BY id");
  return rows.map(rowToProduct);
}

export async function getProductByUniqueId(uniqueId: string): Promise<Product | undefined> {
  const { rows } = await pool.query('SELECT * FROM products WHERE unique_id = $1', [uniqueId]);
  return rows.length > 0 ? rowToProduct(rows[0]) : undefined;
}

export async function addProduct(product: Product & { is_master?: boolean }): Promise<Product> {
  const { rows } = await pool.query(
    `INSERT INTO products (unique_id, name, batch, mfg, expiry, short_url, manufacturer, manufacturer_address, technical_name, registration_number, packing_size, manufacturer_licence, image_url, hazard_symbol, quantity, owner_uid, is_master)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      product.uniqueId,
      product.name,
      product.batch,
      product.mfg,
      product.expiry,
      product.shortUrl,
      product.manufacturer || null,
      product.manufacturerAddress || null,
      product.technicalName || null,
      product.registrationNumber || null,
      product.packingSize || null,
      product.manufacturerLicence || null,
      product.imageUrl || null,
      product.hazardSymbol || null,
      product.quantity || null,
      product.owner_uid || null,
      product.is_master || false,
    ]
  );
  return rowToProduct(rows[0]);
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
    imageUrl: 'image_url',
    hazardSymbol: 'hazard_symbol',
    quantity: 'quantity',
  };

  for (const [key, col] of Object.entries(columnMap)) {
    if (key in updates) {
      fields.push(`${col} = $${i++}`);
      values.push((updates as any)[key]);
    }
  }

  if (fields.length === 0) return null;

  values.push(uniqueId);
  const { rows } = await pool.query(
    `UPDATE products SET ${fields.join(', ')} WHERE unique_id = $${i} RETURNING *`,
    values
  );
  return rows.length > 0 ? rowToProduct(rows[0]) : null;
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
    `INSERT INTO companies (name, logo, address, phone, email, website)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, logo, address, phone, email, website, created_at`,
    [company.name, company.logo || null, company.address || null, company.phone || null, company.email || null, company.website || null]
  );
  return {
    id: rows[0].id,
    name: rows[0].name,
    logo: rows[0].logo ? `/api/companies/${rows[0].id}/logo` : undefined,
    address: rows[0].address,
    phone: rows[0].phone,
    email: rows[0].email,
    website: rows[0].website,
    createdAt: rows[0].created_at,
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
    createdAt: rows[0].created_at,
  };
}

export async function getCompanyById(id: number): Promise<Company | undefined> {
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
  if (rows.length === 0) return undefined;
  // Don't return logo buffer in JSON - use URL instead
  return {
    id: rows[0].id,
    name: rows[0].name,
    logo: rows[0].logo ? `/api/companies/${rows[0].id}/logo` : undefined,
    address: rows[0].address,
    phone: rows[0].phone,
    email: rows[0].email,
    website: rows[0].website,
    createdAt: rows[0].created_at,
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
    createdAt: row.created_at,
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
    createdAt: rows[0].created_at,
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
    createdAt: rows[0].created_at,
    companyId: rows[0].company_id,
    role: rows[0].role || 'user',
  };
}

export async function addUser(user: User): Promise<User> {
  await pool.query(
    'INSERT INTO users (uid, email, password, company_id, role) VALUES ($1, $2, $3, $4, $5)',
    [user.uid, user.email, user.password, user.companyId || null, user.role || 'user']
  );
  return user;
}

// ── Product Image ──
export async function updateProductImage(uniqueId: string, imageBuffer: Buffer): Promise<boolean> {
  const result = await pool.query(
    'UPDATE products SET product_image = $1 WHERE unique_id = $2',
    [imageBuffer, uniqueId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getProductImage(uniqueId: string): Promise<Buffer | null> {
  const { rows } = await pool.query('SELECT product_image FROM products WHERE unique_id = $1', [uniqueId]);
  if (rows.length === 0 || !rows[0].product_image) return null;
  return rows[0].product_image;
}
