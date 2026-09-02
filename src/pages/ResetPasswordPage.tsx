import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validatePasswordResetToken } from '../services/api';
import { KeyRound, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const { submitPasswordReset } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Pre-flight validate token on mount
  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setTokenError('Password reset token is missing from URL.');
        setIsValidating(false);
        setIsTokenValid(false);
        return;
      }

      try {
        const res = await validatePasswordResetToken(token, emailParam || undefined);
        setIsTokenValid(true);
        if (res.data?.email) {
          setEmail(res.data.email);
        }
      } catch (err: any) {
        setIsTokenValid(false);
        setTokenError(err.message || 'This password reset link is invalid or has expired.');
      } finally {
        setIsValidating(false);
      }
    }

    checkToken();
  }, [token, emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newPassword || !confirmPassword) {
      setFormError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitPasswordReset(token, email, newPassword);
      setIsSuccess(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 min-h-[80vh]">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 flex flex-col gap-6">
        
        {/* Header */}
        <div className="text-center flex flex-col items-center gap-1.5">
          <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm mb-2">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-display font-bold text-slate-800 tracking-tight">
            Create New Password
          </h2>
          <p className="text-xs text-slate-500">
            Choose a new strong password for your account.
          </p>
        </div>

        {isValidating ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <span className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
            <p className="text-xs text-slate-500">Verifying reset token security...</p>
          </div>
        ) : !isTokenValid ? (
          <div className="flex flex-col gap-4">
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-red-800">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>Invalid or Expired Link</span>
              </div>
              <p className="text-red-700 text-[11px] leading-relaxed">
                {tokenError || 'This password reset link is invalid or has expired.'}
              </p>
            </div>

            <Link
              to="/forgot-password"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-mono text-xs font-medium py-3 rounded-lg text-center transition-all flex items-center justify-center gap-2"
            >
              <span>Request New Reset Link</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : isSuccess ? (
          <div className="flex flex-col gap-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Password Reset Complete!</span>
              </div>
              <p className="text-emerald-700 text-[11px] leading-relaxed">
                Your password has been updated securely. You can now log in with your new credentials.
              </p>
            </div>

            <Link
              to="/login"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-mono text-xs font-medium py-3 rounded-lg text-center transition-all flex items-center justify-center gap-2"
            >
              <span>Sign In with New Password</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="font-medium">{formError}</div>
              </div>
            )}

            {email && (
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs text-slate-600 flex items-center justify-between">
                <span>Account:</span>
                <span className="font-semibold text-slate-800">{email}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label id="lbl-new-password" className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-slate-400" />
                <span>New Password</span>
              </label>
              <div className="relative">
                <input
                  id="inp-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="•••••••• (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans text-slate-800"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-indigo-600 p-1 rounded transition-colors cursor-pointer"
                  style={{ cursor: 'pointer' }}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label id="lbl-confirm-new-password" className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-slate-400" />
                <span>Confirm New Password</span>
              </label>
              <div className="relative">
                <input
                  id="inp-confirm-new-password"
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
              id="btn-reset-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full cursor-pointer bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all text-white font-mono text-xs font-medium py-3 rounded-lg mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
            Cancel & Return to Login
          </Link>
        </div>

      </div>
    </div>
  );
}
