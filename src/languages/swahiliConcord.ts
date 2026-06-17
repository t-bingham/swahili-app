import type { CardWithState } from '../types';

const STEM_MEANING: Record<string, string> = { zuri: 'good', baya: 'bad', kubwa: 'big' };

export interface ConcordPrompt {
  noun: string;
  answer: string;
  stem: string;
  meaning: string;
}

// Adjective-agreement grammar cards are "<noun> <agreeing-adjective>" (e.g.
// "kitabu kizuri"), with the bare stem encoded in the id (...:-zuri).
// This turns them into a generative concord task: produce the agreeing form.
export function parseSwahiliConcord(card: CardWithState): ConcordPrompt | null {
  if (card.type !== 'grammar' || !card.tags?.includes('adjective-agreement')) return null;
  if (card.swahili.includes('___')) return null; // those go to fill_blank
  const parts = card.swahili.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const stem = card.id.split(':-')[1];
  if (!stem || !STEM_MEANING[stem]) return null;
  return { noun: parts[0], answer: parts[1], stem, meaning: STEM_MEANING[stem] };
}

export function canSwahiliConcord(card: CardWithState): boolean {
  return parseSwahiliConcord(card) !== null;
}
