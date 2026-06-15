import React, { useState } from 'react';
import { normalizationLevels } from '../data/dbSchema';
import { NormanLevel } from '../types';
import { ChevronRight, ShieldCheck, HelpCircle, CornerDownRight, ArrowRight } from 'lucide-react';

export default function NormalizationAnalyzer() {
  const [activeLevelIdx, setActiveLevelIdx] = useState<number>(0);

  const activeLevel = normalizationLevels[activeLevelIdx];

  return (
    <div id="normalization-lab" className="flex flex-col gap-6">
      {/* Upper Navigation Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {normalizationLevels.map((level, idx) => {
          const isActive = idx === activeLevelIdx;
          return (
            <button
              id={`norm-tab-${idx}`}
              key={idx}
              onClick={() => setActiveLevelIdx(idx)}
              className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-1.5 shadow-sm ${
                isActive
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400">Stage {idx + 1}</span>
              </div>
              <h3 className="text-xs font-display font-bold text-slate-800">{level.title.split(' - ')[0]}</h3>
            </button>
          );
        })}
      </div>

      {/* Explanatory Context */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-6 shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-display font-bold text-slate-900">{activeLevel.title}</h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-4xl mt-1.5 font-sans">
            {activeLevel.concept}
          </p>
        </div>

        {/* Applied Demonstration Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          {/* Before Column */}
          <div className="flex flex-col gap-3 bg-[#FFF8F8] p-5 rounded-xl border border-red-100">
            <div>
              <span className="text-[10px] font-mono text-rose-700 uppercase tracking-widest font-semibold flex items-center gap-1">
                <span>🛑 Before: Redundant & Problematic State</span>
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1 font-sans">
                {activeLevel.appliedExample.beforeText}
              </p>
            </div>

            <div className="overflow-x-auto border border-red-200/80 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left font-mono text-[11px] text-red-950 bg-white">
                <thead className="bg-[#FFF0F0] border-b border-red-100 text-rose-800">
                  <tr>
                    {activeLevel.appliedExample.beforeTable.headers.map((h, i) => (
                      <th key={i} className="py-2.5 px-3 font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {activeLevel.appliedExample.beforeTable.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-red-50/50 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2.5 px-3 whitespace-nowrap text-red-900">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* After Column */}
          <div className="flex flex-col gap-4 bg-[#F8FFF8] p-5 rounded-xl border border-emerald-100">
            <div>
              <span className="text-[10px] font-mono text-emerald-700 uppercase tracking-widest font-semibold flex items-center gap-1">
                <span>✅ After: Structured Normalized State</span>
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1 font-sans">
                {activeLevel.appliedExample.afterText}
              </p>
            </div>

            <div className="space-y-4">
              {activeLevel.appliedExample.afterTables.map((tab, tIdx) => (
                <div key={tIdx} className="border border-emerald-200/80 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-[#EFFFEE] text-emerald-800 px-3 py-2 text-[10px] font-bold border-b border-emerald-100 flex items-center gap-2">
                    <CornerDownRight className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="font-mono uppercase tracking-wider">{tab.name}</span>
                  </div>
                  <div className="overflow-x-auto select-none">
                    <table className="w-full text-left font-mono text-[11px] text-emerald-950">
                      <thead className="bg-emerald-50/40 border-b border-emerald-100 text-emerald-800">
                        <tr>
                          {tab.headers.map((h, i) => (
                            <th key={i} className="py-2 px-3 font-semibold text-[10px] uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50">
                        {tab.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-emerald-50/30 transition-colors">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-emerald-900">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Anomalies Solved */}
        <div className="border-t border-slate-100 pt-5">
          <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Database Anomalies Eradicated</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            {activeLevel.appliedExample.problemsSolved.map((prob, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 flex gap-3 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="font-sans text-xs text-slate-700">
                  <span className="font-mono text-[10px] text-indigo-600 block font-bold">SOLVED - CASE {idx + 1}</span>
                  <p className="mt-1 leading-relaxed text-slate-600 font-sans">{prob}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
