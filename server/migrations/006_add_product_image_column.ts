// Add product_image (bytea) column to products table for image upload
import pool from '../pool';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS product_image BYTEA;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration 006: product_image column added successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 006 failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
