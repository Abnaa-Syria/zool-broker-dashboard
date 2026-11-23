import { describe, expect, it } from 'vitest';
import { DEFAULT_CLERK_FLAGS, diffStaff, permissionLabel, roleLabel, selfEditBlock, statusNotice, validatePhone } from './logic';

describe('staff logic', () => {
  it('diffs only changed fields', () => {
    const before = { displayName: 'Ali', flags: DEFAULT_CLERK_FLAGS };
    expect(diffStaff(before, { displayName: ' Ali ', flags: DEFAULT_CLERK_FLAGS })).toEqual({});
    expect(diffStaff(before, { displayName: 'Ali M', flags: { ...DEFAULT_CLERK_FLAGS, canTopUp: true } })).toEqual({
      displayName: 'Ali M',
      canTopUp: true,
    });
  });

  it('blocks self-lockout only for the current employee', () => {
    expect(selfEditBlock(true, { status: 'SUSPENDED' })).not.toBeNull();
    expect(selfEditBlock(true, { canManageStaff: false })).not.toBeNull();
    expect(selfEditBlock(true, { canManageStaff: true })).toBeNull();
    expect(selfEditBlock(false, { status: 'SUSPENDED', canManageStaff: false })).toBeNull();
  });

  it('validates phones loosely', () => {
    expect(validatePhone('+249 912 345 678')).toBeNull();
    expect(validatePhone('0912345678')).toBeNull();
    expect(validatePhone('12')).not.toBeNull();
    expect(validatePhone('abc12345678')).not.toBeNull();
  });
});

describe('staff labels', () => {
  it('roles, permissions and status notices', () => {
    expect(roleLabel('MANAGER')).toBe('مدير المكتب');
    expect(roleLabel('CLERK')).toBe('موظف حجز');
    expect(permissionLabel('broker.book')).toBe('الحجز وإصدار التذاكر');
    expect(permissionLabel('x.y')).toBe('x.y');
    expect(statusNotice({ displayName: 'علي', status: 'SUSPENDED' })).toContain('إيقاف');
    expect(statusNotice({ displayName: 'علي', status: 'ACTIVE' })).toContain('إعادة تفعيل');
  });
});
