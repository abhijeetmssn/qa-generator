// Add is_master column to products table for master catalog vs batch products
import pool from '../pool';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add is_master column — true for catalog products uploaded via Excel
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration 004: is_master column added successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 004 failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
