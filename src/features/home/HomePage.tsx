import * as React from 'react';
import { Link } from 'react-router-dom';
import { MetricCard } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { errorMessage } from '../../lib/api/errors';
import { formatSdg } from '../../lib/money';
import { useAuth } from '../auth/auth-context';
import { useBrokerDashboard, useBrokerWallet } from './api';

/** Broker home (Figma broker Home): today's sales, wallet balance, quick actions. */
export const HomePage: React.FC = () => {
  const { employee, can } = useAuth();
  const dashboard = useBrokerDashboard();
  const wallet = useBrokerWallet();
  const d = dashboard.data;
  const w = wallet.data;

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg">
      <div>
        <h1 className="font-headline-md text-headline-md font-bold text-on-surface">مرحبًا، {employee?.displayName}</h1>
        <p className="text-sm text-on-surface-variant">{employee?.office.name}</p>
      </div>

      {employee?.office.status === 'SUSPENDED' && (
        <div role="alert" className="rounded-lg border border-error/40 bg-error-container/40 px-space-md py-2 text-sm">
          المكتب موقوف حاليًا: الحجز وشحن المحفظة متوقفان. تواصل مع إدارة المنصة.
        </div>
      )}

      <section className="space-y-space-sm">
        <h2 className="font-bold text-on-surface">
          أداء اليوم {d?.scope === 'SELF' && <span className="text-xs font-normal text-on-surface-variant">(مبيعاتك أنت)</span>}
        </h2>
        {dashboard.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : dashboard.isError ? (
          <ErrorState title="تعذّر تحميل أداء اليوم" message={errorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />
        ) : d ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            <MetricCard title="تذاكر اليوم" value={d.ticketsSold.toLocaleString('en-US')} subValue={`${d.bookingsCount} حجز`} icon="confirmation_number" />
            <MetricCard title="إجمالي المبيعات" value={formatSdg(d.grossSalesMinor)} icon="payments" />
            <MetricCard title="العمولة المستحقة" value={formatSdg(d.commissionAccruedMinor)} subValue="تُسوّى لاحقًا من الإدارة" icon="currency_exchange" />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-secondary text-on-secondary p-space-lg flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <div className="text-sm opacity-90">الرصيد الحالي للمكتب</div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {wallet.isLoading ? '…' : wallet.isError ? '—' : formatSdg(w?.balanceMinor)}
          </div>
          {w?.lowBalance && <div className="text-xs mt-1 bg-on-secondary/15 rounded px-2 py-0.5 inline-block">الرصيد منخفض — اشحن المحفظة لمواصلة الحجز</div>}
        </div>
        <Link to="/wallet" className="text-sm underline underline-offset-4">المحفظة والشحن</Link>
      </section>

      <section className="space-y-space-sm">
        <h2 className="font-bold text-on-surface">الوصول السريع</h2>
        <div className="flex flex-wrap gap-space-sm">
          {can('broker.book') && (
            <Link to="/booking/new" className="flex items-center gap-2 rounded-xl border border-surface-container-high bg-surface-container-lowest px-4 py-3 hover:bg-surface-container">
              <span className="material-symbols-outlined">add_circle</span> حجز رحلة جديدة
            </Link>
          )}
          <Link to="/bookings" className="flex items-center gap-2 rounded-xl border border-surface-container-high bg-surface-container-lowest px-4 py-3 hover:bg-surface-container">
            <span className="material-symbols-outlined">confirmation_number</span> إدارة الحجوزات
          </Link>
        </div>
      </section>
    </div>
  );
};
