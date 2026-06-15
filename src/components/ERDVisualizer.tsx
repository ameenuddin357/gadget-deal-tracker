import React, { useState } from 'react';
import { dbTables, erdConnections } from '../data/dbSchema';
import { DBTable } from '../types';
import { Layers, Database, Info, HelpCircle, ChevronRight, Activity, Cpu } from 'lucide-react';

interface ERDVisualizerProps {
  onSelectTable: (tableId: string) => void;
  selectedTableId: string | null;
}

// Nodes coordinate positioning inside a 950 x 680 responsive boundary
const tablePositions: Record<string, { x: number; y: number; w: number; h: number; color: string }> = {
  categories: { x: 40, y: 40, w: 210, h: 140, color: 'from-emerald-50 to-emerald-50/50 border-emerald-200 hover:border-emerald-400' },
  products: { x: 320, y: 40, w: 210, h: 230, color: 'from-indigo-50 to-indigo-50/50 border-indigo-200 hover:border-indigo-400' },
  stores: { x: 600, y: 40, w: 210, h: 160, color: 'from-amber-50 to-amber-50/50 border-amber-200 hover:border-amber-400' },
  product_prices: { x: 520, y: 310, w: 220, h: 210, color: 'from-violet-50 to-violet-50/50 border-violet-200 hover:border-violet-400' },
  users: { x: 40, y: 270, w: 210, h: 165, color: 'from-cyan-50 to-cyan-50/50 border-cyan-200 hover:border-cyan-400' },
  watchlist: { x: 290, y: 310, w: 190, h: 130, color: 'from-teal-50 to-teal-50/50 border-teal-200 hover:border-teal-400' },
  price_alerts: { x: 160, y: 490, w: 210, h: 170, color: 'from-fuchsia-50 to-fuchsia-50/50 border-fuchsia-200 hover:border-fuchsia-400' }
};

export default function ERDVisualizer({ onSelectTable, selectedTableId }: ERDVisualizerProps) {
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);

  // Helper to calculate port positions on the rectangular boundaries
  const getPortCoords = (tableId: string, side: 'top' | 'bottom' | 'left' | 'right', pctOffset = 0.5) => {
    const pos = tablePositions[tableId];
    if (!pos) return { x: 0, y: 0 };
    switch (side) {
      case 'left': return { x: pos.x, y: pos.y + pos.h * pctOffset };
      case 'right': return { x: pos.x + pos.w, y: pos.y + pos.h * pctOffset };
      case 'top': return { x: pos.x + pos.w * pctOffset, y: pos.y };
      case 'bottom': return { x: pos.x + pos.w * pctOffset, y: pos.y + pos.h };
    }
  };

  // Helper connection pathway drawers
  const getConnectionPath = (conn: { fromTable: string; toTable: string }) => {
    let fromSide: string = 'right';
    let toSide: string = 'left';
    let fromOffset = 0.5;
    let toOffset = 0.5;

    // Custom path routing offsets to keep lines clean and reduce overlap
    if (conn.fromTable === 'categories' && conn.toTable === 'products') {
      fromSide = 'right'; toSide = 'left'; fromOffset = 0.4; toOffset = 0.3;
    } else if (conn.fromTable === 'products' && conn.toTable === 'product_prices') {
      fromSide = 'bottom'; toSide = 'top'; fromOffset = 0.7; toOffset = 0.3;
    } else if (conn.fromTable === 'stores' && conn.toTable === 'product_prices') {
      fromSide = 'bottom'; toSide = 'top'; fromOffset = 0.3; toOffset = 0.7;
    } else if (conn.fromTable === 'users' && conn.toTable === 'watchlist') {
      fromSide = 'right'; toSide = 'left'; fromOffset = 0.4; toOffset = 0.3;
    } else if (conn.fromTable === 'products' && conn.toTable === 'watchlist') {
      fromSide = 'bottom'; toSide = 'top'; fromOffset = 0.3; toOffset = 0.4;
    } else if (conn.fromTable === 'users' && conn.toTable === 'price_alerts') {
      fromSide = 'bottom'; toSide = 'left'; fromOffset = 0.5; toOffset = 0.3;
    } else if (conn.fromTable === 'products' && conn.toTable === 'price_alerts') {
      fromSide = 'bottom'; toSide = 'top'; fromOffset = 0.2; toOffset = 0.2;
    }

    const start = getPortCoords(conn.fromTable, fromSide as any, fromOffset);
    const end = getPortCoords(conn.toTable, toSide as any, toOffset);

    // Calculate elegant control points for bezier curves
    const dx = Math.abs(end.x - start.x) * 0.5;
    const dy = Math.abs(end.y - start.y) * 0.5;

    let cp1x = start.x;
    let cp1y = start.y;
    let cp2x = end.x;
    let cp2y = end.y;

    if (fromSide === 'right') cp1x += dx;
    if (fromSide === 'left') cp1x -= dx;
    if (fromSide === 'bottom') cp1y += dy;
    if (fromSide === 'top') cp1y -= dy;

    if (toSide === 'right') cp2x += dx;
    if (toSide === 'left') cp2x -= dx;
    if (toSide === 'bottom') cp2y += dy;
    if (toSide === 'top') cp2y -= dy;

    return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
  };

  const activeTable = dbTables.find(t => t.id === selectedTableId);

  return (
    <div id="erd-visualizer" className="flex flex-col lg:flex-row gap-6 h-full min-h-[650px]">
      {/* Interactive Schema Screen SVG Area */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 flex flex-col relative overflow-hidden shadow-sm">
        <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono text-slate-500 font-semibold">Interactive Schema Topology Layout (PostgreSQL)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-amber-400 rounded-sm"></span> PK</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-indigo-500 rounded-sm"></span> FK</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-emerald-500 rounded-sm"></span> 1-To-Many</span>
          </div>
        </div>

        {/* SVG Wrapper */}
        <div className="flex-1 w-full relative min-h-[500px]" style={{ touchAction: 'none' }}>
          <svg className="absolute inset-0 w-full h-full select-none" viewBox="0 0 950 680" preserveAspectRatio="xMinYMin meet">
            {/* Defs block for schema lines arrows and markers */}
            <defs>
              <marker id="arrow-start" markerWidth="6" markerHeight="6" refX="2" refY="3" orient="auto" markerUnits="strokeWidth">
                <circle cx="3" cy="3" r="1.5" className="fill-slate-400" />
              </marker>
              <marker id="arrow-end" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 0 L 8 3 L 0 6 z" className="fill-emerald-500" />
              </marker>
              <marker id="arrow-end-highlight" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 0 L 8 3 L 0 6 z" className="fill-indigo-650" />
              </marker>
            </defs>

            {/* Render relationships pathways */}
            {erdConnections.map(conn => {
              const isRelatedHovered = hoveredTable && (conn.fromTable === hoveredTable || conn.toTable === hoveredTable);
              const isRelatedSelected = selectedTableId && (conn.fromTable === selectedTableId || conn.toTable === selectedTableId);
              const highlight = isRelatedHovered || isRelatedSelected;

              return (
                <path
                  key={conn.id}
                  d={getConnectionPath(conn)}
                  fill="none"
                  stroke={highlight ? '#6366f1' : '#cbd5e1'}
                  strokeWidth={highlight ? 2.5 : 1.2}
                  strokeDasharray={conn.type === 'many-to-many' ? '4 4' : undefined}
                  markerEnd={highlight ? 'url(#arrow-end-highlight)' : 'url(#arrow-end)'}
                  className="transition-colors duration-200"
                />
              );
            })}

            {/* Render tables nodes */}
            {dbTables.map(table => {
              const pos = tablePositions[table.id];
              if (!pos) return null;
              const isSelected = selectedTableId === table.id;
              const isHovered = hoveredTable === table.id;

              return (
                <g
                  key={table.id}
                  className="cursor-pointer group"
                  onMouseEnter={() => setHoveredTable(table.id)}
                  onMouseLeave={() => setHoveredTable(null)}
                  onClick={() => onSelectTable(table.id)}
                >
                  {/* Table Box Shell */}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.w}
                    height={pos.h}
                    rx="8"
                    className={`fill-white border-2 transition-all duration-200`}
                    style={{ stroke: isSelected ? '#4f46e5' : isHovered ? '#818cf8' : '#e2e8f0', strokeWidth: isSelected ? '2px' : '1.5px' }}
                  />

                  {/* Table Header Accent */}
                  <rect
                    x={pos.x + 1}
                    y={pos.y + 1}
                    width={pos.w - 2}
                    height="32"
                    rx="6"
                    className="fill-slate-50/80"
                  />

                  {/* Header Title Text */}
                  <text
                    x={pos.x + 12}
                    y={pos.y + 22}
                    className="fill-slate-800 font-mono text-xs font-bold tracking-wider uppercase"
                  >
                    {table.name}
                  </text>

                  {/* Connection Node Small Metrics */}
                  <text
                    x={pos.x + pos.w - 24}
                    y={pos.y + 21}
                    className="fill-indigo-600 font-mono text-[9px] font-semibold"
                  >
                    {`[${table.columns.length}]`}
                  </text>

                  {/* Column Lists within visual card bounds */}
                  {table.columns.map((col, idx) => {
                    const yPos = pos.y + 52 + idx * 21;
                    if (yPos > pos.y + pos.h - 10) return null; // Crop overflow

                    return (
                      <g key={col.name} className="font-mono text-[11px]">
                        {/* Key icon tags */}
                        {col.isPK && (
                          <rect
                            x={pos.x + 10}
                            y={yPos - 9}
                            width="14"
                            height="11"
                            rx="2"
                            className="fill-amber-450/10 stroke-amber-500/40"
                            style={{ strokeWidth: '0.5px', fill: 'rgba(245, 158, 11, 0.1)' }}
                          />
                        )}
                        {col.isPK && (
                          <text x={pos.x + 13} y={yPos} className="fill-amber-700 text-[8px] font-bold">
                            P
                          </text>
                        )}

                        {col.isFK && !col.isPK && (
                          <rect
                            x={pos.x + 10}
                            y={yPos - 9}
                            width="14"
                            height="11"
                            rx="2"
                            className="fill-indigo-500/10 stroke-indigo-505/40"
                            style={{ strokeWidth: '0.5px', fill: 'rgba(99, 102, 241, 0.1)' }}
                          />
                        )}
                        {col.isFK && !col.isPK && (
                          <text x={pos.x + 13} y={yPos} className="fill-indigo-700 text-[8px] font-bold">
                            F
                          </text>
                        )}

                        {/* Column Label */}
                        <text
                          x={pos.x + 30}
                          y={yPos}
                          className={`${
                            col.isPK ? 'fill-slate-900 font-bold' : col.isFK ? 'fill-indigo-950 font-medium' : 'fill-slate-600'
                          }`}
                        >
                          {col.name}
                        </text>

                        {/* DataType Right-aligned */}
                        <text
                          x={pos.x + pos.w - 12}
                          y={yPos}
                          textAnchor="end"
                          className="fill-slate-400 text-[9px]"
                        >
                          {col.type.split(' ')[0].toLowerCase()}
                        </text>
                      </g>
                    );
                  })}

                  {/* Truncated block footer if columns exceed box height */}
                  {table.columns.length > 8 && (
                    <text
                      x={pos.x + pos.w / 2}
                      y={pos.y + pos.h - 8}
                      textAnchor="middle"
                      className="fill-slate-400 font-mono text-[9px] font-bold"
                    >
                      •••
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Side Dynamic Details Drawer */}
      <div className="w-full lg:w-[320px] bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm">
        {activeTable ? (
          <div className="flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                <div id={`icon-wrapper-${activeTable.id}`} className="p-2 rounded-lg bg-indigo-50 border border-indigo-150 text-indigo-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-slate-800 text-sm leading-tight flex items-center gap-1">
                    table: <span className="text-indigo-600 font-mono tracking-wide">{activeTable.name}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">3rd Normal Form Schema</p>
                </div>
              </div>

              {/* Purpose block */}
              <div className="mb-4">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Table Purpose</span>
                <p className="text-xs text-slate-600 leading-relaxed mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                  {activeTable.purpose}
                </p>
              </div>

              {/* Real World Usage block */}
              <div className="mb-4">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Real-World Case</span>
                <p className="text-xs text-slate-600 leading-relaxed mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                  {activeTable.realWorldUsage}
                </p>
              </div>

              {/* Index details */}
              <div className="mb-4">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Engine Indices</span>
                <div className="space-y-2 mt-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {activeTable.indexes.map(idx => (
                    <div key={idx.name} className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200/60 font-mono">
                      <div className="flex items-center gap-1 text-indigo-600 font-semibold text-[10px]">
                        <Cpu className="w-3 h-3 text-indigo-600" />
                        <span>{idx.name}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Columns: {idx.columns.join(', ')}</div>
                      <div className="text-[9px] text-slate-450 italic mt-0.5">Reason: {idx.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-2">
              <button
                id={`explore-schema-btn-${activeTable.id}`}
                onClick={() => onSelectTable(activeTable.id)}
                className="w-full flex items-center justify-between text-xs bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-3 rounded-lg font-mono transition-colors group"
              >
                <span>Browse Table Details</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/80 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center h-full py-12">
            <Layers className="w-10 h-10 text-slate-300 mb-3 animate-pulse" />
            <h4 className="text-slate-400 font-display font-medium text-xs">Schema Explorer Panel</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px] mt-1.5">
              Click on any table element inside the topology canvas to inspect its schema purpose, performance indexes, and database role.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
