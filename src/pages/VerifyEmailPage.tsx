import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight, Mail, Send, Check } from 'lucide-react';
import { verifyEmail, resendVerificationEmail } from '../services/api';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Resend state for error fallback
  const [resendEmail, setResendEmail] = useState<string>('');
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      setState('error');
      setErrorMessage('Verification token is missing. Please check your verification link.');
      return;
    }

    const runVerification = async () => {
      try {
        await verifyEmail(token);
        if (!isCancelled) {
          setState('success');
        }
      } catch (err: any) {
        if (!isCancelled) {
          setState('error');
          setErrorMessage(err.message || err.response?.data?.message || 'Verification link is invalid or has expired.');
        }
      }
    };

    runVerification();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || isResending) return;
    setIsResending(true);
    setResendStatus(null);
    try {
      await resendVerificationEmail(resendEmail.toLowerCase().trim());
      setResendStatus('If an unverified account exists, a new verification link has been sent.');
    } catch {
      setResendStatus('Unable to process request right now. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-8 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 flex flex-col gap-6 text-center">
        
        {/* Loading State */}
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-14 w-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-display font-bold text-slate-800 tracking-tight">
                Verifying your email...
              </h2>
              <p className="text-xs text-slate-500">
                Please wait while we validate your verification token.
              </p>
            </div>
          </div>
        )}

        {/* Success State */}
        {state === 'success' && (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="h-14 w-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-display font-bold text-slate-800 tracking-tight">
                Email verified successfully
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your email has been verified. You may now sign in to your account.
              </p>
            </div>

            <Link
              to="/login"
              id="btn-verified-sign-in"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all text-white font-mono text-xs font-medium py-3 rounded-lg mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="h-14 w-14 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
              <XCircle className="w-8 h-8 text-rose-600" />
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-display font-bold text-slate-800 tracking-tight">
                Verification link is invalid or has expired
              </h2>
              <p className="text-xs text-slate-600">
                {errorMessage || 'This verification link may have already been used or has exceeded its 60-minute lifetime.'}
              </p>
            </div>

            {/* Resend Form */}
            <form onSubmit={handleResend} className="w-full flex flex-col gap-3 text-left pt-2 border-t border-slate-100 mt-2">
              <label htmlFor="inp-resend-email" className="text-xs font-mono font-medium text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Resend verification email</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="inp-resend-email"
                  type="email"
                  placeholder="you@domain.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-slate-800"
                  required
                />
                <button
                  type="submit"
                  id="btn-submit-resend"
                  disabled={isResending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isResending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      <span>Send</span>
                    </>
                  )}
                </button>
              </div>

              {resendStatus && (
                <div className="bg-slate-50 border border-slate-200 text-slate-700 p-2.5 rounded-lg text-xs flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{resendStatus}</span>
                </div>
              )}
            </form>

            <div className="w-full pt-2 flex flex-col gap-2">
              <Link
                to="/login"
                id="btn-error-back-to-login"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Back to Sign In</span>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
