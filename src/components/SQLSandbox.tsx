import React, { useState } from 'react';
import { completeDDLScript, completeDMLScript } from '../data/dbSchema';
import { Copy, Check, Download, Play, Terminal, Database, ShieldCheck } from 'lucide-react';

export default function SQLSandbox() {
  const [activeTab, setActiveTab] = useState<'ddl' | 'dml'>('ddl');
  const [copied, setCopied] = useState<boolean>(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    '-- PostgreSQL Sandbox Console Loaded.',
    '-- Ready to provision Gadget Deal Tracker Schema...',
    '-- Tip: Switch tabs to read schema initialization definitions (DDL) vs sample logs (DML).'
  ]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const getActiveCode = () => (activeTab === 'ddl' ? completeDDLScript : completeDMLScript);

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = getActiveCode();
    const blob = new Blob([code], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeTab === 'ddl' ? 'deal_tracker_schema.sql' : 'deal_tracker_seed_data.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setConsoleLogs(prev => [
      ...prev,
      `[SYSTEM] Downloaded file: ${activeTab === 'ddl' ? 'deal_tracker_schema.sql' : 'deal_tracker_seed_data.sql'} successfully.`
    ]);
  };

  const handleExecute = () => {
    setIsExecuting(true);
    setConsoleLogs(prev => [...prev, `[TRANSACTION] BEGIN COMMIT - Parsing ${activeTab.toUpperCase()} Statements...`]);

    setTimeout(() => {
      setIsExecuting(false);
      if (activeTab === 'ddl') {
        setConsoleLogs(prev => [
          ...prev,
          '[SUCCESS] Table "categories" created, index "idx_categories_slug" created.',
          '[SUCCESS] Table "products" created with standard specs_summary and optimal indexes.',
          '[SUCCESS] Table "stores" created with Unique index "idx_stores_domain".',
          '[SUCCESS] Table "product_prices" created with dynamic discount stored calculations.',
          '[SUCCESS] Table "users" created with Unique credential indices.',
          '[SUCCESS] Table "watchlist" created with Unique composite bookmarks constraints.',
          '[SUCCESS] Table "price_alerts" created with composite indexes "idx_alerts_product_target".',
          '[FINISH] Schema execution completes in 8ms. Status: healthy.'
        ]);
      } else {
        setConsoleLogs(prev => [
          ...prev,
          '[SUCCESS] Truncated active tables in cascading sequence.',
          '[SUCCESS] Seeding: 4 categories successfully mapped.',
          '[SUCCESS] Seeding: 4 retail Stores logged and validated.',
          '[SUCCESS] Seeding: 6 gadgets written with specifications text descriptions.',
          '[SUCCESS] Seeding: 11 direct priced store records populated with stored calculations.',
          '[SUCCESS] Seeding: 3 registered user accounts written with Bcrypt hashes.',
          '[SUCCESS] Seeding: 4 active watchlists cataloged.',
          '[SUCCESS] Seeding: 3 target price alerts registered.',
          '[FINISH] Mock seeding completes in 6ms. Status: healthy.'
        ]);
      }
    }, 1200);
  };

  // Prepares a simple visual coloring syntax parsing layout
  const highlightCode = (code: string) => {
    return code.split('\n').map((line, idx) => {
      // Color commented rows
      if (line.trim().startsWith('--') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        return (
          <div key={idx} className="text-slate-400 font-normal italic pl-1 flex">
            <span className="text-slate-350 mr-4 select-none inline-block w-6 text-right text-[10px] not-italic">
              {idx + 1}
            </span>
            <span>{line}</span>
          </div>
        );
      }

      return (
        <div key={idx} className="text-slate-700 pl-1 flex">
          <span className="text-slate-350 mr-4 select-none inline-block w-6 text-right text-[10px] font-semibold">
            {idx + 1}
          </span>
          <span>{line}</span>
        </div>
      );
    });
  };

  return (
    <div id="sql-playroom" className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      {/* Code Viewer Panel */}
      <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl flex flex-col h-[580px] overflow-hidden shadow-sm">
        {/* Upper file selector tab bar */}
        <div className="bg-[#EEF2F6]/60 p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex bg-white p-1 rounded-lg border border-slate-200">
            <button
              id="ddl-script-tab"
              onClick={() => setActiveTab('ddl')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                activeTab === 'ddl'
                  ? 'bg-slate-100 text-slate-800 border border-slate-200/50 font-bold shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Schema DDL (CREATE)
            </button>
            <button
              id="dml-script-tab"
              onClick={() => setActiveTab('dml')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                activeTab === 'dml'
                  ? 'bg-slate-100 text-slate-800 border border-slate-200/50 font-bold shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Seed Data DML (INSERT)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="execute-script-btn"
              onClick={handleExecute}
              disabled={isExecuting}
              className="bg-emerald-650 hover:bg-emerald-600 bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-450 border border-emerald-500/10 text-white py-1.5 px-3.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isExecuting ? 'Running...' : 'Run Statement'}</span>
            </button>

            <button
              id="copy-script-btn"
              onClick={handleCopy}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-2.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors shadow-sm font-semibold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              id="download-script-btn"
              onClick={handleDownload}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 p-1.5 rounded-lg text-xs font-mono flex items-center justify-center transition-colors shadow-sm"
              title="Download SQL File"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real SQL code explorer */}
        <div className="flex-1 overflow-auto bg-white p-4 font-mono text-xs leading-5">
          {highlightCode(getActiveCode())}
        </div>
      </div>

      {/* Compiler Console Log Panel */}
      <div className="xl:col-span-1 bg-[#0A0E17] border border-slate-250 rounded-xl flex flex-col h-[580px] overflow-hidden shadow-lg">
        <div className="bg-[#121824] p-4 border-b border-[#1E293B] flex items-center gap-2">
          <Terminal className="text-indigo-400 w-4 h-4" />
          <span className="text-slate-200 font-mono text-xs font-bold uppercase tracking-wider">PostgreSQL Output Terminal</span>
        </div>

        <div className="flex-1 bg-[#0A0E17] p-4 overflow-y-auto space-y-1.5 font-mono text-xs text-indigo-300 leading-normal scrollbar-thin">
          {consoleLogs.map((log, i) => {
            const isSystem = log.startsWith('[SYSTEM]') || log.startsWith('--');
            const isSuccess = log.startsWith('[SUCCESS]');
            const isTransaction = log.startsWith('[TRANSACTION]');
            const isFinish = log.startsWith('[FINISH]');

            let colorClass = 'text-slate-400';
            if (isSystem) colorClass = 'text-slate-500 italic';
            else if (isSuccess) colorClass = 'text-emerald-400';
            else if (isTransaction) colorClass = 'text-amber-400';
            else if (isFinish) colorClass = 'text-cyan-400 font-semibold';

            return (
              <div key={i} className={`${colorClass} whitespace-pre-wrap word-break-all`}>
                {log}
              </div>
            );
          })}
        </div>

        {/* Clear console footer */}
        <div className="bg-[#121824] p-3 border-t border-[#1E293B] text-right">
          <button
            id="clear-console-btn"
            onClick={() => setConsoleLogs(['-- Console Cleared. Ready to compile schema DDL/DML scripts'])}
            className="text-[10px] uppercase font-mono text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear Console
          </button>
        </div>
      </div>
    </div>
  );
}
