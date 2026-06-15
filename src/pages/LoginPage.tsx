import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, AlertCircle, ArrowRight, ShieldCheck, Database } from 'lucide-react';

export default function LoginPage() {
  const { login, user, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // If user is already authenticated, redirect them to home page or relative target
  const from = (location.state as any)?.from?.pathname || "/";

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
    return () => clearError();
  }, [user, navigate, from, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError("Please fill out all credential inputs.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      // Errors are set in AuthContext and handled inside useEffect or caught cleanly here
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShortcutLogin = () => {
    setEmail("admin@dealtracker.com");
    setPassword("password123");
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 min-h-[80vh]">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 flex flex-col gap-6">
        
        {/* Logo and Greeting Info Header */}
        <div className="text-center flex flex-col items-center gap-1.5">
          <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm mb-2">
            <KeyRound className="w-5 h-5 text-white animate-pulse" />
          </div>
          <h2 className="text-xl font-display font-bold text-slate-800 tracking-tight">
            Welcome Back!
          </h2>
          <p className="text-xs text-slate-500">
            Sign in to track gadgets and compare top merchant pricing.
          </p>
        </div>

        {/* Error notification board */}
        {(error || localError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="font-medium">{localError || error}</div>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label id="lbl-email" className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
              <Mail className="w-3 h-3 text-slate-400" />
              <span>Email Address</span>
            </label>
            <input
              id="inp-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans text-slate-800"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label id="lbl-password" className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-slate-400" />
              <span>Password Code</span>
            </label>
            <input
              id="inp-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans text-slate-800"
              required
            />
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full cursor-pointer bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all text-white font-mono text-xs font-medium py-3 rounded-lg mt-2 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Sign In My Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Sandbox Dev Shortcuts Panel */}
        <div className="border-t border-slate-100 pt-5 mt-1 flex flex-col gap-3">
          <div className="bg-amber-50/75 border border-amber-200/80 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wider">
                Developer Sandbox Override
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              No backend database configured yet? Connect instantly with our preloaded administrator details!
            </p>
            <button
              id="btn-dev-login"
              type="button"
              onClick={handleShortcutLogin}
              className="cursor-pointer border border-amber-300 text-amber-800 bg-white hover:bg-amber-50 rounded-lg py-1.5 px-3 text-xs font-mono font-medium self-start flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Database className="w-3 h-3" />
              <span>Auto-Fill Admin Account</span>
            </button>
          </div>

          <div className="text-center text-xs text-slate-500 mt-2">
            Don't have an online account?{' '}
            <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
              Create an account
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
