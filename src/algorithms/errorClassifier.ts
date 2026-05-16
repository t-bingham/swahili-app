export type ErrorType = 'phonological' | 'semantic' | 'structural';

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

// For slash-separated english fields, return the closest alternative to `given`
function closestAlternative(correct: string, given: string): string {
  const alts = correct.split(/\s*\/\s*|\s*,\s*/);
  if (alts.length === 1) return norm(correct);
  const normGiven = norm(given);
  return alts
    .map(a => norm(a))
    .reduce((best, alt) =>
      levenshtein(alt, normGiven) < levenshtein(best, normGiven) ? alt : best
    );
}

export function classifyError(
  correct: string,
  given: string,
  cardType: string,
): ErrorType {
  if (!given.trim()) return 'semantic';

  const normGiven = norm(given);
  const normCorrect = closestAlternative(correct, given);

  const maxLen = Math.max(normCorrect.length, normGiven.length, 1);
  const dist = levenshtein(normCorrect, normGiven);

  // Phonological: similar spelling/sound (≤40% edit distance)
  if (dist / maxLen <= 0.4) return 'phonological';

  // Structural: conjugation or grammar card where they had the right root but wrong affix
  if (cardType === 'conjugation' || cardType === 'grammar') {
    const correctTokens = normCorrect.split(/\s+/);
    const givenTokens = normGiven.split(/\s+/);
    const sharesRoot = correctTokens.some(ct =>
      givenTokens.some(gt => ct.length >= 3 && gt.length >= 3 && (ct.includes(gt.slice(1)) || gt.includes(ct.slice(1))))
    );
    if (sharesRoot) return 'structural';
  }

  return 'semantic';
}
