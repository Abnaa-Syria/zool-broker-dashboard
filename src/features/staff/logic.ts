export type StaffFlags = { canBook: boolean; canTopUp: boolean; canViewReports: boolean; canManageStaff: boolean };

export const FLAG_FIELDS: Array<{ key: keyof StaffFlags; label: string; hint: string }> = [
  { key: 'canBook', label: 'الحجز', hint: 'إنشاء الحجوزات وإصدار التذاكر' },
  { key: 'canTopUp', label: 'شحن المحفظة', hint: 'إنشاء طلبات الشحن وإرفاق الإيصالات' },
  { key: 'canViewReports', label: 'التقارير', hint: 'عرض تقارير المكتب والعمولات' },
  { key: 'canManageStaff', label: 'إدارة الموظفين', hint: 'إضافة الموظفين وتعديل صلاحياتهم' },
];

export const DEFAULT_CLERK_FLAGS: StaffFlags = { canBook: true, canTopUp: false, canViewReports: false, canManageStaff: false };

/** Only the fields that changed, for PATCH /broker/staff/:id (the API rejects an empty body). */
export function diffStaff(
  before: { displayName: string; flags: StaffFlags },
  after: { displayName: string; flags: StaffFlags },
): Partial<StaffFlags & { displayName: string }> {
  const out: Partial<StaffFlags & { displayName: string }> = {};
  const name = after.displayName.trim();
  if (name !== before.displayName) out.displayName = name;
  for (const { key } of FLAG_FIELDS) {
    if (after.flags[key] !== before.flags[key]) out[key] = after.flags[key];
  }
  return out;
}

/**
 * Self-lockout guard mirroring broker-staff.service: an employee cannot suspend themselves or drop
 * their own staff-management flag. Returns an Arabic reason, or null when allowed.
 */
export function selfEditBlock(isSelf: boolean, change: { status?: string; canManageStaff?: boolean }): string | null {
  if (!isSelf) return null;
  if (change.status === 'SUSPENDED') return 'لا يمكنك إيقاف حسابك بنفسك.';
  if (change.canManageStaff === false) return 'لا يمكنك إزالة صلاحية إدارة الموظفين عن نفسك.';
  return null;
}

/** Light client check before the API normalizes the phone: digits with optional leading +, 8–15 digits. */
export function validatePhone(raw: string): string | null {
  const compact = raw.replace(/[\s-]/g, '');
  if (!/^\+?\d{8,15}$/.test(compact)) return 'أدخل رقم هاتف صحيحًا، مثل ‎+249912345678.';
  return null;
}

/** Notice shown after a suspend / reactivate. */
export function statusNotice(saved: { displayName: string; status: string }): string {
  return saved.status === 'SUSPENDED' ? `تم إيقاف ${saved.displayName} وإنهاء جلساته.` : `تمت إعادة تفعيل ${saved.displayName}.`;
}

export function roleLabel(role: string): string {
  return role === 'MANAGER' ? 'مدير المكتب' : role === 'CLERK' ? 'موظف حجز' : role;
}

/** Arabic label of a broker permission key (GET /broker/staff `permissions`). */
export function permissionLabel(permission: string): string {
  switch (permission) {
    case 'broker.book':
      return 'الحجز وإصدار التذاكر';
    case 'broker.wallet.topup':
      return 'شحن المحفظة';
    case 'broker.reports.view':
      return 'التقارير والعمولات';
    case 'broker.staff.manage':
      return 'إدارة الموظفين';
    default:
      return permission;
  }
}
