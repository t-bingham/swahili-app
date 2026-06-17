import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

const root = process.cwd();

describe('database regression checks', () => {
  it('migration source does not write to obsolete cards.en column', () => {
    const source = [
      fs.readFileSync(path.join(root, 'src/database/db.ts'), 'utf8'),
      fs.readFileSync(path.join(root, 'src/database/migrations.ts'), 'utf8'),
    ].join('\n');

    expect(source).not.toContain('SET en =');
    expect(source).toMatch(/UPDATE cards SET english = \?/);
  });

  it('migration source tracks the legacy migration bundle', () => {
    const source = fs.readFileSync(path.join(root, 'src/database/migrations.ts'), 'utf8');

    expect(source).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
    expect(source).toContain('function runLegacyMigration');
    expect(source).toContain("{ version: 1, languages: ['sw'], run: runLegacyMigration }");
    expect(source).toContain('{ version: 2, languages: [\'sw\'], run: (db) => fixGrammarContent(db) }');
    expect(source).toContain('{ version: 3, run: createReviewNotesTable }');
    expect(source).toContain('{ version: 4, run: createCurriculumInstallTables }');
    expect(source).toContain('current < m.version');
    expect(source).toContain('setMigrationVersion(db, target)');
  });

  it('migration source keeps Swahili content migrations language scoped', () => {
    const source = fs.readFileSync(path.join(root, 'src/database/migrations.ts'), 'utf8');

    expect(source).toContain('languages?: string[]');
    expect(source).toContain("languages.includes(lang)");
    expect(source).toContain("runMigrations(db: Database, lang: string = 'sw')");
  });

  it('database source supports curriculum review notes', () => {
    const migrationSource = fs.readFileSync(path.join(root, 'src/database/migrations.ts'), 'utf8');
    const dbSource = fs.readFileSync(path.join(root, 'src/database/db.ts'), 'utf8');

    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS review_notes');
    expect(migrationSource).toContain('idx_review_notes_card');
    expect(dbSource).toContain('saveReviewNote');
    expect(dbSource).toContain('getReviewNotesForCard');
    expect(dbSource).toContain('exportReviewNotes');
    expect(dbSource).toContain("_mergeAppendOnly(_db, remoteDb, 'review_notes')");
  });

  it('database source tracks installed curriculum and local progress changes', () => {
    const languageSource = fs.readFileSync(path.join(root, 'src/data/languages.ts'), 'utf8');
    const migrationSource = fs.readFileSync(path.join(root, 'src/database/migrations.ts'), 'utf8');
    const dbSource = fs.readFileSync(path.join(root, 'src/database/db.ts'), 'utf8');

    expect(languageSource).toContain('curriculumVersion: number');
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS curriculum_packages');
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS curriculum_unit_versions');
    expect(dbSource).toContain('ensureCurriculumInstallMetadata(lang)');
    expect(dbSource).toContain('getCurriculumPackageInstall');
    expect(dbSource).toContain('getInstalledCurriculumUnits');
    expect(dbSource).toContain('exportLocalProgressChanges');
  });

  it('app source routes sync through a provider boundary', () => {
    const syncSource = fs.readFileSync(path.join(root, 'src/sync/syncService.ts'), 'utf8');
    const layoutSource = fs.readFileSync(path.join(root, 'src/components/Layout.tsx'), 'utf8');
    const learnSource = fs.readFileSync(path.join(root, 'src/screens/LearnScreen.tsx'), 'utf8');
    const settingsSource = fs.readFileSync(path.join(root, 'src/screens/SettingsScreen.tsx'), 'utf8');
    const pickerSource = fs.readFileSync(path.join(root, 'src/screens/UserPickerScreen.tsx'), 'utf8');

    expect(syncSource).toContain('interface SyncProvider');
    expect(syncSource).toContain('getActiveSyncProvider');
    expect(syncSource).toContain('FUTURE_CONVEX_COLLECTIONS');
    expect(layoutSource).toContain('../sync/syncService');
    expect(learnSource).toContain('../sync/syncService');
    expect(settingsSource).toContain('../sync/syncService');
    expect(pickerSource).toContain('../sync/syncService');
    expect(layoutSource).not.toContain('../sync/driveSync');
    expect(learnSource).not.toContain('../sync/driveSync');
    expect(settingsSource).not.toContain('../sync/driveSync');
    expect(pickerSource).not.toContain('../sync/driveSync');
  });

  it('browser-specific file and speech APIs stay behind platform wrappers', () => {
    const fileExportSource = fs.readFileSync(path.join(root, 'src/platform/fileExport.ts'), 'utf8');
    const speechSource = fs.readFileSync(path.join(root, 'src/platform/speech.ts'), 'utf8');
    const gallerySource = fs.readFileSync(path.join(root, 'src/screens/CardGalleryScreen.tsx'), 'utf8');
    const reviewSource = fs.readFileSync(path.join(root, 'src/screens/ReviewScreen.tsx'), 'utf8');
    const speakButtonSource = fs.readFileSync(path.join(root, 'src/components/SpeakButton.tsx'), 'utf8');

    expect(fileExportSource).toContain('URL.createObjectURL');
    expect(speechSource).toContain('speechSynthesis');
    expect(gallerySource).toContain('../platform/fileExport');
    expect(reviewSource).toContain('../platform/fileExport');
    expect(speakButtonSource).toContain('../platform/speech');
    expect(gallerySource).not.toContain('URL.createObjectURL');
    expect(reviewSource).not.toContain('URL.createObjectURL');
    expect(speakButtonSource).not.toContain('window.speechSynthesis');
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
