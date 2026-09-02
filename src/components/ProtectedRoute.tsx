import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-mono text-xs text-slate-500">Checking authorization...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    const getAuthMessage = (path: string): string => {
      if (path === '/' || path.startsWith('/dashboard')) return 'Please log in to access your dashboard.';
      if (path.startsWith('/watchlist')) return 'Please log in to use your watchlist.';
      if (path.startsWith('/compare')) return 'Please log in to use product comparison.';
      if (path.startsWith('/alerts')) return 'Please log in to create price alerts.';
      if (path.startsWith('/history')) return 'Please log in to view your search history.';
      return 'Please log in to access this feature.';
    };

    // Save previous path location and message to display on login page
    return <Navigate to="/login" state={{ from: location, message: getAuthMessage(location.pathname) }} replace />;
  }

  return <>{children}</>;
}
