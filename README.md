# ZoolGo — Broker Office Panel

Web panel for broker offices (مكاتب الوكلاء): office manager and booking clerks. Same `/api/v1/broker/*` API as the broker mobile app (decision D-BROKER-CHANNEL-01).

- Stack: React 19, TypeScript, Vite, Tailwind 3, React Router 7, TanStack Query 5, Recharts. RTL Arabic UI.
- Backend & docs: https://github.com/Abnaa-Syria/zool-backend (plan: `docs/MASTER_PLAN.md`, rules: `docs/API_CONVENTIONS.md`, screens: `docs/SCREEN_API_MAP.md` §3).
- Admin dashboard (shares the UI kit and API client): https://github.com/Abnaa-Syria/zool-dashboard

## Run

Start the backend first (`zool-go-backend`: `npm run dev`, port 4000), then:

```bash
npm ci
cp .env.example .env   # optional; defaults: VITE_API_BASE_URL=/api/v1, proxy target http://localhost:4000
npm run dev            # http://localhost:5174 — Vite proxies /api to the backend
```

Dev seed accounts: office manager `+249900000101`, clerk `+249900000102` (office ZG-BRK-1). The OTP is shown on the login screen in development.

## Auth & permissions

- Access token in memory; refresh token is an HttpOnly cookie scoped to `/api/v1/broker/auth`, restored on reload; 401 → one shared refresh → retry (`src/lib/api/client.ts`).
- Employee flags → permissions: `broker.book`, `broker.wallet.topup`, `broker.reports.view`, `broker.staff.manage`. Managers also pass `broker.reports.view` (reports, commissions), exactly like the API. `useAuth().can(...)` mirrors this.

## Booking features

- **Booking flow** (`/booking/new`, `src/features/booking`): search → trip → seats (hold) → passengers → review (quote) → confirm → tickets. Holds are released on back / cancel / leaving the page; confirm sends one idempotency key per attempt.
- **Round trip (D-RT-01)**: trip type toggle in the search. Outbound trip + seats, then the return trip (cities swapped, return date, only trips leaving after the outbound arrives) + the same number of seats, one passenger list for both legs (passenger i ↔ seat i on each leg). Quote/confirm send `returnTrip`; confirm returns `booking` + `returnBooking`. Rules in `roundTrip.ts`.
- **Women-only seats**: seats with `isWomenOnly` (pink ring). A passenger in such a seat (on any leg) must have gender «أنثى»; gender is optional elsewhere and sent as `gender` (`passengers.ts`). API error `WOMEN_ONLY_SEAT`.
- **Tickets**: the thermal ticket QR encodes the server-signed `qrPayload` (ticket number only as a fallback for old data). Booking detail shows each ticket's boarding status (PENDING / BOARDED / NO_SHOW).
- **Modify booking (D-CHG-01)**, from booking detail for CONFIRMED bookings with `broker.book`: change seat on the same trip (modal with the seat map), or change trip (`/bookings/:id/change`: options for a day → seats (held) → change quote → confirm). The new booking opens after the change; the old one becomes `CHANGED` («مُعدّل», also a filter tab in the bookings list).
- **Notifications**: header bell with the unread count (polled every 60 s), feed, mark one / all as read (`src/features/notifications`).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (:5174) |
| `npm run build` | Typecheck + production build |
| `npm run lint` | oxlint — warnings fail |
| `npm test` | Vitest unit tests |

## Workflow

Commit and push directly to `main`. Run `npm run lint && npx tsc -b && npm test` before pushing; CI re-runs lint, typecheck, tests and build on every push.
