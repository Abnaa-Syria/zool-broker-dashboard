import * as React from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumbs, type BreadcrumbItem } from '../../app/shell/Breadcrumbs';
import { cn } from '../../lib/utils';
import { ErrorState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';

/** Breadcrumbs of a detail page: «الرئيسية» › …items (the last item is the current page). */
export const DetailCrumbs: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => (
  <Breadcrumbs items={[{ label: 'الرئيسية', path: '/home' }, ...items]} className="mb-0" />
);

/** Label/value pair for a `<dl>` grid. */
export function Field({ label, children, mono, className }: { label: string; children: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className={cn('font-semibold mt-0.5 break-words', mono && 'font-mono text-xs')} dir={mono ? 'ltr' : undefined}>
        {children ?? '—'}
      </dd>
    </div>
  );
}

/** Label … value row (amount lists). */
export function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={strong ? 'font-bold tabular-nums' : 'tabular-nums'}>{children}</dd>
    </div>
  );
}

export const DetailSkeleton: React.FC = () => (
  <div className="space-y-space-md">
    <Skeleton className="h-4 w-48" />
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-40 rounded-xl" />
    <Skeleton className="h-60 rounded-xl" />
  </div>
);

/** Error / not-found state of a detail page, under its breadcrumbs. */
export const DetailError: React.FC<{
  crumbs: BreadcrumbItem[];
  notFound: boolean;
  notFoundTitle: string;
  notFoundMessage?: string;
  title: string;
  message: string;
  onRetry?: () => void;
}> = ({ crumbs, notFound, notFoundTitle, notFoundMessage, title, message, onRetry }) => (
  <div className="space-y-space-md">
    <DetailCrumbs items={crumbs} />
    <ErrorState title={notFound ? notFoundTitle : title} message={notFound ? (notFoundMessage ?? '') : message} onRetry={notFound ? undefined : onRetry} />
  </div>
);

/** Inline link to another detail page. */
export const DetailLink: React.FC<{ to: string; children: React.ReactNode; className?: string }> = ({ to, children, className }) => (
  <Link to={to} className={cn('font-semibold text-secondary hover:underline', className)}>
    {children}
  </Link>
);

/** Green success banner after an action. */
export const SuccessNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="status" className="rounded-lg border border-[#BBF7D0] bg-[#DCFCE7] px-space-md py-2 text-sm text-[#15803D]">
    {children}
  </div>
);
