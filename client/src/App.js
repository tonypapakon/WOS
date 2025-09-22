import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import PerformanceMonitor from './components/PerformanceMonitor';

// Lazy load components for better performance
const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const TableView = lazy(() => import('./components/TableView'));
const TakeawayView = lazy(() => import('./components/TakeawayView'));
const MenuView = lazy(() => import('./components/MenuView'));
const OrderView = lazy(() => import('./components/OrderView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const SettingsView = lazy(() => import('./components/SettingsView'));

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {!user ? (
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        ) : (
          <Layout>
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
              </div>
            }>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tables" element={<TableView />} />
                <Route path="/takeaway" element={<TakeawayView />} />
                <Route path="/menu" element={<MenuView />} />
                <Route path="/orders" element={<OrderView />} />
                <Route path="/orders/:tableId" element={<OrderView />} />
                <Route path="/reports" element={<ReportsView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        )}
      <PerformanceMonitor />
      </div>
    </Router>
  );
}

export default App;