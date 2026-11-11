import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import { PageLoader } from './components/ui';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FlowsPage from './pages/FlowsPage';
import FlowDetailPage from './pages/FlowDetailPage';
import SearchPage from './pages/SearchPage';
import ImportExportPage from './pages/ImportExportPage';
import ActivityPage from './pages/ActivityPage';
import UsersPage from './pages/UsersPage';
import AccountPage from './pages/AccountPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link to="/" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">Back to dashboard</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="flows" element={<FlowsPage />} />
              <Route path="flows/:id" element={<FlowDetailPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="import" element={<ImportExportPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="users" element={<AdminOnly><UsersPage /></AdminOnly>} />
              <Route path="account" element={<AccountPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
