import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import ts from 'typescript';
import { googleUsername } from '../src/auth/profileIdentity';
import { lessonPassed } from '../src/utils/lessons';
import { mergedStar, remoteStateWins } from '../src/database/mergePolicy';
import { makeCard } from './factories';

function dateResult(zone: string, expression: string): unknown {
  const source = fs.readFileSync('src/utils/localDate.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  return JSON.parse(execFileSync(process.execPath, ['-e', js + '\nconsole.log(JSON.stringify(' + expression + '))'], {
    env: { ...process.env, TZ: zone }, encoding: 'utf8',
  }));
}

describe('identity and local calendar boundaries', () => {
  it('keeps domains and punctuation distinct while normalizing email casing', () => {
    const identities = ['alex@example.com', 'alex@another.example', 'a.lex@example.com', 'a_lex@example.com'];
    expect(new Set(identities.map(email => googleUsername({ email }))).size).toBe(identities.length);
    expect(googleUsername({ email: ' ALEX@example.com ' })).toBe(googleUsername({ email: identities[0] }));
  });

  it('uses the local date across UTC midnight in Auckland', () => {
    expect(dateResult('Pacific/Auckland', "exports.localDateKey(new Date('2026-09-22T13:30:00Z'))")).toBe('2026-09-23');
    expect(dateResult('Pacific/Auckland', "exports.localDayBounds(new Date('2026-09-22T13:30:00Z'))")).toEqual(['2026-09-22T12:00:00.000Z', '2026-09-23T12:00:00.000Z']);
  });

  it('handles both short and long daylight-saving days', () => {
    const hours = (date: string) => dateResult('America/New_York',
      "((bounds) => (Date.parse(bounds[1])-Date.parse(bounds[0]))/3600000)(exports.localDayBounds(new Date('" + date + "')))");
    expect(hours('2026-03-08T12:00:00Z')).toBe(23);
    expect(hours('2026-11-01T12:00:00Z')).toBe(25);
  });
});

describe('lesson grading', () => {
  const cards = [makeCard({ id: 'blank', type: 'grammar', swahili: 'Mimi ___ hapa.' }), makeCard({ id: 'word' })];
  it('requires every unique card to receive a correct result', () => {
    expect(lessonPassed(cards, [])).toBe(false);
    expect(lessonPassed(cards, [{ card: cards[1], correct: true }])).toBe(false);
    expect(lessonPassed(cards, [{ card: cards[1], correct: true }, { card: cards[1], correct: true }])).toBe(false);
    expect(lessonPassed(cards, cards.map(card => ({ card, correct: true })))).toBe(true);
    expect(lessonPassed(cards, cards.map(card => ({ card, correct: card.id !== 'blank' })))).toBe(false);
    expect(lessonPassed([], [])).toBe(false);
  });
});

describe('deterministic conflict resolution', () => {
  it('uses a later review even if it came from a less-used device', () => {
    expect(remoteStateWins({ last_review: '2026-09-01', review_count: 20 }, { last_review: '2026-09-02', review_count: 3 })).toBe(true);
  });

  it('breaks equal review-count ties consistently in either merge direction', () => {
    const a = { last_review: '2026-09-01', review_count: 2, stability: 10 };
    const b = { ...a, stability: 12 };
    expect(remoteStateWins(a, b)).not.toBe(remoteStateWins(b, a));
    expect(remoteStateWins(a, a)).toBe(false);
  });

  it('does not resurrect a legacy star after an explicit unstar', () => {
    const unstar = { starred: 0, starred_updated_at: '2026-09-01', starred_change_id: 'a' };
    expect(mergedStar(unstar, { starred: 1 })[0]).toBe(0);
    expect(mergedStar({ starred: 1 }, unstar)[0]).toBe(0);
  });

  it('orders equal-time star edits by their change ID', () => {
    const a = { starred: 1, starred_updated_at: '2026-09-01', starred_change_id: 'a' };
    const b = { starred: 0, starred_updated_at: '2026-09-01', starred_change_id: 'b' };
    expect(mergedStar(a, b)).toEqual(mergedStar(b, a));
    expect(mergedStar(a, b)[0]).toBe(0);
  });
});
