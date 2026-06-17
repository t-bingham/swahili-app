import { describe, expect, it } from 'vitest';
import { getLanguageAdapter } from '../src/languages';
import { makeCard } from './factories';

describe('language adapters', () => {
  it('resolves all supported languages with shared labels and text accessors', () => {
    const cases = [
      ['sw', 'Swahili'],
      ['ko', 'Korean'],
      ['mi', 'Maori'],
    ] as const;

    for (const [id, shortName] of cases) {
      const adapter = getLanguageAdapter(id);
      const card = makeCard({ swahili: 'target text', english: 'English text' });

      expect(adapter.id).toBe(id);
      expect(adapter.targetShortName).toBe(shortName);
      expect(adapter.getTargetText(card)).toBe('target text');
      expect(adapter.getEnglishText(card)).toBe('English text');
      expect(adapter.directionLabel('target_to_en')).toContain('English');
      expect(adapter.directionLabel('en_to_target')).toContain(shortName);
      expect(adapter.searchPlaceholder()).toContain(shortName);
      expect(adapter.csvFilenamePrefix()).toBe(`${id}_cards`);
    }
  });

  it('keeps Swahili concord selection inside the Swahili adapter', () => {
    const adapter = getLanguageAdapter('sw');
    const card = makeCard({
      id: 'adj:watu:-zuri',
      swahili: 'watu wazuri',
      english: 'good people',
      type: 'grammar',
      tags: ['adjective-agreement'],
    });

    expect(adapter.specialExercises(card, 'multiple_choice', 3)).toEqual([
      { exercise: 'concord', level: 3 },
    ]);
  });

  it('keeps Korean particle selection inside the Korean adapter', () => {
    const adapter = getLanguageAdapter('ko');
    const card = makeCard({
      id: 'ko-particle-topic',
      swahili: 'eun/neun',
      english: 'topic particle',
      type: 'grammar',
      part_of_speech: 'particle',
      tags: ['grammar', 'particle'],
    });

    expect(adapter.specialExercises(card, 'multiple_choice', 3)).toEqual([
      { exercise: 'particle_choice', level: 3 },
    ]);
  });

  it('keeps Maori tense selection inside the Maori adapter', () => {
    const adapter = getLanguageAdapter('mi');
    const card = makeCard({
      id: 'mi-tense-kei-te',
      swahili: 'kei te ako au',
      english: 'I am learning',
      type: 'conjugation',
      conjugation_key: 'mi:kei-te:ako:au',
      tags: ['tense-pattern'],
    });

    expect(adapter.specialExercises(card, 'multiple_choice', 3)).toEqual([
      { exercise: 'maori_tense', level: 3 },
    ]);
  });
});
