import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

const root = process.cwd();

describe('database regression checks', () => {
  it('migration source does not write to obsolete cards.en column', () => {
    const source = fs.readFileSync(path.join(root, 'src/database/db.ts'), 'utf8');

    expect(source).not.toContain('SET en =');
    expect(source).toMatch(/UPDATE cards SET english = \?/);
  });

  it('migration source tracks the legacy migration bundle', () => {
    const source = fs.readFileSync(path.join(root, 'src/database/db.ts'), 'utf8');

    expect(source).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
    expect(source).toContain('LEGACY_MIGRATION_VERSION');
    expect(source).toContain('getMigrationVersion(_db) < LEGACY_MIGRATION_VERSION');
  });

  it('gallery source exposes and handles the New filter', () => {
    const gallerySource = fs.readFileSync(path.join(root, 'src/screens/CardGalleryScreen.tsx'), 'utf8');
    const dbSource = fs.readFileSync(path.join(root, 'src/database/db.ts'), 'utf8');

    expect(gallerySource).toContain("value: 'new'");
    expect(dbSource).toContain("statusFilter === 'new'");
    expect(dbSource).toContain('cs.depth_level = 1');
  });

  it('bundled seed database uses cards.english and contains the curriculum', async () => {
    const SQL = await initSqlJs({ locateFile: () => path.join(root, 'public/sql-wasm.wasm') });
    const dbBytes = fs.readFileSync(path.join(root, 'public/swahili_default.db'));
    const db = new SQL.Database(dbBytes);

    try {
      const columns = db.exec('PRAGMA table_info(cards)')[0].values.map(row => row[1]);
      expect(columns).toContain('english');
      expect(columns).not.toContain('en');

      db.run("UPDATE cards SET english = english WHERE id IN (SELECT id FROM cards LIMIT 1)");

      const cardCount = db.exec('SELECT COUNT(*) FROM cards')[0].values[0][0] as number;
      const unitCount = db.exec('SELECT COUNT(*) FROM units')[0].values[0][0] as number;

      expect(cardCount).toBeGreaterThan(1000);
      expect(unitCount).toBeGreaterThan(10);
    } finally {
      db.close();
    }
  });
});
