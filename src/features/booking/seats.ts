import type { TripSeat } from './types';

/** Natural seat-label order, same as the backend (`compareSeatLabels`): A1, A2, A10. */
export function compareSeatLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortSeats<T extends { label: string }>(seats: readonly T[]): T[] {
  return [...seats].sort((a, b) => compareSeatLabels(a.label, b.label));
}

/** True when every seat carries grid coordinates (the API does not send them yet). */
export function hasLayout(seats: readonly TripSeat[]): boolean {
  return seats.length > 0 && seats.every((s) => typeof s.row === 'number' && typeof s.column === 'number');
}

export type SeatView = 'selected' | 'free' | 'mine' | 'taken';

/** A seat can be picked when it is free, or already held by this employee (e.g. after a reload). */
export function isSelectable(seat: TripSeat): boolean {
  return seat.status === 'FREE' || (seat.status === 'HELD' && seat.heldByMe);
}

export function seatView(seat: TripSeat, selected: readonly string[]): SeatView {
  if (selected.includes(seat.id)) return 'selected';
  if (seat.status === 'FREE') return 'free';
  if (seat.status === 'HELD' && seat.heldByMe) return 'mine';
  return 'taken';
}

/**
 * Toggle a seat in the selection, never exceeding `max` (the passenger count).
 * When the selection is full and max is 1, the new seat replaces the old one.
 */
export function toggleSeat(selected: readonly string[], seat: TripSeat, max: number): string[] {
  if (selected.includes(seat.id)) return selected.filter((id) => id !== seat.id);
  if (!isSelectable(seat)) return [...selected];
  if (selected.length >= max) {
    return max === 1 ? [seat.id] : [...selected];
  }
  return [...selected, seat.id];
}

/** Drop selections that are no longer selectable after a trip refresh. */
export function pruneSelection(selected: readonly string[], seats: readonly TripSeat[]): string[] {
  const byId = new Map(seats.map((s) => [s.id, s]));
  return selected.filter((id) => {
    const seat = byId.get(id);
    return seat !== undefined && isSelectable(seat);
  });
}

export type HoldPlan = {
  /** Seats to hold now (POST /holds). */
  toHold: string[];
  /** Selected seats this employee already holds: keep their holds. */
  reuse: Array<{ seatId: string; holdId: string; expiresAt?: string; remainingSeconds?: number }>;
  /** Own holds on this trip that are not part of the selection: release them. */
  release: string[];
};

/** An own hold with less time than this is released and taken again instead of reused. */
export const MIN_REUSE_SECONDS = 60;

export function planHolds(selected: readonly string[], seats: readonly TripSeat[]): HoldPlan {
  const plan: HoldPlan = { toHold: [], reuse: [], release: [] };
  const byId = new Map(seats.map((s) => [s.id, s]));
  for (const id of selected) {
    const seat = byId.get(id);
    if (seat?.status === 'HELD' && seat.heldByMe && seat.holdId) {
      if ((seat.remainingSeconds ?? 0) >= MIN_REUSE_SECONDS) {
        plan.reuse.push({ seatId: id, holdId: seat.holdId, expiresAt: seat.holdExpiresAt, remainingSeconds: seat.remainingSeconds });
      } else {
        plan.release.push(seat.holdId); // nearly expired: renew (released before the new hold is taken)
        plan.toHold.push(id);
      }
    } else {
      plan.toHold.push(id);
    }
  }
  for (const seat of seats) {
    if (seat.heldByMe && seat.holdId && !selected.includes(seat.id)) plan.release.push(seat.holdId);
  }
  return plan;
}

/** Keep the selection in the clicked order but present it by seat label (passenger cards). */
export function orderedSelection(selected: readonly string[], seats: readonly TripSeat[]): TripSeat[] {
  const byId = new Map(seats.map((s) => [s.id, s]));
  return sortSeats(selected.map((id) => byId.get(id)).filter((s): s is TripSeat => s !== undefined));
}

/** Grid rows for a seat map with coordinates: rows[r][c] = seat | null. */
export function layoutGrid(seats: readonly TripSeat[]): Array<Array<TripSeat | null>> {
  if (!hasLayout(seats)) return [];
  const maxRow = Math.max(...seats.map((s) => s.row as number));
  const maxCol = Math.max(...seats.map((s) => s.column as number));
  const minRow = Math.min(...seats.map((s) => s.row as number));
  const minCol = Math.min(...seats.map((s) => s.column as number));
  const grid: Array<Array<TripSeat | null>> = Array.from({ length: maxRow - minRow + 1 }, () =>
    Array.from({ length: maxCol - minCol + 1 }, () => null),
  );
  for (const seat of seats) grid[(seat.row as number) - minRow][(seat.column as number) - minCol] = seat;
  return grid;
}
