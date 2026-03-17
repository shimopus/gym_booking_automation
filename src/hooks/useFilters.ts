import { useState, useMemo, useEffect } from 'react';
import { MergedSlot } from '../types';

export function useFilters(results: MergedSlot[], fetchedRange: {start: string, end: string} | null) {
  const [sortField, setSortField] = useState<'date' | 'weekday'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedCourts, setSelectedCourts] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [seenCourts, setSeenCourts] = useState<Set<string>>(new Set());
  const [showUnavailable, setShowUnavailable] = useState<boolean>(false);

  const uniqueCourts = useMemo(() => Array.from(new Set<string>(results.map(r => r.resourceName))).sort(), [results]);
  const bballCourts = useMemo(() => uniqueCourts.filter(c => c.toLowerCase().startsWith('bball')), [uniqueCourts]);
  const otherCourts = useMemo(() => uniqueCourts.filter(c => !c.toLowerCase().startsWith('bball')), [uniqueCourts]);

  useEffect(() => {
    if (uniqueCourts.length > 0) {
      let changed = false;
      const nextSeen = new Set(seenCourts);
      const newCourts: string[] = [];
      
      uniqueCourts.forEach(court => {
        if (!nextSeen.has(court)) {
          nextSeen.add(court);
          newCourts.push(court);
          changed = true;
        }
      });
      
      if (changed) {
        setSeenCourts(nextSeen);
        setSelectedCourts(prev => {
          const next = new Set(prev);
          newCourts.forEach(c => next.add(c));
          return next;
        });
      }
    }
  }, [uniqueCourts, seenCourts]);

  const toggleCourt = (court: string) => {
    setSelectedRows(new Set());
    const next = new Set(selectedCourts);
    if (next.has(court)) {
      next.delete(court);
    } else {
      next.add(court);
    }
    setSelectedCourts(next);
  };

  const toggleGroup = (courts: string[], isSelected: boolean) => {
    setSelectedRows(new Set());
    const next = new Set(selectedCourts);
    courts.forEach(c => {
      if (isSelected) {
        next.delete(c);
      } else {
        next.add(c);
      }
    });
    setSelectedCourts(next);
  };

  const selectAll = () => {
    setSelectedRows(new Set());
    setSelectedCourts(new Set(uniqueCourts));
  };

  const clearAll = () => {
    setSelectedRows(new Set());
    setSelectedCourts(new Set());
  };

  const handleSort = (field: 'date' | 'weekday') => {
    setSelectedRows(new Set());
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const compareCourts = (courtA: string, courtB: string) => {
    const isBBallA = courtA.toLowerCase().startsWith('bball');
    const isBBallB = courtB.toLowerCase().startsWith('bball');
    
    if (isBBallA && !isBBallB) return 1;
    if (!isBBallA && isBBallB) return -1;
    return courtA.localeCompare(courtB);
  };

  const displayResults = useMemo(() => {
    let filtered = results.filter(r => selectedCourts.has(r.resourceName));
    
    // Add skipped days
    if (fetchedRange && showUnavailable) {
      const start = new Date(fetchedRange.start + 'T00:00:00');
      const end = new Date(fetchedRange.end + 'T00:00:00');
      const datesWithSlots = new Set(filtered.map(r => r.dateStr));
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        // Only Mon-Fri (1-5)
        if (day !== 0 && day !== 6) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const date = String(d.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${date}`;
          
          if (!datesWithSlots.has(dateStr)) {
            filtered.push({
              dateStr,
              date: new Date(d),
              start: new Date(d),
              end: new Date(d),
              resourceName: 'No slots available (or < 2h)',
              isSkipped: true
            });
          }
        }
      }
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = a.start.getTime() - b.start.getTime();
        if (comparison === 0) comparison = compareCourts(a.resourceName, b.resourceName);
      } else if (sortField === 'weekday') {
        const dayA = a.start.getDay() === 0 ? 7 : a.start.getDay();
        const dayB = b.start.getDay() === 0 ? 7 : b.start.getDay();
        comparison = dayA - dayB;
        if (comparison === 0) {
          comparison = a.start.getTime() - b.start.getTime();
          if (comparison === 0) comparison = compareCourts(a.resourceName, b.resourceName);
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [results, selectedCourts, sortField, sortDirection, fetchedRange, showUnavailable]);

  return {
    sortField,
    sortDirection,
    selectedCourts,
    setSelectedCourts,
    selectedRows,
    setSelectedRows,
    showUnavailable,
    setShowUnavailable,
    uniqueCourts,
    bballCourts,
    otherCourts,
    displayResults,
    toggleCourt,
    toggleGroup,
    selectAll,
    clearAll,
    handleSort
  };
}
