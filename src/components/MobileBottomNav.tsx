import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, ShoppingBag, Bookmark, GitCompare, MoreHorizontal, 
  History, Bell, X, LogIn, LogOut, User, UserPlus, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MobileBottomNav() {
  const { user, logout, watchlistCount, compareCount, alertCount } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Close more drawer on route changes
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMoreOpen) {
        setIsMoreOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMoreOpen]);

  // Prevent background scrolling when more drawer is open
  useEffect(() => {
    if (isMoreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMoreOpen]);

  const isCatalogueActive = location.pathname === '/products' || (location.pathname.startsWith('/products/') && location.pathname !== '/products');
  const isMoreRouteActive = location.pathname === '/history' || location.pathname === '/alerts';

  return (
    <>
      {/* Mobile & Tablet Fixed Bottom Navigation Bar */}
      <nav 
        id="mobile-bottom-nav"
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 w-full lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] px-1 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="max-w-md md:max-w-lg mx-auto grid grid-cols-5 items-center gap-0.5">
          
          {/* 1. Dashboard */}
          <NavLink
            to="/"
            end
            id="mobile-nav-dashboard"
            className={({ isActive }) => `flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all select-none min-h-[50px] relative ${
              isActive
                ? 'text-indigo-600 font-bold bg-indigo-50/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Home className="w-4 h-4 mb-0.5 shrink-0" />
            <span className="text-[10px] leading-tight tracking-tight">Home</span>
          </NavLink>

          {/* 2. Catalogue */}
          <NavLink
            to="/products"
            id="mobile-nav-catalogue"
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all select-none min-h-[50px] relative ${
              isCatalogueActive
                ? 'text-indigo-600 font-bold bg-indigo-50/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4 mb-0.5 shrink-0" />
            <span className="text-[10px] leading-tight tracking-tight">Search</span>
          </NavLink>

          {/* 3. Watchlist */}
          <NavLink
            to="/watchlist"
            id="mobile-nav-watchlist"
            className={({ isActive }) => `flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all select-none min-h-[50px] relative ${
              isActive
                ? 'text-indigo-600 font-bold bg-indigo-50/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Bookmark className="w-4 h-4 mb-0.5 shrink-0" />
              {user && watchlistCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[15px] h-[15px] flex items-center justify-center text-[9px] font-bold rounded-full bg-indigo-600 text-white leading-none shadow-xs">
                  {watchlistCount > 99 ? '99+' : watchlistCount}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight tracking-tight">Saved</span>
          </NavLink>

          {/* 4. Compare */}
          <NavLink
            to="/compare"
            id="mobile-nav-compare"
            className={({ isActive }) => `flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all select-none min-h-[50px] relative ${
              isActive
                ? 'text-indigo-600 font-bold bg-indigo-50/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <GitCompare className="w-4 h-4 mb-0.5 shrink-0" />
              {compareCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[15px] h-[15px] flex items-center justify-center text-[9px] font-bold rounded-full bg-indigo-600 text-white leading-none shadow-xs">
                  {compareCount > 99 ? '99+' : compareCount}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight tracking-tight">Compare</span>
          </NavLink>

          {/* 5. More Menu Trigger */}
          <button
            type="button"
            id="mobile-nav-more-trigger"
            onClick={() => setIsMoreOpen(prev => !prev)}
            aria-expanded={isMoreOpen}
            aria-controls="mobile-more-sheet"
            aria-label="Open more navigation options"
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all select-none min-h-[50px] relative cursor-pointer ${
              isMoreOpen || isMoreRouteActive
                ? 'text-indigo-600 font-bold bg-indigo-50/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <MoreHorizontal className="w-4 h-4 mb-0.5 shrink-0" />
              {user && alertCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[15px] h-[15px] flex items-center justify-center text-[9px] font-bold rounded-full bg-amber-600 text-white leading-none shadow-xs">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight tracking-tight">More</span>
          </button>

        </div>
      </nav>

      {/* More Navigation Slide-up Sheet / Popover */}
      {isMoreOpen && (
        <div 
          id="mobile-more-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="More navigation destinations"
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
        >
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet Body */}
          <div className="relative z-10 bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 p-4 max-w-lg w-full mx-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom duration-200">
            
            {/* Header bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">More Destinations</span>
              </div>
              <button
                type="button"
                id="btn-close-more-sheet"
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Close more destinations menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="mt-3 flex flex-col gap-2">
              
              {/* Admin Panel (visible only to admins) */}
              {user?.role === 'admin' && (
                <NavLink
                  to="/admin"
                  id="more-nav-admin"
                  onClick={() => setIsMoreOpen(false)}
                  className={({ isActive }) => `flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-purple-50 border-purple-200 text-purple-700 font-semibold' 
                      : 'bg-purple-50/50 hover:bg-purple-100/50 border-purple-200/80 text-purple-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>Admin Panel</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-bold uppercase tracking-wider">
                          Admin
                        </span>
                      </div>
                      <div className="text-[11px] text-purple-600/80 font-normal">Catalogue health & API quota monitor</div>
                    </div>
                  </div>
                </NavLink>
              )}

              {/* Price Alerts */}
              <NavLink
                to="/alerts"
                id="more-nav-alerts"
                onClick={() => setIsMoreOpen(false)}
                className={({ isActive }) => `flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-700 font-semibold' 
                    : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-150 flex items-center justify-center text-amber-600 shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Price Alerts</div>
                    <div className="text-[11px] text-slate-500 font-normal">Active drop notifications</div>
                  </div>
                </div>
                {user && alertCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    {alertCount} active
                  </span>
                )}
              </NavLink>

              {/* History */}
              <NavLink
                to="/history"
                id="more-nav-history"
                onClick={() => setIsMoreOpen(false)}
                className={({ isActive }) => `flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-700 font-semibold' 
                    : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600 shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Search History</div>
                    <div className="text-[11px] text-slate-500 font-normal">Recent search terms & price logs</div>
                  </div>
                </div>
              </NavLink>

              {/* Auth Information in More Menu for quick access */}
              <div className="pt-2 mt-1 border-t border-slate-100">
                {user ? (
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{user.username}</div>
                        <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="more-btn-logout"
                      onClick={() => {
                        setIsMoreOpen(false);
                        logout();
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200/70 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="more-btn-login"
                      onClick={() => {
                        setIsMoreOpen(false);
                        navigate('/login');
                      }}
                      className="py-2 px-3 text-xs font-semibold text-center text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Login</span>
                    </button>
                    <button
                      type="button"
                      id="more-btn-register"
                      onClick={() => {
                        setIsMoreOpen(false);
                        navigate('/register');
                      }}
                      className="py-2 px-3 text-xs font-semibold text-center text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Register</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}
    </>
  );
}
