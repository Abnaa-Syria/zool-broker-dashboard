import * as React from 'react';

/** GET /broker/auth/me (`BrokerMeDto`). */
export type BrokerEmployee = {
  id: string;
  displayName: string;
  role: 'MANAGER' | 'CLERK';
  status: string;
  /** broker.book | broker.wallet.topup | broker.reports.view | broker.staff.manage */
  permissions: string[];
  flags: { canBook: boolean; canTopUp: boolean; canViewReports: boolean; canManageStaff: boolean };
  office: { id: string; code: string; name: string; status: string };
  identities: Array<{ type: string; value: string; isPrimary: boolean }>;
};

export type OtpChallenge = { challengeId: string; expiresAt: string; cooldownSeconds: number; devOtp?: string };

export type AuthState = {
  status: 'loading' | 'authenticated' | 'anonymous';
  employee: BrokerEmployee | null;
  requestOtp: (phone: string) => Promise<OtpChallenge>;
  verifyOtp: (input: { phone: string; code: string; challengeId: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads GET /broker/auth/me (e.g. after a manager changes this employee's permissions). */
  refreshProfile: () => Promise<void>;
  /**
   * Broker permission check, mirroring the backend: the employee's flag, plus the manager
   * override that the API grants only for `broker.reports.view` (reports + commissions).
   */
  can: (permission: string) => boolean;
  isManager: boolean;
};

export const AuthContext = React.createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
