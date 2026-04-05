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

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175',
  'http://localhost:5176', 'http://localhost:5177',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow any *.vercel.app domain
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
        created_at        TIMESTAMPTZ DEFAULT NOW()
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
        created_at        TIMESTAMPTZ DEFAULT NOW()
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
        quantity              VARCHAR(100),
        product_image         BYTEA,
        is_master             BOOLEAN DEFAULT false,
        owner_uid             VARCHAR(100) REFERENCES users(uid),
        active                VARCHAR(1) DEFAULT 'Y',
        created_at            TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Migrate products table: add columns if table already existed without them
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity VARCHAR(100)');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS product_image BYTEA');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS hazard_symbol VARCHAR(255)');

    // Mark all existing products as master catalog so they appear in dropdown
    await client.query("UPDATE products SET is_master = true WHERE is_master = false OR is_master IS NULL");

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
        ['881946515','ETIUS','FASPO647','08/25','07/27','qr-1.in/a.php?x=57afe','AP Demo Manufacturer','123 Industrial Area, Chandigarh','Emamectin Benzoate 5% SG','CIR-1B7889/2021-Emamectin Benzoate (SG) (4325)-2288','1 KG','PB/AGRI/PP/2021/4','demo-admin-001'],
        ['229847361','NEXGROW','NXG-2026-A1','01/26','12/27','qr-1.in/a.php?x=83bcd','AP Demo Manufacturer','123 Industrial Area, Chandigarh','Thiamethoxam 25% WG','CIR-2245/2022-Thiamethoxam (WG) (5610)-3102','500 GM','PB/AGRI/PP/2022/8','demo-admin-001'],
        ['339471829','CROPSHIELD','CSH-2026-B3','03/26','02/28','qr-1.in/a.php?x=a29ef','AP Demo Manufacturer','123 Industrial Area, Chandigarh','Imidacloprid 17.8% SL','CIR-3367/2023-Imidacloprid (SL) (1127)-4415','250 ML','PB/AGRI/PP/2023/12','demo-admin-001'],
        ['447291053','VITACURE','VTC-2025-D1','11/25','10/27','qr-1.in/a.php?x=f10ab','Pharma Mfg Corp','456 Pharma Road, Mumbai','Mancozeb 75% WP','CIR-4489/2024-Mancozeb (WP) (7821)-5503','2 KG','MH/AGRI/PP/2024/2','demo-admin-002'],
        ['558103947','GREENMAX','GMX-2026-E2','02/26','01/28','qr-1.in/a.php?x=d72fc','Pharma Mfg Corp','456 Pharma Road, Mumbai','Chlorpyrifos 20% EC','CIR-5591/2025-Chlorpyrifos (EC) (2034)-6691','1 LTR','MH/AGRI/PP/2025/6','demo-admin-002'],
      ];
      for (const p of products) {
        await pool.query(
          `INSERT INTO products (unique_id,name,batch,mfg,expiry,short_url,manufacturer,manufacturer_address,technical_name,registration_number,packing_size,manufacturer_licence,owner_uid)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          p
        );
      }
      console.log('✅ Demo products seeded');
    }
  } catch (err) {
    console.error('Seed failed:', err);
  }
}

app.listen(PORT, async () => {
  console.log(`✅ API server running on port ${PORT}`);
  await initDB();
});
