/** Shapes of the broker catalog / booking API (zool-go-backend `catalog.service` + `bookings.service`). */

export type TripCompany = { id: string; key: string; name: string };

export type CityRef = { id: string | null; code: string | null; nameAr: string; nameEn: string };
export type StationRef = { id: string; nameAr: string; nameEn: string };
/** Trip endpoint: the station is null on legacy trips created without one. */
export type TripPoint = { station: StationRef | null; city: CityRef };

export type TripStop = { sequence: number; kind: 'ORIGIN' | 'STOP' | 'DESTINATION'; station: StationRef | null; city: CityRef; scheduledAt: string | null };
export type TripAmenity = { code: string; nameAr: string; nameEn: string; icon: string; value: string | null };

/** GET /broker/trips item: the shared app trip view (`trip-view.ts`) + broker fields. Money in minor units. */
export type BrokerTrip = {
  id: string;
  tripNumber: string | null;
  company: TripCompany;
  carrier: { id: string; name: string; legalName: string; logoUrl: string | null; rating: { average: number | null; count: number } };
  serviceClass: 'STANDARD' | 'VIP';
  origin: TripPoint;
  destination: TripPoint;
  departureAt: string;
  arrivalAt: string | null;
  durationMinutes: number | null;
  isDirect: boolean;
  stops: TripStop[];
  amenities: TripAmenity[];
  vehicleModel: string | null;
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
  row: number | null;
  column: number | null;
  isWomenOnly: boolean;
};

export type SeatLayout = { rows: number; columns: number; aisleAfterColumn: number; driverSide: 'LEFT' | 'RIGHT' };

export type BrokerTripDetail = BrokerTrip & { layout: SeatLayout | null; seats: TripSeat[] };

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
