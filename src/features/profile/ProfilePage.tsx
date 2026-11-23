import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DetailCrumbs, Field } from '../../components/shared/DetailParts';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, MetricCard } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatSdg } from '../../lib/money';
import { useAuth } from '../auth/auth-context';
import { useBrokerDashboard } from '../home/api';
import { FLAG_FIELDS, permissionLabel, roleLabel } from '../staff/logic';

/**
 * /profile — the signed-in employee (GET /broker/auth/me): identity, office, permissions and today's
 * sales. Name and permissions are changed by a staff manager; the phone is the login identity.
 */
export const ProfilePage: React.FC = () => {
  const { employee, refreshProfile, logout, can, isManager } = useAuth();
  const dashboard = useBrokerDashboard();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = React.useState(false);
  if (!employee) return null;
  const phone = employee.identities.find((i) => i.type === 'PHONE')?.value ?? null;
  const d = dashboard.data;
  const wholeOffice = isManager || can('broker.reports.view');

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      <DetailCrumbs items={[{ label: 'حسابي' }]} />
      <PageHeader
        title={employee.displayName}
        subtitle={`${roleLabel(employee.role)} — ${employee.office.name}`}
        badge={
          <Badge dot variant={employee.status === 'ACTIVE' ? 'success' : 'error'}>
            {employee.status === 'ACTIVE' ? 'نشط' : employee.status}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              icon="refresh"
              isLoading={refreshing}
              onClick={() => {
                setRefreshing(true);
                void refreshProfile().finally(() => setRefreshing(false));
              }}
            >
              تحديث الصلاحيات
            </Button>
            {can('broker.staff.manage') && (
              <Button variant="outline" icon="manage_accounts" onClick={() => navigate(`/staff/${employee.id}`)}>
                صفحتي في الموظفين
              </Button>
            )}
            <Button variant="danger" icon="logout" onClick={() => void logout()}>
              تسجيل الخروج
            </Button>
          </div>
        }
        className="mb-0"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="lg:col-span-2 space-y-space-sm">
          <h2 className="font-bold">البيانات</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-space-lg gap-y-3 text-sm">
            <Field label="الاسم">{employee.displayName}</Field>
            <Field label="رقم الهاتف (تسجيل الدخول)" mono>
              {phone ?? '—'}
            </Field>
            <Field label="الدور">{roleLabel(employee.role)}</Field>
            <Field label="المكتب">{employee.office.name}</Field>
            <Field label="رمز المكتب" mono>
              {employee.office.code}
            </Field>
            <Field label="حالة المكتب">{employee.office.status === 'ACTIVE' ? 'نشط' : employee.office.status === 'SUSPENDED' ? 'موقوف' : employee.office.status}</Field>
          </dl>
          <p className="text-xs text-on-surface-variant">لتغيير الاسم أو الصلاحيات تواصل مع مدير المكتب. رقم الهاتف هو هوية الدخول ولا يُغيَّر من اللوحة.</p>
        </Card>
        <Card className="space-y-space-sm">
          <h2 className="font-bold">صلاحياتي</h2>
          <ul className="space-y-2 text-sm">
            {FLAG_FIELDS.map((f) => (
              <li key={f.key} className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] ${employee.flags[f.key] ? 'text-[#15803D]' : 'text-outline'}`}>
                  {employee.flags[f.key] ? 'check_circle' : 'cancel'}
                </span>
                {f.label}
              </li>
            ))}
          </ul>
          <p className="text-xs text-on-surface-variant">الفعلية: {employee.permissions.map(permissionLabel).join('، ') || 'لا شيء'}</p>
        </Card>
      </div>

      <section className="space-y-space-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">أداء اليوم {d?.scope === 'OFFICE' ? '(المكتب كله)' : '(مبيعاتي)'}</h2>
          <Link
            to={wholeOffice ? `/bookings?employee=${encodeURIComponent(employee.id)}` : '/bookings'}
            className="text-sm font-semibold text-secondary hover:underline"
          >
            حجوزاتي
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          <MetricCard title="تذاكر اليوم" value={d ? d.ticketsSold.toLocaleString('en-US') : '…'} subValue={d ? `${d.bookingsCount} حجز` : undefined} icon="confirmation_number" />
          <MetricCard title="إجمالي المبيعات" value={d ? formatSdg(d.grossSalesMinor) : '…'} icon="payments" />
          <MetricCard title="العمولة المستحقة" value={d ? formatSdg(d.commissionAccruedMinor) : '…'} icon="currency_exchange" />
        </div>
      </section>
    </div>
  );
};
