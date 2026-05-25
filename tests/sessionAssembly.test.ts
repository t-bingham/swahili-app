import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardWeight, drawWeightedCard } from '../src/scheduling/sessionAssembly';
import { makeCard } from './factories';

describe('session assembly scheduling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('weights overdue cards more than just-reviewed cards at the same depth', () => {
    const now = Date.parse('2026-05-26T00:00:00.000Z');
    const overdue = makeCard({
      id: 'overdue',
      state: {
        card_id: 'overdue',
        depth_level: 3,
        last_review: '2026-05-01T00:00:00.000Z',
        next_review: '2026-05-10T00:00:00.000Z',
      },
    });
    const fresh = makeCard({
      id: 'fresh',
      state: {
        card_id: 'fresh',
        depth_level: 3,
        last_review: '2026-05-25T00:00:00.000Z',
        next_review: '2026-06-25T00:00:00.000Z',
      },
    });

    expect(cardWeight(overdue, now)).toBeGreaterThan(cardWeight(fresh, now));
  });

  it('can force new-card selection when newWordRate is 100', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const newCard = makeCard({ id: 'new', state: { card_id: 'new', depth_level: 1 } });
    const reviewCard = makeCard({ id: 'review', state: { card_id: 'review', depth_level: 3 } });

    expect(drawWeightedCard([reviewCard, newCard], Date.now(), undefined, 100)?.id).toBe('new');
  });

  it('excludes the just-reviewed card when alternatives exist', () => {
    const current = makeCard({ id: 'current', state: { card_id: 'current', depth_level: 2 } });
    const next = makeCard({ id: 'next', state: { card_id: 'next', depth_level: 2 } });

    expect(drawWeightedCard([current, next], Date.now(), 'current')?.id).toBe('next');
  });
});
