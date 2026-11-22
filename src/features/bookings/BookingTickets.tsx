import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { errorMessage } from '../../lib/api/errors';
import { dispatchTickets, downloadTicketPdf, saveBase64Pdf } from './api';
import { boardingStatusLabel, bookingReference, ticketStatusLabel } from './labels';
import { TicketPreviewModal } from './TicketPreviewModal';
import type { Booking } from './types';

/**
 * Tickets of a booking with thermal print (POST /dispatch → TicketDocument) and per-ticket PDF.
 * Printing/downloading needs `broker.book` on the API; pass `canAct` accordingly.
 */
export const BookingTickets: React.FC<{ booking: Booking; canAct: boolean }> = ({ booking, canAct }) => {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [initialTicket, setInitialTicket] = React.useState<string | undefined>();
  const [downloading, setDownloading] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const dispatch = useMutation({ mutationFn: () => dispatchTickets(booking.id) });
  const ref = bookingReference(booking);
  const printable = canAct && booking.status === 'CONFIRMED';
  const qrPayloads = React.useMemo(() => Object.fromEntries(booking.tickets.map((t) => [t.ticketNumber, t.qrPayload])), [booking.tickets]);

  const openPreview = (ticketNumber?: string) => {
    setInitialTicket(ticketNumber);
    setPreviewOpen(true);
    if (!dispatch.data && !dispatch.isPending) dispatch.mutate();
  };

  const download = async (ticketNumber: string) => {
    setDownloading(ticketNumber);
    setDownloadError(null);
    try {
      await downloadTicketPdf(booking.id, ticketNumber);
    } catch (e) {
      setDownloadError(errorMessage(e, 'تعذّر تنزيل التذكرة.'));
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    const result = dispatch.data ?? (await dispatch.mutateAsync().catch(() => null));
    if (result) saveBase64Pdf(result.pdfBase64, `${ref.replace(/[^A-Za-z0-9_-]+/g, '_') || 'tickets'}.pdf`);
  };

  return (
    <section className="space-y-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-on-surface">التذاكر ({booking.tickets.length})</h2>
        {printable && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon="print" onClick={() => openPreview()}>
              طباعة حرارية
            </Button>
            <Button size="sm" variant="outline" icon="picture_as_pdf" onClick={downloadAll} isLoading={dispatch.isPending && !previewOpen}>
              PDF لكل التذاكر
            </Button>
          </div>
        )}
      </div>
      {downloadError && <p className="text-xs text-error">{downloadError}</p>}
      {dispatch.isError && !previewOpen && <p className="text-xs text-error">{errorMessage(dispatch.error)}</p>}
      <ul className="divide-y divide-outline-variant/30 rounded-xl border border-outline-variant/40 bg-surface-container-lowest">
        {booking.tickets.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-space-md py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex h-9 min-w-9 px-2 items-center justify-center rounded-lg bg-surface-container font-mono text-sm font-bold">
                {t.seatLabel ?? '—'}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{t.passengerName ?? '—'}</div>
                <div className="text-xs font-mono text-on-surface-variant" dir="ltr">{t.ticketNumber}</div>
              </div>
              {t.status !== 'CONFIRMED' ? (
                <Badge size="sm" variant={t.status === 'CHANGED' ? 'info' : 'error'}>
                  {ticketStatusLabel(t.status)}
                </Badge>
              ) : (
                <Badge size="sm" variant={boardingStatusLabel(t.boardingStatus).variant} title="حالة الصعود">
                  {boardingStatusLabel(t.boardingStatus).label}
                </Badge>
              )}
            </div>
            {printable && t.status === 'CONFIRMED' && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" icon="qr_code_2" onClick={() => openPreview(t.ticketNumber)}>
                  عرض / طباعة
                </Button>
                <Button size="sm" variant="outline" icon="download" isLoading={downloading === t.ticketNumber} onClick={() => download(t.ticketNumber)}>
                  PDF
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <TicketPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        bookingRef={ref}
        document={dispatch.data?.document ?? null}
        initialTicketNumber={initialTicket}
        loading={dispatch.isPending}
        error={dispatch.isError ? errorMessage(dispatch.error) : null}
        onRetry={() => dispatch.mutate()}
        qrPayloads={qrPayloads}
      />
    </section>
  );
};
