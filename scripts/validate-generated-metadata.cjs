const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const ROOT = path.resolve(__dirname, '..');

const DB_CHECKS = [
  {
    language: 'ko',
    file: path.join(ROOT, 'public', 'korean_default.db'),
    generatedKeyPrefix: 'ko:',
    requiredGeneratedTags: ['grammar:conjugation', 'grammar:tense'],
  },
  {
    language: 'mi',
    file: path.join(ROOT, 'public', 'maori_default.db'),
    generatedKeyPrefix: 'mi:',
    requiredGeneratedTags: ['grammar:tense'],
  },
];

function cell(row, cols, name) {
  return row[cols.indexOf(name)];
}

async function main() {
  const SQL = await initSqlJs();
  const failures = [];

  for (const check of DB_CHECKS) {
    const db = new SQL.Database(fs.readFileSync(check.file));
    const res = db.exec(`
      SELECT id, tags, conjugation_key
      FROM cards
      WHERE source = 'generated'
    `)[0];
    if (!res) {
      failures.push(`${check.language}: no generated cards found`);
      continue;
    }
    for (const row of res.values) {
      const id = String(cell(row, res.columns, 'id'));
      const key = String(cell(row, res.columns, 'conjugation_key') ?? '');
      const tags = JSON.parse(String(cell(row, res.columns, 'tags') || '[]'));
      if (!key.startsWith(check.generatedKeyPrefix)) {
        failures.push(`${check.language}:${id}: conjugation_key must start with ${check.generatedKeyPrefix}`);
      }
      for (const tag of check.requiredGeneratedTags) {
        if (!tags.includes(tag)) failures.push(`${check.language}:${id}: missing tag ${tag}`);
      }
    }
    db.close();
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log('Generated metadata validation passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
