import React, { useState } from 'react';
import { backendFiles, BackendFile } from '../data/backendExplainer.ts';
import { 
  Folder, 
  FileCode, 
  ChevronRight, 
  BookOpen, 
  Award, 
  Lightbulb, 
  CheckCircle,
  Copy,
  Terminal,
  Cpu,
  Bookmark,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

export default function BackendCodeExplorer() {
  const [activeFileKey, setActiveFileKey] = useState<string>('dbConfig');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'code' | 'expose' | 'interview'>('code');
  const [copied, setCopied] = useState(false);
  const [disclosedAnswers, setDisclosedAnswers] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeFile: BackendFile = backendFiles[activeFileKey] || backendFiles.dbConfig;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAnswer = (qIndex: number) => {
    setDisclosedAnswers(prev => ({
      ...prev,
      [`\${activeFileKey}-\${qIndex}`]: !prev[`\${activeFileKey}-\${qIndex}`]
    }));
  };

  const selectFile = (key: string) => {
    setActiveFileKey(key);
    setActiveWorkspaceTab('code'); // Default tab when switching files
    setDisclosedAnswers({});
    setMobileMenuOpen(false);
  };

  // Node structures matching folder design patterns
  const fileGroups = {
    "Database config": [
      { key: 'dbConfig', label: 'db.ts', path: 'src/config/db.ts', verified: true }
    ],
    "Middleware guards": [
      { key: 'authGuard', label: 'auth.ts', path: 'src/middleware/auth.ts', verified: true },
      { key: 'errorHandler', label: 'errorHandler.ts', path: 'src/middleware/errorHandler.ts', verified: true }
    ],
    "MVC Controllers": [
      { key: 'authController', label: 'authController.ts', path: 'src/controllers/authController.ts', verified: true },
      { key: 'productController', label: 'productController.ts', path: 'src/controllers/productController.ts', verified: true },
      { key: 'watchlistController', label: 'watchlistController.ts', path: 'src/controllers/watchlistController.ts', verified: true },
      { key: 'alertController', label: 'alertController.ts', path: 'src/controllers/alertController.ts', verified: true }
    ],
    "REST Routers": [
      { key: 'routesApi', label: 'api.ts', path: 'src/routes/api.ts', verified: true }
    ],
    "Root server files": [
      { key: 'server', label: 'server.ts', path: 'src/server.ts', verified: true }
    ]
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[640px]">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="text-indigo-400 w-4 h-4" />
          <span className="font-mono text-xs font-semibold">MVC Backend Codebase</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 text-slate-400 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Directory Side Rail */}
      <aside className={`w-full md:w-72 bg-slate-50 border-r border-slate-200 shrink-0 p-4 font-sans ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
        <div className="mb-4 hidden md:flex items-center gap-2 pb-3 border-b border-slate-200">
          <Terminal className="text-indigo-600 w-4.5 h-4.5" />
          <div className="text-[12px] font-mono uppercase font-bold tracking-wider text-slate-600">
            MVC Repository Tree
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(fileGroups).map(([groupName, groupFiles]) => (
            <div key={groupName} className="space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] font-mono tracking-wider font-extrabold text-slate-400 uppercase">
                <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{groupName}</span>
              </div>
              
              <div className="space-y-0.5 pl-2.5">
                {groupFiles.map((fFile) => {
                  const isCurrent = activeFileKey === fFile.key;
                  return (
                    <button
                      key={fFile.key}
                      onClick={() => selectFile(fFile.key)}
                      className={`w-full flex items-center justify-between text-left py-1.5 px-3 rounded-lg text-xs font-mono font-medium transition-all ${
                        isCurrent 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-150/70'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCode className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{fFile.label}</span>
                      </div>
                      <ChevronRight className={`w-3 h-3 ${isCurrent ? 'text-indigo-200' : 'text-slate-300'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Portability note */}
        <div className="mt-8 bg-slate-100/90 border border-slate-200/60 p-3 rounded-xl">
          <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">
            Build Portability
          </div>
          <p className="text-[10.5px] text-slate-500 font-sans leading-relaxed">
            All generated MVC source files physically exist on disc in the <code className="bg-slate-250 py-0.5 px-1 rounded text-red-500 font-mono text-[10px]">/backend</code> workspace ready for production deployments.
          </p>
        </div>
      </aside>

      {/* Workspace central console */}
      <div className="flex-1 min-w-0 flex flex-col bg-slate-50/50">
        
        {/* Header Summary section */}
        <div className="bg-white px-6 py-4.5 border-b border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                  {activeFile.category}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {activeFile.path}
                </span>
              </div>
              <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-600" />
                {activeFile.name}
              </h2>
            </div>

            {/* Visual Action Button */}
            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-350 hover:bg-slate-50 bg-white shadow-xs text-slate-700 text-xs font-mono font-medium transition-all cursor-pointer"
              >
                {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Raw Code'}</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-600 font-sans leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200/50">
            <strong>Architecture Overview:</strong> {activeFile.purpose}
          </p>
        </div>

        {/* Double deck Perspective Controls bar */}
        <div className="flex border-b border-slate-200 bg-white px-6 py-1">
          <button
            onClick={() => setActiveWorkspaceTab('code')}
            className={`flex items-center gap-1.5 py-3 px-4 border-b-2 text-xs font-mono font-bold transition-all ${
              activeWorkspaceTab === 'code'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>1. Production Code</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('expose')}
            className={`flex items-center gap-1.5 py-3 px-4 border-b-2 text-xs font-mono font-bold transition-all ${
              activeWorkspaceTab === 'expose'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>2. Line Breakdown</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('interview')}
            className={`flex items-center gap-1.5 py-3 px-4 border-b-2 text-xs font-mono font-bold transition-all ${
              activeWorkspaceTab === 'interview'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>3. Placements Q&A</span>
          </button>
        </div>

        {/* Workspace Display Canvases */}
        <div className="flex-1 p-6 relative">
          
          {/* perspective 1: Code highlighting */}
          {activeWorkspaceTab === 'code' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md flex flex-col h-full animate-fadeIn">
              <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400"></div>
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400"></div>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400"></div>
                </div>
                <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold tracking-wider">
                  PostgreSQL Client Express JS (ES6 ESM Module)
                </div>
              </div>
              <pre className="p-4 overflow-auto max-h-[500px] text-[11px] font-mono text-slate-200 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                <code>{activeFile.code}</code>
              </pre>
            </div>
          )}

          {/* perspective 2: Line expose analysis */}
          {activeWorkspaceTab === 'expose' && (
            <div className="space-y-4 animate-fadeIn max-h-[520px] overflow-y-auto pr-1">
              <div className="bg-indigo-50 border border-indigo-100 p-4.5 rounded-xl flex gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-mono font-bold text-indigo-900 mb-1">
                    Senior Architect Code Review
                  </h4>
                  <p className="text-xs text-indigo-700 font-sans leading-relaxed">
                    This step-by-step table lists the key functional blocks of the file. Click on the tree files in the side rail to load dynamic files. Review the code on the left tab to trace block logic perfectly.
                  </p>
                </div>
              </div>

              {activeFile.explanations.map((elem, idx) => (
                <div 
                  key={idx} 
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-350 transition-all"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="sm:w-1/3 shrink-0 flex flex-col justify-start">
                      <span className="bg-slate-100 text-slate-600 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-slate-250 self-start mb-2">
                        LINES {elem.lines}
                      </span>
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-[10.5px] text-slate-300 overflow-x-auto whitespace-pre">
                        {elem.code}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider mb-1">
                        Surgical Expose
                      </div>
                      <p className="text-[12px] text-slate-600 font-sans leading-relaxed">
                        {elem.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* perspective 3: Placements interview Q&As */}
          {activeWorkspaceTab === 'interview' && (
            <div className="space-y-4 animate-fadeIn max-h-[520px] overflow-y-auto pr-1">
              <div className="bg-amber-50 border border-amber-100 p-4.5 rounded-xl flex gap-3">
                <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-mono font-bold text-amber-900 mb-1">
                    Campus Placement Boardroom Strategy
                  </h4>
                  <p className="text-xs text-amber-800 font-sans leading-relaxed">
                    Senior Backend interviewers regularly challenge candidates on asynchronous lifecycle safety, SQL injections, horizontal permissions bypasses, and connection pool sizing constraints. Click on the questions below to reveal examiner-grade answers!
                  </p>
                </div>
              </div>

              {activeFile.interviewQuestions.map((qna, idx) => {
                const isDisclosed = disclosedAnswers[`\${activeFileKey}-\${idx}`];
                return (
                  <div 
                    key={idx} 
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-sm hover:border-slate-350 transition-all"
                  >
                    <button
                      onClick={() => toggleAnswer(idx)}
                      className="w-full flex items-center justify-between p-4.5 text-left bg-slate-50/70 hover:bg-slate-50 border-b border-transparent transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-[11px] font-mono font-bold shrink-0">
                          Q{idx + 1}
                        </span>
                        <h4 className="text-xs font-display font-bold text-slate-700 leading-tight">
                          {qna.question}
                        </h4>
                      </div>
                      <span className="text-xs font-mono text-indigo-600 font-semibold shrink-0 pl-2">
                        {isDisclosed ? 'Hide Answer' : 'Click to Reveal'}
                      </span>
                    </button>

                    {isDisclosed && (
                      <div className="p-4.5 space-y-3 bg-white border-t border-slate-150 animate-fadeIn">
                        <div>
                          <div className="text-[9px] font-mono text-emerald-600 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            Model Answer (Candidate response)
                          </div>
                          <p className="text-[12px] text-slate-600 font-sans leading-relaxed">
                            {qna.answer}
                          </p>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-xl border border-dashed border-indigo-200">
                          <div className="text-[9px] font-mono text-indigo-700 uppercase font-extrabold tracking-widest mb-1.5 flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                            Senior Architect placement Tip
                          </div>
                          <p className="text-[11.5px] text-indigo-800 font-sans leading-relaxed italic">
                            "{qna.architectTip}"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
