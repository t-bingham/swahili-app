// The Korean alphabet (한글). A finite, rule-based dataset — no LLM generation, no
// content-quality risk. Romanization follows the Revised Romanization of Korean.
//
// 19 consonants (14 basic + 5 tense "double") and 21 vowels (10 basic + 11 compound) = 40 jamo.

export type JamoType = 'consonant' | 'vowel';
export type JamoGroup = 'basic-consonant' | 'double-consonant' | 'basic-vowel' | 'compound-vowel';

export interface Jamo {
  char: string;    // the letter
  rom: string;     // Revised Romanization
  type: JamoType;
  group: JamoGroup;
  sound: string;   // hint for an English speaker
  example: string; // a syllable/word that uses it
}

export const HANGUL: Jamo[] = [
  // ── Basic consonants (자음) ──────────────────────────────────────────────
  { char: 'ㄱ', rom: 'g',  type: 'consonant', group: 'basic-consonant', sound: 'soft "g" as in "gun" (k at the end of a syllable)', example: '가 (ga)' },
  { char: 'ㄴ', rom: 'n',  type: 'consonant', group: 'basic-consonant', sound: '"n" as in "no"', example: '나 (na) — I/me' },
  { char: 'ㄷ', rom: 'd',  type: 'consonant', group: 'basic-consonant', sound: 'soft "d" as in "do" (t at the end)', example: '다 (da)' },
  { char: 'ㄹ', rom: 'r',  type: 'consonant', group: 'basic-consonant', sound: 'between "r" and "l"', example: '라 (ra)' },
  { char: 'ㅁ', rom: 'm',  type: 'consonant', group: 'basic-consonant', sound: '"m" as in "mom"', example: '마 (ma)' },
  { char: 'ㅂ', rom: 'b',  type: 'consonant', group: 'basic-consonant', sound: 'soft "b" as in "boy" (p at the end)', example: '바 (ba)' },
  { char: 'ㅅ', rom: 's',  type: 'consonant', group: 'basic-consonant', sound: '"s" as in "see"', example: '사 (sa) — four' },
  { char: 'ㅇ', rom: 'ng', type: 'consonant', group: 'basic-consonant', sound: 'silent at the start of a syllable; "ng" at the end', example: '아 (a) — silent here' },
  { char: 'ㅈ', rom: 'j',  type: 'consonant', group: 'basic-consonant', sound: '"j" as in "jam"', example: '자 (ja)' },
  { char: 'ㅊ', rom: 'ch', type: 'consonant', group: 'basic-consonant', sound: 'aspirated "ch" as in "church"', example: '차 (cha) — car/tea' },
  { char: 'ㅋ', rom: 'k',  type: 'consonant', group: 'basic-consonant', sound: 'aspirated "k" (a puff of air)', example: '카 (ka)' },
  { char: 'ㅌ', rom: 't',  type: 'consonant', group: 'basic-consonant', sound: 'aspirated "t" (a puff of air)', example: '타 (ta)' },
  { char: 'ㅍ', rom: 'p',  type: 'consonant', group: 'basic-consonant', sound: 'aspirated "p" (a puff of air)', example: '파 (pa) — green onion' },
  { char: 'ㅎ', rom: 'h',  type: 'consonant', group: 'basic-consonant', sound: '"h" as in "hat"', example: '하 (ha)' },

  // ── Tense "double" consonants (쌍자음) ───────────────────────────────────
  { char: 'ㄲ', rom: 'kk', type: 'consonant', group: 'double-consonant', sound: 'tense "g/k" — sharp, no air', example: '까 (kka)' },
  { char: 'ㄸ', rom: 'tt', type: 'consonant', group: 'double-consonant', sound: 'tense "d/t" — sharp, no air', example: '따 (tta)' },
  { char: 'ㅃ', rom: 'pp', type: 'consonant', group: 'double-consonant', sound: 'tense "b/p" — sharp, no air', example: '빠 (ppa)' },
  { char: 'ㅆ', rom: 'ss', type: 'consonant', group: 'double-consonant', sound: 'tense "s" — sharp', example: '싸 (ssa) — cheap' },
  { char: 'ㅉ', rom: 'jj', type: 'consonant', group: 'double-consonant', sound: 'tense "j" — sharp', example: '짜 (jja) — salty' },

  // ── Basic vowels (모음) ──────────────────────────────────────────────────
  { char: 'ㅏ', rom: 'a',   type: 'vowel', group: 'basic-vowel', sound: '"a" as in "father"', example: '아 (a)' },
  { char: 'ㅑ', rom: 'ya',  type: 'vowel', group: 'basic-vowel', sound: '"ya" as in "yard"', example: '야 (ya)' },
  { char: 'ㅓ', rom: 'eo',  type: 'vowel', group: 'basic-vowel', sound: '"u" as in "but"', example: '어 (eo)' },
  { char: 'ㅕ', rom: 'yeo', type: 'vowel', group: 'basic-vowel', sound: '"yu" as in "young"', example: '여 (yeo)' },
  { char: 'ㅗ', rom: 'o',   type: 'vowel', group: 'basic-vowel', sound: '"o" as in "go"', example: '오 (o) — five' },
  { char: 'ㅛ', rom: 'yo',  type: 'vowel', group: 'basic-vowel', sound: '"yo" as in "yoga"', example: '요 (yo)' },
  { char: 'ㅜ', rom: 'u',   type: 'vowel', group: 'basic-vowel', sound: '"oo" as in "moon"', example: '우 (u)' },
  { char: 'ㅠ', rom: 'yu',  type: 'vowel', group: 'basic-vowel', sound: '"you"', example: '유 (yu)' },
  { char: 'ㅡ', rom: 'eu',  type: 'vowel', group: 'basic-vowel', sound: '"u" as in "put", lips unrounded', example: '으 (eu)' },
  { char: 'ㅣ', rom: 'i',   type: 'vowel', group: 'basic-vowel', sound: '"ee" as in "see"', example: '이 (i) — two/tooth' },

  // ── Compound vowels (이중모음) ───────────────────────────────────────────
  { char: 'ㅐ', rom: 'ae',  type: 'vowel', group: 'compound-vowel', sound: '"e" as in "bed"', example: '애 (ae)' },
  { char: 'ㅒ', rom: 'yae', type: 'vowel', group: 'compound-vowel', sound: '"ya" as in "yam"', example: '얘 (yae)' },
  { char: 'ㅔ', rom: 'e',   type: 'vowel', group: 'compound-vowel', sound: '"e" as in "bed" (near-identical to ㅐ)', example: '에 (e) — to/at' },
  { char: 'ㅖ', rom: 'ye',  type: 'vowel', group: 'compound-vowel', sound: '"ye" as in "yes"', example: '예 (ye) — yes' },
  { char: 'ㅘ', rom: 'wa',  type: 'vowel', group: 'compound-vowel', sound: '"wa" as in "wand"', example: '와 (wa) — and/with' },
  { char: 'ㅙ', rom: 'wae', type: 'vowel', group: 'compound-vowel', sound: '"wa" as in "wax"', example: '왜 (wae) — why' },
  { char: 'ㅚ', rom: 'oe',  type: 'vowel', group: 'compound-vowel', sound: '"we" as in "wet"', example: '외 (oe)' },
  { char: 'ㅝ', rom: 'wo',  type: 'vowel', group: 'compound-vowel', sound: '"wo" as in "won"', example: '워 (wo)' },
  { char: 'ㅞ', rom: 'we',  type: 'vowel', group: 'compound-vowel', sound: '"we" as in "wet"', example: '웨 (we)' },
  { char: 'ㅟ', rom: 'wi',  type: 'vowel', group: 'compound-vowel', sound: '"we" as in "week"', example: '위 (wi) — above' },
  { char: 'ㅢ', rom: 'ui',  type: 'vowel', group: 'compound-vowel', sound: '"eu" + "i" glided together', example: '의 (ui) — of' },
];

export const CONSONANTS = HANGUL.filter(j => j.type === 'consonant');
export const VOWELS = HANGUL.filter(j => j.type === 'vowel');

export type HangulSet = 'consonants' | 'vowels' | 'all';

export function jamoFor(set: HangulSet): Jamo[] {
  if (set === 'consonants') return CONSONANTS;
  if (set === 'vowels') return VOWELS;
  return HANGUL;
}
