import fs from 'node:fs/promises';
import path from 'node:path';
import initSqlJs from '../node_modules/sql.js/dist/sql-asm.js';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const ROOT = path.resolve('.');
const OUTPUT_DIR = path.join(ROOT, 'review');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'curriculum-review.xlsx');

const LANGUAGES = [
  { id: 'sw', name: 'Swahili', file: 'public/swahili_default.db' },
  { id: 'ko', name: 'Korean', file: 'public/korean_default.db' },
  { id: 'mi', name: 'Maori', file: 'public/maori_default.db' },
];

const HEADERS = [
  'language',
  'card_id',
  'unit_id',
  'unit_name',
  'type',
  'source',
  'target_text',
  'english',
  'pronunciation',
  'part_of_speech',
  'register',
  'tags',
  'example_target',
  'example_english',
  'cultural_note',
  'verb_root',
  'conjugation_key',
  'review_status',
  'issue_type',
  'suggested_target',
  'suggested_english',
  'suggested_pronunciation',
  'suggested_note',
  'reviewer',
  'review_notes',
];

const STATUS_VALUES = ['Unreviewed', 'Approved', 'Needs fix', 'Unsure', 'Reject'];
const ISSUE_VALUES = [
  '',
  'Translation',
  'Spelling',
  'Pronunciation',
  'Grammar',
  'Cultural note',
  'Register/formality',
  'Duplicate',
  'Bad example',
  'Other',
];

function colName(n) {
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sqlRows(db, sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((column, index) => {
      obj[column] = row[index];
    });
    return obj;
  });
}

function tableColumns(db, table) {
  return new Set(sqlRows(db, `PRAGMA table_info(${table})`).map(row => row.name));
}

function columnOrNull(columns, alias, tableAlias = 'c') {
  return columns.has(alias) ? `${tableAlias}.${alias}` : `NULL AS ${alias}`;
}

function normalizeRows(language, db) {
  const cardColumns = tableColumns(db, 'cards');
  const rows = sqlRows(db, `
    SELECT
      c.id,
      c.unit_id,
      u.name AS unit_name,
      c.type,
      c.source,
      c.swahili,
      c.english,
      c.pronunciation,
      ${columnOrNull(cardColumns, 'part_of_speech')},
      ${columnOrNull(cardColumns, 'register')},
      c.tags,
      c.example_sentences,
      ${columnOrNull(cardColumns, 'cultural_note')},
      ${columnOrNull(cardColumns, 'verb_root')},
      ${columnOrNull(cardColumns, 'conjugation_key')},
      c.frequency_rank
    FROM cards c
    LEFT JOIN units u ON u.id = c.unit_id
    ORDER BY u.order_index ASC, c.type ASC, c.frequency_rank ASC, c.id ASC
  `);

  return rows.map(row => {
    const tags = safeJsonParse(row.tags, []);
    const examples = safeJsonParse(row.example_sentences, []);
    const firstExample = examples[0] ?? {};
    return [
      language.name,
      row.id,
      row.unit_id,
      row.unit_name ?? '',
      row.type,
      row.source,
      row.swahili,
      row.english,
      row.pronunciation ?? '',
      row.part_of_speech ?? '',
      row.register ?? '',
      Array.isArray(tags) ? tags.join(', ') : '',
      firstExample.swahili ?? '',
      firstExample.english ?? '',
      row.cultural_note ?? '',
      row.verb_root ?? '',
      row.conjugation_key ?? '',
      'Unreviewed',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ];
  });
}

function writeSheet(workbook, sheetName, rows) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(2);
  sheet.showGridLines = false;

  const allRows = [HEADERS, ...rows];
  const lastCol = colName(HEADERS.length);
  sheet.getRangeByIndexes(0, 0, allRows.length, HEADERS.length).values = allRows;

  const used = sheet.getRange(`A1:${lastCol}${allRows.length}`);
  used.format = {
    font: { name: 'Aptos', size: 10 },
    alignment: { vertical: 'top' },
    wrapText: true,
  };
  sheet.getRange(`A1:${lastCol}1`).format = {
    fill: '#1F4E78',
    font: { color: '#FFFFFF', bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  used.format.borders = { preset: 'all', style: 'thin', color: '#D9E2F3' };

  const widths = [
    80, 150, 110, 180, 100, 100, 220, 240, 150, 120, 100, 160, 260,
    260, 340, 150, 150, 120, 150, 220, 240, 180, 260, 140, 320,
  ];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, allRows.length, 1).format.columnWidthPx = width;
  });
  sheet.getRange(`A1:${lastCol}1`).format.rowHeightPx = 34;

  const table = sheet.tables.add(`A1:${lastCol}${allRows.length}`, true, `${sheetName}ReviewTable`);
  table.style = 'TableStyleMedium2';
  table.showFilterButton = true;

  if (rows.length > 0) {
    const firstDataRow = 2;
    const lastDataRow = rows.length + 1;
    sheet.getRange(`R${firstDataRow}:R${lastDataRow}`).dataValidation = {
      rule: { type: 'list', values: STATUS_VALUES },
    };
    sheet.getRange(`S${firstDataRow}:S${lastDataRow}`).dataValidation = {
      rule: { type: 'list', values: ISSUE_VALUES },
    };
    sheet.getRange(`R${firstDataRow}:R${lastDataRow}`).conditionalFormats.add('containsText', {
      text: 'Needs fix',
      format: { fill: '#FCE4D6', font: { color: '#9C0006', bold: true } },
    });
    sheet.getRange(`R${firstDataRow}:R${lastDataRow}`).conditionalFormats.add('containsText', {
      text: 'Approved',
      format: { fill: '#E2F0D9', font: { color: '#375623', bold: true } },
    });
  }

  return sheet;
}

function writeSummary(workbook, summaries) {
  const sheet = workbook.worksheets.add('Summary');
  sheet.showGridLines = false;
  sheet.getRange('A1:H1').merge();
  sheet.getRange('A1').values = [['Curriculum Review Workbook']];
  sheet.getRange('A1').format = {
    fill: '#1F4E78',
    font: { color: '#FFFFFF', bold: true, size: 16 },
    alignment: { horizontal: 'center' },
  };

  sheet.getRange('A3:E3').values = [['Language', 'Units', 'Cards', 'Vocabulary/Phrases', 'Grammar/Patterns']];
  sheet.getRange('A3:E3').format = {
    fill: '#D9EAF7',
    font: { bold: true },
    alignment: { horizontal: 'center' },
  };
  const rows = summaries.map(summary => [
    summary.name,
    summary.units,
    summary.cards,
    summary.vocabulary + summary.phrase,
    summary.grammar + summary.conjugation,
  ]);
  sheet.getRangeByIndexes(3, 0, rows.length, 5).values = rows;
  sheet.getRange(`A3:E${rows.length + 3}`).format.borders = {
    preset: 'all',
    style: 'thin',
    color: '#BFBFBF',
  };

  sheet.getRange('A9:H15').values = [
    ['Review workflow'],
    ['1. Filter a language tab by type, unit, cultural note, or generated content.'],
    ['2. Mark review_status as Approved, Needs fix, Unsure, Reject, or leave Unreviewed.'],
    ['3. Put proposed edits in the suggested_* columns; do not overwrite the source columns.'],
    ['4. Use issue_type for quick triage and review_notes for context.'],
    ['5. Later, corrections can be imported back into the seed scripts or an in-app review queue.'],
    [''],
  ];
  sheet.getRange('A9:H9').merge();
  sheet.getRange('A10:H15').merge(true);
  sheet.getRange('A9:H15').format = {
    fill: '#F8F9FA',
    font: { size: 11 },
    wrapText: true,
    alignment: { vertical: 'top' },
  };
  sheet.getRange('A9').format.font = { bold: true, size: 13 };
  sheet.getRange('A:H').format.columnWidthPx = 150;
}

const SQL = await initSqlJs();
const workbook = Workbook.create();
const summaries = [];

for (const language of LANGUAGES) {
  const dbPath = path.join(ROOT, language.file);
  const db = new SQL.Database(await fs.readFile(dbPath));
  const rows = normalizeRows(language, db);
  const counts = Object.fromEntries(
    sqlRows(db, 'SELECT type, COUNT(*) AS count FROM cards GROUP BY type')
      .map(row => [row.type, row.count]),
  );
  summaries.push({
    name: language.name,
    units: sqlRows(db, 'SELECT COUNT(*) AS count FROM units')[0].count,
    cards: rows.length,
    vocabulary: counts.vocabulary ?? 0,
    phrase: counts.phrase ?? 0,
    grammar: counts.grammar ?? 0,
    conjugation: counts.conjugation ?? 0,
  });
  writeSheet(workbook, language.name, rows);
  db.close();
}

writeSummary(workbook, summaries);

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(OUTPUT_FILE);
console.log(OUTPUT_FILE);
