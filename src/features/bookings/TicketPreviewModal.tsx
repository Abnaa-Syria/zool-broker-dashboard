import * as React from 'react';
import { Modal, ModalContent, ModalDescription, ModalTitle } from '../../components/ui/Modal';
import { ReceiptPrinter, type ReceiptPrinterStage } from '../../components/shared/ReceiptPrinter';
import { TactileButton } from '../../components/shared/TactileButton';
import { printTicketElement } from '../../lib/printTicket';
import { formatSdg } from '../../lib/money';
import { ThermalTicketPaper } from './ThermalTicketPaper';
import { routeLabel } from './labels';
import type { TicketDocument } from './types';

interface TicketPreviewModalProps {
  open: boolean;
  onClose: () => void;
  bookingRef: string;
  document: TicketDocument | null;
  /** Ticket to show first (e.g. the row the user clicked). */
  initialTicketNumber?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** ticketNumber → signed boarding code from the booking DTO (drawn as the QR). */
  qrPayloads?: Readonly<Record<string, string | null>>;
}

/** Thermal-printer preview of the API TicketDocument, with print (current / all tickets). */
export const TicketPreviewModal: React.FC<TicketPreviewModalProps> = ({
  open,
  onClose,
  bookingRef,
  document: doc,
  initialTicketNumber,
  loading = false,
  error = null,
  onRetry,
  qrPayloads,
}) => {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<ReceiptPrinterStage>('printing');
  const [wasOpen, setWasOpen] = React.useState(false);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setStage('printing');
    else setSelected(null);
  }

  const passengers = doc?.passengers ?? [];
  const activeNumber = selected ?? initialTicketNumber ?? passengers[0]?.ticketNumber;
  const passenger = passengers.find((p) => p.ticketNumber === activeNumber) ?? passengers[0];

  const replay = (next?: string) => {
    if (next) setSelected(next);
    setStage('processing');
    window.setTimeout(() => setStage('printing'), 200);
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalContent size="md" className="bg-zinc-950 border-zinc-800 p-0 gap-0 max-h-[94vh] overflow-y-auto text-zinc-100 max-w-xl">
        <div className="p-4 px-6 border-b border-zinc-800 flex items-center justify-between gap-3 sticky top-0 z-20 bg-zinc-950/95">
          <div>
            <ModalTitle className="text-sm text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-emerald-400">print</span>
              طابعة التذاكر الحرارية
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-700">80mm</span>
            </ModalTitle>
            <ModalDescription className="text-[11px] text-zinc-400">
              الحجز {bookingRef} • {passengers.length} تذكرة
            </ModalDescription>
          </div>
          <div className="flex items-center gap-2 ml-8">
            <TactileButton
              onClick={() => printTicketElement('printable-ticket')}
              disabled={!passenger}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
            >
              <span className="material-symbols-outlined text-base">print</span>
              طباعة التذكرة
            </TactileButton>
            {passengers.length > 1 && (
              <TactileButton onClick={() => printTicketElement('printable-all-tickets')}>طباعة الكل</TactileButton>
            )}
          </div>
        </div>

        {passengers.length > 1 && (
          <div className="px-6 py-2.5 flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 overflow-x-auto">
            <span className="text-xs text-zinc-400 shrink-0">المسافرون:</span>
            {passengers.map((p) => (
              <button
                key={p.ticketNumber}
                type="button"
                onClick={() => p.ticketNumber !== passenger?.ticketNumber && replay(p.ticketNumber)}
                className={`py-1 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap ${
                  p.ticketNumber === passenger?.ticketNumber
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {p.name}
                <span className="text-[10px] font-mono text-emerald-400">({p.seatLabel})</span>
              </button>
            ))}
          </div>
        )}

        <div className="p-3 sm:p-5 flex flex-col items-center bg-gradient-to-b from-zinc-950 via-zinc-900/80 to-zinc-950 min-h-[200px]">
          {loading ? (
            <p className="py-16 text-sm text-zinc-400">جارٍ تجهيز التذاكر…</p>
          ) : error ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-red-300">{error}</p>
              {onRetry && <TactileButton onClick={onRetry}>إعادة المحاولة</TactileButton>}
            </div>
          ) : doc && passenger ? (
            <ReceiptPrinter.Root stage={stage} feedMotion="stepped" onPrintComplete={() => setStage('complete')} className="w-full max-w-sm">
              <ReceiptPrinter.Machine className="w-full">
                <ReceiptPrinter.Header>
                  <span className="text-[11px] font-mono tracking-wider text-zinc-300 font-bold">ZoolGo THERMAL-80</span>
                  <TactileButton onClick={() => replay()} disabled={stage === 'printing'} className="text-[10px] py-0.5 px-2">
                    إعادة
                  </TactileButton>
                </ReceiptPrinter.Header>
                <ReceiptPrinter.Screen>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-white">{doc.carrier.name}</p>
                        <p className="text-[10px] text-zinc-400">
                          {routeLabel(doc.trip.origin, doc.trip.destination)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-sm">{formatSdg(passenger.fareAmountMinor)}</span>
                    </div>
                    <div className="border-t border-zinc-800/80 pt-2">
                      <ReceiptPrinter.Status />
                    </div>
                  </div>
                </ReceiptPrinter.Screen>
              </ReceiptPrinter.Machine>
              <ReceiptPrinter.Output className="w-[calc(100%-1rem)]">
                <ReceiptPrinter.Paper>
                  <div id="printable-ticket">
                    <ThermalTicketPaper document={doc} passenger={passenger} bookingRef={bookingRef} qrPayload={qrPayloads?.[passenger.ticketNumber]} />
                  </div>
                </ReceiptPrinter.Paper>
              </ReceiptPrinter.Output>
            </ReceiptPrinter.Root>
          ) : (
            <p className="py-16 text-sm text-zinc-400">لا توجد تذاكر مؤكدة لهذا الحجز.</p>
          )}
        </div>

        {/* Off-screen source for "print all": one ticket per passenger, separated by a cut line. */}
        {doc && passengers.length > 1 && (
          <div id="printable-all-tickets" className="hidden" aria-hidden="true">
            {passengers.map((p, i) => (
              <div key={p.ticketNumber} style={i > 0 ? { breakBefore: 'page', paddingTop: 12 } : undefined}>
                <ThermalTicketPaper document={doc} passenger={p} bookingRef={bookingRef} qrPayload={qrPayloads?.[p.ticketNumber]} />
              </div>
            ))}
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};
