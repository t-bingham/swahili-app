import { getLanguageAdapter } from '../languages';
import type { CardWithState, ErrorType } from '../types';
export type { ErrorType } from '../types';

export function classifyError(
  card: CardWithState,
  given: string,
  languageId: string,
): ErrorType {
  return getLanguageAdapter(languageId).classifyError(card, given) ?? 'semantic';
}
