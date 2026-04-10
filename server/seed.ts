import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { findUserByEmail, addUser, getProducts, addProduct, getCompanyByName, addCompany } from './db';
import pool from './pool';

// Demo companies
const DEMO_COMPANIES = [
  {
    name: 'AP Demo Company',
    address: '123 Demo Street, New Delhi, India',
    phone: '011-12345678',
    email: 'info@apdemo.com',
    website: 'www.apdemo.com',
  },
  {
    name: 'Pharma Solutions Ltd',
    address: '456 Pharma Road, Mumbai, India',
    phone: '022-87654321',
    email: 'info@pharma.com',
    website: 'www.pharmasolutions.com',
  },
];

// Demo users with different companies
const DEMO_USERS = [
  {
    uid: 'demo-admin-001',
    email: 'admin@demo.com',
    password: 'admin123456',
    companyName: 'AP Demo Company',
    companyAddress: '123 Demo Street, New Delhi, India',
    role: 'admin',
  },
  {
    uid: 'demo-editor-001',
    email: 'editor@demo.com',
    password: 'editor123456',
    companyName: 'AP Demo Company',
    companyAddress: '123 Demo Street, New Delhi, India',
    role: 'editor',
  },
  {
    uid: 'demo-viewer-001',
    email: 'viewer@demo.com',
    password: 'viewer123456',
    companyName: 'AP Demo Company',
    companyAddress: '123 Demo Street, New Delhi, India',
    role: 'viewer',
  },
  {
    uid: 'demo-admin-002',
    email: 'admin@pharma.com',
    password: 'admin123456',
    companyName: 'Pharma Solutions Ltd',
    companyAddress: '456 Pharma Road, Mumbai, India',
    role: 'admin',
  },
];

// Sample products — assigned to demo admin users
const SAMPLE_PRODUCTS = [
  {
    uniqueId: '881946515',
    name: 'ETIUS',
    batch: 'FASPO647',
    mfg: '08/25',
    expiry: '07/27',
    shortUrl: 'qr-1.in/a.php?x=57afe',
    manufacturer: 'AP Demo Manufacturer',
    manufacturerAddress: '123 Industrial Area, Chandigarh',
    technicalName: 'Emamectin Benzoate 5% SG',
    registrationNumber: 'CIR-1B7889/2021-Emamectin Benzoate (SG) (4325)-2288',
    packingSize: '1 KG',
    manufacturerLicence: 'PB/AGRI/PP/2021/4',
    imageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde9f?w=400&h=300&fit=crop',
    hazardSymbol: '☠️ Toxic',
    owner_uid: 'demo-admin-001',
  },
  {
    uniqueId: '229847361',
    name: 'NEXGROW',
    batch: 'NXG-2026-A1',
    mfg: '01/26',
    expiry: '12/27',
    shortUrl: 'qr-1.in/a.php?x=83bcd',
    manufacturer: 'AP Demo Manufacturer',
    manufacturerAddress: '123 Industrial Area, Chandigarh',
    technicalName: 'Thiamethoxam 25% WG',
    registrationNumber: 'CIR-2245/2022-Thiamethoxam (WG) (5610)-3102',
    packingSize: '500 GM',
    manufacturerLicence: 'PB/AGRI/PP/2022/8',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5f3f3f96d?w=400&h=300&fit=crop',
    hazardSymbol: '⚠️ Health Hazard',
    owner_uid: 'demo-admin-001',
  },
  {
    uniqueId: '339471829',
    name: 'CROPSHIELD',
    batch: 'CSH-2026-B3',
    mfg: '03/26',
    expiry: '02/28',
    shortUrl: 'qr-1.in/a.php?x=a29ef',
    manufacturer: 'AP Demo Manufacturer',
    manufacturerAddress: '123 Industrial Area, Chandigarh',
    technicalName: 'Imidacloprid 17.8% SL',
    registrationNumber: 'CIR-3367/2023-Imidacloprid (SL) (1127)-4415',
    packingSize: '250 ML',
    manufacturerLicence: 'PB/AGRI/PP/2023/12',
    imageUrl: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=400&h=300&fit=crop',
    hazardSymbol: '🧪 Irritant',
    owner_uid: 'demo-admin-001',
  },
  {
    uniqueId: '447291053',
    name: 'VITACURE',
    batch: 'VTC-2025-D1',
    mfg: '11/25',
    expiry: '10/27',
    shortUrl: 'qr-1.in/a.php?x=f10ab',
    manufacturer: 'Pharma Mfg Corp',
    manufacturerAddress: '456 Pharma Road, Mumbai',
    technicalName: 'Mancozeb 75% WP',
    registrationNumber: 'CIR-4489/2024-Mancozeb (WP) (7821)-5503',
    packingSize: '2 KG',
    manufacturerLicence: 'MH/AGRI/PP/2024/2',
    imageUrl: 'https://images.unsplash.com/photo-1585314317383-c7db3963a3a2?w=400&h=300&fit=crop',
    hazardSymbol: '☠️ Toxic',
    owner_uid: 'demo-admin-002',
  },
  {
    uniqueId: '558103947',
    name: 'GREENMAX',
    batch: 'GMX-2026-E2',
    mfg: '02/26',
    expiry: '01/28',
    shortUrl: 'qr-1.in/a.php?x=d72fc',
    manufacturer: 'Pharma Mfg Corp',
    manufacturerAddress: '456 Pharma Road, Mumbai',
    technicalName: 'Chlorpyrifos 20% EC',
    registrationNumber: 'CIR-5591/2025-Chlorpyrifos (EC) (2034)-6691',
    packingSize: '1 LTR',
    manufacturerLicence: 'MH/AGRI/PP/2025/6',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=400&h=300&fit=crop',
    hazardSymbol: '⚠️ Health Hazard',
    owner_uid: 'demo-admin-002',
  },
];

async function seed() {
  // 0. Seed demo companies first
  const companyMap: { [key: string]: number } = {};
  for (const company of DEMO_COMPANIES) {
    const existing = await getCompanyByName(company.name);
    if (existing) {
      companyMap[company.name] = existing.id!;
      console.log(`⏩ Company already exists: ${company.name}`);
    } else {
      const created = await addCompany({
        name: company.name,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
      });
      companyMap[company.name] = created.id!;
      console.log(`✅ Company created: ${company.name} (ID: ${created.id})`);
    }
  }

  // 1. Seed demo users
  for (const demoUser of DEMO_USERS) {
    const existing = await findUserByEmail(demoUser.email);
    if (!existing) {
      const hashed = await bcrypt.hash(demoUser.password, 10);
      const companyId = companyMap[demoUser.companyName];
      await addUser({
        uid: demoUser.uid,
        email: demoUser.email,
        password: hashed,
        createdAt: new Date().toISOString(),
        companyId: companyId,
        companyName: demoUser.companyName,
        companyAddress: demoUser.companyAddress,
        role: demoUser.role as any,
      });
      console.log(`✅ User created: ${demoUser.email} / ${demoUser.password} (Role: ${demoUser.role}, Company: ${demoUser.companyName})`);
    } else {
      // Always ensure the role is correct for existing seed users
      await pool.query('UPDATE users SET role = $1 WHERE email = $2', [demoUser.role, demoUser.email]);
      console.log(`✅ Role updated for existing user: ${demoUser.email} → ${demoUser.role}`);
    }
  }

  // 2. Seed products if table is empty
  const products = await getProducts();
  if (products.length === 0) {
    for (const p of SAMPLE_PRODUCTS) {
      await addProduct({ id: 0, ...p });
    }
    console.log(`✅ Seeded ${SAMPLE_PRODUCTS.length} sample products`);
  } else {
    console.log(`⏩ Products already exist (${products.length}), skipping seed`);
  }

  await pool.end();
  console.log('\\n🎉 Seed complete! Demo login credentials:');
  console.log('  Admin:  admin@demo.com  / admin123456');
  console.log('  Editor: editor@demo.com / editor123456');
  console.log('  Viewer: viewer@demo.com / viewer123456');
  console.log('  Admin (Pharma): admin@pharma.com / admin123456');
}

seed().catch(console.error);
