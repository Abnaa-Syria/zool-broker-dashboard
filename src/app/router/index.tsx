import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { LoginPage } from '../../features/auth/LoginPage';
import { RequireAuth } from '../../features/auth/RequireAuth';
import { HomePage } from '../../features/home/HomePage';
import { BookingFlowPage } from '../../features/booking/BookingFlowPage';
import { BookingsListPage } from '../../features/bookings/BookingsListPage';
import { BookingDetailPage } from '../../features/bookings/BookingDetailPage';
import { WalletPage } from '../../features/wallet/WalletPage';
import { StaffPage } from '../../features/staff/StaffPage';
import { CommissionsPage } from '../../features/commissions/CommissionsPage';
import { ReportsPage } from '../../features/reports/ReportsPage';

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
      // feature routes are added below by feature (booking, bookings, wallet, staff, commissions, reports)
      // wallet + staff + commissions + reports
      { path: 'wallet', element: <WalletPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'commissions', element: <CommissionsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      // booking + bookings
      { path: 'booking/new', element: <BookingFlowPage /> },
      { path: 'bookings', element: <BookingsListPage /> },
      { path: 'bookings/:id', element: <BookingDetailPage /> },
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
]);
