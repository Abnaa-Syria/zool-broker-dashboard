import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { Input, SearchInput } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useAssignedCarriers } from '../booking/api';
import { useBookings, useStaffOptions } from './api';
import {
  filtersFromParams,
  filtersToParams,
  matchesSearch,
  toBookingsQuery,
  type BookingFilters,
  type RangePreset,
  type StatusTab,
} from './filters';
import { bookingReference, routeLabel, bookingStatusLabel } from './labels';

const TABS: Array<{ id: StatusTab; label: string }> = [
  { id: 'ALL', label: 'الكل' },
  { id: 'CONFIRMED', label: 'مؤكدة' },
  { id: 'CANCELLED', label: 'ملغاة' },
];

const RANGES: Array<{ id: RangePreset; label: string }> = [
  { id: 'all', label: 'كل الفترات' },
  { id: 'today', label: 'اليوم' },
  { id: '7days', label: 'آخر 7 أيام' },
  { id: '30days', label: 'آخر 30 يومًا' },
  { id: 'custom', label: 'فترة مخصصة' },
];

const selectClass =
  'h-10 rounded-lg bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/60 px-3 focus:outline-none focus:ring-2 focus:ring-secondary/30';

/** GET /broker/bookings — clerks without report access only get their own bookings (API-scoped). */
export const BookingsListPage: React.FC = () => {
  const { can, isManager } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const [search, setSearch] = React.useState('');

  const wholeOffice = isManager || can('broker.reports.view');
  const staffAccess = wholeOffice && can('broker.staff.manage');
  const staff = useStaffOptions(staffAccess);
  const carriers = useAssignedCarriers();
  const list = useBookings(toBookingsQuery(filters, { canFilterEmployee: wholeOffice }));

  const update = (patch: Partial<BookingFilters>) => {
    const next = { ...filters, page: 1, ...patch };
    setParams(filtersToParams(next), { replace: true });
  };

  const rows = (list.data?.data ?? []).filter((b) => matchesSearch(b, search));
  const meta = list.data?.meta;

  return (
    <div className="flex flex-col gap-space-md pb-space-xl">
      <PageHeader
        title="الحجوزات والتذاكر"
        subtitle={wholeOffice ? 'كل حجوزات المكتب' : 'حجوزاتك أنت فقط'}
        actions={
          can('broker.book') ? (
            <Button icon="add_circle" onClick={() => navigate('/booking/new')}>
              حجز جديد
            </Button>
          ) : undefined
        }
        className="mb-0"
      />

      <div role="tablist" className="inline-flex self-start rounded-lg bg-surface-container-lowest border border-outline-variant/40 p-1 gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={filters.tab === t.id}
            type="button"
            onClick={() => update({ tab: t.id })}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-semibold',
              filters.tab === t.id ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:bg-surface-container',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-space-sm">
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="رقم الحجز، اسم أو هاتف المسافر، رقم التذكرة"
            aria-label="بحث في الصفحة الحالية"
          />
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          فترة التأكيد
          <select className={selectClass} value={filters.range} onChange={(e) => update({ range: e.target.value as RangePreset })}>
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {filters.range === 'custom' && (
          <>
            <div className="w-40">
              <Input type="date" label="من" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
            </div>
            <div className="w-40">
              <Input type="date" label="إلى" value={filters.to} onChange={(e) => update({ to: e.target.value })} />
            </div>
          </>
        )}
        {(carriers.data?.length ?? 0) > 1 && (
          <label className="flex flex-col gap-1 text-xs font-semibold">
            شركة النقل
            <select className={selectClass} value={filters.companyId} onChange={(e) => update({ companyId: e.target.value })}>
              <option value="">كل الشركات</option>
              {carriers.data?.map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {staffAccess && staff.data && (
          <label className="flex flex-col gap-1 text-xs font-semibold">
            الموظف
            <select className={selectClass} value={filters.employeeId} onChange={(e) => update({ employeeId: e.target.value })}>
              <option value="">كل الموظفين</option>
              {staff.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {search && <p className="text-xs text-on-surface-variant">البحث يشمل الصفحة الحالية فقط.</p>}

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState title="تعذّر تحميل الحجوزات" message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="confirmation_number"
          title={search ? 'لا نتائج مطابقة في هذه الصفحة' : 'لا توجد حجوزات'}
          description={search ? 'جرّب صفحة أخرى أو غيّر عوامل التصفية.' : 'لا توجد حجوزات تطابق عوامل التصفية الحالية.'}
          actionText={can('broker.book') && !search ? 'حجز جديد' : undefined}
          onAction={() => navigate('/booking/new')}
        />
      ) : (
        <Table className={cn(list.isPlaceholderData && 'opacity-60')}>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الحجز</TableHead>
              <TableHead>المسافر</TableHead>
              <TableHead>الرحلة</TableHead>
              <TableHead>المغادرة</TableHead>
              <TableHead>التذاكر</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>العمولة</TableHead>
              {wholeOffice && <TableHead>الموظف</TableHead>}
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => {
              const status = bookingStatusLabel(b.status);
              const first = b.passengers[0];
              return (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                  <TableCell>
                    <Link to={`/bookings/${b.id}`} className="font-mono font-semibold text-secondary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {bookingReference(b)}
                    </Link>
                    <div className="text-[11px] text-on-surface-variant">{formatDateTime(b.confirmedAt ?? b.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{first?.fullName ?? '—'}</div>
                    {b.passengers.length > 1 && <div className="text-[11px] text-on-surface-variant">+{b.passengers.length - 1} مسافر</div>}
                  </TableCell>
                  <TableCell>
                    <div>
                      {routeLabel(b.trip.origin, b.trip.destination)}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">{b.trip.company.name}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(b.trip.departureAt)}</TableCell>
                  <TableCell className="tabular-nums">{b.tickets.length}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">{formatSdg(b.totalAmountMinor)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">{formatSdg(b.commissionAmountMinor)}</TableCell>
                  {wholeOffice && <TableCell>{b.employee?.displayName ?? '—'}</TableCell>}
                  <TableCell>
                    <Badge variant={status.variant} dot size="sm">
                      {status.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-on-surface-variant">
            صفحة {meta.page} من {meta.totalPages} • {meta.total.toLocaleString('en-US')} حجز
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon="chevron_right" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon="chevron_left"
              iconPosition="end"
              disabled={filters.page >= meta.totalPages}
              onClick={() => update({ page: filters.page + 1 })}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
