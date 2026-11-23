import * as React from 'react';
import { Button } from '../../components/ui/Button';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../../components/ui/Modal';
import { errorMessage } from '../../lib/api/errors';
import { useUpdateStaff, type StaffMember } from './api';
import { selfEditBlock } from './logic';

/**
 * Suspend / reactivate an employee (PATCH /broker/staff/:id {status}). Suspension is the broker's
 * "delete": it ends the employee's sessions and can be undone. Mount only while open.
 */
export const StaffStatusModal: React.FC<{
  member: StaffMember;
  selfId: string | undefined;
  onClose: () => void;
  onDone: (saved: StaffMember) => void;
}> = ({ member, selfId, onClose, onDone }) => {
  const update = useUpdateStaff();
  const nextStatus = member.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
  const block = selfEditBlock(member.id === selfId, { status: nextStatus });

  const confirm = () => {
    if (block) return;
    update.mutate({ id: member.id, patch: { status: nextStatus } }, { onSuccess: onDone });
  };

  return (
    <Modal open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>{nextStatus === 'SUSPENDED' ? 'إيقاف الموظف' : 'إعادة تفعيل الموظف'}</ModalTitle>
          <ModalDescription>
            {nextStatus === 'SUSPENDED'
              ? `سيتم إيقاف ${member.displayName} وتسجيل خروجه من جميع الأجهزة. تبقى حجوزاته وسجله كما هي، ويمكنك إعادة تفعيله لاحقًا.`
              : `سيتمكن ${member.displayName} من تسجيل الدخول مجددًا بصلاحياته الحالية.`}
          </ModalDescription>
        </ModalHeader>
        {(block || update.isError) && (
          <p role="alert" className="text-xs text-error">
            {block ?? errorMessage(update.error)}
          </p>
        )}
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
            إلغاء
          </Button>
          <Button variant={nextStatus === 'SUSPENDED' ? 'danger' : 'secondary'} isLoading={update.isPending} disabled={Boolean(block)} onClick={confirm}>
            {nextStatus === 'SUSPENDED' ? 'إيقاف' : 'إعادة تفعيل'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

