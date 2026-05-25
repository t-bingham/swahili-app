import type { Unit } from '../types';

export type UnitTrack = 'vocabulary' | 'grammar';
export type UnitBasePath = '/app/units' | '/app/grammar';

export function unitTrack(unit: Unit): UnitTrack {
  return unit.track === 'grammar' ? 'grammar' : 'vocabulary';
}

export function unitBasePath(unit: Unit): UnitBasePath {
  return unitTrack(unit) === 'grammar' ? '/app/grammar' : '/app/units';
}

export function unitsForTrack(units: Unit[], track: UnitTrack): Unit[] {
  return [...units]
    .filter(unit => unit.id !== 'unit-00-placement')
    .filter(unit => unitTrack(unit) === track)
    .sort((a, b) => a.level !== b.level ? a.level - b.level : a.order_index - b.order_index);
}

export function unitDisplayNumber(units: Unit[], unit: Unit): number | null {
  const peers = unitsForTrack(units, unitTrack(unit));
  const index = peers.findIndex(peer => peer.id === unit.id);
  return index >= 0 ? index + 1 : null;
}

export function unitDisplayLabel(units: Unit[], unit: Unit): string {
  const displayNumber = unitDisplayNumber(units, unit);
  const fallback = displayNumber ?? '?';
  return unitTrack(unit) === 'grammar' ? `Grammar ${fallback}` : `Unit ${fallback}`;
}
