import * as React from 'react';
import { useParams } from 'react-router-dom';
import { DetailCrumbs, DetailError, DetailLink, DetailSkeleton, Field, Row } from '../../components/shared/DetailParts';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../lib/api/client';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { formatSdg } from '../../lib/money';
import { cn } from '../../lib/utils';
import { useAuth } from '../auth/auth-context';
import { useTopUp, useTopUpLedgerEntry } from './api';
import { CONFIRMATION_PATH_LABELS, TOP_UP_STATUS_LABELS, topUpTimeline } from './logic';
import { TopUpModal, TopUpStatusBadge } from './TopUpModal';

const CRUMBS = [{ label: 'المحفظة والشحن', path: '/wallet' }];

/**
 * /wallet/top-ups/:intentId — GET /broker/wallet/top-ups/:id (polled while pending): amount, status
 * history, payment references, receipt evidence and the platform's review note. Actions (broker.wallet.topup):
 * continue the payment / attach a receipt on PENDING or FAILED requests. The office never credits the
 * wallet directly and cannot delete a request; the platform confirms or rejects it.
 */
export const TopUpDetailPage: React.FC = () => {
  const { intentId } = useParams();
  const { can, isManager, employee } = useAuth();
  const canTopUp = can('broker.wallet.topup');
  const allowed = canTopUp || isManager;
  const query = useTopUp(allowed ? (intentId ?? null) : null);
  const ledger = useTopUpLedgerEntry(intentId, query.data?.status === 'CONFIRMED');
  const [modalOpen, setModalOpen] = React.useState(false);

  if (!allowed) {
    return (
      <div className="space-y-space-md">
        <DetailCrumbs items={[...CRUMBS, { label: 'طلب شحن' }]} />
        <EmptyState icon="lock" title="لا تملك صلاحية عرض طلبات الشحن" description="طلبات الشحن متاحة لمدير المكتب ولمن يملك صلاحية شحن المحفظة." />
      </div>
    );
  }
  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    return (
      <DetailError
        crumbs={[...CRUMBS, { label: 'طلب شحن' }]}
        notFound={query.error instanceof ApiError && query.error.status === 404}
        notFoundTitle="طلب الشحن غير موجود"
        notFoundMessage="قد يكون الطلب تابعًا لمكتب آخر أو أن الرابط غير صحيح."
        title="تعذّر تحميل طلب الشحن"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  const t = query.data;
  const status = TOP_UP_STATUS_LABELS[t.status];
  const actionable = canTopUp && (t.status === 'PENDING' || t.status === 'FAILED') && employee?.office.status !== 'SUSPENDED';
  const timeline = topUpTimeline(t);

  return (
    <div className="flex flex-col gap-space-lg pb-space-xl">
      <DetailCrumbs items={[...CRUMBS, { label: `طلب شحن ${formatSdg(t.amountMinor)}` }]} />
      <PageHeader
        title={`طلب شحن ${formatSdg(t.amountMinor)}`}
        subtitle={`أُنشئ ${formatDateTime(t.createdAt)} • ${status?.label ?? t.status}`}
        badge={<TopUpStatusBadge status={t.status} />}
        actions={
          actionable ? (
            <Button variant="secondary" icon={t.status === 'FAILED' ? 'upload_file' : 'payments'} onClick={() => setModalOpen(true)}>
              {t.status === 'FAILED' ? 'إعادة إرفاق إيصال' : 'متابعة الدفع / إرفاق إيصال'}
            </Button>
          ) : undefined
        }
        className="mb-0"
      />

      {t.status === 'PENDING' && (
        <p className="text-xs text-on-surface-variant flex items-center gap-1" aria-live="polite">
          <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          نتابع حالة الدفع تلقائيًا…
        </p>
      )}
      {t.status === 'FAILED' && t.note && (
        <div role="alert" className="rounded-lg border border-error/40 bg-error-container/40 px-space-md py-2 text-sm">
          <strong>ملاحظة المراجعة / سبب الرفض:</strong> {t.note}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card className="lg:col-span-2 space-y-space-sm">
          <h2 className="font-bold">بيانات الطلب</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-space-lg gap-y-3 text-sm">
            <Field label="المبلغ">{formatSdg(t.amountMinor)}</Field>
            <Field label="الحالة">{status?.label ?? t.status}</Field>
            <Field label="طريقة التأكيد">{CONFIRMATION_PATH_LABELS[t.confirmationPath] ?? t.confirmationPath}</Field>
            <Field label="مزود الدفع">{t.provider}</Field>
            <Field label="مرجع الدفع لدى المزود" mono>
              {t.providerRef ?? '—'}
            </Field>
            <Field label="مرجع التحويل / الإيصال" mono>
              {t.paymentReferenceNormalized ?? '—'}
            </Field>
            <Field label="تاريخ الإنشاء">{formatDateTime(t.createdAt)}</Field>
            <Field label="تاريخ التأكيد">{formatDateTime(t.confirmedAt)}</Field>
            {t.failedAt && <Field label="تاريخ الرفض / الفشل">{formatDateTime(t.failedAt)}</Field>}
            <Field label="رقم الطلب" mono>
              {t.id}
            </Field>
          </dl>
        </Card>
        <Card className="space-y-space-sm">
          <h2 className="font-bold">الإيصال والمراجعة</h2>
          <dl className="space-y-3 text-sm">
            <Row label="إيصال مرفق">{t.hasEvidence ? 'نعم' : 'لا'}</Row>
            <Row label="مرجع الإيصال">
              <span className="font-mono text-xs" dir="ltr">
                {t.paymentReferenceNormalized ?? '—'}
              </span>
            </Row>
          </dl>
          <div className="text-sm">
            <div className="text-xs text-on-surface-variant">{t.status === 'FAILED' ? 'ملاحظة المراجعة (سبب الرفض)' : 'ملاحظة المكتب'}</div>
            <p className={cn('mt-0.5', t.status === 'FAILED' && 'text-error')}>{t.note ?? '—'}</p>
          </div>
          {t.hasEvidence && <p className="text-xs text-on-surface-variant">ملف الإيصال محفوظ لدى المنصة للمراجعة ولا يمكن تنزيله من لوحة المكتب.</p>}
        </Card>
      </div>

      <section className="space-y-space-sm">
        <h2 className="font-bold">سجل الحالة</h2>
        <ol className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md space-y-3">
          {timeline.map((s) => (
            <li key={s.key} className="flex items-start gap-3 text-sm">
              <span
                className={cn(
                  'mt-1 w-3 h-3 rounded-full shrink-0',
                  s.tone === 'error' ? 'bg-error' : s.tone === 'current' ? 'border-2 border-secondary animate-pulse' : 'bg-secondary',
                )}
                aria-hidden="true"
              />
              <div>
                <div className={cn('font-semibold', s.tone === 'error' && 'text-error')}>{s.label}</div>
                {s.at && <div className="text-xs text-on-surface-variant">{formatDateTime(s.at)}</div>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {t.status === 'CONFIRMED' && (
        <Card className="space-y-space-sm">
          <h2 className="font-bold">حركة المحفظة</h2>
          {ledger.isLoading ? (
            <p className="text-sm text-on-surface-variant">جارٍ البحث عن حركة الإضافة…</p>
          ) : ledger.data ? (
            <>
              <dl className="space-y-2 text-sm">
                <Row label="أُضيف إلى الرصيد">{formatSdg(ledger.data.amountMinor)}</Row>
                <Row label="الرصيد بعد الإضافة">{formatSdg(ledger.data.balanceAfterMinor)}</Row>
                <Row label="التاريخ">{formatDateTime(ledger.data.createdAt)}</Row>
              </dl>
              <DetailLink to={`/wallet/ledger/${ledger.data.id}`} className="text-sm">
                فتح الحركة
              </DetailLink>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">لم تُعثر على حركة الإضافة في سجل المحفظة.</p>
          )}
        </Card>
      )}

      {modalOpen && <TopUpModal open onOpenChange={(o) => !o && setModalOpen(false)} initialIntent={t} canAct={canTopUp} />}
    </div>
  );
};
