import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { api, type PageMeta } from '../../lib/api/client';
import { findInPages, SCAN_PAGE_SIZE } from '../../lib/api/findInPages';
import { markReadLocally } from './logic';
import type { AppNotification } from './types';

const PAGE_SIZE = 15;
/** Unread badge polling interval (no push channel on the web panel). */
export const UNREAD_POLL_MS = 60_000;

export function useUnreadCount() {
  return useQuery({
    queryKey: ['broker-notifications-unread'],
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) => api.get<{ unread: number }>('/broker/notifications/unread-count', undefined, signal).then((r) => r.data.unread),
  });
}

export function useNotifications(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['broker-notifications'],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => api.get<AppNotification[]>('/broker/notifications', { page: pageParam, pageSize: PAGE_SIZE }, signal),
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | 'all') =>
      (id === 'all' ? api.post<{ unread: number }>('/broker/notifications/read-all') : api.post<{ unread: number }>(`/broker/notifications/${encodeURIComponent(id)}/read`)).then(
        (r) => r.data.unread,
      ),
    onMutate: (id) => {
      qc.setQueryData<InfiniteData<{ data: AppNotification[]; meta?: PageMeta }>>(['broker-notifications'], (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, data: markReadLocally(p.data, id) })) } : old,
      );
    },
    onSuccess: (unread, id) => {
      qc.setQueryData(['broker-notifications-unread'], unread);
      void qc.invalidateQueries({ queryKey: ['broker-notifications'] });
      if (id === 'all') void qc.invalidateQueries({ queryKey: ['broker-notification'] });
      else qc.setQueryData<AppNotification | null>(['broker-notification', id], (n) => (n ? markReadLocally([n], id)[0]! : n));
    },
  });
}

/**
 * One notification for /notifications/:id. The API has no GET-by-id: use the loaded feed when it
 * holds the item, otherwise scan the feed pages.
 */
export function useNotification(id: string | undefined) {
  const qc = useQueryClient();
  const cached = qc
    .getQueryData<InfiniteData<{ data: AppNotification[] }>>(['broker-notifications'])
    ?.pages.flatMap((p) => p.data)
    .find((n) => n.id === id);
  return useQuery({
    queryKey: ['broker-notification', id],
    enabled: Boolean(id),
    initialData: cached,
    queryFn: ({ signal }) =>
      findInPages(
        (page) =>
          api
            .get<AppNotification[]>('/broker/notifications', { page, pageSize: SCAN_PAGE_SIZE }, signal)
            .then((r) => ({ items: r.data, totalPages: r.meta?.totalPages ?? 1 })),
        (n) => n.id === id,
      ),
  });
}
