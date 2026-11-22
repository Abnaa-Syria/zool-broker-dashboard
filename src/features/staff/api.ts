import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { StaffFlags } from './logic';

/** `EmployeeDto` (brokers.dto). */
export type StaffMember = {
  id: string;
  officeId: string;
  displayName: string;
  role: 'MANAGER' | 'CLERK';
  status: 'ACTIVE' | 'SUSPENDED';
  phone: string | null;
  flags: StaffFlags;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffPatch = Partial<StaffFlags & { displayName: string; status: 'ACTIVE' | 'SUSPENDED' }>;

const KEY = ['broker-staff'];

export function useStaff(enabled: boolean) {
  return useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => api.get<StaffMember[]>('/broker/staff', undefined, signal).then((r) => r.data),
    enabled,
  });
}

export function useCreateClerk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StaffFlags & { displayName: string; phone: string }) => api.post<StaffMember>('/broker/staff', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: StaffPatch }) =>
      api.patch<StaffMember>(`/broker/staff/${encodeURIComponent(id)}`, patch).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
