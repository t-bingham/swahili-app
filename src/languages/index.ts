import { getLanguage } from '../data/languages';
import type { LanguageAdapter } from './types';
import { createBaseAdapter } from './shared';
import { createSwahiliAdapter } from './sw';
import { createKoreanAdapter } from './ko';
import { createMaoriAdapter } from './mi';

const cache = new Map<string, LanguageAdapter>();

function createAdapter(languageId: string): LanguageAdapter {
  const config = getLanguage(languageId);
  if (config.id === 'sw') return createSwahiliAdapter(config);
  if (config.id === 'ko') return createKoreanAdapter(config);
  if (config.id === 'mi') return createMaoriAdapter(config);
  return createBaseAdapter(config);
}

export function getLanguageAdapter(languageId: string | undefined | null): LanguageAdapter {
  const id = getLanguage(languageId).id;
  const cached = cache.get(id);
  if (cached) return cached;
  const adapter = createAdapter(id);
  cache.set(id, adapter);
  return adapter;
}

export type { LanguageAdapter, StudyDirection } from './types';
