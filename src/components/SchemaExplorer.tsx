import React, { useState } from 'react';
import { dbTables } from '../data/dbSchema';
import { DBTable, DBColumn } from '../types';
import { Search, Copy, Check, ShieldAlert, Cpu, Info, Database, Eye } from 'lucide-react';

interface SchemaExplorerProps {
  initialSelectedTableId: string | null;
}

export default function SchemaExplorer({ initialSelectedTableId }: SchemaExplorerProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>(initialSelectedTableId || 'products');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  const handleCopyDDL = (table: DBTable) => {
    navigator.clipboard.writeText(table.sqlDDL);
    setCopiedTable(table.id);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  // Find matching table or filtered list based on search queries
  const filteredTables = dbTables.filter(t => {
    const tableMatch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const columnMatch = t.columns.some(col => 
      col.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return tableMatch || columnMatch;
  });

  const activeTable = dbTables.find(t => t.id === selectedTableId) || dbTables[0];

  return (
    <div id="schema-explorer" className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      {/* Sidebar Table Selector */}
      <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
          <input
            id="explorer-search"
            type="text"
            placeholder="Search columns or tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-9 pr-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
          />
        </div>

        <div className="flex-1 overflow-y-auto max-h-[480px] space-y-1 pr-1 border-t border-slate-100 pt-3">
          {filteredTables.map(table => {
            const isSelected = selectedTableId === table.id;
            return (
              <button
                id={`table-selector-${table.id}`}
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                className={`w-full text-left font-mono text-xs p-2.5 rounded-lg flex items-center justify-between border transition-all ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" />
                  <span>{table.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">({table.columns.length})</span>
              </button>
            );
          })}
          {filteredTables.length === 0 && (
            <div className="text-center text-slate-400 py-6 text-xs font-mono">
              No matching tables.
            </div>
          )}
        </div>
      </div>

      {/* Main Table Dictionary Information Panel */}
      <div className="lg:col-span-3 flex flex-col gap-6">
        {activeTable && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-5 shadow-sm">
            {/* Header section with copy capability */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-display font-bold text-slate-900">
                    Table: <span className="text-indigo-600 font-mono text-base">{activeTable.name}</span>
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xl mt-1">
                    {activeTable.purpose}
                  </p>
                </div>
              </div>

              <button
                id={`copy-ddl-${activeTable.id}`}
                onClick={() => handleCopyDDL(activeTable)}
                className="self-start sm:self-center bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-2 px-3.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors shadow-sm"
              >
                {copiedTable === activeTable.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">Copied SQL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy DDL</span>
                  </>
                )}
              </button>
            </div>

            {/* Real World Usage Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex items-start gap-3">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-display font-medium text-slate-800">Database Role & Real-World Operations</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {activeTable.realWorldUsage}
                </p>
              </div>
            </div>

            {/* Columns Schema Grid */}
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Columns Definition</span>
              <div className="overflow-x-auto mt-2 border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left font-mono text-xs text-slate-600">
                  <thead className="bg-[#F8FAFC] text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-bold text-[11px]">Field</th>
                      <th className="py-2.5 px-3 font-bold text-[11px]">Type</th>
                      <th className="py-2.5 px-3 font-bold text-[11px]">Constraints</th>
                      <th className="py-2.5 px-4 font-bold text-[11px]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {activeTable.columns.map(col => (
                      <tr key={col.name} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          {col.name}
                          {col.isPK && (
                            <span className="text-[8px] bg-amber-50 border border-amber-200 text-amber-800 font-bold px-1.5 py-0.5 rounded">PK</span>
                          )}
                          {col.isFK && (
                            <span className="text-[8px] bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold px-1.5 py-0.5 rounded cursor-help" title={`References ${col.fkRef}`}>FK</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">{col.type.toLowerCase()}</td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {col.constraints && col.constraints.length > 0 ? (
                              col.constraints.map((c, i) => (
                                <span key={i} className="text-[9px] bg-slate-50 text-slate-500 border border-slate-200 py-0.5 px-1.5 rounded">
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-[9px] text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px] font-sans leading-relaxed max-w-[240px] md:max-w-xs xl:max-w-sm">
                          {col.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Indexes Information Box */}
            <div className="border-t border-slate-100 pt-5">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Storage Performance Indexes</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {activeTable.indexes.map(idx => (
                  <div key={idx.name} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
                    <Cpu className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="font-mono text-xs">
                      <div className="text-slate-800 font-bold">{idx.name}</div>
                      <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Attributes: {idx.columns.join(', ')}</div>
                      <div className="text-[9px] text-slate-450 font-semibold mt-1 uppercase">Method: {idx.type}</div>
                      <div className="text-[11px] text-slate-500 font-sans leading-relaxed mt-1.5 pr-2 border-t border-slate-200/55 pt-1.5">
                        {idx.reason}
                      </div>
                    </div>
                  </div>
                ))}
                {activeTable.indexes.length === 0 && (
                  <div className="col-span-2 text-slate-400 leading-relaxed text-xs py-4 italic">
                    No custom indices declared for this table outside of primary implicit uniquely indexed structures.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
