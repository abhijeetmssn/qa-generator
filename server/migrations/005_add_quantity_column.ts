// Add quantity column to products table
import pool from '../pool';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity VARCHAR(100);
    `);

    await client.query('COMMIT');
    console.log('✅ Migration 005: quantity column added successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 005 failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
