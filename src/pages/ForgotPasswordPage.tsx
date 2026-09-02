import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request password reset. Please try again.');
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
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-display font-bold text-slate-800 tracking-tight">
            Forgot Password
          </h2>
          <p className="text-xs text-slate-500">
            Enter your registered email address and we'll send you a password reset link.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="font-medium">{errorMsg}</div>
          </div>
        )}

        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label id="lbl-forgot-email" className="text-xs font-mono font-medium text-slate-600 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" />
                <span>Email Address</span>
              </label>
              <input
                id="inp-forgot-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans text-slate-800"
                required
                autoFocus
              />
            </div>

            <button
              id="btn-forgot-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full cursor-pointer bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all text-white font-mono text-xs font-medium py-3 rounded-lg mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>Send Password Reset Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Reset Link Dispatched</span>
              </div>
              <p className="text-emerald-700 leading-relaxed text-[11px]">
                If an account exists for <strong>{email}</strong>, a secure password reset link has been dispatched.
              </p>
              <p className="text-slate-500 text-[10px] mt-1 border-t border-emerald-200/60 pt-2">
                ⏳ The reset link is single-use and will expire in <strong>1 hour</strong>. Please check your inbox and spam folder.
              </p>
            </div>

            <button
              type="button"
              onClick={() => { setSubmitted(false); setEmail(''); }}
              className="cursor-pointer text-xs text-indigo-600 hover:underline text-center font-medium"
            >
              Try another email address
            </button>
          </div>
        )}

        {/* Back to login link */}
        <div className="border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Login</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
