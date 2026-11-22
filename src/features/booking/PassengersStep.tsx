import * as React from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { hasErrors, validatePassenger, type PassengerDraft, type PassengerErrors } from './passengers';
import type { TripSeat } from './types';

const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

export const PassengersStep: React.FC<{
  seats: TripSeat[];
  carrierName: string;
  drafts: PassengerDraft[];
  onChange: (drafts: PassengerDraft[]) => void;
  onBack: () => void;
  onContinue: () => void;
}> = ({ seats, carrierName, drafts, onChange, onBack, onContinue }) => {
  const [touched, setTouched] = React.useState(false);
  const errors: PassengerErrors[] = drafts.map(validatePassenger);
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
          <h3 className="font-bold text-sm">
            المسافر {ORDINALS[i] ?? i + 1} <span className="text-secondary">(مقعد <span className="font-mono">{seat.label}</span>)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
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
