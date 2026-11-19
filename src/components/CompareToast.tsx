import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, X, ArrowRight, GitCompare } from 'lucide-react';

export interface CompareReplacedEventDetail {
  oldProductName: string;
  newProductName: string;
  oldProductId: number;
  newProductId: number;
}

// Guaranteed 2-line clamp style via explicit WebKit box properties
const lineClamp2Style: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
};

export default function CompareToast() {
  const navigate = useNavigate();
  const [toastData, setToastData] = useState<CompareReplacedEventDetail | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout>;

    const handleReplaced = (e: Event) => {
      const customEvent = e as CustomEvent<CompareReplacedEventDetail>;
      if (customEvent.detail && customEvent.detail.oldProductName && customEvent.detail.newProductName) {
        setToastData(customEvent.detail);
        setIsVisible(true);

        clearTimeout(dismissTimer);
        // Auto-dismiss after 4.5 seconds
        dismissTimer = setTimeout(() => {
          setIsVisible(false);
        }, 4500);
      }
    };

    window.addEventListener('deal-compare-replaced', handleReplaced);

    return () => {
      window.removeEventListener('deal-compare-replaced', handleReplaced);
      clearTimeout(dismissTimer);
    };
  }, []);

  if (!toastData || !isVisible) return null;

  return (
    <aside
      id="compare-replacement-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed z-50 left-3 right-3 sm:left-auto sm:right-5 sm:translate-x-0 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 w-auto sm:w-[320px] sm:max-w-[340px] lg:w-[340px] lg:max-w-[360px] max-w-[calc(100vw-24px)] bg-slate-900 text-white rounded-2xl p-3 sm:p-3.5 shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto max-h-[320px] overflow-hidden"
    >
      {/* Screen-reader full text announcement */}
      <span className="sr-only">
        Comparison updated: {toastData.oldProductName} was replaced with {toastData.newProductName}.
      </span>

      {/* Header: Status Icon, Title, and Dismiss Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate">
            Comparison updated
          </span>
        </div>

        <button
          type="button"
          id="btn-toast-close"
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0 min-h-[28px] min-w-[28px] flex items-center justify-center -mr-1"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body: Compact Line-Clamped Product Names */}
      <div className="mt-2 flex flex-col gap-1 text-xs">
        <p
          className="font-medium text-slate-200 text-xs sm:text-[13px] leading-snug line-clamp-2-guaranteed"
          style={lineClamp2Style}
          title={toastData.oldProductName}
        >
          {toastData.oldProductName}
        </p>
        <p className="text-[11px] text-slate-400 leading-none">
          was replaced with
        </p>
        <p
          className="font-semibold text-emerald-300 text-xs sm:text-[13px] leading-snug line-clamp-2-guaranteed"
          style={lineClamp2Style}
          title={toastData.newProductName}
        >
          {toastData.newProductName}
        </p>
      </div>

      {/* Action: View Compare Button */}
      <div className="mt-2.5 flex items-center">
        <button
          type="button"
          id="btn-toast-view-compare"
          onClick={() => {
            setIsVisible(false);
            navigate('/compare');
          }}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs min-h-[36px] w-full sm:w-auto"
        >
          <GitCompare className="w-3.5 h-3.5 shrink-0" />
          <span>View Compare</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
        </button>
      </div>
    </aside>
  );
}
