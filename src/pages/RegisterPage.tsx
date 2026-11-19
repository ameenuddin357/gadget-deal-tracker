import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, User, AlertCircle, ArrowRight, CheckCircle, Eye, EyeOff, Send, Check } from 'lucide-react';
import { resendVerificationEmail } from '../services/api';

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

  // Email verification post-registration state
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

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
    setResendStatus(null);

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
      const normalizedEmail = email.toLowerCase().trim();
      const res = await register(username, normalizedEmail, password);
      // When verification is required (EMAIL_VERIFICATION_ENABLED=true), show verification screen
      if (res?.verificationRequired) {
        setRegisteredEmail(normalizedEmail);
      } else {
        // When verification is disabled, redirect to normal app/home
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      // Error message is displayed in AuthContext or localError
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!registeredEmail || isResending) return;
    setIsResending(true);
    setResendStatus(null);
    try {
      await resendVerificationEmail(registeredEmail);
      setResendStatus("A new verification link has been sent to your email.");
    } catch (err: any) {
      setResendStatus("Unable to resend verification email right now. Please try again shortly.");
    } finally {
      setIsResending(false);
    }
  };

  // If successfully registered, show verification instructions
  if (registeredEmail) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 flex flex-col gap-6 text-center">
          <div className="mx-auto h-14 w-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
            <Mail className="w-7 h-7 animate-pulse text-indigo-600" />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-display font-bold text-slate-800 tracking-tight">
              Check your email
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We sent a verification link to <strong className="text-slate-800">{registeredEmail}</strong>. Please verify your email before signing in.
            </p>
            <p className="text-xs text-slate-500">
              The verification link is valid for 60 minutes.
            </p>
          </div>

          {resendStatus && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resendStatus}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Link
              to="/login"
              id="btn-back-to-login"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all text-white font-mono text-xs font-medium py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              type="button"
              id="btn-resend-verification"
              onClick={handleResend}
              disabled={isResending}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isResending ? (
                <span className="h-4 w-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Resend Verification Email</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
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
                <span>Create Account</span>
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
