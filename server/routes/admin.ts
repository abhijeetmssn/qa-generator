import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware';
import pool from '../pool';

const router = Router();

// GET /api/admin/export-sql — export full DB as .sql (admin only)
router.get('/export-sql', authenticateToken, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const lines: string[] = [];

    lines.push('-- =============================================');
    lines.push('-- Full database export');
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push('-- =============================================');
    lines.push('');
    lines.push('SET client_encoding = \'UTF8\';');
    lines.push('SET standard_conforming_strings = on;');
    lines.push('');

    // Get all user-defined tables in public schema
    const { rows: tables } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );

    for (const { tablename } of tables) {
      lines.push(`-- ─────────────────────────────────────────`);
      lines.push(`-- Table: ${tablename}`);
      lines.push(`-- ─────────────────────────────────────────`);

      // Get column info
      const { rows: cols } = await pool.query<{
        column_name: string;
        data_type: string;
        character_maximum_length: number | null;
        is_nullable: string;
        column_default: string | null;
      }>(
        `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tablename]
      );

      // Build CREATE TABLE
      const colDefs = cols.map(c => {
        let type = c.data_type.toUpperCase();
        if (c.character_maximum_length) type += `(${c.character_maximum_length})`;
        let def = `  "${c.column_name}" ${type}`;
        if (c.column_default) def += ` DEFAULT ${c.column_default}`;
        if (c.is_nullable === 'NO') def += ' NOT NULL';
        return def;
      });

      // Get primary key constraints
      const { rows: pks } = await pool.query<{ column_name: string }>(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = 'public'
           AND tc.table_name = $1
         ORDER BY kcu.ordinal_position`,
        [tablename]
      );
      if (pks.length > 0) {
        const pkCols = pks.map(p => `"${p.column_name}"`).join(', ');
        colDefs.push(`  PRIMARY KEY (${pkCols})`);
      }

      lines.push(`CREATE TABLE IF NOT EXISTS "${tablename}" (`);
      lines.push(colDefs.join(',\n'));
      lines.push(');');
      lines.push('');

      // Get all rows
      const { rows: dataRows, fields } = await pool.query(`SELECT * FROM "${tablename}"`);

      if (dataRows.length > 0) {
        const colNames = fields.map(f => `"${f.name}"`).join(', ');
        lines.push(`-- Data for table: ${tablename}`);

        for (const row of dataRows) {
          const values = fields.map(f => {
            const val = row[f.name];
            if (val === null || val === undefined) return 'NULL';
            // Binary / Buffer (e.g. logo images stored as bytea)
            if (Buffer.isBuffer(val)) {
              return `'\\x${val.toString('hex')}'`;
            }
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'number') return String(val);
            if (val instanceof Date) return `'${val.toISOString()}'`;
            // Escape single quotes
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          lines.push(`INSERT INTO "${tablename}" (${colNames}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`);
        }
        lines.push('');
      }
    }

    // Sequences: reset all sequences to the current max value so auto-increment works correctly
    lines.push('-- ─────────────────────────────────────────');
    lines.push('-- Reset sequences');
    lines.push('-- ─────────────────────────────────────────');
    const { rows: seqs } = await pool.query<{ sequence_name: string; table_name: string; column_name: string }>(
      `SELECT s.sequence_name,
              t.table_name,
              c.column_name
       FROM information_schema.sequences s
       JOIN information_schema.columns c
         ON c.column_default LIKE '%' || s.sequence_name || '%'
       JOIN information_schema.tables t
         ON t.table_name = c.table_name AND t.table_schema = 'public'
       WHERE s.sequence_schema = 'public'`
    );
    for (const { sequence_name, table_name, column_name } of seqs) {
      lines.push(`SELECT setval('${sequence_name}', COALESCE((SELECT MAX("${column_name}") FROM "${table_name}"), 1));`);
    }
    lines.push('');

    const sql = lines.join('\n');

    const filename = `db-export-${new Date().toISOString().slice(0, 10)}.sql`;
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(sql);
  } catch (err) {
    console.error('SQL export error:', err);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

export default router;
