import React from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// E-Commerce Deal Tracker Frontend Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProductListingPage from './pages/ProductListingPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import WatchlistPage from './pages/WatchlistPage';
import PriceAlertsPage from './pages/PriceAlertsPage';
import ComparePage from './pages/ComparePage';
import HistoryPage from './pages/HistoryPage';

// Visual Elements
import { 
  ShoppingBag, Bookmark, Bell, LogOut, LogIn, UserPlus, Home, User, ServerCrash, KeyRound,
  GitCompare, History, Sparkles
} from 'lucide-react';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppWrapper />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppWrapper() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isLoginActive = location.pathname === '/login';
  const isRegisterActive = location.pathname === '/register';
  const isProductDetails = location.pathname.startsWith('/products/') && location.pathname !== '/products';

  const handleHeaderAiAdvisorClick = () => {
    if (isProductDetails) {
      const el = document.getElementById('ai-deal-advisor-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      if (!user) {
        navigate('/login', { state: { message: 'Please log in to use the AI Deal Advisor.' } });
      } else {
        navigate('/products?ai_advisor=true');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans select-none antialiased">
      
      {/* Dynamic Upper Navigation Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-4 py-3 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-display font-bold tracking-tight text-slate-900">
                Gadget Tracker Pro
              </h1>
            </div>
          </div>

          {/* Context Switcher Mode and User State indicators */}
          <div className="flex flex-wrap items-center gap-2">

            {/* AI Deal Advisor Quick Entry Point */}
            <button
              id="btn-header-ai-advisor"
              onClick={handleHeaderAiAdvisorClick}
              className="cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-slate-900 text-white hover:bg-slate-800 border border-slate-800 shadow-xs"
              title="Consult AI Deal Advisor"
            >
              <span className="text-sm">🤖</span>
              <span>AI Deal Advisor</span>
            </button>

            {/* Quick telemetry metrics */}
            {user && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-neutral-600 text-xs">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-slate-700">Hi, {user.username}</span>
              </div>
            )}

            {/* Login control metrics */}
            {user ? (
              <button
                id="btn-auth-logout"
                onClick={logout}
                className="cursor-pointer border border-transparent hover:bg-red-50 text-slate-500 hover:text-red-600 p-2 rounded-xl transition-all"
                title="Sign Out Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <Link
                  to="/login"
                  id="lnk-auth-login"
                  className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-1 transition-all ${
                    isLoginActive
                      ? 'bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100'
                      : 'bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <LogIn className={`w-3 h-3 ${isLoginActive ? 'text-indigo-500' : 'text-slate-500'}`} />
                  <span>Login</span>
                </Link>
                <Link
                  to="/register"
                  id="lnk-auth-register"
                  className={`cursor-pointer hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-mono font-medium items-center gap-1 transition-all ${
                    isRegisterActive
                      ? 'bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100'
                      : 'bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <UserPlus className={`w-3 h-3 ${isRegisterActive ? 'text-indigo-500' : 'text-slate-500'}`} />
                  <span>Register</span>
                </Link>
              </div>
            )}

          </div>

        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
          {/* =========================================================
             1. REACTION FRONT-END APPLICATION MODE (with React Router)
             ========================================================= */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Primary Nav Links */}
            <div className="flex border border-slate-200 bg-white p-1 rounded-xl self-center overflow-x-auto scrollbar-none gap-1 shadow-sm w-full sm:w-auto">
              <NavLink
                to="/"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/products"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Tech Catalogue</span>
              </NavLink>

              <NavLink
                to="/watchlist"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>My Watchlist</span>
              </NavLink>

              <NavLink
                to="/compare"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Compare Deals</span>
              </NavLink>

              <NavLink
                to="/history"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </NavLink>

              <NavLink
                to="/alerts"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Price Alerts</span>
              </NavLink>
            </div>

            {/* E-Commerce App Routing Views */}
            <div className="flex-1">
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                
                {/* Protected Routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } />
                
                <Route path="/watchlist" element={
                  <ProtectedRoute>
                    <WatchlistPage />
                  </ProtectedRoute>
                } />

                <Route path="/compare" element={
                  <ProtectedRoute>
                    <ComparePage />
                  </ProtectedRoute>
                } />

                <Route path="/history" element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                } />

                <Route path="/alerts" element={
                  <ProtectedRoute>
                    <PriceAlertsPage />
                  </ProtectedRoute>
                } />

                {/* Public Products Pages */}
                <Route path="/products" element={<ProductListingPage />} />
                <Route path="/products/:id" element={<ProductDetailsPage />} />

                {/* Catch-all fallback redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>

          </div>
      </main>

      {/* Primary Decorative Footer bounds */}
      <footer className="border-t border-slate-200 bg-white mt-12 py-6 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-[10px] text-slate-500">
          <div>
            Gadget Tracker Pro
          </div>
          <div className="flex items-center gap-3">
            <span>Real-time PostgreSQL tracking</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Licensed PostgreSQL 16</span>
          </div>
        </div>
      </footer>
      
    </div>
  );
}
