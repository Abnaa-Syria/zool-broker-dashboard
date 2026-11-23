import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DetailCrumbs, DetailError, DetailSkeleton, Field, SuccessNotice } from '../../components/shared/DetailParts';
import { SimplePager } from '../../components/shared/SimplePager';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, MetricCard } from '../../components/ui/Card';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useBookings } from '../bookings/api';
import { bookingReference, bookingStatusLabel, routeLabel } from '../bookings/labels';
import { useReportByEmployee } from '../reports/api';
import { presetRange, RANGE_PRESETS, type RangePresetKey } from '../reports/range';
import { useStaff, type StaffMember } from './api';
import { FLAG_FIELDS, permissionLabel, roleLabel, statusNotice } from './logic';
import { StaffFormModal } from './StaffFormModal';
import { StaffStatusModal } from './StaffStatusModal';

const CRUMBS = [{ label: 'الموظفون', path: '/staff' }];
const SALES_PRESETS = RANGE_PRESETS.filter((p): p is Exclude<(typeof RANGE_PRESETS)[number], { key: 'custom' }> => p.key !== 'custom');

/**
 * /staff/:employeeId — profile, permissions, sales and bookings of one employee, with edit and
 * suspend / reactivate (`broker.staff.manage`). The API has no staff delete: suspension is the safe removal.
 */
export const StaffDetailPage: React.FC = () => {
  const { employeeId } = useParams();
  const { can, employee, isManager, refreshProfile } = useAuth();
  const allowed = can('broker.staff.manage');
  const staff = useStaff(allowed);
  const [editOpen, setEditOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  if (!allowed) {
    return (
      <div className="space-y-space-md">
        <DetailCrumbs items={[...CRUMBS, { label: 'موظف' }]} />
        <EmptyState icon="lock" title="لا تملك صلاحية إدارة الموظفين" description="اطلب من مدير المكتب منحك صلاحية «إدارة الموظفين»." />
      </div>
    );
  }
  if (staff.isLoading) return <DetailSkeleton />;
  const member = staff.data?.find((m) => m.id === employeeId);
  if (staff.isError || !member) {
    return (
      <DetailError
        crumbs={[...CRUMBS, { label: 'موظف' }]}
        notFound={!staff.isError}
        notFoundTitle="الموظف غير موجود"
        notFoundMessage="لا يوجد موظف بهذا الرقم في مكتبك."
        title="تعذّر تحميل الموظف"
        message={errorMessage(staff.error)}
        onRetry={() => staff.refetch()}
      />
    );
  }

  const isSelf = member.id === employee?.id;
  const wholeOffice = isManager || can('broker.reports.view');

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      <DetailCrumbs items={[...CRUMBS, { label: member.displayName }]} />
      <PageHeader
        title={member.displayName}
        subtitle={`${roleLabel(member.role)}${isSelf ? ' • حسابك أنت' : ''}`}
        badge={
          <Badge dot variant={member.status === 'ACTIVE' ? 'success' : 'error'}>
            {member.status === 'ACTIVE' ? 'نشط' : 'موقوف'}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              icon="edit"
              onClick={() => {
                setNotice(null);
                setEditOpen(true);
              }}
            >
              تعديل البيانات والصلاحيات
            </Button>
            {!isSelf && (
              <Button
                variant={member.status === 'ACTIVE' ? 'danger' : 'secondary'}
                icon={member.status === 'ACTIVE' ? 'block' : 'check_circle'}
                onClick={() => {
                  setNotice(null);
                  setStatusOpen(true);
                }}
              >
                {member.status === 'ACTIVE' ? 'إيقاف الموظف' : 'إعادة تفعيل'}
              </Button>
            )}
          </div>
        }
        className="mb-0"
      />

      {notice && <SuccessNotice>{notice}</SuccessNotice>}
      {member.status === 'SUSPENDED' && (
        <div role="status" className="rounded-lg border border-error/40 bg-error-container/40 px-space-md py-2 text-sm">
          هذا الموظف موقوف: لا يستطيع تسجيل الدخول. حجوزاته السابقة تبقى ظاهرة ويمكن إدارتها من صفحاتها.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="lg:col-span-2 space-y-space-sm">
          <h2 className="font-bold">الملف الشخصي</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-space-lg gap-y-3 text-sm">
            <Field label="الاسم">{member.displayName}</Field>
            <Field label="رقم الهاتف (تسجيل الدخول)" mono>
              {member.phone ?? '—'}
            </Field>
            <Field label="الدور">{roleLabel(member.role)}</Field>
            <Field label="الحالة">{member.status === 'ACTIVE' ? 'نشط' : 'موقوف'}</Field>
            <Field label="آخر تسجيل دخول">{formatDateTime(member.lastLoginAt)}</Field>
            <Field label="تاريخ الإضافة">{formatDateTime(member.createdAt)}</Field>
            <Field label="آخر تعديل">{formatDateTime(member.updatedAt)}</Field>
            <Field label="رقم الموظف" mono>
              {member.id}
            </Field>
          </dl>
        </Card>
        <Card className="space-y-space-sm">
          <h2 className="font-bold">الصلاحيات</h2>
          <ul className="space-y-2 text-sm">
            {FLAG_FIELDS.map((f) => (
              <li key={f.key} className="flex items-start gap-2">
                <span className={cn('material-symbols-outlined text-[18px]', member.flags[f.key] ? 'text-[#15803D]' : 'text-outline')}>
                  {member.flags[f.key] ? 'check_circle' : 'cancel'}
                </span>
                <span>
                  <span className="font-medium">{f.label}</span>
                  <span className="block text-xs text-on-surface-variant">{f.hint}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="text-xs text-on-surface-variant pt-1 border-t border-outline-variant/30">
            الصلاحيات الفعلية: {member.permissions.length ? member.permissions.map(permissionLabel).join('، ') : 'لا شيء'}
            {member.role === 'MANAGER' && ' • مدير المكتب يرى التقارير والعمولات دائمًا.'}
          </div>
        </Card>
      </div>

      {can('broker.reports.view') && <StaffSales member={member} />}

      {wholeOffice ? (
        <StaffBookings member={member} />
      ) : (
        <p className="text-sm text-on-surface-variant">عرض حجوزات الموظفين الآخرين متاح لمدير المكتب ولمن يملك صلاحية التقارير.</p>
      )}

      {editOpen && (
        <StaffFormModal
          member={member}
          selfId={employee?.id}
          onClose={() => setEditOpen(false)}
          onSaved={async (saved, wasSelf) => {
            setEditOpen(false);
            setNotice(`تم حفظ بيانات ${saved.displayName}.`);
            if (wasSelf) await refreshProfile().catch(() => undefined);
          }}
        />
      )}
      {statusOpen && (
        <StaffStatusModal
          member={member}
          selfId={employee?.id}
          onClose={() => setStatusOpen(false)}
          onDone={(saved) => {
            setStatusOpen(false);
            setNotice(statusNotice(saved));
          }}
        />
      )}
    </div>
  );
};

/** GET /broker/reports/by-employee for a period, this employee's row. */
const StaffSales: React.FC<{ member: StaffMember }> = ({ member }) => {
  const [preset, setPreset] = React.useState<Exclude<RangePresetKey, 'custom'>>('30days');
  const range = React.useMemo(() => presetRange(preset), [preset]);
  const report = useReportByEmployee(range, true);
  const row = report.data?.items.find((r) => r.employeeId === member.id);

  return (
    <section className="space-y-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">المبيعات</h2>
        <div className="inline-flex flex-wrap bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-1 gap-1" role="group" aria-label="الفترة">
          {SALES_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={preset === p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold',
                preset === p.key ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:bg-surface-container',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {report.isLoading ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : report.isError ? (
        <ErrorState title="تعذّر تحميل المبيعات" message={errorMessage(report.error)} onRetry={() => report.refetch()} className="my-0" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          <MetricCard title="التذاكر المباعة" value={(row?.ticketsSold ?? 0).toLocaleString('en-US')} subValue={`${range.from} → ${range.to}`} icon="confirmation_number" />
          <MetricCard title="إجمالي المبيعات" value={formatSdg(row?.grossSalesMinor ?? 0)} icon="payments" />
          <MetricCard title="العمولة المستحقة" value={formatSdg(row?.commissionAccruedMinor ?? 0)} icon="currency_exchange" />
        </div>
      )}
    </section>
  );
};

/** GET /broker/bookings?employeeId= (managers / report viewers see the whole office). */
const StaffBookings: React.FC<{ member: StaffMember }> = ({ member }) => {
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const list = useBookings({ page, pageSize: 10, employeeId: member.id });
  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;

  return (
    <section className="space-y-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">
          الحجوزات{meta ? ` (${meta.total.toLocaleString('en-US')})` : ''}
        </h2>
        <Link to={`/bookings?employee=${encodeURIComponent(member.id)}`} className="text-sm font-semibold text-secondary hover:underline">
          فتح في قائمة الحجوزات مع عوامل التصفية
        </Link>
      </div>
      {list.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : list.isError ? (
        <ErrorState title="تعذّر تحميل الحجوزات" message={errorMessage(list.error)} onRetry={() => list.refetch()} className="my-0" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">لا توجد حجوزات لهذا الموظف.</p>
      ) : (
        <>
          <Table className={cn(list.isPlaceholderData && 'opacity-60')}>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الحجز</TableHead>
                <TableHead>الرحلة</TableHead>
                <TableHead>المغادرة</TableHead>
                <TableHead>التذاكر</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>العمولة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => {
                const st = bookingStatusLabel(b.status);
                return (
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                    <TableCell>
                      <Link to={`/bookings/${b.id}`} className="font-mono font-semibold text-secondary hover:underline" onClick={(e) => e.stopPropagation()}>
                        {bookingReference(b)}
                      </Link>
                      <div className="text-[11px] text-on-surface-variant">{formatDateTime(b.confirmedAt ?? b.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      {routeLabel(b.trip.origin, b.trip.destination)}
                      <div className="text-[11px] text-on-surface-variant">{b.trip.company.name}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(b.trip.departureAt)}</TableCell>
                    <TableCell className="tabular-nums">{b.tickets.length}</TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">{formatSdg(b.totalAmountMinor)}</TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">{formatSdg(b.commissionAmountMinor)}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant} dot size="sm">
                        {st.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {meta && <SimplePager page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} disabled={list.isFetching} />}
        </>
      )}
    </section>
  );
};
