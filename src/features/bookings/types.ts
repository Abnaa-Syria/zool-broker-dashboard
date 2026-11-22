/** Shapes of the broker bookings API (zool-go-backend `bookings.dto.ts`, `ticket-document.ts`). */

export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | (string & {});

export type BookingTicket = {
  id: string;
  ticketNumber: string;
  status: 'CONFIRMED' | 'CANCELLED' | (string & {});
  seatId: string | null;
  seatLabel: string | null;
  passengerId: string;
  passengerName: string | null;
};

export type Booking = {
  id: string;
  status: BookingStatus;
  bookingRef: string | null;
  channel: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  officeId: string | null;
  employee: { id: string; displayName: string } | null;
  trip: {
    id: string;
    origin: string;
    destination: string;
    departureAt: string;
    company: { id: string; key: string; name: string };
  };
  totalAmountMinor: number;
  commissionAmountMinor: number;
  /** UNSETTLED | RESERVED | SETTLED | CLAWED_BACK */
  commissionStatus: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  passengers: Array<{ id: string; fullName: string; phone: string | null; idNumber: string | null }>;
  tickets: BookingTicket[];
};

/** POST /broker/bookings/confirm */
export type ConfirmResult = { booking: Booking; balanceAfterMinor: number };

/** POST /broker/bookings/:id/cancel */
export type CancelResult = {
  booking: Booking;
  refundedAmountMinor: number;
  commissionClawedBackMinor: number;
  balanceAfterMinor: number;
};

export type TicketDocumentPassenger = {
  name: string;
  phone: string | null;
  seatLabel: string;
  ticketNumber: string;
  fareAmountMinor: number;
};

export type TicketDocument = {
  bookingId: string;
  issuedAt: string;
  office: { id: string; name: string; code: string };
  carrier: { id: string; name: string; code: string };
  trip: { id: string; origin: string; destination: string; departureAt: string; basePriceMinor: number };
  passengers: TicketDocumentPassenger[];
  totals: { totalAmountMinor: number; commissionAmountMinor: number; currency: 'SDG' };
};

/** POST /broker/bookings/:id/dispatch {channel:'download'} */
export type DispatchResult = {
  bookingId: string;
  channel: 'download' | 'whatsapp' | 'sms';
  status: 'READY' | 'RECORDED';
  document: TicketDocument;
  pdfBase64: string;
  pdfContentType: 'application/pdf';
  attemptId: string;
};
