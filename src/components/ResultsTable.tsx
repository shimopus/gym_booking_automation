import React from 'react';
import { CalendarDays, MapPin, Clock, CheckSquare, Square } from 'lucide-react';
import { MergedSlot } from '../types';
import { getWeekId, formatDate, formatWeekday, formatTime } from '../utils';

interface ResultsTableProps {
  results: MergedSlot[];
  displayResults: MergedSlot[];
  tableRef: React.RefObject<HTMLDivElement | null>;
  sortField: 'date' | 'weekday';
  handleSort: (field: 'date' | 'weekday') => void;
  renderSortIcon: (field: 'date' | 'weekday') => React.ReactNode;
  selectedRows: Set<number>;
  setSelectedRows: (rows: Set<number>) => void;
  rowSpans: number[];
  weekColors: Map<string, boolean>;
  calculateDuration: (start: Date, end: Date) => string;
}

export function ResultsTable({
  results,
  displayResults,
  tableRef,
  sortField,
  handleSort,
  renderSortIcon,
  selectedRows,
  setSelectedRows,
  rowSpans,
  weekColors,
  calculateDuration
}: ResultsTableProps) {
  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4 flex-1">
        <div className="w-20 h-20 rounded-full bg-neutral-50 flex items-center justify-center">
          <CalendarDays className="w-10 h-10 text-neutral-300" />
        </div>
        <div className="text-center">
          <p className="text-neutral-600 font-medium">No results yet</p>
          <p className="text-sm mt-1">Click "Fetch Latest Availability" to see available slots.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={tableRef} className="overflow-x-auto flex-1 border border-neutral-200 rounded-xl bg-white">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200 sticky top-0">
          <tr>
            <th 
              className="px-5 py-4 font-medium cursor-pointer hover:bg-neutral-100 transition-colors select-none group"
              onClick={() => handleSort('date')}
            >
              <div className="flex items-center gap-1.5">
                Date
                <span className="opacity-0 group-hover:opacity-100 transition-opacity data-[active=true]:opacity-100" data-active={sortField === 'date'}>
                  {renderSortIcon('date')}
                </span>
              </div>
            </th>
            <th 
              className="px-5 py-4 font-medium cursor-pointer hover:bg-neutral-100 transition-colors select-none group"
              onClick={() => handleSort('weekday')}
            >
              <div className="flex items-center gap-1.5">
                Weekday
                <span className="opacity-0 group-hover:opacity-100 transition-opacity data-[active=true]:opacity-100" data-active={sortField === 'weekday'}>
                  {renderSortIcon('weekday')}
                </span>
              </div>
            </th>
            <th className="px-5 py-4 font-medium">
              <div className="flex items-center gap-1.5">
                Court Name
              </div>
            </th>
            <th className="px-5 py-4 font-medium">Available Time</th>
            <th className="px-5 py-4 font-medium">Duration</th>
            <th className="px-5 py-4 font-medium">2h Price</th>
            <th className="px-5 py-4 font-medium w-20 text-center">
              <button 
                onClick={() => {
                  if (selectedRows.size === displayResults.length) {
                    setSelectedRows(new Set());
                  } else {
                    setSelectedRows(new Set(displayResults.map((_, i) => i)));
                  }
                }}
                className="flex items-center justify-center gap-1 mx-auto p-1 hover:bg-neutral-200 rounded transition-colors"
              >
                {selectedRows.size === displayResults.length && displayResults.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-300" />
                )}
                <span className="text-[10px]">ALL</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {displayResults.length > 0 ? (
            displayResults.map((slot, idx) => {
              const rowSpan = rowSpans[idx];
              const isAlternate = weekColors.get(getWeekId(slot.start));
              const bgClass = isAlternate ? 'bg-neutral-100' : 'bg-white';
              
              return (
                <tr key={idx} className={`${bgClass} hover:bg-indigo-50 transition-colors`}>
                  {rowSpan > 0 && (
                    <>
                      <td rowSpan={rowSpan} className="px-5 py-4 whitespace-nowrap text-neutral-900 font-medium align-top border-r border-neutral-100">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-neutral-400" />
                          {formatDate(slot.start)}
                        </div>
                      </td>
                      <td rowSpan={rowSpan} className="px-5 py-4 whitespace-nowrap text-neutral-600 align-top border-r border-neutral-100">
                        {formatWeekday(slot.start)}
                      </td>
                    </>
                  )}
                  <td className="px-5 py-4 whitespace-nowrap text-neutral-900">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-neutral-400" />
                      {slot.resourceName}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-indigo-600 font-medium">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      {formatTime(slot.start)} - {formatTime(slot.end)}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-neutral-600 font-medium">
                    {calculateDuration(slot.start, slot.end)}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-emerald-600 font-medium">
                    {slot.price2h ? `$${slot.price2h.toFixed(2)}` : 'N/A'}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-center">
                    <button 
                      onClick={() => {
                        const next = new Set(selectedRows);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        setSelectedRows(next);
                      }}
                      className="p-1 hover:bg-neutral-200 rounded transition-colors"
                    >
                      {selectedRows.has(idx) ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-neutral-300" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="px-5 py-12 text-center text-neutral-500">
                No slots match the selected filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
