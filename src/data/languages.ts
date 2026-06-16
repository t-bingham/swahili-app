// Multi-language registry. Pure data + feature flags — no behaviour change to the
// existing Swahili flows until later stages wire language selection into the DB layer.
// Each language declares the grammar features it has so exercise selection can be made
// language-aware (Stage 4): Swahili uses noun-class/concord; Korean uses honorifics/Hangul.

export type Script = 'latin' | 'hangul';

export interface LanguageFeatures {
  nounClass?: boolean;
  concord?: boolean;
  honorifics?: boolean;
  hangul?: boolean;
  tenseParticles?: boolean;   // Te reo: tense is marked by pre-verb particles
  macrons?: boolean;          // Te reo: long vowels written with macrons (ā ē ī ō ū)
}

export interface LanguageConfig {
  id: string;          // BCP-47-ish short id: 'sw', 'ko'
  name: string;        // English display name
  nativeName: string;  // endonym
  flag: string;
  script: Script;
  templateDb: string;  // public path to the seed DB (Korean's not built yet)
  available: boolean;  // is a learnable curriculum ready?
  features: LanguageFeatures;
}

export const LANGUAGES: Record<string, LanguageConfig> = {
  sw: {
    id: 'sw',
    name: 'Swahili',
    nativeName: 'Kiswahili',
    flag: '🇹🇿',
    script: 'latin',
    templateDb: '/swahili_default.db',
    available: true,
    features: { nounClass: true, concord: true },
  },
  ko: {
    id: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    script: 'hangul',
    templateDb: '/korean_default.db',
    available: true,
    features: { honorifics: true, hangul: true },
  },
  mi: {
    id: 'mi',
    name: 'Te Reo Māori',
    nativeName: 'Te Reo Māori',
    flag: '🇳🇿',
    script: 'latin',
    templateDb: '/maori_default.db',
    available: true,
    features: { tenseParticles: true, macrons: true },
  },
};

export const DEFAULT_LANGUAGE = 'sw';

export function getLanguage(id: string | undefined | null): LanguageConfig {
  return (id && LANGUAGES[id]) || LANGUAGES[DEFAULT_LANGUAGE];
}
