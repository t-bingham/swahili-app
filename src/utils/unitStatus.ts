import type { Unit, UnitProgress } from '../types';

export function computeStatus(unit: Unit, progressMap: Map<string, UnitProgress>): UnitProgress['status'] {
  const prog = progressMap.get(unit.id);
  if (prog?.status === 'completed') return 'completed';
  if (prog?.status === 'in_progress') return 'in_progress';
  const prereqsMet =
    unit.prerequisite_ids.length === 0 ||
    unit.prerequisite_ids.every(id => progressMap.get(id)?.status === 'completed');
  if (!prereqsMet) return 'locked';
  return 'available';
}
