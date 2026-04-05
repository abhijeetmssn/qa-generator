import pool from './pool.js';

async function main() {
  // Check counts
  const { rows } = await pool.query("SELECT COUNT(*) as total, COUNT(CASE WHEN is_master = true THEN 1 END) as master FROM products");
  console.log('Product counts:', rows[0]);

  // Mark all existing products as master so they appear in dropdown
  const result = await pool.query("UPDATE products SET is_master = true WHERE is_master IS NULL OR is_master = false");
  console.log('Updated to master:', result.rowCount, 'products');

  await pool.end();
}

main().catch(console.error);
