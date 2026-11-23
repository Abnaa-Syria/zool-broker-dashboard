import { describe, expect, it } from 'vitest';
import { commissionRate } from './api';

describe('commissionRate', () => {
  it('percent of the booking total', () => {
    expect(commissionRate(350_000, 3_500_000)).toBe(10);
    expect(commissionRate(1, 3)).toBe(33.33);
    expect(commissionRate(10, 0)).toBeNull();
  });
});
