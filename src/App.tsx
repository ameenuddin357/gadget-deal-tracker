import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Educational DB Architect Hub Components
import ERDVisualizer from './components/ERDVisualizer';
import SchemaExplorer from './components/SchemaExplorer';
import NormalizationAnalyzer from './components/NormalizationAnalyzer';
import SQLSandbox from './components/SQLSandbox';
import QuerySimulator from './components/QuerySimulator';
import InterviewSimulator from './components/InterviewSimulator';
import BackendCodeExplorer from './components/BackendCodeExplorer';

// E-Commerce Deal Tracker Frontend Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProductListingPage from './pages/ProductListingPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import WatchlistPage from './pages/WatchlistPage';
import PriceAlertsPage from './pages/PriceAlertsPage';
import ComparePage from './pages/ComparePage';
import HistoryPage from './pages/HistoryPage';

// Visual Elements
import { 
  Database, Layers, BookOpen, Binary, Code2, Cpu, Award, Terminal, 
  ShoppingBag, Bookmark, Bell, LogOut, LogIn, UserPlus, Home, User, ServerCrash, KeyRound,
  GitCompare, History
} from 'lucide-react';

type TabId = 'erd' | 'dictionary' | 'normalization' | 'sql' | 'optimizer' | 'interview' | 'backend';
type AppMode = 'deal-tracker' | 'schema-architect';

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
  const [appMode, setAppMode] = useState<AppMode>('deal-tracker');
  const [activeTab, setActiveTab] = useState<TabId>('erd');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  
  const { user, logout } = useAuth();

  const handleSelectTableFromERD = (tableId: string) => {
    setSelectedTableId(tableId);
    setActiveTab('dictionary');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans select-none antialiased">
      
      {/* Dynamic Upper Navigation Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-4 py-3 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
              {appMode === 'deal-tracker' ? (
                <ShoppingBag className="w-5 h-5 text-white" />
              ) : (
                <Database className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-base font-display font-bold tracking-tight text-slate-900">
                E-Commerce Gadget Deal Tracker
              </h1>
              <p className="text-[11px] font-mono text-indigo-600 font-medium">
                {appMode === 'deal-tracker' 
                  ? 'React Application Live Tracker Frontend' 
                  : 'PostgreSQL Schema Studio & Senior Database Architect Suite'
                }
              </p>
            </div>
          </div>

          {/* Context Switcher Mode and User State indicators */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Swap app modes */}
            <button
              id="btn-toggle-app-mode"
              onClick={() => setAppMode(prev => prev === 'deal-tracker' ? 'schema-architect' : 'deal-tracker')}
              className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white font-mono text-[10px] font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            >
              {appMode === 'deal-tracker' ? (
                <>
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Switch to DB Architect Suite</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Go to Live App Frontend</span>
                </>
              )}
            </button>

            {/* Quick telemetry metrics */}
            {appMode === 'deal-tracker' && user && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-neutral-600 text-xs">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-slate-700">Hi, {user.username}</span>
              </div>
            )}

            {/* Login control metrics */}
            {appMode === 'deal-tracker' ? (
              user ? (
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
                    className="cursor-pointer bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-1 transition-all"
                  >
                    <LogIn className="w-3 h-3 text-slate-500" />
                    <span>Login</span>
                  </Link>
                  <Link
                    to="/register"
                    id="lnk-auth-register"
                    className="cursor-pointer hidden sm:flex bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-mono font-medium items-center gap-1 transition-all"
                  >
                    <UserPlus className="w-3 h-3 text-indigo-500" />
                    <span>Register</span>
                  </Link>
                </div>
              )
            ) : null}

          </div>

        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
        {appMode === 'deal-tracker' ? (
          /* =========================================================
             1. REACTION FRONT-END APPLICATION MODE (with React Router)
             ========================================================= */
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Primary Nav Links */}
            <div className="flex border border-slate-200 bg-white p-1 rounded-xl self-start overflow-x-auto scrollbar-none gap-1 shadow-sm w-full sm:w-auto">
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
        ) : (
          /* =========================================================
             2. EDUCATIONAL POSTGRESQL ARCHITECT HUB MODE (Tabs View)
             ========================================================= */
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Switchdeck Tab Option Selector Menu */}
            <div className="flex border border-slate-200 bg-white p-1 rounded-xl self-start w-full overflow-x-auto scrollbar-none gap-1 shadow-sm">
              <button
                id="tab-btn-erd"
                onClick={() => setActiveTab('erd')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  activeTab === 'erd'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Topology ERD</span>
              </button>

              <button
                id="tab-btn-dictionary"
                onClick={() => setActiveTab('dictionary')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  activeTab === 'dictionary'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Reference Dictionary</span>
              </button>

              <button
                id="tab-btn-normalization"
                onClick={() => setActiveTab('normalization')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  activeTab === 'normalization'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Binary className="w-3.5 h-3.5" />
                <span>Normalization Lab</span>
              </button>

              <button
                id="tab-btn-sql"
                onClick={() => setActiveTab('sql')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  activeTab === 'sql'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>SQL Sandbox Scripts</span>
              </button>

              <button
                id="tab-btn-backend"
                onClick={() => setActiveTab('backend')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  activeTab === 'backend'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                <span>MVC Express Backend</span>
              </button>

              <button
                id="tab-btn-optimizer"
                onClick={() => setActiveTab('optimizer')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  activeTab === 'optimizer'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Query Optimizer</span>
              </button>

              <button
                id="tab-btn-interview"
                onClick={() => setActiveTab('interview')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  activeTab === 'interview'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Architect Board Exam</span>
              </button>
            </div>

            {/* Tab Workspace Panel Window */}
            <div className="flex-1 min-h-[500px]">
              {activeTab === 'erd' && (
                <ERDVisualizer
                  selectedTableId={selectedTableId}
                  onSelectTable={handleSelectTableFromERD}
                />
              )}

              {activeTab === 'dictionary' && (
                <SchemaExplorer initialSelectedTableId={selectedTableId} />
              )}

              {activeTab === 'normalization' && <NormalizationAnalyzer />}

              {activeTab === 'sql' && <SQLSandbox />}

              {activeTab === 'backend' && <BackendCodeExplorer />}

              {activeTab === 'optimizer' && <QuerySimulator />}

              {activeTab === 'interview' && <InterviewSimulator />}
            </div>
          </div>
        )}

      </main>

      {/* Primary Decorative Footer bounds */}
      <footer className="border-t border-slate-200 bg-white mt-12 py-6 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-[10px] text-slate-500">
          <div>
            E-Commerce Gadget Deal Tracker Schema Workspace • Designed by Senior Database Architect
          </div>
          <div className="flex items-center gap-3">
            <span>Server-side API Grids Connected</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Licensed PostgreSQL 16</span>
          </div>
        </div>
      </footer>
      
    </div>
  );
}
