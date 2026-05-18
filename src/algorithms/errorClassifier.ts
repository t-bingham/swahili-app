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

// ---------------------------------------------------------------------------
// Morpheme parser
// ---------------------------------------------------------------------------

// Subject prefixes ordered longest-first to avoid greedy mismatch (e.g. "wa" before "w")
const SUBJECT_PREFIXES = ['si', 'hu', 'ha', 'tu', 'wa', 'ni', 'u', 'a', 'm'];
// Tense markers ordered longest-first
const TENSE_MARKERS = ['me', 'na', 'li', 'ta', 'ki', 'ka', 'ja'];
// Object infixes (3SG is most common; kept minimal to avoid over-stripping)
const OBJ_INFIXES = ['ni', 'ku', 'mu', 'tu', 'wa', 'ki', 'vi', 'i', 'zi', 'u', 'li', 'ya', 'lo'];

interface MorphemeSlots {
  subjectPrefix: string;
  tenseMarker: string;
  objInfix: string;
  root: string;
}

function parseMorphemes(word: string): MorphemeSlots | null {
  let rest = word.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (rest.length < 3) return null;

  // 1. Strip subject prefix
  let subjectPrefix = '';
  for (const pfx of SUBJECT_PREFIXES) {
    if (rest.startsWith(pfx) && rest.length > pfx.length) {
      subjectPrefix = pfx;
      rest = rest.slice(pfx.length);
      break;
    }
  }
  if (!subjectPrefix) return null; // can't parse without a recognized subject prefix

  // 2. Strip tense marker
  let tenseMarker = '';
  for (const tm of TENSE_MARKERS) {
    if (rest.startsWith(tm) && rest.length > tm.length) {
      tenseMarker = tm;
      rest = rest.slice(tm.length);
      break;
    }
  }
  if (!tenseMarker) return null; // can't parse without a recognized tense marker

  // 3. Optionally strip object infix (only when root would still be ≥3 chars)
  let objInfix = '';
  for (const inf of OBJ_INFIXES) {
    if (rest.startsWith(inf) && rest.length - inf.length >= 3) {
      objInfix = inf;
      rest = rest.slice(inf.length);
      break;
    }
  }

  // 4. Whatever remains is root + final vowel; strip the final vowel (a/e/i/o/u)
  // Keep at least 2 chars as the root (monosyllabic roots like "ja" exist)
  let root = rest;
  if (root.length > 2 && /[aeiou]$/.test(root)) {
    root = root.slice(0, -1);
  }

  if (root.length < 2) return null;

  return { subjectPrefix, tenseMarker, objInfix, root };
}

// ---------------------------------------------------------------------------
// Morpheme-aware classification for conjugation cards
// ---------------------------------------------------------------------------

function classifyConjugationError(correctSwahili: string, wrongAnswer: string): ErrorType | null {
  const normCorrect = norm(correctSwahili);
  const normWrong   = norm(wrongAnswer);

  // Quick check: very close overall → phonological
  const dist = levenshtein(normCorrect, normWrong);
  const maxLen = Math.max(normCorrect.length, normWrong.length, 1);
  if (dist <= 2) return 'phonological';

  const correctSlots = parseMorphemes(normCorrect);
  const wrongSlots   = parseMorphemes(normWrong);

  if (!correctSlots || !wrongSlots) return null; // fall back to generic logic

  const rootDist = levenshtein(correctSlots.root, wrongSlots.root);
  const rootMaxLen = Math.max(correctSlots.root.length, wrongSlots.root.length, 1);
  const rootSimilar = rootDist / rootMaxLen <= 0.35;

  if (rootSimilar) {
    // Root is essentially the same — error is in the grammatical affixes
    return 'structural';
  }

  // Root is different — learner chose the wrong word entirely
  return 'semantic';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function classifyError(
  correct: string,
  given: string,
  cardType: string,
  correctSwahili?: string,
): ErrorType {
  if (!given.trim()) return 'semantic';

  // Morpheme-aware path for conjugation cards when we have the correct Swahili form
  if ((cardType === 'conjugation') && correctSwahili) {
    const morphemeResult = classifyConjugationError(correctSwahili, given);
    if (morphemeResult !== null) return morphemeResult;
    // fall through to generic logic if parsing failed
  }

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
