import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { LoginPage } from '../../features/auth/LoginPage';
import { RequireAuth } from '../../features/auth/RequireAuth';
import { HomePage } from '../../features/home/HomePage';

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
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
]);
