import { normalize as norm } from '../utils/normalize';
import type { CardWithState, ErrorType } from '../types';

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function closestAlternative(correct: string, given: string): string {
  const alts = correct.split(/\s*\/\s*|\s*,\s*/);
  if (alts.length === 1) return norm(correct);
  const normGiven = norm(given);
  return alts
    .map(a => norm(a))
    .reduce((best, alt) =>
      levenshtein(alt, normGiven) < levenshtein(best, normGiven) ? alt : best,
    );
}

export function normalizedEditRatio(correct: string, given: string): number {
  const normCorrect = norm(correct);
  const normGiven = norm(given);
  return levenshtein(normCorrect, normGiven) / Math.max(normCorrect.length, normGiven.length, 1);
}

export function genericClassifyError(card: CardWithState, given: string): ErrorType {
  if (!given.trim()) return 'semantic';

  const targets = [card.english, card.swahili];
  if (card.senses) targets.push(...card.senses.map(s => s.english));

  const closest = targets
    .map(target => closestAlternative(target, given))
    .sort((a, b) => normalizedEditRatio(a, given) - normalizedEditRatio(b, given))[0] ?? card.english;

  const normGiven = norm(given);
  const normCorrect = norm(closest);
  const distRatio = levenshtein(normCorrect, normGiven) / Math.max(normCorrect.length, normGiven.length, 1);
  if (distRatio <= 0.4) return 'phonological';

  if (card.type === 'conjugation' || card.type === 'grammar') {
    const correctTokens = normCorrect.split(/\s+/);
    const givenTokens = normGiven.split(/\s+/);
    const sharesRoot = correctTokens.some(ct =>
      givenTokens.some(gt => ct.length >= 3 && gt.length >= 3 && (ct.includes(gt.slice(1)) || gt.includes(ct.slice(1)))),
    );
    if (sharesRoot) return 'structural';
  }

  return 'semantic';
}
