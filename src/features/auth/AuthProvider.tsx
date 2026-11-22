import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onSessionChange, refreshSession, setAccessToken } from '../../lib/api/client';
import { AuthContext, type AuthState, type BrokerEmployee, type OtpChallenge } from './auth-context';

type TokensDto = { accessToken: string; employee: BrokerEmployee };

/** Permissions the API grants to managers without the explicit flag (`allowManager: true`). */
const MANAGER_OVERRIDES = new Set(['broker.reports.view']);

/** Restores the broker session from the refresh cookie on load; exposes login/logout + permissions. */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<AuthState['status']>('loading');
  const [employee, setEmployee] = React.useState<BrokerEmployee | null>(null);

  React.useEffect(() => {
    const off = onSessionChange((event, payload) => {
      if (event === 'refreshed') {
        const data = payload as Partial<TokensDto> | undefined;
        if (data?.employee) setEmployee(data.employee);
        setStatus('authenticated');
      } else {
        setAccessToken(null);
        setEmployee(null);
        setStatus('anonymous');
        queryClient.clear();
      }
    });
    let cancelled = false;
    refreshSession().then((ok) => {
      if (!cancelled && !ok) setStatus('anonymous');
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [queryClient]);

  const refreshProfile = React.useCallback(async () => {
    const { data } = await api.get<BrokerEmployee>('/broker/auth/me');
    setEmployee(data);
  }, []);

  const value = React.useMemo<AuthState>(() => {
    const permissions = new Set(employee?.permissions ?? []);
    const isManager = employee?.role === 'MANAGER';
    return {
      status,
      employee,
      isManager,
      can: (p) => permissions.has(p) || (isManager && MANAGER_OVERRIDES.has(p)),
      refreshProfile,
      requestOtp: async (phone) =>
        (await api.post<OtpChallenge>('/broker/auth/otp/request', { phone }, { noRetry: true })).data,
      verifyOtp: async (input) => {
        const { data } = await api.post<TokensDto>('/broker/auth/otp/verify', input, { noRetry: true });
        setAccessToken(data.accessToken);
        setEmployee(data.employee);
        setStatus('authenticated');
      },
      logout: async () => {
        try {
          await api.post('/broker/auth/logout', {}, { noRetry: true });
        } finally {
          setAccessToken(null);
          setEmployee(null);
          setStatus('anonymous');
          queryClient.clear();
        }
      },
    };
  }, [status, employee, queryClient, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
