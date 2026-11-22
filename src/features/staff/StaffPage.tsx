import * as React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { errorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { useAuth } from '../auth/auth-context';
import { useStaff, useUpdateStaff, type StaffMember } from './api';
import { FLAG_FIELDS, selfEditBlock } from './logic';
import { StaffFormModal } from './StaffFormModal';

/** Office staff (`broker.staff.manage`): list, add clerks, edit flags, suspend / reactivate. */
export const StaffPage: React.FC = () => {
  const { can, employee, refreshProfile } = useAuth();
  const allowed = can('broker.staff.manage');
  const staff = useStaff(allowed);
  const update = useUpdateStaff();
  const [form, setForm] = React.useState<{ member: StaffMember | null } | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<StaffMember | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  if (!allowed) {
    return <EmptyState icon="lock" title="لا تملك صلاحية إدارة الموظفين" description="اطلب من مدير المكتب منحك صلاحية «إدارة الموظفين»." />;
  }

  const afterSave = async (saved: StaffMember, wasSelf: boolean) => {
    setForm(null);
    setNotice(`تم حفظ بيانات ${saved.displayName}.`);
    if (wasSelf) await refreshProfile().catch(() => undefined);
  };

  const nextStatus = statusTarget?.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
  const statusBlock = statusTarget ? selfEditBlock(statusTarget.id === employee?.id, { status: nextStatus }) : null;

  const confirmStatus = () => {
    if (!statusTarget || statusBlock) return;
    update.mutate(
      { id: statusTarget.id, patch: { status: nextStatus } },
      {
        onSuccess: (saved) => {
          setStatusTarget(null);
          setNotice(saved.status === 'SUSPENDED' ? `تم إيقاف ${saved.displayName} وإنهاء جلساته.` : `تمت إعادة تفعيل ${saved.displayName}.`);
        },
      },
    );
  };

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg">
      <PageHeader
        title="الموظفون"
        subtitle="موظفو المكتب وصلاحياتهم. الإيقاف ينهي جلسات الموظف فورًا."
        actions={
          <Button
            variant="secondary"
            icon="person_add"
            onClick={() => {
              setNotice(null);
              setForm({ member: null });
            }}
          >
            إضافة موظف
          </Button>
        }
      />

      {notice && (
        <p role="status" className="rounded-lg bg-[#DCFCE7] text-[#15803D] px-space-md py-2 text-sm">
          {notice}
        </p>
      )}

      {staff.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : staff.isError ? (
        <ErrorState title="تعذّر تحميل الموظفين" message={errorMessage(staff.error)} onRetry={() => staff.refetch()} />
      ) : (staff.data ?? []).length === 0 ? (
        <EmptyState icon="group" title="لا يوجد موظفون" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الهاتف</TableHead>
              <TableHead>الدور</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الصلاحيات</TableHead>
              <TableHead>آخر دخول</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.data!.map((m) => {
              const isSelf = m.id === employee?.id;
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-semibold">
                    {m.displayName}
                    {isSelf && <span className="text-xs font-normal text-on-surface-variant ms-1">(أنت)</span>}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums" dir="ltr">
                    {m.phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge size="sm" variant={m.role === 'MANAGER' ? 'secondary' : 'neutral'}>
                      {m.role === 'MANAGER' ? 'مدير المكتب' : 'موظف حجز'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge size="sm" dot variant={m.status === 'ACTIVE' ? 'success' : 'error'}>
                      {m.status === 'ACTIVE' ? 'نشط' : 'موقوف'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {FLAG_FIELDS.filter((f) => m.flags[f.key]).map((f) => (
                        <Badge key={f.key} size="sm" variant="info">
                          {f.label}
                        </Badge>
                      ))}
                      {FLAG_FIELDS.every((f) => !m.flags[f.key]) && <span className="text-xs text-on-surface-variant">بدون صلاحيات</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(m.lastLoginAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        icon="edit"
                        onClick={() => {
                          setNotice(null);
                          setForm({ member: m });
                        }}
                      >
                        تعديل
                      </Button>
                      {!isSelf && (
                        <Button
                          size="sm"
                          variant={m.status === 'ACTIVE' ? 'ghost' : 'outline'}
                          icon={m.status === 'ACTIVE' ? 'block' : 'check_circle'}
                          onClick={() => {
                            update.reset();
                            setStatusTarget(m);
                          }}
                        >
                          {m.status === 'ACTIVE' ? 'إيقاف' : 'إعادة تفعيل'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {form && <StaffFormModal member={form.member} selfId={employee?.id} onClose={() => setForm(null)} onSaved={afterSave} />}

      <Modal open={statusTarget !== null} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>{nextStatus === 'SUSPENDED' ? 'إيقاف الموظف' : 'إعادة تفعيل الموظف'}</ModalTitle>
            <ModalDescription>
              {nextStatus === 'SUSPENDED'
                ? `سيتم إيقاف ${statusTarget?.displayName ?? ''} وتسجيل خروجه من جميع الأجهزة. يمكنك إعادة تفعيله لاحقًا.`
                : `سيتمكن ${statusTarget?.displayName ?? ''} من تسجيل الدخول مجددًا بصلاحياته الحالية.`}
            </ModalDescription>
          </ModalHeader>
          {(statusBlock || update.isError) && (
            <p role="alert" className="text-xs text-error">
              {statusBlock ?? errorMessage(update.error)}
            </p>
          )}
          <ModalFooter>
            <Button variant="ghost" onClick={() => setStatusTarget(null)}>
              إلغاء
            </Button>
            <Button variant={nextStatus === 'SUSPENDED' ? 'danger' : 'secondary'} isLoading={update.isPending} disabled={Boolean(statusBlock)} onClick={confirmStatus}>
              {nextStatus === 'SUSPENDED' ? 'إيقاف' : 'إعادة تفعيل'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
