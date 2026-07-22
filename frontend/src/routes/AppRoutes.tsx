import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuthStore } from '../store/authStore';
import { LoadingPanel } from '../components/common/States';

const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })));
const ArchitecturePage = lazy(() => import('../pages/ArchitecturePage').then(module => ({ default: module.ArchitecturePage })));
const AuthCallbackPage = lazy(() => import('../pages/AuthCallbackPage').then(module => ({ default: module.AuthCallbackPage })));
const DashboardPage = lazy(() => import('../pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const DependencyGraphPage = lazy(() => import('../pages/DependencyGraphPage').then(module => ({ default: module.DependencyGraphPage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then(module => ({ default: module.LoginPage })));
const OperationsPage = lazy(() => import('../pages/OperationsPage').then(module => ({ default: module.OperationsPage })));
const RepositoriesPage = lazy(() => import('../pages/RepositoriesPage').then(module => ({ default: module.RepositoriesPage })));
const ReviewDetailPage = lazy(() => import('../pages/ReviewDetailPage').then(module => ({ default: module.ReviewDetailPage })));
const ReviewsPage = lazy(() => import('../pages/ReviewsPage').then(module => ({ default: module.ReviewsPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const TimelinePage = lazy(() => import('../pages/TimelinePage').then(module => ({ default: module.TimelinePage })));
const AnalysisExecutionPage = lazy(() => import('../pages/AnalysisExecutionPage').then(module => ({ default: module.AnalysisExecutionPage })));

function ProtectedLayout() {
  const token = useAuthStore(state => state.token);
  return token ? <DashboardLayout /> : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-sand p-8 dark:bg-ink"><LoadingPanel rows={7} /></div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/repositories" element={<RepositoriesPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/reviews/:id" element={<ReviewDetailPage />} />
          <Route path="/reviews/:id/analysis" element={<AnalysisExecutionPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
          <Route path="/dependency-graph" element={<DependencyGraphPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
