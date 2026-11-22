import { describe, expect, it } from 'vitest';
import { presetRange, validateRange } from './range';

// 2026-11-22 23:30 Sudan time (UTC+2) = 21:30 UTC — still the 22nd in Khartoum.
const now = new Date('2026-11-22T21:30:00Z');

describe('report ranges', () => {
  it('builds Sudan-day presets', () => {
    expect(presetRange('today', now)).toEqual({ from: '2026-11-22', to: '2026-11-22' });
    expect(presetRange('7days', now)).toEqual({ from: '2026-11-16', to: '2026-11-22' });
    expect(presetRange('30days', now)).toEqual({ from: '2026-10-24', to: '2026-11-22' });
    expect(presetRange('month', now)).toEqual({ from: '2026-11-01', to: '2026-11-22' });
  });

  it('uses the Sudan date after UTC midnight differs', () => {
    // 22:30 UTC = 00:30 on the 23rd in Khartoum.
    expect(presetRange('today', new Date('2026-11-22T22:30:00Z'))).toEqual({ from: '2026-11-23', to: '2026-11-23' });
  });

  it('validates ranges', () => {
    expect(validateRange({ from: '2026-11-01', to: '2026-11-22' })).toBeNull();
    expect(validateRange({ from: '2026-11-22', to: '2026-11-22' })).toBeNull();
    expect(validateRange({ from: '2026-11-23', to: '2026-11-22' })).not.toBeNull();
    expect(validateRange({ from: '', to: '2026-11-22' })).not.toBeNull();
    expect(validateRange({ from: '22/11/2026', to: '2026-11-22' })).not.toBeNull();
  });
});
