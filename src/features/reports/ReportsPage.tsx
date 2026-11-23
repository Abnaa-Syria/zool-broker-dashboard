import * as React from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, MetricCard } from '../../components/ui/Card';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { errorMessage } from '../../lib/api/errors';
import { sudanDate } from '../../lib/dates';
import { formatSdg, minorToSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useReportByCarrier, useReportByEmployee, useReportSummary, useWalletActivity } from './api';
import { RANGE_PRESETS, presetRange, validateRange, type DateRange, type RangePresetKey } from './range';

type SalesTableRow = { key: string; label: string; href?: string; ticketsSold: number; grossSalesMinor: number; commissionAccruedMinor: number };

const BAR_COLOR = '#226a4b'; // theme `secondary`

/** Single-series horizontal bars (gross sales) + the same rows as a table. */
const SalesBreakdown: React.FC<{
  title: string;
  firstColumn: string;
  rows: SalesTableRow[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}> = ({ title, firstColumn, rows, isLoading, error, onRetry }) => {
  const chartData = (rows ?? []).slice(0, 10).map((r) => ({ name: r.label, amount: minorToSdg(r.grossSalesMinor) }));
  return (
    <Card className="space-y-space-md">
      <h2 className="font-bold text-on-surface">{title}</h2>
      {isLoading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : error ? (
        <ErrorState title={`تعذّر تحميل ${title}`} message={errorMessage(error)} onRetry={onRetry} className="my-0" />
      ) : !rows || rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant py-space-md text-center">لا توجد مبيعات مؤكدة في هذه الفترة.</p>
      ) : (
        <>
          <div style={{ height: Math.max(120, chartData.length * 36 + 40) }} aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#d5eee0" horizontal={false} />
                <XAxis
                  type="number"
                  reversed
                  tick={{ fontSize: 11, fill: '#5f6f66' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v.toLocaleString('en-US', { notation: 'compact' })}
                />
                <YAxis type="category" dataKey="name" width={120} orientation="right" tick={{ fontSize: 11, fill: '#1b2b22' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(34,106,75,0.06)' }} formatter={(v) => [`${Number(v).toLocaleString('en-US')} ج.س`, 'المبيعات']} />
                <Bar dataKey="amount" fill={BAR_COLOR} radius={[4, 0, 0, 4]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-on-surface-variant text-xs">
                <tr>
                  <th className="py-2 px-2 font-medium">{firstColumn}</th>
                  <th className="py-2 px-2 font-medium">التذاكر</th>
                  <th className="py-2 px-2 font-medium">المبيعات</th>
                  <th className="py-2 px-2 font-medium">العمولة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-surface-container">
                    <td className="py-2 px-2">
                      {r.href ? (
                        <Link to={r.href} className="text-secondary hover:underline">
                          {r.label}
                        </Link>
                      ) : (
                        r.label
                      )}
                    </td>
                    <td className="py-2 px-2 tabular-nums">{r.ticketsSold.toLocaleString('en-US')}</td>
                    <td className="py-2 px-2 tabular-nums">{formatSdg(r.grossSalesMinor)}</td>
                    <td className="py-2 px-2 tabular-nums">{formatSdg(r.commissionAccruedMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
};

/** Office reports (reports.view or manager) for a Sudan-day range. */
export const ReportsPage: React.FC = () => {
  const { can } = useAuth();
  const allowed = can('broker.reports.view');
  const staffPages = can('broker.staff.manage');
  const [preset, setPreset] = React.useState<RangePresetKey>('7days');
  const [custom, setCustom] = React.useState<DateRange>(() => presetRange('7days'));
  const range = React.useMemo(() => (preset === 'custom' ? custom : presetRange(preset)), [preset, custom]);
  const rangeError = validateRange(range);
  const enabled = allowed && !rangeError;

  const summary = useReportSummary(range, enabled);
  const byEmployee = useReportByEmployee(range, enabled);
  const byCarrier = useReportByCarrier(range, enabled);
  const wallet = useWalletActivity(range, enabled);

  if (!allowed) {
    return <EmptyState icon="lock" title="لا تملك صلاحية عرض التقارير" description="التقارير متاحة لمدير المكتب ولمن يملك صلاحية التقارير." />;
  }

  const s = summary.data;
  const w = wallet.data;
  const today = sudanDate();

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg">
      <PageHeader title="التقارير" subtitle="مبيعات المكتب المؤكدة حسب أيام توقيت السودان." />

      <div className="flex flex-wrap items-end gap-space-sm">
        <div className="inline-flex flex-wrap items-center bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-1 shadow-sm gap-1" role="group" aria-label="الفترة">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={preset === p.key}
              onClick={() => {
                if (p.key === 'custom') setCustom(range);
                setPreset(p.key);
              }}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                preset === p.key ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex gap-space-sm items-end">
            <div className="w-40">
              <Input label="من" type="date" max={today} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </div>
            <div className="w-40">
              <Input label="إلى" type="date" max={today} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </div>
          </div>
        )}
        <span className="text-xs text-on-surface-variant pb-2 tabular-nums" dir="ltr">
          {range.from} → {range.to}
        </span>
      </div>
      {rangeError && (
        <p role="alert" className="text-sm text-error">
          {rangeError}
        </p>
      )}

      {!rangeError && (
        <>
          {summary.isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-space-md">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : summary.isError ? (
            <ErrorState title="تعذّر تحميل ملخص التقرير" message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
          ) : s ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-space-md">
              <MetricCard title="التذاكر المباعة" value={s.ticketsSold.toLocaleString('en-US')} icon="confirmation_number" />
              <MetricCard title="إجمالي المبيعات" value={formatSdg(s.grossSalesMinor)} icon="payments" />
              <MetricCard title="العمولة المستحقة" value={formatSdg(s.commissionAccruedMinor)} subValue="تُسوّى من المنصة" icon="currency_exchange" />
              <MetricCard title="الإلغاءات" value={s.cancellations.toLocaleString('en-US')} icon="cancel" />
              <MetricCard title="المبالغ المستردة" value={formatSdg(s.refundsMinor)} subValue="أُعيدت للمحفظة" icon="undo" />
            </div>
          ) : null}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
            <SalesBreakdown
              title="المبيعات حسب الموظف"
              firstColumn="الموظف"
              rows={byEmployee.data?.items.map((r) => ({
                ...r,
                key: r.employeeId,
                label: r.displayName,
                href: staffPages ? `/staff/${r.employeeId}` : `/bookings?employee=${encodeURIComponent(r.employeeId)}`,
              }))}
              isLoading={byEmployee.isLoading}
              error={byEmployee.error}
              onRetry={() => byEmployee.refetch()}
            />
            <SalesBreakdown
              title="المبيعات حسب شركة النقل"
              firstColumn="شركة النقل"
              rows={byCarrier.data?.items.map((r) => ({ ...r, key: r.companyId, label: r.name, href: `/bookings?carrier=${encodeURIComponent(r.companyId)}` }))}
              isLoading={byCarrier.isLoading}
              error={byCarrier.error}
              onRetry={() => byCarrier.refetch()}
            />
          </div>

          <Card className="space-y-space-md">
            <h2 className="font-bold text-on-surface">حركة المحفظة في الفترة</h2>
            {wallet.isLoading ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : wallet.isError ? (
              <ErrorState title="تعذّر تحميل حركة المحفظة" message={errorMessage(wallet.error)} onRetry={() => wallet.refetch()} className="my-0" />
            ) : w ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
                {[
                  { label: 'عمليات الشحن', b: w.topUps, sign: '+' },
                  { label: 'خصومات الحجوزات', b: w.bookingDebits, sign: '−' },
                  { label: 'استردادات الإلغاء', b: w.refunds, sign: '+' },
                  { label: 'تسويات العمولة', b: w.commissionPayouts, sign: '−' },
                ].map((x) => (
                  <div key={x.label} className="rounded-lg bg-surface-container-low p-space-md">
                    <div className="text-xs text-on-surface-variant">{x.label}</div>
                    <div className="text-lg font-bold tabular-nums mt-1" dir="ltr">
                      {x.b.totalMinor > 0 ? x.sign : ''}
                      {formatSdg(x.b.totalMinor)}
                    </div>
                    <div className="text-xs text-on-surface-variant">{x.b.count.toLocaleString('en-US')} حركة</div>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
};
