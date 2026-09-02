import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, User, AlertCircle, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const { register, user, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
    return () => clearError();
  }, [user, navigate, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username || !email || !password || !confirmPassword) {
      setLocalError("Please fill in all registration fields.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Your password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match. Please verify.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(username, email, password);
    } catch (err: any) {
      // Errors are set in AuthContext and handled automatically in the UI
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 min-h-[80vh]">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 flex flex-col gap-6">
        
        {/* Logo and Greeting Info Header */}
        <div className="text-center flex flex-col items-center gap-1.5">
          <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm mb-2">
            <User className="w-5 h-5 text-white animate-pulse" />
          </div>
          <h2 className="text-xl font-display font-bold text-slate-800 tracking-tight">
            Register Account
          </h2>
          <p className="text-xs text-slate-500">
            Set up credentials to log prices, alert metrics, and watchlists.
          </p>
        </div>

        {/* Error notification board */}
        {(error || localError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="font-medium">{localError || error}</div>
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label id="lbl-username" className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              <span>Full Name</span>
            </label>
            <input
              id="inp-username"
              type="text"
              placeholder="Alex Rivera"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans text-slate-800"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label id="lbl-register-email" className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
              <Mail className="w-3 h-3 text-slate-400" />
              <span>Email Address</span>
            </label>
            <input
              id="inp-register-email"
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans text-slate-800"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label id="lbl-register-password" className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-slate-400" />
              <span>Secure Password</span>
            </label>
            <div className="relative">
              <input
                id="inp-register-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="•••••••• (Min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans text-slate-800"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-indigo-600 p-1 rounded transition-colors cursor-pointer"
                style={{ cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label id="lbl-confirm-password" className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-slate-400" />
              <span>Confirm Password</span>
            </label>
            <div className="relative">
              <input
                id="inp-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans text-slate-800"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-indigo-600 p-1 rounded transition-colors cursor-pointer"
                style={{ cursor: 'pointer' }}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="btn-register-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full cursor-pointer bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all text-white font-mono text-xs font-medium py-3 rounded-lg mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Provision My Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="border-t border-slate-150 pt-5 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
            Login
          </Link>
        </div>

      </div>
    </div>
  );
}
