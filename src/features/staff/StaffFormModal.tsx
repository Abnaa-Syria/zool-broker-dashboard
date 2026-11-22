import * as React from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../../components/ui/Modal';
import { ApiError } from '../../lib/api/client';
import { errorMessage } from '../../lib/api/errors';
import { useCreateClerk, useUpdateStaff, type StaffMember } from './api';
import { DEFAULT_CLERK_FLAGS, FLAG_FIELDS, diffStaff, selfEditBlock, validatePhone, type StaffFlags } from './logic';

/**
 * Add a clerk (POST /broker/staff — new employees are always CLERK) or edit name + permission flags
 * (PATCH /broker/staff/:id). Mount only while open so each opening starts from the row's values.
 */
export const StaffFormModal: React.FC<{
  member: StaffMember | null;
  selfId: string | undefined;
  onClose: () => void;
  onSaved: (saved: StaffMember, wasSelf: boolean) => void;
}> = ({ member, selfId, onClose, onSaved }) => {
  const isEdit = member !== null;
  const isSelf = isEdit && member.id === selfId;
  const [displayName, setDisplayName] = React.useState(member?.displayName ?? '');
  const [phone, setPhone] = React.useState('');
  const [flags, setFlags] = React.useState<StaffFlags>(member?.flags ?? DEFAULT_CLERK_FLAGS);
  const [error, setError] = React.useState<string | null>(null);
  const create = useCreateClerk();
  const update = useUpdateStaff();
  const pending = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      setError('الاسم يجب أن يكون حرفين على الأقل.');
      return;
    }
    if (!isEdit) {
      const phoneError = validatePhone(phone);
      if (phoneError) {
        setError(phoneError);
        return;
      }
      setError(null);
      create.mutate(
        { displayName: displayName.trim(), phone: phone.replace(/[\s-]/g, ''), ...flags },
        {
          onSuccess: (saved) => onSaved(saved, false),
          onError: (err) => setError(err instanceof ApiError && err.code === 'CONFLICT' ? 'رقم الهاتف مسجّل مسبقًا لموظف آخر.' : errorMessage(err)),
        },
      );
      return;
    }
    const patch = diffStaff({ displayName: member.displayName, flags: member.flags }, { displayName, flags });
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    const block = selfEditBlock(isSelf, patch);
    if (block) {
      setError(block);
      return;
    }
    setError(null);
    update.mutate(
      { id: member.id, patch },
      { onSuccess: (saved) => onSaved(saved, isSelf), onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>{isEdit ? `تعديل ${member.displayName}` : 'إضافة موظف حجز'}</ModalTitle>
          <ModalDescription>
            {isEdit ? 'تسري الصلاحيات الجديدة على الموظف فورًا.' : 'يُضاف الموظف بدور «موظف حجز» ويسجّل الدخول برقم هاتفه عبر رمز التحقق.'}
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="space-y-space-md" noValidate>
          <Input label="الاسم" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={160} autoFocus />
          {!isEdit && (
            <Input label="رقم الهاتف" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+249912345678" className="text-left" />
          )}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-on-surface mb-1">الصلاحيات</legend>
            {FLAG_FIELDS.map((f) => {
              const locked = isSelf && f.key === 'canManageStaff';
              return (
                <label key={f.key} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 accent-secondary"
                    checked={flags[f.key]}
                    disabled={locked}
                    onChange={(e) => setFlags((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                  />
                  <span>
                    <span className="font-medium">{f.label}</span>
                    <span className="block text-xs text-on-surface-variant">
                      {locked ? 'لا يمكنك إزالة هذه الصلاحية عن نفسك.' : f.hint}
                    </span>
                  </span>
                </label>
              );
            })}
            {isEdit && member.role === 'MANAGER' && (
              <p className="text-xs text-on-surface-variant">مدير المكتب يرى التقارير والعمولات دائمًا بغض النظر عن صلاحية التقارير.</p>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="text-xs text-error">
              {error}
            </p>
          )}
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="secondary" isLoading={pending}>
              {isEdit ? 'حفظ التغييرات' : 'إضافة الموظف'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
