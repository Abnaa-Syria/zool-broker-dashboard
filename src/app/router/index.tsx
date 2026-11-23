import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { LoginPage } from '../../features/auth/LoginPage';
import { RequireAuth } from '../../features/auth/RequireAuth';
import { HomePage } from '../../features/home/HomePage';
import { BookingFlowPage } from '../../features/booking/BookingFlowPage';
import { BookingsListPage } from '../../features/bookings/BookingsListPage';
import { BookingDetailPage } from '../../features/bookings/BookingDetailPage';
import { ChangeTripPage } from '../../features/bookings/ChangeTripPage';
import { WalletPage } from '../../features/wallet/WalletPage';
import { StaffPage } from '../../features/staff/StaffPage';
import { CommissionsPage } from '../../features/commissions/CommissionsPage';
import { ReportsPage } from '../../features/reports/ReportsPage';
import { TripDetailPage } from '../../features/trips/TripDetailPage';
import { TopUpDetailPage } from '../../features/wallet/TopUpDetailPage';
import { LedgerEntryDetailPage } from '../../features/wallet/LedgerEntryDetailPage';
import { CommissionDetailPage } from '../../features/commissions/CommissionDetailPage';
import { StaffDetailPage } from '../../features/staff/StaffDetailPage';
import { NotificationsPage } from '../../features/notifications/NotificationsPage';
import { NotificationDetailPage } from '../../features/notifications/NotificationDetailPage';
import { ProfilePage } from '../../features/profile/ProfilePage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomePage /> },
      // Every entity has its own detail page (list → /entity/:id), with breadcrumbs and its actions.
      // wallet + staff + commissions + reports
      { path: 'wallet', element: <WalletPage /> },
      { path: 'wallet/top-ups/:intentId', element: <TopUpDetailPage /> },
      { path: 'wallet/ledger/:entryId', element: <LedgerEntryDetailPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'staff/:employeeId', element: <StaffDetailPage /> },
      { path: 'commissions', element: <CommissionsPage /> },
      { path: 'commissions/booking/:bookingId', element: <CommissionDetailPage /> },
      { path: 'commissions/:accrualId', element: <CommissionDetailPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'notifications/:id', element: <NotificationDetailPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'trips/:tripId', element: <TripDetailPage /> },
      // booking + bookings
      { path: 'booking/new', element: <BookingFlowPage /> },
      { path: 'bookings', element: <BookingsListPage /> },
      { path: 'bookings/:id', element: <BookingDetailPage /> },
      { path: 'bookings/:id/change', element: <ChangeTripPage /> },
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
]);
