import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api/client';
import {
  balanceBeforeMinor,
  idempotencyKeyFor,
  ledgerReferencePath,
  ledgerTypeLabel,
  minTopUpFromError,
  parseSdgInput,
  signedAmountMinor,
  topUpPollInterval,
  topUpTimeline,
  validateReceipt,
} from './logic';

describe('wallet logic', () => {
  it('labels ledger types in Arabic and falls back to the raw code', () => {
    expect(ledgerTypeLabel('CREDIT_TOPUP')).toBe('شحن المحفظة');
    expect(ledgerTypeLabel('DEBIT_BOOKING')).toBe('خصم حجز');
    expect(ledgerTypeLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('signs amounts by direction', () => {
    expect(signedAmountMinor({ direction: 'DEBIT', amountMinor: 500 })).toBe(-500);
    expect(signedAmountMinor({ direction: 'CREDIT', amountMinor: 500 })).toBe(500);
  });

  it('parses SDG input to minor units', () => {
    expect(parseSdgInput('12,500')).toBe(1_250_000);
    expect(parseSdgInput(' 10.5 ')).toBe(1050);
    expect(parseSdgInput('١٠٠')).toBe(10_000);
    expect(parseSdgInput('')).toBeNull();
    expect(parseSdgInput('0')).toBeNull();
    expect(parseSdgInput('-5')).toBeNull();
    expect(parseSdgInput('1.234')).toBeNull();
    expect(parseSdgInput('abc')).toBeNull();
  });

  it('reuses the idempotency key only for the same amount', () => {
    let n = 0;
    const gen = () => `k${++n}`;
    const a = idempotencyKeyFor(null, 100, gen);
    expect(a).toEqual({ amountMinor: 100, key: 'k1' });
    expect(idempotencyKeyFor(a, 100, gen)).toBe(a);
    expect(idempotencyKeyFor(a, 200, gen)).toEqual({ amountMinor: 200, key: 'k2' });
  });

  it('reads the minimum from TOP_UP_BELOW_MINIMUM', () => {
    const err = new ApiError({ status: 422, code: 'TOP_UP_BELOW_MINIMUM', message: 'x', details: { minTopUpMinor: 100000, amountMinor: 5 } });
    expect(minTopUpFromError(err)).toBe(100000);
    expect(minTopUpFromError(new ApiError({ status: 409, code: 'CONFLICT', message: 'x' }))).toBeNull();
    expect(minTopUpFromError(new Error('x'))).toBeNull();
  });

  it('validates receipts like the backend', () => {
    expect(validateReceipt(null)).not.toBeNull();
    expect(validateReceipt({ name: 'r.pdf', type: 'application/pdf', size: 1000 })).toBeNull();
    expect(validateReceipt({ name: 'r.jpg', type: '', size: 1000 })).toBeNull();
    expect(validateReceipt({ name: 'r.gif', type: 'image/gif', size: 1000 })).toMatch(/غير مدعوم/);
    expect(validateReceipt({ name: 'r.png', type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toMatch(/5/);
  });

  it('polls only open top-ups', () => {
    expect(topUpPollInterval('PENDING')).toBe(5000);
    expect(topUpPollInterval('PENDING_REVIEW')).toBe(30000);
    expect(topUpPollInterval('CONFIRMED')).toBe(false);
    expect(topUpPollInterval('FAILED')).toBe(false);
    expect(topUpPollInterval(undefined)).toBe(false);
  });
});

describe('wallet detail helpers', () => {
  it('balance before an entry', () => {
    expect(balanceBeforeMinor({ direction: 'DEBIT', amountMinor: 3500, balanceAfterMinor: 1500 })).toBe(5000);
    expect(balanceBeforeMinor({ direction: 'CREDIT', amountMinor: 3500, balanceAfterMinor: 5000 })).toBe(1500);
  });

  it('reference paths', () => {
    expect(ledgerReferencePath({ referenceType: 'booking', referenceId: 'b1' })).toBe('/bookings/b1');
    expect(ledgerReferencePath({ referenceType: 'top_up_intent', referenceId: 't1' })).toBe('/wallet/top-ups/t1');
    expect(ledgerReferencePath({ referenceType: 'commission_settlement', referenceId: 's1' })).toBeNull();
    expect(ledgerReferencePath({ referenceType: 'booking', referenceId: null })).toBeNull();
  });

  it('top-up timeline', () => {
    const base = { createdAt: 'c', confirmedAt: null, failedAt: null, hasEvidence: false };
    expect(topUpTimeline({ ...base, status: 'PENDING' }).map((s) => s.key)).toEqual(['created', 'pending']);
    expect(topUpTimeline({ ...base, status: 'CONFIRMED', confirmedAt: 'x' }).map((s) => s.key)).toEqual(['created', 'confirmed']);
    const review = topUpTimeline({ ...base, status: 'PENDING_REVIEW', failedAt: 'f', hasEvidence: true });
    expect(review.map((s) => s.key)).toEqual(['created', 'failed', 'evidence', 'review']);
    expect(review[2]!.tone).toBe('current');
    expect(topUpTimeline({ ...base, status: 'FAILED', failedAt: 'f' }).at(-1)!.tone).toBe('error');
    expect(topUpTimeline({ ...base, status: 'FAILED', failedAt: 'f', hasEvidence: true }).map((s) => s.key)).toEqual(['created', 'evidence', 'failed']);
  });
});
