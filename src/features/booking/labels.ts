import type { TripPoint } from './types';

/** "City (Station)" for a trip endpoint; legacy trips have no station. */
export function pointLabel(p: TripPoint): string {
  return p.station ? `${p.city.nameAr} (${p.station.nameAr})` : p.city.nameAr;
}
