import { Slot, MergedSlot } from '../types';

export const parseMultipleJSON = (text: string) => {
  const str = text.trim();
  if (!str) return [];
  
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    // Fallback to custom tokenizer for concatenated JSON
  }

  const results: any[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') inString = false;
    } else {
      if (char === '"') inString = true;
      else if (char === '{' || char === '[') {
        if (depth === 0) start = i;
        depth++;
      }
      else if (char === '}' || char === ']') {
        depth--;
        if (depth === 0 && start !== -1) {
          const jsonStr = str.substring(start, i + 1);
          try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
              results.push(...parsed);
            } else {
              results.push(parsed);
            }
          } catch (err) {
            // ignore invalid chunks
          }
          start = -1;
        }
      }
    }
  }
  
  if (results.length === 0) {
    throw new Error("Could not parse valid JSON from the input.");
  }
  
  return results;
};

export const processJsonData = (input: string) => {
  const parsedDocs = parseMultipleJSON(input);

  const resourceMap = new Map<string, string>();
  const slots: Slot[] = [];

  parsedDocs.forEach((doc: any, index: number) => {
    if (!doc.data || !Array.isArray(doc.data)) {
      console.warn(`Document ${index + 1} missing 'data' array.`);
      return;
    }

    if (doc.included && Array.isArray(doc.included)) {
      doc.included.forEach((item: any) => {
        if (item.type === 'resources' && item.id && item.attributes?.name) {
          resourceMap.set(item.id, item.attributes.name);
        }
      });
    }

    doc.data.forEach((item: any) => {
      if (item.type === 'resource-availabilities') {
        const start = new Date(item.attributes.start);
        const end = new Date(item.attributes.end);
        const resourceId = item.relationships?.resource?.data?.id;
        const rentalPrice = parseFloat(item.attributes.rental_price) || 0;

        if (start && end && resourceId && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
          // The rental_price from the API is for a 30-minute slot
          // To get the 2-hour price, we multiply the 30-minute price by 4
          const price2h = rentalPrice * 4;
          slots.push({ start, end, resourceId, price2h });
        }
      }
    });
  });

  if (slots.length === 0) {
    throw new Error("No valid availability slots found in the provided JSON.");
  }

  // Filter weekdays (0 = Sunday, 6 = Saturday)
  const weekdaySlots = slots.filter(slot => {
    const day = slot.start.getDay();
    return day !== 0 && day !== 6;
  });

  // Group by date and resource
  const grouped = new Map<string, Slot[]>();
  weekdaySlots.forEach(slot => {
    const dateStr = slot.start.toISOString().split('T')[0];
    const key = `${dateStr}_${slot.resourceId}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(slot);
  });

  const mergedSlots: MergedSlot[] = [];

  // Merge contiguous slots
  grouped.forEach((groupSlots, key) => {
    // Sort by start time
    groupSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentSlot = { ...groupSlots[0] };

    for (let i = 1; i < groupSlots.length; i++) {
      const nextSlot = groupSlots[i];
      // If next slot starts exactly when current ends, or before (overlap)
      if (nextSlot.start.getTime() <= currentSlot.end.getTime()) {
        currentSlot.end = new Date(Math.max(currentSlot.end.getTime(), nextSlot.end.getTime()));
      } else {
        // Push current and start new
        const durationMs = currentSlot.end.getTime() - currentSlot.start.getTime();
        if (durationMs >= 2 * 60 * 60 * 1000) {
          const [dateStr, resourceId] = key.split('_');
          mergedSlots.push({
            dateStr,
            date: new Date(dateStr),
            start: currentSlot.start,
            end: currentSlot.end,
            resourceName: resourceMap.get(resourceId) || `Unknown Court (${resourceId})`,
            price2h: currentSlot.price2h
          });
        }
        currentSlot = { ...nextSlot };
      }
    }

    // Check the last slot
    const durationMs = currentSlot.end.getTime() - currentSlot.start.getTime();
    if (durationMs >= 2 * 60 * 60 * 1000) {
      const [dateStr, resourceId] = key.split('_');
      mergedSlots.push({
        dateStr,
        date: new Date(dateStr),
        start: currentSlot.start,
        end: currentSlot.end,
        resourceName: resourceMap.get(resourceId) || `Unknown Court (${resourceId})`,
        price2h: currentSlot.price2h
      });
    }
  });

  // Sort results by date, then start time
  mergedSlots.sort((a, b) => {
    if (a.start.getTime() !== b.start.getTime()) {
      return a.start.getTime() - b.start.getTime();
    }
    return a.resourceName.localeCompare(b.resourceName);
  });

  return mergedSlots;
};
