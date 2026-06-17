export type Script = 'latin' | 'hangul';

export interface LanguageFeatures {
  nounClass?: boolean;
  concord?: boolean;
  honorifics?: boolean;
  hangul?: boolean;
  tenseParticles?: boolean;
  macrons?: boolean;
}

export interface LanguageConfig {
  id: string;
  name: string;
  nativeName: string;
  flag: string;
  script: Script;
  templateDb: string;
  curriculumVersion: number;
  available: boolean;
  targetLanguageName: string;
  targetLanguageShortName: string;
  locale: string;
  ttsLangPrefixes: string[];
  features: LanguageFeatures;
}

export const LANGUAGES: Record<string, LanguageConfig> = {
  sw: {
    id: 'sw',
    name: 'Swahili',
    nativeName: 'Kiswahili',
    flag: '\uD83C\uDDF9\uD83C\uDDFF',
    script: 'latin',
    templateDb: '/swahili_default.db',
    curriculumVersion: 1,
    available: true,
    targetLanguageName: 'Swahili',
    targetLanguageShortName: 'Swahili',
    locale: 'sw',
    ttsLangPrefixes: ['sw'],
    features: { nounClass: true, concord: true },
  },
  ko: {
    id: 'ko',
    name: 'Korean',
    nativeName: '\uD55C\uAD6D\uC5B4',
    flag: '\uD83C\uDDF0\uD83C\uDDF7',
    script: 'hangul',
    templateDb: '/korean_default.db',
    curriculumVersion: 1,
    available: true,
    targetLanguageName: 'Korean',
    targetLanguageShortName: 'Korean',
    locale: 'ko-KR',
    ttsLangPrefixes: ['ko'],
    features: { honorifics: true, hangul: true },
  },
  mi: {
    id: 'mi',
    name: 'Te Reo Maori',
    nativeName: 'Te Reo Maori',
    flag: '\uD83C\uDDF3\uD83C\uDDFF',
    script: 'latin',
    templateDb: '/maori_default.db',
    curriculumVersion: 1,
    available: true,
    targetLanguageName: 'te reo Maori',
    targetLanguageShortName: 'Maori',
    locale: 'mi-NZ',
    ttsLangPrefixes: ['mi'],
    features: { tenseParticles: true, macrons: true },
  },
};

export const DEFAULT_LANGUAGE = 'sw';

export function getLanguage(id: string | undefined | null): LanguageConfig {
  return (id && LANGUAGES[id]) || LANGUAGES[DEFAULT_LANGUAGE];
}
