export const getWeekId = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${weekNo.toString().padStart(2, '0')}`;
};

export const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const formatWeekday = (date: Date) => {
  return date.toLocaleDateString([], { weekday: 'short' });
};

export const formatDate = (date: Date) => {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const formatPollOption = (start: Date, end: Date, courtName: string) => {
  const day = start.toLocaleDateString([], { weekday: 'short' });
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const dd = String(start.getDate()).padStart(2, '0');
  
  const compactTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      .replace(':00', '')
      .replace(' ', '');
  };

  const timeRange = `${compactTime(start)} - ${compactTime(end)}`;
  return `${day} ${mm}/${dd} | ${timeRange} | ${courtName}`;
};

export const getBest2hWindow = (start: Date, end: Date) => {
  const targetStart = new Date(start);
  targetStart.setHours(20, 0, 0, 0); // 8 PM
  
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const slotDuration = end.getTime() - start.getTime();
  
  if (slotDuration < twoHoursMs) return { start, end };

  // Possible start range: [start, end - 2h]
  const minStart = start.getTime();
  const maxStart = end.getTime() - twoHoursMs;
  const targetTime = targetStart.getTime();

  // Clamp targetTime to [minStart, maxStart]
  const bestStartMs = Math.max(minStart, Math.min(maxStart, targetTime));
  const bestStart = new Date(bestStartMs);
  const bestEnd = new Date(bestStartMs + twoHoursMs);

  return { start: bestStart, end: bestEnd };
};
