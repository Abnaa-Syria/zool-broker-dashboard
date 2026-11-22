/** Shapes of the broker bookings API (zool-go-backend `bookings.dto.ts`, `ticket-document.ts`). */
import type { TripPoint } from '../booking/types';

/** CHANGED: the booking was moved to another trip (D-CHG-01); its tickets are void, the new booking holds them. */
export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'CHANGED' | (string & {});

export type BoardingStatus = 'PENDING' | 'BOARDED' | 'NO_SHOW' | (string & {});

export type BookingTicket = {
  id: string;
  ticketNumber: string;
  status: 'CONFIRMED' | 'CANCELLED' | (string & {});
  seatId: string | null;
  seatLabel: string | null;
  passengerId: string;
  passengerName: string | null;
  boardingStatus: BoardingStatus;
  /** Server-signed boarding code drawn as the QR; null unless the booking and the ticket are confirmed. */
  qrPayload: string | null;
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
  /** D-CHG-01: on a CHANGED booking, the booking that replaced it */
  replacedByBookingId?: string | null;
  /** D-CHG-01: on a booking created by a trip change, the old booking */
  replacesBookingId?: string | null;
  createdAt: string;
  passengers: Array<{ id: string; fullName: string; phone: string | null; idNumber: string | null }>;
  tickets: BookingTicket[];
};

/** POST /broker/bookings/confirm; `returnBooking` is set for a round trip (D-RT-01). */
export type ConfirmResult = { booking: Booking; returnBooking?: Booking | null; balanceAfterMinor: number };

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
  /** Signed boarding code (same as the booking ticket's `qrPayload`). */
  qrPayload?: string | null;
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

// ---------------------------------------------------------------- D-CHG-01 booking changes

/**
 * GET /broker/bookings/:id/change-options item: the app trip card (`toTripCardView`) of another trip of
 * the same carrier and cities + `priceDifferenceMinor` (new trip total − current booking total, before the fee).
 */
export type ChangeOption = {
  id: string;
  tripNumber: string | null;
  status: string;
  carrier: { id: string; name: string; legalName: string; logoUrl: string | null };
  serviceClass: 'STANDARD' | 'VIP';
  departureAt: string;
  arrivalAt: string | null;
  durationMinutes: number | null;
  origin: TripPoint;
  destination: TripPoint;
  isDirect: boolean;
  stopsCount: number;
  seatsAvailable: number;
  seatsTotal: number;
  priceMinor: number;
  priceDifferenceMinor: number;
};

/** POST /broker/bookings/:id/change-quote */
export type ChangeQuote = {
  bookingId: string;
  newTrip: Omit<ChangeOption, 'priceDifferenceMinor'>;
  /** New seat labels in label order (passenger i ↔ seats[i], same order as the current tickets). */
  seats: string[];
  oldTotalMinor: number;
  newTotalMinor: number;
  changeFeeMinor: number;
  priceDifferenceMinor: number;
  /** Debited from the office wallet now. */
  payMinor: number;
  /** Credited to the office wallet now. */
  refundMinor: number;
  commission?: { percent: number; newCommissionMinor: number };
  currency: 'SDG';
};

/** POST /broker/bookings/:id/change → the NEW booking (the old one becomes CHANGED). */
export type ChangeResult = { booking: Booking; replayed: boolean };
