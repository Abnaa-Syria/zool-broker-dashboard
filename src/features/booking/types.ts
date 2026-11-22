/** Shapes of the broker catalog / booking API (zool-go-backend `catalog.service` + `bookings.service`). */

export type TripCompany = { id: string; key: string; name: string };

/** GET /broker/trips item (`toBrokerTripDto`). Money in minor units. */
export type BrokerTrip = {
  id: string;
  company: TripCompany;
  origin: string;
  destination: string;
  departureAt: string;
  /** Not returned yet; rendered when the API adds it. */
  arrivalAt?: string | null;
  basePrice: number;
  commissionPercent: number;
  expectedCommissionPerSeat: number;
  availability: { free: number; held: number; sold: number; total: number };
  seatsFree: number;
  seatsTotal: number;
};

export type SeatStatus = 'FREE' | 'HELD' | 'SOLD';

/** GET /broker/trips/:id seat. Layout / women-only fields are optional: the API has none yet. */
export type TripSeat = {
  id: string;
  label: string;
  status: SeatStatus;
  heldByMe: boolean;
  holdId?: string;
  holdExpiresAt?: string;
  remainingSeconds?: number;
  row?: number | null;
  column?: number | null;
  womenOnly?: boolean | null;
};

export type BrokerTripDetail = BrokerTrip & { seats: TripSeat[] };

/** POST /broker/trips/:id/holds */
export type HoldsResult = {
  tripId: string;
  expiresAt: string;
  remainingSeconds: number;
  holds: Array<{ id: string; seatId: string; seatLabel: string; expiresAt: string; remainingSeconds: number }>;
};

export type PassengerInput = { fullName: string; phone: string; idNumber?: string };

/** POST /broker/bookings/quote */
export type BookingQuote = {
  tripId: string;
  seats: Array<{ id: string; label: string }>;
  seatCount: number;
  unitPriceMinor: number;
  totalAmountMinor: number;
  commissionPercent: number;
  expectedCommissionMinor: number;
  walletBalanceMinor: number;
  balanceAfterMinor: number;
  sufficientBalance: boolean;
  heldByMe: boolean;
  exposure: { ceiling: number; usedToday: number; remaining: number; withinCeiling: boolean };
};

/** GET /broker/carriers */
export type AssignedCarrier = { companyId: string; key: string; name: string; commissionPercent: number };
