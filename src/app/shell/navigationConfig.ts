export interface NavItem {
  name: string;
  path: string;
  icon: string;
  /** Hidden unless the employee passes `can(permission)` (the API enforces it as well). */
  permission?: string;
  /** Kept for the shell banner; every broker page is live. */
  data: 'live' | 'mock';
  badge?: string;
  badgeVariant?: 'neutral' | 'success' | 'warning' | 'error' | 'secondary';
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navigationConfig: NavSection[] = [
  {
    title: 'المبيعات',
    items: [
      { name: 'الرئيسية', path: '/home', icon: 'home', data: 'live' },
      { name: 'حجز جديد', path: '/booking/new', icon: 'add_circle', permission: 'broker.book', data: 'live' },
      { name: 'الحجوزات والتذاكر', path: '/bookings', icon: 'confirmation_number', data: 'live' },
    ],
  },
  {
    title: 'المكتب',
    items: [
      { name: 'المحفظة والشحن', path: '/wallet', icon: 'account_balance_wallet', data: 'live' },
      { name: 'العمولات', path: '/commissions', icon: 'currency_exchange', permission: 'broker.reports.view', data: 'live' },
      { name: 'التقارير', path: '/reports', icon: 'bar_chart', permission: 'broker.reports.view', data: 'live' },
      { name: 'الموظفون', path: '/staff', icon: 'group', permission: 'broker.staff.manage', data: 'live' },
    ],
  },
];

/** Nav item that owns a pathname (longest prefix wins). */
export function findNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const section of navigationConfig) {
    for (const item of section.items) {
      const owns = pathname === item.path || pathname.startsWith(`${item.path}/`);
      if (owns && (!best || item.path.length > best.path.length)) best = item;
    }
  }
  return best;
}
