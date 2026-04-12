import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import pool from './pool';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import companiesRoutes from './routes/companies';
import hazardsRoutes from './routes/hazards';
import adminRoutes from './routes/admin';

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175',
  'http://localhost:5176', 'http://localhost:5177',
  'http://qrgenerators.in', 'https://qrgenerators.in',
  'http://www.qrgenerators.in', 'https://www.qrgenerators.in',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow any *.vercel.app domain or known origins
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Serve uploaded logos as static files
app.use('/uploads', express.static(path.join(__dirname_local, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/hazards', hazardsRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auto-migrate & seed on startup
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id                SERIAL PRIMARY KEY,
        name              VARCHAR(255) UNIQUE NOT NULL,
        logo              BYTEA,
        address           TEXT,
        phone             VARCHAR(20),
        email             VARCHAR(255),
        website           VARCHAR(255),
        created_date      TIMESTAMPTZ DEFAULT NOW(),
        updated_date      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid               VARCHAR(100) PRIMARY KEY,
        email             VARCHAR(255) UNIQUE NOT NULL,
        password          VARCHAR(255) NOT NULL,
        company_id        INTEGER REFERENCES companies(id),
        role              VARCHAR(50) DEFAULT 'viewer',
        created_date      TIMESTAMPTZ DEFAULT NOW(),
        updated_date      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Migrate existing users table: add company_id if it doesn't exist
    try {
      await client.query('SAVEPOINT users_migration');
      await client.query(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)'
      );
      // Drop redundant company-related columns - fetch from company table instead
      await client.query(
        'ALTER TABLE users DROP COLUMN IF EXISTS company_logo'
      );
      await client.query(
        'ALTER TABLE users DROP COLUMN IF EXISTS company_name'
      );
      await client.query(
        'ALTER TABLE users DROP COLUMN IF EXISTS company_address'
      );
      await client.query('RELEASE SAVEPOINT users_migration');
    } catch (migrationErr: any) {
      await client.query('ROLLBACK TO SAVEPOINT users_migration');
      if (!migrationErr.message.includes('already exists')) {
        console.error('Migration warning:', migrationErr.message);
      }
    }

    // Migrate logo column to BYTEA for binary data storage
    try {
      await client.query('SAVEPOINT logo_migration');
      await client.query(
        `ALTER TABLE companies 
         ALTER COLUMN logo TYPE BYTEA`
      );
      await client.query('RELEASE SAVEPOINT logo_migration');
      console.log('✅ Logo column migrated to BYTEA');
    } catch (migrationErr: any) {
      await client.query('ROLLBACK TO SAVEPOINT logo_migration');
      // Column might already be BYTEA, ignore this error
      if (!migrationErr.message.includes('already') && !migrationErr.message.includes('same')) {
        console.warn('Logo column migration info:', migrationErr.message);
      }
    }

    // Create products table (with all columns)
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id                    SERIAL PRIMARY KEY,
        unique_id             VARCHAR(100) UNIQUE NOT NULL,
        name                  VARCHAR(255) NOT NULL,
        batch                 VARCHAR(100),
        mfg                   VARCHAR(100),
        expiry                VARCHAR(100),
        short_url             VARCHAR(255),
        manufacturer          VARCHAR(255),
        manufacturer_address  TEXT,
        technical_name        VARCHAR(255),
        registration_number   VARCHAR(255),
        packing_size          VARCHAR(100),
        manufacturer_licence  VARCHAR(255),
        image_url             VARCHAR(500),
        hazard_symbol         VARCHAR(255),
        hazard_id             INTEGER,
        quantity              VARCHAR(100),
        product_image         BYTEA,
        is_master             BOOLEAN DEFAULT false,
        company_id            INTEGER REFERENCES companies(id),
        owner_uid             VARCHAR(100) REFERENCES users(uid),
        active                VARCHAR(1) DEFAULT 'Y',
        created_date          TIMESTAMPTZ DEFAULT NOW(),
        updated_date          TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create hazards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hazards (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        image       BYTEA,
        created_date TIMESTAMPTZ DEFAULT NOW(),
        updated_date TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Migrate products table: add columns if table already existed without them
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity VARCHAR(100)');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS product_image BYTEA');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS hazard_symbol VARCHAR(255)');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS hazard_id INTEGER');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)');

    // Add marketed_by column
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS marketed_by VARCHAR(500)');

    // Add created_date and updated_date to all tables
    // Products
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT NOW()');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_date TIMESTAMPTZ DEFAULT NOW()');
    // Companies
    await client.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT NOW()');
    await client.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_date TIMESTAMPTZ DEFAULT NOW()');
    // Users
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT NOW()');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_date TIMESTAMPTZ DEFAULT NOW()');
    // Hazards
    await client.query('ALTER TABLE hazards ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT NOW()');
    await client.query('ALTER TABLE hazards ADD COLUMN IF NOT EXISTS updated_date TIMESTAMPTZ DEFAULT NOW()');

    // Backfill from created_at (only if column still exists) then drop it
    for (const tbl of ['products', 'companies', 'users', 'hazards']) {
      const { rows: cols } = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'created_at'`, [tbl]
      );
      if (cols.length > 0) {
        await client.query(`UPDATE ${tbl} SET created_date = created_at WHERE created_date IS NULL AND created_at IS NOT NULL`);
        await client.query(`UPDATE ${tbl} SET updated_date = created_at WHERE updated_date IS NULL AND created_at IS NOT NULL`);
        await client.query(`ALTER TABLE ${tbl} DROP COLUMN created_at`);
      }
    }

    // One-time fix: spread existing product dates from April 1-13 based on ID order
    // (runs only when all products share the same created_date, i.e. from DEFAULT NOW() migration)
    const { rows: distinctDates } = await client.query(
      `SELECT COUNT(DISTINCT created_date) AS cnt FROM products`
    );
    if (parseInt(distinctDates[0].cnt) <= 1) {
      await client.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS rn,
                 COUNT(*) OVER () AS total
          FROM products
        )
        UPDATE products p
        SET created_date = '2026-04-01T00:00:00+05:30'::timestamptz + (r.rn::float / GREATEST(r.total - 1, 1)) * INTERVAL '12 days',
            updated_date = '2026-04-01T00:00:00+05:30'::timestamptz + (r.rn::float / GREATEST(r.total - 1, 1)) * INTERVAL '12 days'
        FROM ranked r
        WHERE p.id = r.id
      `);
      console.log('✅ Backfilled product dates (April 1–13 spread by ID)');
    }

    // Drop short_url column — no longer used, QR links are built from unique_id at runtime
    await client.query('ALTER TABLE products DROP COLUMN IF EXISTS short_url');
    // Drop quantity column — replaced by packing_size which serves the same purpose
    await client.query('ALTER TABLE products DROP COLUMN IF EXISTS quantity');

    // Backfill company_id on existing products from owner_uid → users.company_id
    await client.query(`
      UPDATE products p
      SET company_id = u.company_id
      FROM users u
      WHERE p.owner_uid = u.uid AND p.company_id IS NULL AND u.company_id IS NOT NULL
    `);

    // Backfill child products: copy master fields (manufacturer_licence, technical_name, registration_number, manufacturer, manufacturer_address, marketed_by) to child products that are missing them
    await client.query(`
      UPDATE products child
      SET
        manufacturer_licence = COALESCE(NULLIF(TRIM(child.manufacturer_licence), ''), master.manufacturer_licence),
        technical_name = COALESCE(NULLIF(TRIM(child.technical_name), ''), master.technical_name),
        registration_number = COALESCE(NULLIF(TRIM(child.registration_number), ''), master.registration_number),
        manufacturer = COALESCE(NULLIF(TRIM(child.manufacturer), ''), master.manufacturer),
        manufacturer_address = COALESCE(NULLIF(TRIM(child.manufacturer_address), ''), master.manufacturer_address)
      FROM products master
      WHERE master.is_master = true
        AND (child.is_master = false OR child.is_master IS NULL)
        AND master.name = child.name
        AND master.company_id = child.company_id
    `);

    // Fix roles: migration 003 set DEFAULT 'user' which is not a valid role.
    // Update any 'user' roles to 'viewer', then restore admin for seed admins.
    await client.query(`UPDATE users SET role = 'viewer' WHERE role = 'user' OR role IS NULL`);
    await client.query(`UPDATE users SET role = 'admin' WHERE uid IN ('demo-admin-001', 'demo-admin-002')`);
    await client.query(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'viewer'`);

    await client.query('COMMIT');
    console.log('✅ Database tables ready');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
  }

  // Seed demo data if tables are empty
  try {
    const { default: bcrypt } = await import('bcryptjs');
    
    // First, ensure companies exist
    const { rows: companyRows } = await pool.query('SELECT id, name FROM companies');
    let apDemoId = companyRows.find(r => r.name === 'AP Demo Company')?.id;
    let pharmaId = companyRows.find(r => r.name === 'Pharma Solutions Ltd')?.id;
    
    if (!apDemoId) {
      const result = await pool.query(
        'INSERT INTO companies (name, address) VALUES ($1, $2) RETURNING id',
        ['AP Demo Company', '123 Demo Street, New Delhi, India']
      );
      apDemoId = result.rows[0].id;
    }
    
    if (!pharmaId) {
      const result = await pool.query(
        'INSERT INTO companies (name, address) VALUES ($1, $2) RETURNING id',
        ['Pharma Solutions Ltd', '456 Pharma Road, Mumbai, India']
      );
      pharmaId = result.rows[0].id;
    }
    
    // Then seed users with company_id
    const { rows: userRows } = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userRows[0].count) === 0) {
      const demoUsers = [
        { uid: 'demo-admin-001', email: 'admin@demo.com', password: 'admin123456', companyId: apDemoId, companyAddress: '123 Demo Street, New Delhi, India', role: 'admin' },
        { uid: 'demo-editor-001', email: 'editor@demo.com', password: 'editor123456', companyId: apDemoId, companyAddress: '123 Demo Street, New Delhi, India', role: 'editor' },
        { uid: 'demo-viewer-001', email: 'viewer@demo.com', password: 'viewer123456', companyId: apDemoId, companyAddress: '123 Demo Street, New Delhi, India', role: 'viewer' },
        { uid: 'demo-admin-002', email: 'admin@pharma.com', password: 'admin123456', companyId: pharmaId, companyAddress: '456 Pharma Road, Mumbai, India', role: 'admin' },
      ];
      for (const u of demoUsers) {
        const hashed = await bcrypt.hash(u.password, 10);
        await pool.query(
          'INSERT INTO users (uid, email, password, company_id, company_address, role) VALUES ($1,$2,$3,$4,$5,$6)',
          [u.uid, u.email, hashed, u.companyId, u.companyAddress, u.role]
        );
      }
      console.log('✅ Demo users seeded with company_id');
    }

    const { rows: prodRows } = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(prodRows[0].count) === 0) {
      const products = [
        ['881946515','ETIUS','FASPO647','08/25','07/27','qr-1.in/a.php?x=57afe','AP Demo Manufacturer','123 Industrial Area, Chandigarh','Emamectin Benzoate 5% SG','CIR-1B7889/2021-Emamectin Benzoate (SG) (4325)-2288','1 KG','PB/AGRI/PP/2021/4','demo-admin-001', apDemoId],
        ['229847361','NEXGROW','NXG-2026-A1','01/26','12/27','qr-1.in/a.php?x=83bcd','AP Demo Manufacturer','123 Industrial Area, Chandigarh','Thiamethoxam 25% WG','CIR-2245/2022-Thiamethoxam (WG) (5610)-3102','500 GM','PB/AGRI/PP/2022/8','demo-admin-001', apDemoId],
        ['339471829','CROPSHIELD','CSH-2026-B3','03/26','02/28','qr-1.in/a.php?x=a29ef','AP Demo Manufacturer','123 Industrial Area, Chandigarh','Imidacloprid 17.8% SL','CIR-3367/2023-Imidacloprid (SL) (1127)-4415','250 ML','PB/AGRI/PP/2023/12','demo-admin-001', apDemoId],
        ['447291053','VITACURE','VTC-2025-D1','11/25','10/27','qr-1.in/a.php?x=f10ab','Pharma Mfg Corp','456 Pharma Road, Mumbai','Mancozeb 75% WP','CIR-4489/2024-Mancozeb (WP) (7821)-5503','2 KG','MH/AGRI/PP/2024/2','demo-admin-002', pharmaId],
        ['558103947','GREENMAX','GMX-2026-E2','02/26','01/28','qr-1.in/a.php?x=d72fc','Pharma Mfg Corp','456 Pharma Road, Mumbai','Chlorpyrifos 20% EC','CIR-5591/2025-Chlorpyrifos (EC) (2034)-6691','1 LTR','MH/AGRI/PP/2025/6','demo-admin-002', pharmaId],
      ];
      for (const p of products) {
        await pool.query(
          `INSERT INTO products (unique_id,name,batch,mfg,expiry,short_url,manufacturer,manufacturer_address,technical_name,registration_number,packing_size,manufacturer_licence,owner_uid,company_id,is_master)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)`,
          p
        );
      }
      console.log('✅ Demo products seeded');
    }

    // Backfill company_id on any products that are missing it
    await pool.query(`
      UPDATE products p
      SET company_id = u.company_id
      FROM users u
      WHERE p.owner_uid = u.uid AND p.company_id IS NULL AND u.company_id IS NOT NULL
    `);
  } catch (err) {
    console.error('Seed failed:', err);
  }
}

app.listen(PORT, async () => {
  console.log(`✅ API server running on port ${PORT}`);
  await initDB();
});
