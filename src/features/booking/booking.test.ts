import { describe, expect, it } from 'vitest';
import { earliestDeadline, formatCountdown, holdDeadline, secondsLeft } from './countdown';
import { resizeDrafts, toPassengerInput, validatePassenger } from './passengers';
import { hasLayout, isSelectable, layoutGrid, orderedSelection, planHolds, pruneSelection, sortSeats, toggleSeat } from './seats';
import { computeCommission, estimateBooking, formatPercent, walletAfter } from './totals';
import type { TripSeat } from './types';

const seat = (id: string, label: string, extra: Partial<TripSeat> = {}): TripSeat => ({ id, label, status: 'FREE', heldByMe: false, ...extra });

describe('seat selection', () => {
  const free1 = seat('s1', 'A1');
  const free2 = seat('s2', 'A2');
  const free3 = seat('s3', 'A10');
  const sold = seat('s4', 'A3', { status: 'SOLD' });
  const heldOther = seat('s5', 'A4', { status: 'HELD' });
  const heldMine = seat('s6', 'A5', { status: 'HELD', heldByMe: true, holdId: 'h6', remainingSeconds: 120 });

  it('sorts labels naturally like the backend', () => {
    expect(sortSeats([free3, free2, free1]).map((s) => s.label)).toEqual(['A1', 'A2', 'A10']);
  });

  it('only free seats or my own held seats are selectable', () => {
    expect(isSelectable(free1)).toBe(true);
    expect(isSelectable(heldMine)).toBe(true);
    expect(isSelectable(sold)).toBe(false);
    expect(isSelectable(heldOther)).toBe(false);
  });

  it('toggles up to the passenger count', () => {
    let sel = toggleSeat([], free1, 2);
    sel = toggleSeat(sel, free2, 2);
    expect(sel).toEqual(['s1', 's2']);
    expect(toggleSeat(sel, free3, 2)).toEqual(['s1', 's2']); // full: ignored
    expect(toggleSeat(sel, free1, 2)).toEqual(['s2']); // deselect
    expect(toggleSeat([], sold, 2)).toEqual([]);
    expect(toggleSeat([], heldOther, 1)).toEqual([]);
  });

  it('replaces the seat when exactly one passenger', () => {
    expect(toggleSeat(['s1'], free2, 1)).toEqual(['s2']);
  });

  it('prunes seats that became unavailable', () => {
    expect(pruneSelection(['s1', 's4', 'missing', 's6'], [free1, sold, heldMine])).toEqual(['s1', 's6']);
  });

  it('plans holds: reuse mine, hold the rest, release unselected own holds', () => {
    const mine2 = seat('s7', 'A6', { status: 'HELD', heldByMe: true, holdId: 'h7' });
    const plan = planHolds(['s1', 's6'], [free1, heldMine, mine2]);
    expect(plan.toHold).toEqual(['s1']);
    expect(plan.reuse).toEqual([{ seatId: 's6', holdId: 'h6', expiresAt: undefined, remainingSeconds: 120 }]);
    expect(plan.release).toEqual(['h7']);
  });

  it('renews an own hold that is about to expire instead of reusing it', () => {
    const almost = seat('s8', 'A7', { status: 'HELD', heldByMe: true, holdId: 'h8', remainingSeconds: 5 });
    const plan = planHolds(['s8'], [almost]);
    expect(plan).toEqual({ toHold: ['s8'], reuse: [], release: ['h8'] });
  });

  it('orders the selection by label for passenger cards', () => {
    expect(orderedSelection(['s3', 's1'], [free1, free2, free3]).map((s) => s.label)).toEqual(['A1', 'A10']);
  });

  it('builds a grid only when every seat has coordinates', () => {
    expect(hasLayout([free1])).toBe(false);
    const a = seat('a', '1', { row: 1, column: 1 });
    const b = seat('b', '2', { row: 1, column: 3 });
    const c = seat('c', '3', { row: 2, column: 1 });
    expect(hasLayout([a, b, c])).toBe(true);
    const grid = layoutGrid([a, b, c]);
    expect(grid.map((r) => r.map((s) => s?.id ?? null))).toEqual([
      ['a', null, 'b'],
      ['c', null, null],
    ]);
  });
});

describe('hold countdown', () => {
  it('uses the API remaining seconds from the response time', () => {
    const deadline = holdDeadline(300, 1_000_000);
    expect(deadline).toBe(1_300_000);
    expect(secondsLeft(deadline, 1_000_000)).toBe(300);
    expect(secondsLeft(deadline, 1_299_001)).toBe(1);
    expect(secondsLeft(deadline, 1_400_000)).toBe(0);
  });

  it('formats mm:ss', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(-3)).toBe('00:00');
  });

  it('takes the earliest of several holds', () => {
    expect(earliestDeadline([])).toBeNull();
    expect(earliestDeadline([5, 3, 9])).toBe(3);
  });
});

describe('totals', () => {
  it('computes commission with integer basis points (floor), like the API', () => {
    expect(computeCommission(18000, 10)).toBe(1800);
    expect(computeCommission(333, 7.5)).toBe(24); // 24.975 → 24
    expect(estimateBooking(3_200_000, 3, 10)).toEqual({ totalMinor: 9_600_000, commissionMinor: 960_000 });
  });

  it('debits the full total from the wallet (no net debit)', () => {
    expect(walletAfter(50_000, 36_000)).toEqual({ afterMinor: 14_000, sufficient: true });
    expect(walletAfter(0, 18_000)).toEqual({ afterMinor: -18_000, sufficient: false });
  });

  it('formats percent', () => {
    expect(formatPercent(10)).toBe('10%');
    expect(formatPercent(7.5)).toBe('7.5%');
  });
});

describe('passengers', () => {
  it('requires name and phone, idNumber optional', () => {
    expect(validatePassenger({ fullName: 'أحمد علي', phone: '+249 912 345 678', idNumber: '' })).toEqual({});
    const e = validatePassenger({ fullName: ' ', phone: 'abc', idNumber: 'x'.repeat(65) });
    expect(Object.keys(e).sort()).toEqual(['fullName', 'idNumber', 'phone']);
    expect(validatePassenger({ fullName: 'Ali', phone: '', idNumber: '' }).phone).toBeDefined();
    expect(validatePassenger({ fullName: 'Ali', phone: '12345', idNumber: '' }).phone).toBeDefined();
  });

  it('trims and omits empty idNumber', () => {
    expect(toPassengerInput({ fullName: ' Ali ', phone: ' 0912345678 ', idNumber: ' ' })).toEqual({ fullName: 'Ali', phone: '0912345678' });
    expect(toPassengerInput({ fullName: 'Ali', phone: '0912345678', idNumber: 'P1' })).toEqual({ fullName: 'Ali', phone: '0912345678', idNumber: 'P1' });
  });

  it('resizes drafts keeping typed values', () => {
    const d = resizeDrafts([{ fullName: 'A', phone: '1', idNumber: '' }], 2);
    expect(d).toHaveLength(2);
    expect(d[0].fullName).toBe('A');
    expect(resizeDrafts(d, 1)).toHaveLength(1);
  });
});
