import { describe, expect, it } from 'vitest';
import { buildCloze, canCloze } from '../src/components/exercises/SentenceCloze';
import { buildFillBlank, canFillInBlank } from '../src/components/exercises/FillInBlank';
import { canNounClassExercise } from '../src/components/exercises/NounClassExercise';
import { canKoreanParticleExercise } from '../src/components/exercises/KoreanParticleExercise';
import { canMaoriTenseExercise } from '../src/components/exercises/MaoriTenseExercise';
import { canSwahiliConcord } from '../src/languages/swahiliConcord';
import { getLanguageAdapter } from '../src/languages';
import { makeCard } from './factories';

describe('special exercise safety', () => {
  const swahili = getLanguageAdapter('sw');

  it('returns null when a cloze cannot be built for the current card', () => {
    const card = makeCard({
      id: 'no-cloze',
      swahili: 'jambo',
      example_sentences: [{ swahili: 'Habari yako?', english: 'How are you?' }],
    });

    expect(buildCloze(card)).toBeNull();
    expect(canCloze(card)).toBe(false);
  });

  it('builds a cloze only when the target occurs in the example', () => {
    const card = makeCard({
      id: 'with-cloze',
      swahili: 'maji',
      example_sentences: [{ swahili: 'Ninataka maji sasa.', english: 'I want water now.' }],
    });

    expect(buildCloze(card)).toEqual({
      before: 'Ninataka ',
      after: ' sasa.',
      answer: 'maji',
      english: 'I want water now.',
    });
  });

  it('rejects incompatible cards across every special exercise', () => {
    const ordinary = makeCard();

    expect(canSwahiliConcord(ordinary)).toBe(false);
    expect(canNounClassExercise(ordinary)).toBe(false);
    expect(canKoreanParticleExercise(ordinary)).toBe(false);
    expect(canMaoriTenseExercise(ordinary)).toBe(false);
  });

  it('recognizes valid cards for noun-class, Korean particle, and Maori tense exercises', () => {
    expect(canNounClassExercise(makeCard({ noun_class: 'M-Wa' }))).toBe(true);
    expect(canKoreanParticleExercise(makeCard({
      type: 'grammar',
      part_of_speech: 'particle',
      swahili: 'topic particle',
    }))).toBe(true);
    expect(canMaoriTenseExercise(makeCard({
      type: 'conjugation',
      tags: ['tense-pattern'],
      conjugation_key: 'mi:kei-te:ako:au',
    }))).toBe(true);
  });

  it('selects fill-blank only when exactly one answer can be derived', () => {
    const valid = makeCard({
      type: 'grammar',
      swahili: 'Ninataka ___.',
      example_sentences: [{ swahili: 'Ninataka maji.', english: 'I want water.' }],
    });
    const invalid = makeCard({
      type: 'grammar',
      swahili: '___sha ___ yako.',
      example_sentences: [{ swahili: 'Pumzisha pumzi yako.', english: 'Catch your breath.' }],
    });

    expect(buildFillBlank(valid, swahili)).toEqual({
      before: 'Ninataka ',
      after: '.',
      answer: 'maji',
    });
    expect(canFillInBlank(valid, swahili)).toBe(true);
    expect(buildFillBlank(invalid, swahili)).toBeNull();
    expect(canFillInBlank(invalid, swahili)).toBe(false);
  });
});
