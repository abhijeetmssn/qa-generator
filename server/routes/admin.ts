import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware';
import pool from '../pool';
import { getLockedUsers, unlockUser, lockUser, getAllUsers } from '../db';

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
    lines.push("SET client_encoding = 'UTF8';");
    lines.push('SET standard_conforming_strings = on;');
    lines.push('');

    // 1. Emit CREATE SEQUENCE before tables
    const { rows: allSeqs } = await pool.query<{
      sequence_name: string;
      data_type: string;
      start_value: string;
      increment: string;
      min_value: string;
      max_value: string;
      cycle_option: string;
    }>(
      `SELECT sequence_name, data_type, start_value, increment, minimum_value AS min_value,
              maximum_value AS max_value, cycle_option
       FROM information_schema.sequences WHERE sequence_schema = 'public'`
    );

    if (allSeqs.length > 0) {
      lines.push('-- Sequences');
      for (const s of allSeqs) {
        lines.push(`CREATE SEQUENCE IF NOT EXISTS "${s.sequence_name}"`);
        lines.push(`  AS ${s.data_type}`);
        lines.push(`  START WITH ${s.start_value}`);
        lines.push(`  INCREMENT BY ${s.increment}`);
        lines.push(`  MINVALUE ${s.min_value}`);
        lines.push(`  MAXVALUE ${s.max_value}`);
        lines.push(`  ${s.cycle_option === 'YES' ? 'CYCLE' : 'NO CYCLE'};`);
        lines.push('');
      }
    }

    // 2. Tables + data
    const { rows: tables } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );

    for (const { tablename } of tables) {
      lines.push(`-- Table: ${tablename}`);

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

      const colDefs = cols.map(c => {
        const isSerial =
          c.column_default?.startsWith('nextval(') &&
          (c.data_type === 'integer' || c.data_type === 'bigint');
        let type: string;
        if (isSerial) {
          type = c.data_type === 'bigint' ? 'BIGSERIAL' : 'SERIAL';
        } else {
          type = c.data_type.toUpperCase();
          if (c.character_maximum_length) type += `(${c.character_maximum_length})`;
        }
        let def = `  "${c.column_name}" ${type}`;
        if (!isSerial && c.column_default !== null) def += ` DEFAULT ${c.column_default}`;
        if (c.is_nullable === 'NO') def += ' NOT NULL';
        return def;
      });

      const { rows: pks } = await pool.query<{ column_name: string }>(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = 'public' AND tc.table_name = $1
         ORDER BY kcu.ordinal_position`,
        [tablename]
      );
      if (pks.length > 0) {
        colDefs.push(`  PRIMARY KEY (${pks.map(p => `"${p.column_name}"`).join(', ')})`);
      }

      lines.push(`CREATE TABLE IF NOT EXISTS "${tablename}" (`);
      lines.push(colDefs.join(',\n'));
      lines.push(');');
      lines.push('');

      const { rows: dataRows, fields } = await pool.query(`SELECT * FROM "${tablename}"`);

      if (dataRows.length > 0) {
        const colNames = fields.map(f => `"${f.name}"`).join(', ');
        lines.push(`-- Data for ${tablename}`);
        for (const row of dataRows) {
          const values = fields.map(f => {
            const val = row[f.name];
            if (val === null || val === undefined) return 'NULL';
            if (Buffer.isBuffer(val)) return `'\\x${val.toString('hex')}'`;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'number') return String(val);
            if (val instanceof Date) return `'${val.toISOString()}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          lines.push(`INSERT INTO "${tablename}" (${colNames}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`);
        }
        lines.push('');
      }
    }

    // 3. Reset sequences
    lines.push('-- Reset sequences');
    const { rows: seqBindings } = await pool.query<{
      seq_name: string;
      table_name: string;
      col_name: string;
    }>(
      `SELECT pg_get_serial_sequence(c.table_name, c.column_name) AS seq_name,
              c.table_name, c.column_name AS col_name
       FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.column_default LIKE 'nextval(%'
         AND pg_get_serial_sequence(c.table_name, c.column_name) IS NOT NULL`
    );
    for (const { seq_name, table_name, col_name } of seqBindings) {
      lines.push(`SELECT setval('${seq_name}', COALESCE((SELECT MAX("${col_name}") FROM "${table_name}"), 1));`);
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

// GET /api/admin/users — list all users (admin only)
router.get('/users', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const decoded = (req as any).user;
    const companyId = decoded?.companyId ? Number(decoded.companyId) : undefined;
    const users = await getAllUsers(companyId);
    res.json({ users });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/:uid/lock — manually lock a user (admin only)
router.post('/users/:uid/lock', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    // get email from uid
    const { rows } = await pool.query('SELECT email FROM users WHERE uid = $1', [uid]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    await lockUser(rows[0].email);
    res.json({ message: 'User locked successfully' });
  } catch (err) {
    console.error('Lock user error:', err);
    res.status(500).json({ error: 'Failed to lock user' });
  }
});

// GET /api/admin/locked-users — list all locked user accounts (admin only)
router.get('/locked-users', authenticateToken, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const users = await getLockedUsers();
    res.json({ users });
  } catch (err) {
    console.error('Get locked users error:', err);
    res.status(500).json({ error: 'Failed to fetch locked users' });
  }
});

// POST /api/admin/users/:uid/unlock — unlock a user account (admin only)
router.post('/users/:uid/unlock', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    await unlockUser(uid);
    res.json({ message: 'User unlocked successfully' });
  } catch (err) {
    console.error('Unlock user error:', err);
    res.status(500).json({ error: 'Failed to unlock user' });
  }
});

export default router;
