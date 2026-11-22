import * as React from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { cn } from '../../lib/utils';
import { hasErrors, validatePassenger, womenOnlyPassengers, type PassengerDraft, type PassengerErrors } from './passengers';
import type { Gender, TripSeat } from './types';

const SELECT_CLASS =
  'h-10 rounded-lg bg-surface-container-lowest text-on-surface text-sm border px-3 focus:outline-none focus:ring-2 focus:ring-secondary/30';

const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

export const PassengersStep: React.FC<{
  seats: TripSeat[];
  /** Round trip: return-leg seats (passenger i ↔ returnSeats[i]). */
  returnSeats?: TripSeat[];
  carrierName: string;
  drafts: PassengerDraft[];
  onChange: (drafts: PassengerDraft[]) => void;
  onBack: () => void;
  onContinue: () => void;
}> = ({ seats, returnSeats, carrierName, drafts, onChange, onBack, onContinue }) => {
  const [touched, setTouched] = React.useState(false);
  const womenOnly = womenOnlyPassengers(seats.length, returnSeats ? [seats, returnSeats] : [seats]);
  const errors: PassengerErrors[] = drafts.map((d, i) => validatePassenger(d, { womenOnly: womenOnly[i] }));
  const invalid = errors.some(hasErrors);

  const set = (i: number, patch: Partial<PassengerDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!invalid) onContinue();
  };

  return (
    <form onSubmit={submit} className="space-y-space-md" noValidate>
      <p className="text-sm text-on-surface-variant">أدخل بيانات الركاب بدقة — مطلوبة لإصدار تذاكر {carrierName}.</p>
      {seats.map((seat, i) => (
        <Card key={seat.id} className="space-y-space-sm">
          <h3 className="font-bold text-sm flex flex-wrap items-center gap-x-2">
            المسافر {ORDINALS[i] ?? i + 1}{' '}
            <span className="text-secondary">
              ({returnSeats ? 'الذهاب ' : ''}مقعد <span className="font-mono">{seat.label}</span>
              {returnSeats?.[i] && (
                <>
                  {' '}• العودة مقعد <span className="font-mono">{returnSeats[i].label}</span>
                </>
              )}
              )
            </span>
            {womenOnly[i] && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-pink-600">
                <span className="material-symbols-outlined text-[16px]">woman</span>
                مقعد مخصص للسيدات
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm">
            <Input
              label="الاسم الكامل (مطابق للهوية)"
              value={drafts[i]?.fullName ?? ''}
              onChange={(e) => set(i, { fullName: e.target.value })}
              error={touched ? errors[i]?.fullName : undefined}
              autoComplete="off"
              required
            />
            <Input
              label="رقم الهاتف"
              type="tel"
              dir="ltr"
              placeholder="+249…"
              value={drafts[i]?.phone ?? ''}
              onChange={(e) => set(i, { phone: e.target.value })}
              error={touched ? errors[i]?.phone : undefined}
              autoComplete="off"
              required
            />
            <Input
              label="رقم الهوية / الجواز (اختياري)"
              value={drafts[i]?.idNumber ?? ''}
              onChange={(e) => set(i, { idNumber: e.target.value })}
              error={touched ? errors[i]?.idNumber : undefined}
              autoComplete="off"
            />
            <label className="flex flex-col gap-1 w-full text-xs font-semibold">
              {womenOnly[i] ? 'الجنس (مطلوب)' : 'الجنس (اختياري)'}
              <select
                className={cn(SELECT_CLASS, touched && errors[i]?.gender ? 'border-error' : 'border-outline-variant/60')}
                value={drafts[i]?.gender ?? ''}
                onChange={(e) => set(i, { gender: e.target.value as Gender | '' })}
                aria-invalid={touched && Boolean(errors[i]?.gender)}
              >
                <option value="">{womenOnly[i] ? 'اختر…' : 'غير محدد'}</option>
                <option value="FEMALE">أنثى</option>
                <option value="MALE" disabled={womenOnly[i]}>
                  ذكر{womenOnly[i] ? ' (غير مسموح لهذا المقعد)' : ''}
                </option>
              </select>
              {touched && errors[i]?.gender && <span className="text-[11px] font-normal text-error">{errors[i]?.gender}</span>}
            </label>
          </div>
          {i === 0 && seats.length > 1 && drafts[0]?.phone && (
            <button
              type="button"
              className="text-xs text-secondary hover:underline"
              onClick={() => onChange(drafts.map((d, j) => (j > 0 && !d.phone ? { ...d, phone: drafts[0].phone } : d)))}
            >
              استخدام هذا الهاتف لباقي المسافرين
            </button>
          )}
        </Card>
      ))}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          تغيير المقاعد
        </Button>
        <Button type="submit" icon="receipt_long">
          مراجعة الحجز والأسعار
        </Button>
      </div>
    </form>
  );
};
