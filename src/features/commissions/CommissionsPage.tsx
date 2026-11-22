import * as React from 'react';
import { SimplePager } from '../../components/shared/SimplePager';
import { Badge } from '../../components/ui/Badge';
import { MetricCard } from '../../components/ui/Card';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { ACCRUAL_STATUS, ACCRUAL_TABS, ACCRUAL_TAB_HINTS, useBrokerCommissions, type AccrualStatus } from './api';

function shortId(id: string): string {
  return id.length > 10 ? `…${id.slice(-8)}` : id;
}

/** Office commissions (reports.view or manager). Settlement is done by the platform (D-SET-01). */
export const CommissionsPage: React.FC = () => {
  const { can } = useAuth();
  const allowed = can('broker.reports.view');
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<AccrualStatus>('UNSETTLED');
  const q = useBrokerCommissions(page, status, allowed);

  if (!allowed) {
    return <EmptyState icon="lock" title="لا تملك صلاحية عرض العمولات" description="العمولات متاحة لمدير المكتب ولمن يملك صلاحية التقارير." />;
  }

  const d = q.data?.data;
  const meta = q.data?.meta;

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg">
      <PageHeader title="العمولات" subtitle="عمولة المكتب عن كل حجز مؤكد." />

      <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low px-space-md py-3 text-sm flex gap-2">
        <span className="material-symbols-outlined text-secondary">info</span>
        <p>
          تُستحق العمولة عند تأكيد الحجز وتُلغى تلقائيًا إذا أُلغي الحجز. تتولى إدارة المنصة تسوية العمولات ودفعها للمكتب بشكل دوري؛
          لا يمكن سحب العمولات أو تحويلها إلى رصيد المحفظة من هنا.
        </p>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState title="تعذّر تحميل العمولات" message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : d ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            <MetricCard title="عمولات غير مُسوّاة" value={formatSdg(d.totalUnsettledMinor)} subValue="بانتظار تسوية المنصة" icon="currency_exchange" />
            <MetricCard title="عدد الحجوزات" value={d.unsettledCount.toLocaleString('en-US')} subValue="ذات عمولة غير مُسوّاة" icon="confirmation_number" />
            <MetricCard title="آخر تسوية" value={d.lastSettledAt ? formatDateTime(d.lastSettledAt) : 'لم تتم بعد'} icon="event_available" />
          </div>

          <section className="space-y-space-sm">
            <div className="flex flex-wrap items-center gap-space-sm">
              <h2 className="font-bold text-on-surface">سجل العمولات</h2>
              <div role="tablist" aria-label="حالة العمولة" className="inline-flex flex-wrap bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-1 gap-1">
                {ACCRUAL_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={status === t}
                    onClick={() => {
                      setStatus(t);
                      setPage(1);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                      status === t ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container',
                    )}
                  >
                    {ACCRUAL_STATUS[t].label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-on-surface-variant">{ACCRUAL_TAB_HINTS[status]}</p>
            {d.items.length === 0 ? (
              <EmptyState icon="currency_exchange" title={`لا توجد عمولات «${ACCRUAL_STATUS[status].label}»`} />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>تاريخ التأكيد</TableHead>
                      <TableHead>الحجز</TableHead>
                      <TableHead>قيمة الحجز</TableHead>
                      <TableHead>العمولة</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((a) => {
                      const s = ACCRUAL_STATUS[a.status] ?? { label: a.status, variant: 'info' as const };
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs whitespace-nowrap">{formatDateTime(a.booking.confirmedAt ?? a.createdAt)}</TableCell>
                          <TableCell className="font-mono text-xs" dir="ltr" title={a.bookingId}>
                            {shortId(a.bookingId)}
                          </TableCell>
                          <TableCell className="tabular-nums">{formatSdg(a.booking.totalAmountMinor)}</TableCell>
                          <TableCell className="tabular-nums font-semibold">{formatSdg(a.amountMinor)}</TableCell>
                          <TableCell>
                            <Badge size="sm" dot variant={s.variant}>
                              {s.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {meta && <SimplePager page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} disabled={q.isFetching} />}
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};
