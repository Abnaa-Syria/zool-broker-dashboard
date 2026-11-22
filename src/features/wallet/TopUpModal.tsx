import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../../components/ui/Modal';
import { ApiError } from '../../lib/api/client';
import { errorMessage } from '../../lib/api/errors';
import { formatSdg } from '../../lib/money';
import { useCreateTopUp, useMockConfirmTopUp, useSubmitTopUpEvidence, useTopUp, type TopUpIntent } from './api';
import { TOP_UP_STATUS_LABELS, idempotencyKeyFor, minTopUpFromError, parseSdgInput, validateReceipt } from './logic';

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `topup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function topUpError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'MOCK_PAYMENT_DISABLED') return 'التأكيد التجريبي غير متاح في هذه البيئة. استخدم الدفع الفعلي أو أرفق الإيصال.';
    if (error.code === 'CONFLICT') return 'تعارض: مرجع الدفع أو مفتاح الطلب مستخدم مسبقًا. تحقق من البيانات وحاول مجددًا.';
    const min = minTopUpFromError(error);
    if (min !== null) return `مبلغ الشحن أقل من الحد الأدنى (${formatSdg(min)}).`;
  }
  return errorMessage(error);
}

export const TopUpStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = TOP_UP_STATUS_LABELS[status] ?? { label: status, variant: 'info' as const };
  return (
    <Badge variant={s.variant} size="sm" dot>
      {s.label}
    </Badge>
  );
};

/**
 * Mount it only while open (`{open && <TopUpModal …/>}`) so every opening starts fresh.
 *
 * Top-up flow (D-ADMIN-TOPUP-01): create an intent (idempotent), then either the payment provider
 * confirms it and the wallet is credited automatically, or the office uploads a receipt and the
 * platform reviews it. There is never a direct wallet credit from the office (D-ADJ-01).
 */
export const TopUpModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Re-open an existing intent (e.g. to attach a receipt later or follow its status). */
  initialIntent?: TopUpIntent | null;
  /** False for viewers without broker.wallet.topup (e.g. a manager without the flag): details only. */
  canAct?: boolean;
}> = ({ open, onOpenChange, initialIntent, canAct = true }) => {
  const [amount, setAmount] = React.useState('');
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [minHint, setMinHint] = React.useState<number | null>(null);
  const keyRef = React.useRef<{ amountMinor: number; key: string } | null>(null);
  const [intentId, setIntentId] = React.useState<string | null>(initialIntent?.id ?? null);
  // Live status from GET /broker/wallet/top-ups/:id (polled while pending); mutations write into the same cache.
  const detail = useTopUp(intentId, initialIntent);
  const intent = detail.data ?? null;
  const [mode, setMode] = React.useState<'choose' | 'manual'>('choose');
  const [reference, setReference] = React.useState('');
  const [note, setNote] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const create = useCreateTopUp();
  const evidence = useSubmitTopUpEvidence();
  const mock = useMockConfirmTopUp();

  const update = (next: TopUpIntent) => setIntentId(next.id);

  const submitAmount = (e: React.FormEvent) => {
    e.preventDefault();
    const minor = parseSdgInput(amount);
    if (minor === null) {
      setAmountError('أدخل مبلغًا صحيحًا بالجنيه السوداني (حتى منزلتين عشريتين).');
      return;
    }
    setAmountError(null);
    keyRef.current = idempotencyKeyFor(keyRef.current, minor, newKey);
    create.mutate(
      { amountMinor: minor, idempotencyKey: keyRef.current.key },
      {
        onSuccess: update,
        onError: (err) => {
          const min = minTopUpFromError(err);
          if (min !== null) setMinHint(min);
          setAmountError(topUpError(err));
        },
      },
    );
  };

  const submitEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent) return;
    if (!reference.trim()) {
      setFormError('أدخل رقم مرجع التحويل أو الإيصال.');
      return;
    }
    const fileError = validateReceipt(file);
    if (fileError) {
      setFormError(fileError);
      return;
    }
    setFormError(null);
    evidence.mutate(
      { intentId: intent.id, receipt: file!, paymentReference: reference.trim(), note: note.trim() || undefined },
      { onSuccess: update, onError: (err) => setFormError(topUpError(err)) },
    );
  };

  const confirmMock = () => {
    if (!intent) return;
    mock.mutate(intent.id, { onSuccess: (r) => update(r.intent) });
  };

  const canAttach = canAct && intent && (intent.status === 'PENDING' || intent.status === 'FAILED');

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>شحن محفظة المكتب</ModalTitle>
          <ModalDescription>يُضاف الرصيد فقط بعد تأكيد الدفع من مزود الدفع أو بعد مراجعة المنصة للإيصال.</ModalDescription>
        </ModalHeader>

        {!intentId ? (
          <form onSubmit={submitAmount} className="space-y-space-md" noValidate>
            <Input
              label="المبلغ (ج.س)"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={amountError ?? undefined}
              hint={minHint !== null ? `الحد الأدنى للشحن: ${formatSdg(minHint)}` : 'يُحدَّد الحد الأدنى للشحن من إدارة المنصة.'}
              placeholder="مثال: 50,000"
            />
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="secondary" isLoading={create.isPending}>
                متابعة
              </Button>
            </ModalFooter>
          </form>
        ) : !intent ? (
          detail.isError ? (
            <p role="alert" className="text-sm text-error">{errorMessage(detail.error)}</p>
          ) : (
            <p className="text-sm text-on-surface-variant">جارٍ تحميل حالة الطلب…</p>
          )
        ) : (
          <div className="space-y-space-md">
            <div className="rounded-lg bg-surface-container-low p-space-md text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-on-surface-variant">المبلغ</span>
                <span className="font-bold tabular-nums">{formatSdg(intent.amountMinor)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-on-surface-variant">الحالة</span>
                <TopUpStatusBadge status={intent.status} />
              </div>
              {intent.providerRef && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-on-surface-variant">مرجع الدفع</span>
                  <span className="font-mono text-xs" dir="ltr">{intent.providerRef}</span>
                </div>
              )}
              {intent.paymentReferenceNormalized && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-on-surface-variant">مرجع التحويل</span>
                  <span className="font-mono text-xs" dir="ltr">{intent.paymentReferenceNormalized}</span>
                </div>
              )}
              {intent.note && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-on-surface-variant shrink-0">{intent.status === 'FAILED' ? 'سبب الرفض' : 'ملاحظة'}</span>
                  <span className={intent.status === 'FAILED' ? 'text-error' : ''}>{intent.note}</span>
                </div>
              )}
            </div>

            {intent.status === 'PENDING' && (
              <p className="text-xs text-on-surface-variant flex items-center gap-1" aria-live="polite">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                نتابع حالة الدفع تلقائيًا…
              </p>
            )}
            {intent.status === 'CONFIRMED' && (
              <p role="status" className="rounded-lg bg-[#DCFCE7] text-[#15803D] px-space-md py-2 text-sm">
                تم تأكيد الدفع وأُضيف المبلغ إلى رصيد المكتب.
              </p>
            )}
            {intent.status === 'PENDING_REVIEW' && (
              <p role="status" className="rounded-lg bg-surface-container-high px-space-md py-2 text-sm">
                تم استلام الإيصال وهو الآن قيد مراجعة المنصة. سيُضاف الرصيد بعد الموافقة، وسيظهر في سجل الحركات.
              </p>
            )}

            {canAttach && mode === 'choose' && (
              <div className="space-y-space-sm text-sm">
                {intent.status === 'FAILED' && (
                  <p className="text-error">رُفض الطلب أو فشل الدفع. يمكنك إرفاق إيصال صحيح لإعادة المراجعة.</p>
                )}
                {intent.status === 'PENDING' && (
                  <div className="rounded-lg border border-outline-variant/50 p-space-md space-y-2">
                    <div className="font-semibold">الدفع عبر مزود الدفع</div>
                    <p className="text-xs text-on-surface-variant">
                      أكمل الدفع لدى مزود الدفع باستخدام مرجع الدفع أعلاه. يُضاف الرصيد تلقائيًا فور تحقق المزود من الدفع؛ لا حاجة لأي إجراء آخر.
                    </p>
                    {intent.mockConfirmAvailable && (
                      <div className="pt-1 space-y-1">
                        <Button size="sm" variant="outline" icon="science" isLoading={mock.isPending} onClick={confirmMock}>
                          تأكيد دفع تجريبي (بيئة التطوير)
                        </Button>
                        {mock.isError && <p className="text-xs text-error">{topUpError(mock.error)}</p>}
                      </div>
                    )}
                  </div>
                )}
                <div className="rounded-lg border border-outline-variant/50 p-space-md space-y-2">
                  <div className="font-semibold">دفعت بتحويل بنكي؟ أرفق الإيصال</div>
                  <p className="text-xs text-on-surface-variant">إذا لم يتأكد الدفع تلقائيًا، أرفق صورة الإيصال ليراجعه فريق المنصة يدويًا.</p>
                  <Button size="sm" variant="outline" icon="upload_file" onClick={() => setMode('manual')}>
                    إرفاق إيصال للمراجعة
                  </Button>
                </div>
              </div>
            )}

            {canAttach && mode === 'manual' && (
              <form onSubmit={submitEvidence} className="space-y-space-sm" noValidate>
                <Input label="رقم مرجع التحويل / الإيصال" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={128} required />
                <Input label="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                <label className="flex flex-col gap-1 text-xs font-semibold">
                  ملف الإيصال (PDF أو JPG أو PNG، حتى 5 ميغابايت)
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="text-sm font-normal file:me-2 file:rounded-md file:border-0 file:bg-surface-container-high file:px-3 file:py-1.5"
                  />
                </label>
                {formError && <p role="alert" className="text-xs text-error">{formError}</p>}
                <ModalFooter>
                  <Button type="button" variant="ghost" onClick={() => setMode('choose')}>
                    رجوع
                  </Button>
                  <Button type="submit" variant="secondary" isLoading={evidence.isPending}>
                    إرسال للمراجعة
                  </Button>
                </ModalFooter>
              </form>
            )}

            {(!canAttach || mode === 'choose') && (
              <ModalFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  إغلاق
                </Button>
              </ModalFooter>
            )}
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};
