import { describe, expect, it } from 'vitest';
import { channelLabel, genderLabel, legLabel, paymentMethodLabel, paymentStatusLabel, refundReasonLabel, refundStatusLabel } from './labels';

describe('booking detail labels', () => {
  it('channel and payment', () => {
    expect(channelLabel('BROKER')).toBe('مكتب الوكيل');
    expect(channelLabel(null)).toBe('—');
    expect(paymentMethodLabel('WALLET')).toBe('محفظة المكتب (رصيد مسبق)');
    expect(paymentMethodLabel('OTHER')).toBe('OTHER');
    expect(paymentStatusLabel('PAID')).toBe('مدفوع');
    expect(paymentStatusLabel('REFUNDED')).toBe('مسترد');
    expect(paymentStatusLabel(undefined)).toBe('—');
  });

  it('refunds', () => {
    expect(refundStatusLabel('PENDING').variant).toBe('warning');
    expect(refundStatusLabel('NEW').label).toBe('NEW');
    expect(refundReasonLabel('CHANGE_DIFFERENCE')).toBe('فرق سعر تعديل الرحلة');
    expect(refundReasonLabel(null)).toBe('—');
  });

  it('gender and leg', () => {
    expect(genderLabel('FEMALE')).toBe('أنثى');
    expect(genderLabel(null)).toBeNull();
    expect(legLabel('RETURN')).toBe('رحلة العودة');
    expect(legLabel(null)).toBeNull();
  });
});
