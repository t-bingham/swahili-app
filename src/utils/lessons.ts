import type { CardWithState } from '../types';

export const CARDS_PER_LESSON = 8;

export type LessonStatus = 'locked' | 'available' | 'complete' | 'mastered';

export interface LessonInfo {
  index: number;
  cards: CardWithState[];
  status: LessonStatus;
}

export function computeLessons(allCards: CardWithState[]): LessonInfo[] {
  const sorted = [...allCards].sort((a, b) => a.frequency_rank - b.frequency_rank);

  const chunks: CardWithState[][] = [];
  for (let i = 0; i < sorted.length; i += CARDS_PER_LESSON) {
    chunks.push(sorted.slice(i, i + CARDS_PER_LESSON));
  }

  return chunks.map((chunk, idx) => {
    const introduced = chunk.every(c => c.state.depth_level >= 2 || c.state.review_count > 0);
    const mastered = chunk.every(c => c.state.depth_level >= 3);

    // A lesson unlocks once the previous lesson's cards are all introduced
    const prevDone =
      idx === 0 ||
      chunks[idx - 1].every(c => c.state.depth_level >= 2 || c.state.review_count > 0);

    const status: LessonStatus =
      mastered ? 'mastered' :
      introduced ? 'complete' :
      prevDone ? 'available' :
      'locked';

    return { index: idx, cards: chunk, status };
  });
}
