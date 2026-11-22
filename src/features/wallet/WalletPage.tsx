import * as React from 'react';
import { SimplePager } from '../../components/shared/SimplePager';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useBrokerWallet, useTopUps, useWalletLedger, type TopUpIntent, type TopUpStatus } from './api';
import { TOP_UP_STATUS_LABELS, ledgerTypeLabel, signedAmountMinor } from './logic';
import { TopUpModal, TopUpStatusBadge } from './TopUpModal';

const REFERENCE_LABELS: Record<string, string> = {
  top_up_intent: 'طلب شحن',
  booking: 'حجز',
  commission_settlement: 'تسوية عمولة',
};

function shortId(id: string): string {
  return id.length > 10 ? `…${id.slice(-8)}` : id;
}

/** Office wallet: balance, paginated ledger, and the top-up flow (`broker.wallet.topup`). */
export const WalletPage: React.FC = () => {
  const { can, employee, isManager } = useAuth();
  const canTopUp = can('broker.wallet.topup');
  const officeSuspended = employee?.office.status === 'SUSPENDED';
  const wallet = useBrokerWallet();
  const [page, setPage] = React.useState(1);
  const ledger = useWalletLedger(page);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [reopen, setReopen] = React.useState<TopUpIntent | null>(null);
  // Same rule as GET /broker/wallet/top-ups: broker.wallet.topup or the office manager.
  const canSeeTopUps = canTopUp || isManager;
  const [topUpPage, setTopUpPage] = React.useState(1);
  const [topUpStatus, setTopUpStatus] = React.useState<TopUpStatus | ''>('');
  const topUps = useTopUps(topUpPage, topUpStatus, canSeeTopUps);
  const topUpRows = topUps.data?.data ?? [];

  const openModal = (intent: TopUpIntent | null) => {
    setReopen(intent);
    setModalOpen(true);
  };

  const w = wallet.data;
  const entries = ledger.data?.data ?? [];
  const meta = ledger.data?.meta;

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg">
      <PageHeader
        title="المحفظة والشحن"
        subtitle="رصيد المكتب المدفوع مسبقًا يُستخدم لخصم قيمة الحجوزات."
        actions={
          canTopUp ? (
            <Button variant="secondary" icon="add_card" disabled={officeSuspended} onClick={() => openModal(null)}>
              شحن المحفظة
            </Button>
          ) : undefined
        }
      />

      {officeSuspended && (
        <div role="alert" className="rounded-lg border border-error/40 bg-error-container/40 px-space-md py-2 text-sm">
          المكتب موقوف حاليًا: شحن المحفظة متوقف. تواصل مع إدارة المنصة.
        </div>
      )}

      {wallet.isLoading ? (
        <Skeleton className="h-36 rounded-2xl" />
      ) : wallet.isError ? (
        <ErrorState title="تعذّر تحميل المحفظة" message={errorMessage(wallet.error)} onRetry={() => wallet.refetch()} />
      ) : w ? (
        <section className="rounded-2xl bg-secondary text-on-secondary p-space-lg flex flex-wrap items-end justify-between gap-space-md">
          <div>
            <div className="text-sm opacity-90">الرصيد الحالي</div>
            <div className="text-3xl font-bold tabular-nums mt-1">{formatSdg(w.balanceMinor)}</div>
            {w.lowBalance ? (
              <div className="text-xs mt-2 bg-on-secondary/15 rounded px-2 py-0.5 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                الرصيد أقل من حد التنبيه ({formatSdg(w.lowBalanceThresholdMinor)}) — اشحن المحفظة لمواصلة الحجز
              </div>
            ) : (
              <div className="text-xs mt-2 opacity-80">حد تنبيه الرصيد المنخفض: {formatSdg(w.lowBalanceThresholdMinor)}</div>
            )}
          </div>
          {typeof w.updatedAt === 'string' && <div className="text-xs opacity-80">آخر تحديث: {formatDateTime(w.updatedAt)}</div>}
        </section>
      ) : null}

      {!canTopUp && (
        <p className="text-xs text-on-surface-variant">شحن المحفظة متاح للموظفين الذين يملكون صلاحية الشحن فقط.</p>
      )}

      {canSeeTopUps && (
        <Card className="space-y-space-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-on-surface">طلبات الشحن</h2>
              <p className="text-xs text-on-surface-variant">الطلبات المؤكدة تظهر أيضًا في سجل الحركات أدناه.</p>
            </div>
            <select
              aria-label="تصفية حسب الحالة"
              value={topUpStatus}
              onChange={(e) => {
                setTopUpStatus(e.target.value as TopUpStatus | '');
                setTopUpPage(1);
              }}
              className="h-9 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-2 text-sm"
            >
              <option value="">كل الحالات</option>
              {(Object.keys(TOP_UP_STATUS_LABELS) as TopUpStatus[]).map((st) => (
                <option key={st} value={st}>
                  {TOP_UP_STATUS_LABELS[st]!.label}
                </option>
              ))}
            </select>
          </div>
          {topUps.isLoading ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : topUps.isError ? (
            <ErrorState title="تعذّر تحميل طلبات الشحن" message={errorMessage(topUps.error)} onRetry={() => topUps.refetch()} className="my-0" />
          ) : topUpRows.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-space-sm">لا توجد طلبات شحن{topUpStatus ? ' بهذه الحالة' : ''}.</p>
          ) : (
            <>
              <ul className="divide-y divide-surface-container">
                {topUpRows.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-space-md gap-y-1 py-2 text-sm">
                    <span className="tabular-nums font-semibold min-w-24">{formatSdg(t.amountMinor)}</span>
                    <TopUpStatusBadge status={t.status} />
                    <span className="text-xs text-on-surface-variant">
                      {formatDateTime(t.createdAt)}
                      {t.confirmationPath === 'MANUAL_FALLBACK' && ' · إيصال يدوي'}
                    </span>
                    {t.status === 'FAILED' && t.note && <span className="text-xs text-error basis-full">سبب الرفض: {t.note}</span>}
                    <span className="ms-auto">
                      {canTopUp && (t.status === 'PENDING' || t.status === 'FAILED') ? (
                        <Button size="sm" variant="outline" onClick={() => openModal(t)}>
                          {t.status === 'FAILED' ? 'إعادة إرفاق إيصال' : 'متابعة الدفع / إرفاق إيصال'}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => openModal(t)}>
                          التفاصيل
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {topUps.data?.meta && (
                <SimplePager
                  page={topUps.data.meta.page}
                  totalPages={topUps.data.meta.totalPages}
                  total={topUps.data.meta.total}
                  onPageChange={setTopUpPage}
                  disabled={topUps.isFetching}
                />
              )}
            </>
          )}
        </Card>
      )}

      <section className="space-y-space-sm">
        <h2 className="font-bold text-on-surface">سجل حركات المحفظة</h2>
        {ledger.isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : ledger.isError ? (
          <ErrorState title="تعذّر تحميل سجل الحركات" message={errorMessage(ledger.error)} onRetry={() => ledger.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState icon="receipt_long" title="لا توجد حركات بعد" description="ستظهر هنا عمليات الشحن وخصومات الحجوزات والاستردادات." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الرصيد بعد الحركة</TableHead>
                  <TableHead>المرجع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const signed = signedAmountMinor(e);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(e.createdAt)}</TableCell>
                      <TableCell>
                        <Badge size="sm" variant={e.direction === 'CREDIT' ? 'success' : 'neutral'}>
                          {ledgerTypeLabel(e.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn('tabular-nums font-semibold whitespace-nowrap', signed < 0 ? 'text-error' : 'text-[#15803D]')} dir="ltr">
                        {signed < 0 ? '−' : '+'}
                        {formatSdg(Math.abs(signed))}
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">{formatSdg(e.balanceAfterMinor)}</TableCell>
                      <TableCell className="text-xs text-on-surface-variant">
                        {e.referenceType ? (
                          <span title={e.referenceId ?? undefined}>
                            {REFERENCE_LABELS[e.referenceType] ?? e.referenceType}
                            {e.referenceId && <span className="font-mono ms-1" dir="ltr">{shortId(e.referenceId)}</span>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {meta && (
              <SimplePager page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} disabled={ledger.isFetching} />
            )}
          </>
        )}
      </section>

      {modalOpen && (
        <TopUpModal
          open
          onOpenChange={(o) => {
            if (!o) setModalOpen(false);
          }}
          initialIntent={reopen}
          canAct={canTopUp}
        />
      )}
    </div>
  );
};
