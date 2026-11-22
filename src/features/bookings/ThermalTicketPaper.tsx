import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatSdg } from '../../lib/money';
import { PLATFORM_TZ } from '../../lib/dates';
import { ticketQrValue } from './labels';
import type { TicketDocument, TicketDocumentPassenger } from './types';

const timeFmt = new Intl.DateTimeFormat('ar-SD-u-nu-latn', { timeZone: PLATFORM_TZ, hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('ar-SD-u-nu-latn', { timeZone: PLATFORM_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const issuedFmt = new Intl.DateTimeFormat('ar-SD-u-nu-latn', { timeZone: PLATFORM_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export interface ThermalTicketPaperProps {
  document: TicketDocument;
  passenger: TicketDocumentPassenger;
  bookingRef: string;
  /** Signed boarding code from the booking DTO (`tickets[].qrPayload`); wins over the document's copy. */
  qrPayload?: string | null;
  className?: string;
}

/**
 * One passenger's 80 mm thermal ticket, built from the API TicketDocument (POST /dispatch).
 * The QR encodes the server-signed boarding code (`qrPayload`); the ticket number only when there is none.
 */
export const ThermalTicketPaper: React.FC<ThermalTicketPaperProps> = ({ document: doc, passenger, bookingRef, qrPayload, className = '' }) => {
  const departure = new Date(doc.trip.departureAt);

  return (
    <div className={`w-full max-w-sm mx-auto bg-white text-slate-900 font-sans ${className}`} dir="rtl">
      <div className="flex flex-col items-center pb-3">
        <div className="w-14 h-9 flex items-center justify-center p-0.5">
          <img src="/log-zool-bw.svg" alt="ZoolGo" className="max-h-full max-w-full object-contain grayscale" />
        </div>
        <span className="text-[11px] font-bold text-black mt-0.5">{doc.carrier.name}</span>
        <span className="text-[9px] text-slate-500">تذكرة صعود — صادرة من {doc.office.name} ({doc.office.code})</span>
      </div>

      <div className="flex items-center justify-between pb-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500">رقم الحجز</span>
          <span className="text-lg font-extrabold font-mono tracking-tight" dir="ltr">{bookingRef}</span>
        </div>
        <span className="bg-[#e8f5e9] text-[#1b5e20] px-3 py-0.5 rounded-full text-xs font-bold">مؤكد</span>
      </div>

      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex flex-col items-start min-w-[70px]">
          <span className="text-xl font-extrabold text-[#00875a] leading-none">{timeFmt.format(departure)}</span>
          <span className="text-sm font-bold mt-1">{doc.trip.origin}</span>
          <span className="text-[11px] text-slate-500">المغادرة</span>
        </div>
        <div className="flex-1 flex items-center gap-1 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00875a] shrink-0" />
          <div className="flex-1 border-t-2 border-dotted border-slate-300 h-0" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0" />
        </div>
        <div className="flex flex-col items-end min-w-[70px]">
          <span className="text-xl font-extrabold font-mono leading-none">&nbsp;</span>
          <span className="text-sm font-bold mt-1">{doc.trip.destination}</span>
          <span className="text-[11px] text-slate-500">الوصول</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pb-3 text-xs">
        <Field label="المسافر" value={passenger.name} />
        <Field label="المقعد" value={passenger.seatLabel} mono center />
        <Field label="التاريخ" value={dateFmt.format(departure)} />
        <Field label="الأجرة" value={formatSdg(passenger.fareAmountMinor)} center />
        <Field label="الهاتف" value={passenger.phone ?? '—'} mono ltr />
        <Field label="الشركة" value={doc.carrier.name} center />
      </div>

      <div className="my-2.5 border-b-2 border-dashed border-slate-300" />

      <p className="text-center text-xs text-slate-500 pb-2">اعرض هذا الرمز عند الصعود إلى الحافلة</p>
      <div className="flex flex-col items-center gap-1 pb-1">
        <div className="p-2 bg-white rounded-lg border border-slate-200">
          <QRCodeSVG value={ticketQrValue(passenger.ticketNumber, qrPayload, passenger.qrPayload)} size={120} level="M" marginSize={0} />
        </div>
        <span className="font-mono text-[11px] font-bold tracking-wide" dir="ltr">{passenger.ticketNumber}</span>
        <span className="text-[9px] text-slate-400">أُصدرت {issuedFmt.format(new Date(doc.issuedAt))}</span>
      </div>
    </div>
  );
};

function Field({ label, value, mono, center, ltr }: { label: string; value: string; mono?: boolean; center?: boolean; ltr?: boolean }) {
  return (
    <div className={`flex flex-col ${center ? 'items-center' : 'items-start'}`}>
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-sm font-bold mt-0.5 break-words ${mono ? 'font-mono' : ''}`} dir={ltr ? 'ltr' : undefined}>
        {value}
      </span>
    </div>
  );
}
