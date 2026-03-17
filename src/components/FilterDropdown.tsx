import React, { useRef, useEffect } from 'react';
import { Filter, X, CheckSquare, Square, ChevronDown } from 'lucide-react';

interface FilterDropdownProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedCourts: Set<string>;
  uniqueCourts: string[];
  bballCourts: string[];
  otherCourts: string[];
  toggleCourt: (court: string) => void;
  toggleGroup: (courts: string[], allSelected: boolean) => void;
  selectAll: () => void;
  clearAll: () => void;
  showUnavailable: boolean;
  setShowUnavailable: (show: boolean) => void;
}

export function FilterDropdown({
  isOpen,
  setIsOpen,
  selectedCourts,
  uniqueCourts,
  bballCourts,
  otherCourts,
  toggleCourt,
  toggleGroup,
  selectAll,
  clearAll,
  showUnavailable,
  setShowUnavailable
}: FilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-medium ${
          isOpen || selectedCourts.size < uniqueCourts.length
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
            : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span>Filter Courts</span>
        {selectedCourts.size < uniqueCourts.length && (
          <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {selectedCourts.size}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-neutral-200 shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Select Courts</span>
            <div className="flex gap-2">
              <button 
                onClick={selectAll}
                className="text-[10px] font-bold text-indigo-600 hover:underline"
              >
                All
              </button>
              <button 
                onClick={clearAll}
                className="text-[10px] font-bold text-neutral-500 hover:underline"
              >
                None
              </button>
            </div>
          </div>
          
          <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {otherCourts.length > 0 && (
              <div className="mb-2">
                <div 
                  className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded-lg cursor-pointer group"
                  onClick={() => toggleGroup(otherCourts, otherCourts.every(c => selectedCourts.has(c)))}
                >
                  {otherCourts.every(c => selectedCourts.has(c)) ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : otherCourts.some(c => selectedCourts.has(c)) ? (
                    <div className="w-4 h-4 border-2 border-indigo-600 rounded flex items-center justify-center bg-indigo-600">
                      <div className="w-2 h-0.5 bg-white rounded-full" />
                    </div>
                  ) : (
                    <Square className="w-4 h-4 text-neutral-300 group-hover:text-neutral-400" />
                  )}
                  <span className="text-xs font-bold text-neutral-800">Volleyball</span>
                </div>
                <div className="ml-4 space-y-0.5">
                  {otherCourts.map(court => (
                    <div 
                      key={court}
                      className="flex items-center gap-2 p-1.5 hover:bg-neutral-50 rounded-md cursor-pointer group"
                      onClick={() => toggleCourt(court)}
                    >
                      {selectedCourts.has(court) ? (
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-400" />
                      )}
                      <span className="text-xs text-neutral-600">{court}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bballCourts.length > 0 && (
              <div className={otherCourts.length > 0 ? "pt-2 border-t border-neutral-100" : ""}>
                <div 
                  className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded-lg cursor-pointer group"
                  onClick={() => toggleGroup(bballCourts, bballCourts.every(c => selectedCourts.has(c)))}
                >
                  {bballCourts.every(c => selectedCourts.has(c)) ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : bballCourts.some(c => selectedCourts.has(c)) ? (
                    <div className="w-4 h-4 border-2 border-indigo-600 rounded flex items-center justify-center bg-indigo-600">
                      <div className="w-2 h-0.5 bg-white rounded-full" />
                    </div>
                  ) : (
                    <Square className="w-4 h-4 text-neutral-300 group-hover:text-neutral-400" />
                  )}
                  <span className="text-xs font-bold text-neutral-800">Basketball</span>
                </div>
                <div className="ml-4 space-y-0.5">
                  {bballCourts.map(court => (
                    <div 
                      key={court}
                      className="flex items-center gap-2 p-1.5 hover:bg-neutral-50 rounded-md cursor-pointer group"
                      onClick={() => toggleCourt(court)}
                    >
                      {selectedCourts.has(court) ? (
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-400" />
                      )}
                      <span className="text-xs text-neutral-600">{court}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-neutral-100 bg-neutral-50/50">
            <div 
              className="flex items-center gap-2 p-2 hover:bg-neutral-100 rounded-lg cursor-pointer group transition-colors"
              onClick={() => setShowUnavailable(!showUnavailable)}
            >
              {showUnavailable ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-neutral-300 group-hover:text-neutral-400" />
              )}
              <span className="text-xs font-medium text-neutral-700">Show unavailable slots</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
