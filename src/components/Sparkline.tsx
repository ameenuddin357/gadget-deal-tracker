import React from 'react';

interface SparklineProps {
  history?: { price: number | string }[];
  width?: number;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({ history, width = 80, height = 28 }) => {
  if (!history || history.length < 2) {
    return (
      <div className="text-[10px] text-slate-400 font-medium italic">
        Tracking started
      </div>
    );
  }

  const prices = history.map(h => typeof h.price === 'string' ? parseFloat(h.price) : h.price).filter(p => !isNaN(p));
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices.map((val, idx) => {
    const x = (idx / (prices.length - 1)) * (width - 8) + 4;
    // Invert y because SVG y=0 is top
    const y = height - 4 - ((val - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const isTrendDown = prices[prices.length - 1] <= prices[0];
  const strokeColor = isTrendDown ? '#10b981' : '#f43f5e'; // green if price dropped or flat, red if increased

  const lastPointX = width - 4;
  const lastPointY = height - 4 - ((prices[prices.length - 1] - min) / range) * (height - 8);

  return (
    <div className="flex items-center gap-1.5" title={`Price trend (${prices.length} data points)`}>
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle
          cx={lastPointX}
          cy={lastPointY}
          r="2.5"
          fill={strokeColor}
        />
      </svg>
      <span className={`text-[10px] font-bold ${isTrendDown ? 'text-emerald-600' : 'text-rose-500'}`}>
        {isTrendDown ? '↓' : '↑'}
      </span>
    </div>
  );
};
