import React, { useState } from 'react';
import { simulationQueries } from '../data/dbSchema';
import { SimulationQuery } from '../types';
import { Eye, Clock, ListFilter, Play, FileJson, CheckCircle, Database, ChevronRight, HelpCircle } from 'lucide-react';

export default function QuerySimulator() {
  const [selectedQueryId, setSelectedQueryId] = useState<string>('query-best-deal');
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [explainLevel, setExplainLevel] = useState<'plan' | 'results'>('plan');

  const activeQuery = simulationQueries.find(q => q.id === selectedQueryId) || simulationQueries[0];

  return (
    <div id="query-sandbox" className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      {/* Selector Deck */}
      <div className="xl:col-span-1 flex flex-col gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider font-bold">Deal Tracker Use Cases</span>
        <div className="space-y-2 flex-1 overflow-y-auto max-h-[450px]">
          {simulationQueries.map(q => {
            const isSelected = selectedQueryId === q.id;
            return (
              <button
                id={`query-template-${q.id}`}
                key={q.id}
                onClick={() => {
                  setSelectedQueryId(q.id);
                  setExplainLevel('plan');
                }}
                className={`w-full text-left p-3.5 rounded-xl border text-xs flex flex-col gap-2 transition-all shadow-sm ${
                  isSelected
                    ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                    : 'bg-transparent border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 font-mono uppercase font-bold text-[10px]">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{q.title}</span>
                </div>
                <p className="text-[11px] font-sans font-medium leading-relaxed text-slate-500">
                  {q.description.substring(0, 95)}...
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compiler Execution Deck */}
      <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-5 justify-between shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200/50 text-amber-650 text-amber-700">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900">{activeQuery.title}</h3>
                <p className="text-[10px] text-slate-400 font-mono">Use Case Query Optimizer</p>
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                id="view-plan-tab"
                onClick={() => setExplainLevel('plan')}
                className={`px-3 py-1.5 rounded text-[10px] font-mono leading-none transition-colors ${
                  explainLevel === 'plan' ? 'bg-white text-slate-800 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                EXPLAIN PLAN
              </button>
              <button
                id="view-results-tab"
                onClick={() => setExplainLevel('results')}
                className={`px-3 py-1.5 rounded text-[10px] font-mono leading-none transition-colors ${
                  explainLevel === 'results' ? 'bg-white text-slate-800 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                RESULT TUPLES ({activeQuery.mockResult.length})
              </button>
            </div>
          </div>

          {/* Compiled SQL Readout */}
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Compiled PostgreSQL Statement</span>
            <div className="bg-slate-50 p-4 border border-slate-200/80 rounded-xl font-mono text-slate-700 text-xs mt-1.5 leading-5 max-h-[160px] overflow-y-auto">
              {activeQuery.sqlQuery.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>

          {/* Tab Content 1: Visual EXPLAIN Planning Nodes */}
          {explainLevel === 'plan' && (
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">PostgreSQL Clustered Query execution Plan</span>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4 font-mono text-xs shadow-inner">
                {/* Visual execution timeline curves */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-200/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-10 bg-emerald-500 rounded-sm"></div>
                    <div>
                      <div className="text-slate-800 font-bold">Index Scan Operations</div>
                      <div className="text-[10px] text-emerald-600 mt-0.5">Target Index: {activeQuery.indexTarget}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-slate-400 text-[10px] font-sans font-semibold">Estimated Query Cost</div>
                    <div className="text-[13px] text-indigo-650 text-indigo-600 font-extrabold mt-0.5 font-mono">0.02ms (0.15 index scans cost)</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-slate-800 text-[11px] font-bold">1. Key Filter Scan [Fast O(Log n) Scan]</div>
                      <p className="text-[10px] font-sans text-slate-500 leading-normal mt-0.5">
                        The optimizer references index key <span className="font-mono text-indigo-700 text-[10px] font-semibold">{activeQuery.indexTarget}</span>, filtering nodes straight to matching values in memory blocks. Segments O(n) overhead out of scope.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-slate-800 text-[11px] font-bold">2. Foreign Key Join Hash Resolved</div>
                      <p className="text-[10px] font-sans text-slate-500 leading-normal mt-0.5">
                        Matches joining foreign keys securely. Indexes block scanning overlaps relative to associated catalogs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real explanation */}
              <p className="text-[11px] text-slate-600 leading-relaxed italic border-l-2 border-indigo-550 border-indigo-600 pl-3">
                <span className="font-sans font-bold text-slate-800 not-italic">Architect Analysis: </span>
                {activeQuery.explanation}
              </p>
            </div>
          )}

          {/* Tab Content 2: Table results output */}
          {explainLevel === 'results' && (
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Simulated Query Result Set</span>

              <div className="overflow-x-auto border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left font-mono text-[11px] text-slate-600 bg-white">
                  <thead className="bg-[#F8FAFC] text-slate-500 border-b border-slate-200">
                    <tr>
                      {Object.keys(activeQuery.mockResult[0] || {}).map((key, i) => (
                        <th key={i} className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider">{key.replace('_', ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeQuery.mockResult.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                        {Object.values(row).map((cell, cIdx) => (
                          <td key={cIdx} className="py-3 px-4 whitespace-nowrap text-slate-850 text-slate-800">
                            {typeof cell === 'number' && keyContainsPrice(Object.keys(row)[cIdx]) ? `$${cell.toFixed(2)}` : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper checker
function keyContainsPrice(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes('price') || k.includes('msrp') || k.includes('cost');
}
