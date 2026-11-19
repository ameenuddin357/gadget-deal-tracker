import React from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MobileBottomNav from './components/MobileBottomNav';
import CompareToast from './components/CompareToast';

// E-Commerce Deal Tracker Frontend Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import ProductListingPage from './pages/ProductListingPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import WatchlistPage from './pages/WatchlistPage';
import PriceAlertsPage from './pages/PriceAlertsPage';
import ComparePage from './pages/ComparePage';
import HistoryPage from './pages/HistoryPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminOffersPage from './pages/admin/AdminOffersPage';
import AdminSyncStatusPage from './pages/admin/AdminSyncStatusPage';

// Visual Elements
import { 
  ShoppingBag, Bookmark, Bell, LogOut, LogIn, UserPlus, Home, User, ServerCrash, KeyRound,
  GitCompare, History, Sparkles, ShieldCheck
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
  const { user, logout, watchlistCount, compareCount, alertCount } = useAuth();
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans select-none antialiased w-full max-w-full">
      
      {/* Dynamic Upper Navigation Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 px-3 py-2.5 sm:px-6 sm:py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand Logo & Name */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0 shrink group">
            <div className="h-9 w-9 sm:h-10 sm:w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 group-hover:bg-indigo-700 transition-colors">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-display font-bold tracking-tight text-slate-900 truncate">
                Gadget Tracker Pro
              </h1>
            </div>
          </Link>

          {/* Context Switcher Mode and User State indicators */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* AI Deal Advisor Quick Entry Point */}
            <button
              id="btn-header-ai-advisor"
              onClick={handleHeaderAiAdvisorClick}
              className="cursor-pointer px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-slate-900 text-white hover:bg-slate-800 border border-slate-800 shadow-xs min-h-[36px]"
              title="Consult AI Deal Advisor"
            >
              <span className="text-sm leading-none">🤖</span>
              <span className="hidden sm:inline">AI Deal Advisor</span>
              <span className="sm:hidden font-medium">AI Advisor</span>
            </button>

            {/* Quick telemetry metrics */}
            {user && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-neutral-600 text-xs">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-slate-700">Hi, {user.username}</span>
              </div>
            )}

            {/* Admin Header Link (visible only to admin accounts on desktop >= 1024px) */}
            {user && user.role === 'admin' && (
              <Link
                to="/admin"
                id="header-admin-link"
                className="cursor-pointer hidden lg:flex px-2.5 py-1.5 rounded-xl text-xs font-semibold items-center gap-1.5 transition-all bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 min-h-[36px]"
                title="Open Admin Dashboard"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Admin Panel</span>
              </Link>
            )}

            {/* Login control metrics */}
            {user ? (
              <button
                id="btn-auth-logout"
                onClick={logout}
                className="cursor-pointer border border-transparent hover:bg-red-50 text-slate-500 hover:text-red-600 p-2 rounded-xl transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Sign Out Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <Link
                  to="/login"
                  id="lnk-auth-login"
                  className={`cursor-pointer px-2.5 py-1.5 sm:px-3 rounded-xl text-xs font-mono font-medium flex items-center gap-1 transition-all min-h-[36px] ${
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
                  className={`cursor-pointer hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-mono font-medium items-center gap-1 transition-all min-h-[36px] ${
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 flex flex-col gap-6">
        
          {/* =========================================================
             1. REACTION FRONT-END APPLICATION MODE (with React Router)
             ========================================================= */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Desktop Primary Nav Links (Hidden below lg where bottom nav is used) */}
            <div className="hidden lg:flex border border-slate-200 bg-white p-1 rounded-xl self-center max-w-full overflow-x-auto scrollbar-none gap-1 shadow-sm w-auto">
              <NavLink
                to="/"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </NavLink>

              <NavLink
                to="/products"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Search Gadgets</span>
              </NavLink>

              <NavLink
                to="/watchlist"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved Gadgets</span>
                {user && watchlistCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700 leading-none">
                    {watchlistCount}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/compare"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Compare Prices</span>
                {compareCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700 leading-none">
                    {compareCount}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/history"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Search History</span>
              </NavLink>

              <NavLink
                to="/alerts"
                className={({ isActive }) => `flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Price Alerts</span>
                {user && alertCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700 leading-none">
                    {alertCount}
                  </span>
                )}
              </NavLink>
            </div>

            {/* E-Commerce App Routing Views */}
            <div className="flex-1">
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                
                {/* Protected Routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } />

                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                
                <Route path="/admin" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboardPage />
                  </ProtectedRoute>
                } />
                
                <Route path="/admin/products" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminProductsPage />
                  </ProtectedRoute>
                } />
                
                <Route path="/admin/offers" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminOffersPage />
                  </ProtectedRoute>
                } />

                <Route path="/admin/sync" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminSyncStatusPage />
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
      <footer className="border-t border-slate-200 bg-white mt-auto pt-4 sm:pt-5 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:pb-5 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-xs text-slate-500 text-center sm:text-left font-sans">
          <div className="font-semibold text-slate-700">
            Gadget Tracker Pro
          </div>
          <div className="text-[11px] text-slate-400">
            Track prices. Find better deals.
          </div>
        </div>
      </footer>

      {/* Mobile & Tablet Fixed Bottom Navigation Bar (<1024px) */}
      <MobileBottomNav />

      {/* Global Compare Replacement Success Feedback Toast */}
      <CompareToast />
      
    </div>
  );
}

