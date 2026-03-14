import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileJson, AlertCircle, CalendarDays, Clock, MapPin, ChevronDown, ChevronUp, ArrowUpDown, Filter, CheckSquare, Square, X, Share2, Image as ImageIcon, Loader2, ExternalLink, Download, Send, Settings, LogIn, LogOut } from 'lucide-react';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import * as htmlToImage from 'html-to-image';
import { db, auth, signIn, logOut } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface Slot {
  start: Date;
  end: Date;
  resourceId: string;
  price2h?: number;
}

interface PollOption {
  text: string;
  voter_count: number;
  price2h?: number;
}

interface VoterInfo {
  userId: number;
  name: string;
  username?: string;
  optionIds: number[];
  votedAt: number;
}

interface SentSummary {
  messageId: number;
  chatId: string;
  text: string;
  users: {
    userId: number;
    name: string;
    username?: string;
    total: number;
    paid: boolean;
  }[];
  timestamp: number;
}

interface SentLineup {
  messageId: number;
  chatId: string;
  text: string;
  optionIndex: number;
  timestamp: number;
}

interface ActivePoll {
  id: string;
  messageId: number;
  question: string;
  options: PollOption[];
  totalVoterCount: number;
  createdAt: number;
  voterAnswers?: { [userId: number]: VoterInfo };
  sentSummaries?: SentSummary[];
  sentLineups?: SentLineup[];
}

interface MergedSlot {
  dateStr: string;
  date: Date;
  start: Date;
  end: Date;
  resourceName: string;
  price2h?: number;
}

const getWeekId = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${weekNo.toString().padStart(2, '0')}`;
};

export default function App() {
  const [results, setResults] = useState<MergedSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'date' | 'weekday'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedCourts, setSelectedCourts] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isImageCopied, setIsImageCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [username, setUsername] = useState(() => localStorage.getItem('sportsHouseUsername') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('sportsHousePassword') || '');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('sportsHouseRemember') === 'true');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 29);
    return d.toISOString().split('T')[0];
  });
  
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const originalTgBotTokenRef = useRef('');
  const [pollSlot, setPollSlot] = useState<MergedSlot | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<Partial<PollOption>[]>([
    { text: "I'm in! 🙋‍♂️" },
    { text: "Can't make it 🙅‍♂️" },
    { text: "Maybe 🤔" }
  ]);
  const [isSendingPoll, setIsSendingPoll] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isBulkPoll, setIsBulkPoll] = useState(false);
  const [activePolls, setActivePolls] = useState<ActivePoll[]>([]);
  const [lastUpdateId, setLastUpdateId] = useState(0);
  const [activeTab, setActiveTab] = useState<'polls' | 'slots'>('polls');
  const [isRefreshingPolls, setIsRefreshingPolls] = useState(false);
  const [selectedPollForDetails, setSelectedPollForDetails] = useState<ActivePoll | null>(null);
  const [isSendingLineup, setIsSendingLineup] = useState(false);
  const [lineupPreviews, setLineupPreviews] = useState<{ optionIndex: number; text: string; users?: any[] }[] | null>(null);
  const [editingLineup, setEditingLineup] = useState<{ index: number; text: string } | null>(null);
  const [isSavingLineup, setIsSavingLineup] = useState(false);
  const [ignoreVoteLimit, setIgnoreVoteLimit] = useState(false);
  const [showPollDetails, setShowPollDetails] = useState(true);
  
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    
    const unsubscribePolls = onSnapshot(collection(db, 'polls'), (snapshot) => {
      const polls = snapshot.docs.map(doc => doc.data() as ActivePoll);
      polls.sort((a, b) => b.createdAt - a.createdAt);
      setActivePolls(polls);
      
      // Update selected poll if it exists
      setSelectedPollForDetails(current => {
        if (!current) return null;
        return polls.find(p => p.id === current.id) || null;
      });
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'telegram'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tgBotToken) {
          setTgBotToken(data.tgBotToken);
          originalTgBotTokenRef.current = data.tgBotToken;
        }
        if (data.tgChatId) setTgChatId(data.tgChatId);
        if (data.lastUpdateId !== undefined) setLastUpdateId(data.lastUpdateId);
      }
    });

    return () => {
      unsubscribePolls();
      unsubscribeSettings();
    };
  }, [isAuthReady, user]);

  const savePollToFirebase = async (poll: ActivePoll) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'polls', poll.id), poll);
    } catch (err) {
      console.error('Failed to save poll to Firebase', err);
    }
  };

  const deletePollFromFirebase = async (pollId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'polls', pollId));
    } catch (err) {
      console.error('Failed to delete poll from Firebase', err);
    }
  };

  const saveLastUpdateId = async (id: number) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'settings', 'telegram'), { lastUpdateId: id }, { merge: true });
    } catch (err) {
      console.error('Failed to save lastUpdateId', err);
    }
  };

  useEffect(() => {
    const migrateData = async () => {
      if (!user || !isAuthReady) return;
      if (localStorage.getItem('hasMigratedToFirebase') === 'true') return;

      console.log('Migrating local data to Firebase...');
      let migratedSomething = false;

      // Migrate Polls
      const localPolls = localStorage.getItem('activePolls');
      if (localPolls) {
        try {
          const parsedPolls = JSON.parse(localPolls);
          if (Array.isArray(parsedPolls) && parsedPolls.length > 0) {
            for (const poll of parsedPolls) {
              await savePollToFirebase(poll);
            }
            migratedSomething = true;
          }
        } catch (err) {
          console.error('Failed to parse local polls for migration', err);
        }
      }

      // Migrate Telegram Settings
      const localToken = localStorage.getItem('tgBotToken');
      const localChatId = localStorage.getItem('tgChatId');
      const localLastUpdateId = localStorage.getItem('lastUpdateId');
      
      if (localToken || localChatId || localLastUpdateId) {
        try {
          const settingsObj: any = {};
          if (localToken) settingsObj.tgBotToken = localToken;
          if (localChatId) settingsObj.tgChatId = localChatId;
          if (localLastUpdateId) settingsObj.lastUpdateId = Number(localLastUpdateId);
          
          await setDoc(doc(db, 'settings', 'telegram'), settingsObj, { merge: true });
          migratedSomething = true;
        } catch (err) {
          console.error('Failed to migrate settings', err);
        }
      }

      localStorage.setItem('hasMigratedToFirebase', 'true');
      if (migratedSomething) {
        console.log('Migration complete!');
      }
    };

    migrateData();
  }, [user, isAuthReady]);

  useEffect(() => {
    if (selectedPollForDetails) {
      setShowPollDetails(!(selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0));
    }
  }, [selectedPollForDetails?.id]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        const decompressed = decompressFromEncodedURIComponent(hash);
        if (decompressed) {
          const parsed = JSON.parse(decompressed);
          const reconstructed: MergedSlot[] = parsed.map((item: any) => ({
            dateStr: item.d,
            date: new Date(item.d),
            start: new Date(item.s),
            end: new Date(item.e),
            resourceName: item.r,
            price2h: item.p
          }));
          setResults(reconstructed);
          setSelectedCourts(new Set(reconstructed.map(r => r.resourceName)));
        }
      } catch (err) {
        console.error("Failed to parse shared data", err);
      }
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopyImage = async () => {
    if (!tableRef.current) return;
    try {
      setIsGeneratingImage(true);
      const blob = await htmlToImage.toBlob(tableRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setIsImageCopied(true);
        setTimeout(() => setIsImageCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy image", err);
      alert("Failed to copy image to clipboard. Your browser might not support this feature.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const parseMultipleJSON = (text: string) => {
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

  const handleFetchFromSportsHouse = async () => {
    setIsFetching(true);
    setFetchProgress('Authenticating...');
    setError(null);
    setShowSettings(false);
    
    try {
      const authResponse = await fetch('https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/customer/auth/token?company=sportshouse', {
        method: 'POST',
        headers: {
          'accept': 'application/vnd.api+json',
          'content-type': 'application/vnd.api+json',
          'x-requested-with': 'xmlhttprequest'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: username,
          client_secret: password,
          stay_signed_in: false,
          company: 'sportshouse',
          company_code: 'sportshouse'
        })
      });

      if (!authResponse.ok) {
        throw new Error(`Authentication failed: ${authResponse.status}`);
      }

      const authData = await authResponse.json();
      const accessToken = authData.access_token;

      if (!accessToken) {
        throw new Error('No access token received');
      }

      if (rememberMe) {
        localStorage.setItem('sportsHouseUsername', username);
        localStorage.setItem('sportsHousePassword', password);
        localStorage.setItem('sportsHouseRemember', 'true');
      } else {
        localStorage.removeItem('sportsHouseUsername');
        localStorage.removeItem('sportsHousePassword');
        localStorage.removeItem('sportsHouseRemember');
      }

      setFetchProgress('Authentication successful. Fetching resource type 14...');
      
      const startParam = encodeURIComponent(`${startDate} 00:00:00`);
      const endParam = encodeURIComponent(`${endDate} 23:59:59`);
      
      const url1 = `https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/resource-availabilities?cache[save]=false&page[size]=2000&include=resource.address%2Cresource.resourceType%2Cresource.facility.address%2Cresource.files%2Cfees.product.locations%2CbookingOption%2CbookingOptionAvailability&filter[is_available]=true&filter[resource_type_id]=14&filter[facility_id]=1&filter[start__gte]=${startParam}&filter[end__lte]=${endParam}&filter[and][or][0][and][start_time__lte]=24%3A00%3A00&filter[and][or][0][and][end_time__gte]=17%3A00%3A00&filter[day_of_week__in][]=2&filter[day_of_week__in][]=4&filter[day_of_week__in][]=8&filter[day_of_week__in][]=16&filter[day_of_week__in][]=32&filterRelations[fees.is_online]=true&filterRelations[fees.is_active]=true&fields[resource-availabilities]=id%2Cstart%2Cend%2Conline_type%2Crental_price%2Crental_price_non_resident%2Cresource%2Cfees%2CbookingOption%2CbookingOptionAvailability&fields[resource]=id%2Cname%2Cdesc%2Clat%2Clng%2Caddress%2CresourceType%2Cfacility%2Cfiles&fields[facilities]=id%2Cname%2Cemail%2Cphone%2Clat%2Clng%2Caddress&sort=start%2Cend&company=sportshouse`;
      
      const res1 = await fetch(url1, {
        headers: {
          'accept': 'application/vnd.api+json',
          'authorization': `Bearer ${accessToken}`,
          'x-requested-with': 'XMLHttpRequest'
        }
      });
      
      if (!res1.ok) {
        throw new Error(`Failed to fetch resource type 14: ${res1.status}`);
      }
      
      const data1 = await res1.json();
      
      setFetchProgress('Fetching resource type 17...');
      
      const url2 = url1.replace('filter[resource_type_id]=14', 'filter[resource_type_id]=17');
      
      const res2 = await fetch(url2, {
        headers: {
          'accept': 'application/vnd.api+json',
          'authorization': `Bearer ${accessToken}`,
          'x-requested-with': 'XMLHttpRequest'
        }
      });
      
      if (!res2.ok) {
        throw new Error(`Failed to fetch resource type 17: ${res2.status}`);
      }
      
      const data2 = await res2.json();
      
      setFetchProgress('Processing data...');
      
      const combinedJson = JSON.stringify(data1, null, 2) + '\n\n' + JSON.stringify(data2, null, 2);
      setFetchProgress('');
      processJson(combinedJson);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data from SportsHouse.");
    } finally {
      setIsFetching(false);
    }
  };

  const processJson = (input: string) => {
    setError(null);
    try {
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

      setResults(mergedSlots);
      setSelectedCourts(new Set(mergedSlots.map(r => r.resourceName)));
      setSelectedRows(new Set());

    } catch (err: any) {
      setError(err.message || "Failed to parse JSON");
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatWeekday = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'long' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const calculateDuration = (start: Date, end: Date) => {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
  };

  const uniqueCourts = Array.from(new Set<string>(results.map(r => r.resourceName))).sort();
  const bballCourts = uniqueCourts.filter(c => c.toLowerCase().startsWith('bball'));
  const otherCourts = uniqueCourts.filter(c => !c.toLowerCase().startsWith('bball'));

  const handleSort = (field: 'date' | 'weekday') => {
    setSelectedRows(new Set());
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSaveSettings = async () => {
    const oldToken = originalTgBotTokenRef.current;
    if (oldToken !== tgBotToken) {
      setLastUpdateId(0);
      await saveLastUpdateId(0);
    }
    
    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'telegram'), {
          tgBotToken,
          tgChatId,
          lastUpdateId: tgBotToken !== oldToken ? 0 : lastUpdateId
        }, { merge: true });
        originalTgBotTokenRef.current = tgBotToken;
      } catch (err) {
        console.error('Failed to save settings to Firebase', err);
      }
    }
    
    if (rememberMe) {
      localStorage.setItem('sportsHouseUsername', username);
      localStorage.setItem('sportsHousePassword', password);
      localStorage.setItem('sportsHouseRemember', 'true');
    } else {
      localStorage.removeItem('sportsHouseUsername');
      localStorage.removeItem('sportsHousePassword');
      localStorage.removeItem('sportsHouseRemember');
    }
    
    setShowSettings(false);
  };

  const getBest2hWindow = (start: Date, end: Date) => {
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

  const openPollModal = (slot: MergedSlot) => {
    if (!tgBotToken || !tgChatId) {
      setShowSettings(true);
      return;
    }
    const { start, end } = getBest2hWindow(slot.start, slot.end);
    setPollSlot(slot);
    setIsBulkPoll(false);
    setPollQuestion("Кто готов закоммититься на зал - голосуем! 🏐");
    setPollOptions([{
      text: formatPollOption(start, end, slot.resourceName),
      price2h: slot.price2h
    }]);
  };

  const formatPollOption = (start: Date, end: Date, courtName: string) => {
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

  const openBulkPollModal = () => {
    if (!tgBotToken || !tgChatId) {
      setShowSettings(true);
      return;
    }
    
    const selectedSlots = displayResults.filter((_, idx) => selectedRows.has(idx));
    if (selectedSlots.length === 0) return;

    setIsBulkPoll(true);
    setPollSlot(selectedSlots[0]);
    setPollQuestion("Кто готов закоммититься на зал - голосуем! 🏐");
    
    const options = selectedSlots.map(slot => {
      const { start, end } = getBest2hWindow(slot.start, slot.end);
      return {
        text: formatPollOption(start, end, slot.resourceName),
        price2h: slot.price2h
      };
    });
    
    setPollOptions(options);
  };

  const handleSendPoll = async () => {
    if (!tgBotToken || !tgChatId) return;
    
    setIsSendingPoll(true);
    try {
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendPoll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: tgChatId,
          question: pollQuestion,
          options: pollOptions.filter(opt => opt.text?.trim()).map(opt => opt.text || ''),
          is_anonymous: false,
          allows_multiple_answers: isBulkPoll
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.description || 'Failed to send poll');
      }

      const data = await response.json();
      const finalOptions = pollOptions.filter(opt => opt.text?.trim());

      const newPoll: ActivePoll = {
        id: data.result.poll.id,
        messageId: data.result.message_id,
        question: data.result.poll.question,
        options: data.result.poll.options.map((o: any, idx: number) => ({ 
          text: o.text, 
          voter_count: o.voter_count,
          price2h: finalOptions[idx]?.price2h
        })),
        totalVoterCount: data.result.poll.total_voter_count,
        createdAt: Date.now()
      };

      const updatedPolls = [newPoll, ...activePolls].slice(0, 10); // Keep last 10
      setActivePolls(updatedPolls);
      await savePollToFirebase(newPoll);

      setPollSlot(null);
      setSelectedRows(new Set());
      alert('Poll sent successfully!');
    } catch (err: any) {
      console.error('Telegram API Error:', err);
      alert(`Failed to send poll: ${err.message}`);
    } finally {
      setIsSendingPoll(false);
    }
  };

  const refreshPolls = useCallback(async () => {
    if (!tgBotToken || activePolls.length === 0) return;
    
    setIsRefreshingPolls(true);
    try {
      const offset = lastUpdateId ? lastUpdateId + 1 : 0;
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/getUpdates?offset=${offset}&limit=100&allowed_updates=["poll","poll_answer"]`);
      if (!response.ok) throw new Error('Failed to fetch updates');
      
      const data = await response.json();
      const updates = data.result || [];
      
      if (updates.length > 0) {
        const maxUpdateId = Math.max(...updates.map((u: any) => u.update_id));
        setLastUpdateId(maxUpdateId);
        await saveLastUpdateId(maxUpdateId);
      }

      const pollUpdates = updates
        .filter((u: any) => u.poll)
        .map((u: any) => u.poll);

      const pollAnswerUpdates = updates
        .filter((u: any) => u.poll_answer)
        .map((u: any) => u.poll_answer);
        
      setActivePolls(prevPolls => {
        const nextPolls = prevPolls.map(p => {
          let updatedPoll = { ...p };
          
          const pollUpdate = pollUpdates.find((up: any) => up.id === p.id);
          if (pollUpdate) {
            updatedPoll.options = pollUpdate.options.map((o: any) => {
              const existingOption = p.options.find((eo: any) => eo.text === o.text);
              return { 
                text: o.text, 
                voter_count: o.voter_count,
                price2h: existingOption?.price2h
              };
            });
            updatedPoll.totalVoterCount = pollUpdate.total_voter_count;
          }

          const answersForThisPoll = pollAnswerUpdates.filter((au: any) => au.poll_id === p.id);
          if (answersForThisPoll.length > 0) {
            const currentVoterAnswers = { ...(updatedPoll.voterAnswers || {}) };
            answersForThisPoll.forEach((au: any) => {
              if (au.option_ids.length === 0) {
                delete currentVoterAnswers[au.user.id];
              } else {
                const existing = currentVoterAnswers[au.user.id];
                currentVoterAnswers[au.user.id] = {
                  userId: au.user.id,
                  name: [au.user.first_name, au.user.last_name].filter(Boolean).join(' '),
                  username: au.user.username,
                  optionIds: au.option_ids,
                  votedAt: existing?.votedAt || Date.now()
                };
              }
            });
            updatedPoll.voterAnswers = currentVoterAnswers;
          }

          return updatedPoll;
        });

        // Save modified polls to Firebase
        nextPolls.forEach(p => {
          const prev = prevPolls.find(old => old.id === p.id);
          if (JSON.stringify(prev) !== JSON.stringify(p)) {
            savePollToFirebase(p);
          }
        });
        
        // Update selected poll if it's in the list
        if (selectedPollForDetails) {
          const updatedSelected = nextPolls.find(p => p.id === selectedPollForDetails.id);
          if (updatedSelected) setSelectedPollForDetails(updatedSelected);
        }

        return nextPolls;
      });
    } catch (err) {
      console.error('Failed to refresh polls', err);
    } finally {
      setIsRefreshingPolls(false);
    }
  }, [tgBotToken, activePolls.length, lastUpdateId, selectedPollForDetails]);

  // Auto-refresh polls every 30 seconds and on visibility change
  useEffect(() => {
    if (!tgBotToken || activePolls.length === 0) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPolls();
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshPolls();
      }
    }, 30000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tgBotToken, activePolls.length, refreshPolls]);

  const togglePaidStatus = async (pollId: string, summaryIndex: number, userIndex: number) => {
    if (!tgBotToken) return;
    
    const poll = activePolls.find(p => p.id === pollId);
    if (!poll || !poll.sentSummaries) return;

    const summary = poll.sentSummaries[summaryIndex];
    const user = summary.users[userIndex];
    const newPaidStatus = !user.paid;

    // Update local state
    const nextPolls = activePolls.map(p => {
      if (p.id === pollId) {
        const nextSummaries = [...(p.sentSummaries || [])];
        const nextUsers = [...nextSummaries[summaryIndex].users];
        nextUsers[userIndex] = { ...nextUsers[userIndex], paid: newPaidStatus };
        
        // Rebuild the text
        let newText = `<b>💰 Summary Payments</b>\n\n`;
        nextUsers.forEach(u => {
          const mention = u.username 
            ? `@${u.username.replace(/_/g, '\\_')}` 
            : `<a href="tg://user?id=${u.userId}">${u.name}</a>`;
          const displayName = u.username ? `${u.name} (${mention})` : mention;
          const statusEmoji = u.paid ? ' ✅' : ' ❌';
          newText += `${displayName}: <b>$${u.total.toFixed(2)}</b>${statusEmoji}\n`;
        });
        
        if (summary.text.includes('⚠️ Note:')) {
           newText += `\n<i>⚠️ Note: Some sessions had missing price data. Totals might be incomplete.</i>`;
        }
        
        nextSummaries[summaryIndex] = { 
          ...nextSummaries[summaryIndex], 
          users: nextUsers,
          text: newText 
        };
        
        return { ...p, sentSummaries: nextSummaries };
      }
      return p;
    });

    setActivePolls(nextPolls);
    const updatedPoll = nextPolls.find(p => p.id === pollId);
    if (updatedPoll) savePollToFirebase(updatedPoll);
    
    if (selectedPollForDetails && selectedPollForDetails.id === pollId) {
      setSelectedPollForDetails(nextPolls.find(p => p.id === pollId) || null);
    }

    try {
      const updatedSummary = nextPolls.find(p => p.id === pollId)?.sentSummaries?.[summaryIndex];
      if (updatedSummary) {
        await fetch(`https://api.telegram.org/bot${tgBotToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: updatedSummary.chatId,
            message_id: updatedSummary.messageId,
            text: updatedSummary.text,
            parse_mode: 'HTML'
          })
        });
      }
    } catch (err) {
      console.error('Failed to update Telegram message:', err);
    }
  };

  const removePoll = (id: string) => {
    const next = activePolls.filter(p => p.id !== id);
    setActivePolls(next);
    deletePollFromFirebase(id);
  };

  const prepareLineups = (poll: ActivePoll) => {
    if (!poll.voterAnswers) return;
    
    const allVoters = (Object.values(poll.voterAnswers) as VoterInfo[])
      .sort((a, b) => a.votedAt - b.votedAt);

    const previews: { optionIndex: number; text: string; users?: any[] }[] = [];
    const userCosts: { [userId: number]: { name: string; username?: string; total: number } } = {};
    let hasMissingPrices = false;

    for (let i = 0; i < poll.options.length; i++) {
      const option = poll.options[i];
      const optionVoters = allVoters.filter(v => v.optionIds.includes(i));

      if (optionVoters.length >= 12 || (ignoreVoteLimit && optionVoters.length > 0)) {
        let message = `<b>${option.text}</b>\n\n`;
        optionVoters.forEach((v, idx) => {
          const mention = v.username 
            ? `@${v.username.replace(/_/g, '\\_')}` 
            : `<a href="tg://user?id=${v.userId}">${v.name}</a>`;
          const displayName = v.username ? `${v.name} (${mention})` : mention;
          message += `${idx + 1}. ${displayName}\n`;

          // Track costs and presence
          if (!userCosts[v.userId]) {
            userCosts[v.userId] = { name: v.name, username: v.username, total: 0 };
          }
          if (option.price2h !== undefined) {
            userCosts[v.userId].total += option.price2h / optionVoters.length;
          } else {
            hasMissingPrices = true;
          }
        });
        previews.push({ optionIndex: i, text: message });
      }
    }

    // Add summary message
    if (Object.keys(userCosts).length > 0) {
      let summary = `<b>💰 Summary Payments</b>\n\n`;
      const sortedUsers = Object.entries(userCosts)
        .map(([userId, data]) => ({ userId: Number(userId), ...data }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const usersForSummary = sortedUsers.map(u => {
        const roundedTotal = Math.ceil(u.total * 2) / 2;
        const mention = u.username 
          ? `@${u.username.replace(/_/g, '\\_')}` 
          : `<a href="tg://user?id=${u.userId}">${u.name}</a>`;
        
        const displayName = u.username ? `${u.name} (${mention})` : mention;
        const isShimopus = u.username?.toLowerCase() === 'shimopus';
        const statusEmoji = isShimopus ? ' ✅' : ' ❌';
        summary += `${displayName}: <b>$${roundedTotal.toFixed(2)}</b>${statusEmoji}\n`;
        
        return {
          userId: u.userId,
          name: u.name,
          username: u.username,
          total: roundedTotal,
          paid: isShimopus
        };
      });
      
      if (hasMissingPrices) {
        summary += `\n<i>⚠️ Note: Some sessions had missing price data. Totals might be incomplete.</i>`;
      }
      
      previews.push({ optionIndex: -1, text: summary, users: usersForSummary });
    }

    if (previews.length === 0) {
      alert(ignoreVoteLimit ? 'No sessions have any votes yet.' : 'No sessions have reached the 12 vote minimum yet.');
      return;
    }

    setLineupPreviews(previews);
  };

  const handleSaveEditedLineup = async () => {
    if (!tgBotToken || !selectedPollForDetails || !editingLineup || !selectedPollForDetails.sentLineups) return;
    
    setIsSavingLineup(true);
    try {
      const lineup = selectedPollForDetails.sentLineups[editingLineup.index];
      
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: lineup.chatId,
          message_id: lineup.messageId,
          text: editingLineup.text,
          parse_mode: 'HTML'
        })
      });
      
      if (!response.ok) throw new Error('Failed to edit message on Telegram');
      
      const pollId = selectedPollForDetails.id;
      const nextPolls = activePolls.map(p => {
        if (p.id === pollId && p.sentLineups) {
          const nextLineups = [...p.sentLineups];
          nextLineups[editingLineup.index] = {
            ...nextLineups[editingLineup.index],
            text: editingLineup.text
          };
          return { ...p, sentLineups: nextLineups };
        }
        return p;
      });
      
      setActivePolls(nextPolls);
      const updatedPoll = nextPolls.find(p => p.id === pollId);
      if (updatedPoll) savePollToFirebase(updatedPoll);
      
      if (updatedPoll) {
        setSelectedPollForDetails(updatedPoll);
      }
      
      setEditingLineup(null);
    } catch (err: any) {
      console.error('Failed to edit lineup:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsSavingLineup(false);
    }
  };

  const handleSendFinalLineups = async () => {
    if (!tgBotToken || !tgChatId || !lineupPreviews || !selectedPollForDetails) return;
    
    setIsSendingLineup(true);
    try {
      const newSummaries: SentSummary[] = [];
      const newLineups: SentLineup[] = [];
      
      for (const preview of lineupPreviews) {
        const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: preview.text,
            parse_mode: 'HTML'
          })
        });
        
        if (!response.ok) throw new Error('Failed to send message to Telegram');
        const data = await response.json();
        
        // If it's a summary message, save it
        if (preview.optionIndex === -1 && preview.users) {
          newSummaries.push({
            messageId: data.result.message_id,
            chatId: tgChatId,
            text: preview.text,
            users: preview.users,
            timestamp: Date.now()
          });
        } else {
          newLineups.push({
            messageId: data.result.message_id,
            chatId: tgChatId,
            text: preview.text,
            optionIndex: preview.optionIndex,
            timestamp: Date.now()
          });
        }
        
        // Small delay to ensure order and avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update activePolls with the new summaries and lineups
      const pollId = selectedPollForDetails.id;
      setActivePolls(prev => {
        const next = prev.map(p => {
          if (p.id === pollId) {
            const updated = {
              ...p,
              sentSummaries: [...(p.sentSummaries || []), ...newSummaries],
              sentLineups: [...(p.sentLineups || []), ...newLineups]
            };
            savePollToFirebase(updated);
            return updated;
          }
          return p;
        });
        return next;
      });

      alert('Lineups and summary sent successfully!');
      setLineupPreviews(null);
      setSelectedPollForDetails(null);
    } catch (err: any) {
      console.error('Failed to send lineup:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsSendingLineup(false);
    }
  };

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

  let displayResults = results.filter(r => selectedCourts.has(r.resourceName));

  const compareCourts = (courtA: string, courtB: string) => {
    const isBBallA = courtA.toLowerCase().startsWith('bball');
    const isBBallB = courtB.toLowerCase().startsWith('bball');
    
    if (isBBallA && !isBBallB) return 1;
    if (!isBBallA && isBBallB) return -1;
    return courtA.localeCompare(courtB);
  };

  displayResults.sort((a, b) => {
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

  const rowSpans = new Array(displayResults.length).fill(1);
  for (let i = 0; i < displayResults.length; i++) {
    if (rowSpans[i] === 0) continue;
    let span = 1;
    for (let j = i + 1; j < displayResults.length; j++) {
      if (displayResults[i].dateStr === displayResults[j].dateStr) {
        span++;
        rowSpans[j] = 0;
      } else {
        break;
      }
    }
    rowSpans[i] = span;
  }

  const weekColors = new Map<string, boolean>();
  const uniqueWeekIds = Array.from(new Set<string>(displayResults.map(r => getWeekId(r.start)))).sort();
  uniqueWeekIds.forEach((weekId, index) => {
    weekColors.set(weekId, index % 2 === 0);
  });

  const renderSortIcon = (field: 'date' | 'weekday') => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-neutral-300" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8 font-sans text-neutral-900">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Court Availability Finder</h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
              <p className="text-neutral-500">Find weekday slots of 2 hours or more at SportsHouse.</p>
              <a 
                href="https://apps.daysmartrecreation.com/dash/x/#/online/sportshouse/login?noAutoLogin=1" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Book on SportsHouse
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <div>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-600 font-medium">{user.email}</span>
                <button 
                  onClick={logOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={signIn}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Sync
              </button>
            )}
          </div>
        </header>

        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 min-h-[500px] flex flex-col overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex border-b border-neutral-200 bg-neutral-50/50">
              <button
                onClick={() => setActiveTab('polls')}
                className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
                  activeTab === 'polls' 
                    ? 'border-indigo-600 text-indigo-600 bg-white' 
                    : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Send className="w-4 h-4" />
                Active Polls
                {activePolls.length > 0 && (
                  <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-[10px]">
                    {activePolls.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('slots')}
                className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
                  activeTab === 'slots' 
                    ? 'border-indigo-600 text-indigo-600 bg-white' 
                    : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Available Slots
              </button>
            </div>

            {activeTab === 'polls' ? (
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-neutral-100 bg-neutral-50/30 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Poll Management
                  </h3>
                  {activePolls.length > 0 && (
                    <button 
                      onClick={refreshPolls}
                      disabled={isRefreshingPolls}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-sm transition-all disabled:opacity-50"
                    >
                      {isRefreshingPolls ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      Refresh Results
                    </button>
                  )}
                </div>
                
                <div className="p-6 flex-1">
                  {activePolls.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activePolls.map(poll => (
                        <div 
                          key={poll.id} 
                          onClick={() => setSelectedPollForDetails(poll)}
                          className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm relative group cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
                        >
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removePoll(poll.id);
                            }}
                            className="absolute top-3 right-3 p-1.5 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white rounded-lg shadow-sm border border-neutral-100"
                            title="Remove from list"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="mb-2">
                            {poll.sentSummaries && poll.sentSummaries.length > 0 ? (
                              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-fit">
                                <div className="w-1 h-1 bg-indigo-500 rounded-full" />
                                Finalized
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-fit">
                                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                Live
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-neutral-900 mb-4 pr-8 line-clamp-2 leading-tight">{poll.question}</p>
                          <div className="space-y-2.5">
                            {poll.options.map((opt, i) => {
                              const percentage = poll.totalVoterCount > 0 ? (opt.voter_count / poll.totalVoterCount) * 100 : 0;
                              return (
                                <div key={i} className="space-y-1">
                                  <div className="flex justify-between text-[11px] text-neutral-600 font-medium">
                                    <span className="truncate pr-2">{opt.text}</span>
                                    <span className="font-bold text-indigo-600">{opt.voter_count}</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-indigo-500 transition-all duration-500" 
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-4 pt-3 border-t border-neutral-50 text-[10px] text-neutral-400 flex justify-between items-center">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {new Date(poll.createdAt).toLocaleDateString()}
                            </span>
                            <span className="font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {poll.totalVoterCount} total votes
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4 py-20">
                      <div className="w-20 h-20 rounded-full bg-neutral-50 flex items-center justify-center">
                        <Send className="w-10 h-10 text-neutral-300" />
                      </div>
                      <div className="text-center">
                        <p className="text-neutral-600 font-medium">No active polls</p>
                        <p className="text-sm mt-1">Create a poll from the Available Slots tab to see it here.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="bg-neutral-50 border-b border-neutral-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!username || !password) {
                          setShowSettings(true);
                        } else {
                          handleFetchFromSportsHouse();
                        }
                      }}
                      disabled={isFetching}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 font-medium"
                    >
                      {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>{isFetching ? 'Fetching...' : 'Fetch Latest Availability'}</span>
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="p-2.5 rounded-xl border bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors shadow-sm"
                      title="Settings"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    {isFetching ? (fetchProgress || 'Syncing with SportsHouse...') : 'System Ready'}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-medium">Available Slots</h2>
                  {results.length > 0 && (
                    <span className="bg-indigo-50 text-indigo-700 py-1 px-3 rounded-full text-sm font-medium">
                      {displayResults.length} {displayResults.length !== results.length ? `of ${results.length} ` : ''}slots found
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 relative" ref={filterRef}>
                  {results.length > 0 && (
                    <>
                      <button
                        onClick={handleCopyImage}
                        disabled={isGeneratingImage || isImageCopied}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Copy table as image"
                      >
                        {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : (isImageCopied ? <CheckSquare className="w-4 h-4 text-green-600" /> : <ImageIcon className="w-4 h-4" />)}
                        <span className="text-sm font-medium hidden sm:inline">{isGeneratingImage ? 'Copying...' : (isImageCopied ? 'Copied!' : 'Copy Image')}</span>
                      </button>

                      {selectedRows.size > 0 && (
                        <button
                          onClick={openBulkPollModal}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          <Send className="w-4 h-4" />
                          <span className="text-sm font-medium">Create Group Poll ({selectedRows.size})</span>
                        </button>
                      )}

                      <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                          isFilterOpen 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                        }`}
                        title="Filter by court"
                      >
                        <Filter className="w-4 h-4" />
                        <span className="text-sm font-medium hidden sm:inline">Filter</span>
                        {selectedCourts.size !== uniqueCourts.length && (
                          <span className="bg-indigo-600 text-white text-xs py-0.5 px-1.5 rounded-full ml-1">
                            {selectedCourts.size}
                          </span>
                        )}
                      </button>
                    </>
                  )}

                {isFilterOpen && (
                    <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-neutral-200 z-10 overflow-hidden flex flex-col max-h-[60vh]">
                      <div className="p-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                        <span className="text-sm font-medium text-neutral-700">Filter by Court</span>
                        <button onClick={() => setIsFilterOpen(false)} className="p-1 hover:bg-neutral-200 rounded-md text-neutral-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="p-3 border-b border-neutral-100 flex items-center gap-2">
                        <button onClick={selectAll} className="flex-1 py-1.5 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md transition-colors">
                          Select All
                        </button>
                        <button onClick={clearAll} className="flex-1 py-1.5 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md transition-colors">
                          Clear All
                        </button>
                      </div>

                      <div className="overflow-y-auto p-2">
                        {otherCourts.length > 0 && (
                          <div className="space-y-0.5 mb-2">
                            {otherCourts.map(court => (
                              <div 
                                key={court}
                                className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded-md cursor-pointer group"
                                onClick={() => toggleCourt(court)}
                              >
                                {selectedCourts.has(court) ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-neutral-300 group-hover:text-neutral-400" />
                                )}
                                <span className="text-sm font-medium text-neutral-700">{court}</span>
                              </div>
                            ))}
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
                              <span className="text-sm font-semibold text-neutral-800">Basketball Courts</span>
                            </div>
                            <div className="ml-6 space-y-0.5 mt-1">
                              {bballCourts.map(court => (
                                <div 
                                  key={court}
                                  className="flex items-center gap-2 p-1.5 hover:bg-neutral-50 rounded-md cursor-pointer group"
                                  onClick={() => toggleCourt(court)}
                                >
                                  {selectedCourts.has(court) ? (
                                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-neutral-300 group-hover:text-neutral-400" />
                                  )}
                                  <span className="text-sm text-neutral-600">{court}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
            </div>
              
            <div className="flex-1 overflow-hidden flex flex-col">
              {results.length > 0 ? (
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
                          <td colSpan={6} className="px-5 py-12 text-center text-neutral-500">
                            No slots match the selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4 flex-1">
                    <div className="w-20 h-20 rounded-full bg-neutral-50 flex items-center justify-center">
                      <CalendarDays className="w-10 h-10 text-neutral-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-neutral-600 font-medium">No results yet</p>
                      <p className="text-sm mt-1">Upload JSON data and click process to see available slots.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>

      {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">Settings</h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <section className="space-y-4">
                  <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">SportsHouse API</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date</label>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">End Date</label>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Email / Username</label>
                    <input 
                      type="text" 
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="Enter your email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="Enter your password"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="rememberMe" className="text-sm text-neutral-700 cursor-pointer">
                      Remember credentials
                    </label>
                  </div>
                </section>

                <hr className="border-neutral-100" />

                <section className="space-y-4">
                  <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Telegram Notifications</h4>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Bot Token</label>
                    <input 
                      type="password" 
                      value={tgBotToken}
                      onChange={e => setTgBotToken(e.target.value)}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Chat ID</label>
                    <select 
                      value={tgChatId}
                      onChange={e => setTgChatId(e.target.value)}
                      className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      <option value="">Select a chat...</option>
                      <option value="-5037930746">Test chat (-5037930746)</option>
                      <option value="-1002692599988">Сильный Состав (-1002692599988)</option>
                      {tgChatId && tgChatId !== "-5037930746" && tgChatId !== "-1002692599988" && (
                        <option value={tgChatId}>Current: {tgChatId}</option>
                      )}
                    </select>
                  </div>
                </section>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveSettings}
                    className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-medium transition-colors"
                  >
                    Save & Close
                  </button>
                  <button
                    onClick={handleFetchFromSportsHouse}
                    disabled={!username || !password || isFetching}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Fetch Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {pollSlot && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-neutral-900">Create Poll</h3>
                  {isBulkPoll && (
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                      Multi-select
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setPollSlot(null)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Question</label>
                  <input 
                    type="text" 
                    value={pollQuestion}
                    onChange={e => setPollQuestion(e.target.value)}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Options</label>
                  <div className="space-y-2">
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input 
                          type="text" 
                          value={opt.text}
                          onChange={e => {
                            const newOpts = [...pollOptions];
                            newOpts[i] = { ...newOpts[i], text: e.target.value };
                            setPollOptions(newOpts);
                          }}
                          className="flex-1 p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        />
                        {pollOptions.length > 2 && (
                          <button 
                            onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {pollOptions.length < 10 && (
                    <button 
                      onClick={() => setPollOptions([...pollOptions, { text: '' }])}
                      className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      + Add Option
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSendPoll}
                  disabled={isSendingPoll || !pollQuestion.trim() || pollOptions.filter(o => o.text?.trim()).length < 2}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                >
                  {isSendingPoll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Poll to Telegram
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Poll Details Modal */}
      {selectedPollForDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-indigo-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900">Poll Details</h3>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Created {new Date(selectedPollForDetails.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPollForDetails(null)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0 && (
                <div className="mb-10 space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Sent Summaries & Payments</h3>
                  </div>
                  <div className="space-y-4">
                    {selectedPollForDetails.sentSummaries.map((summary, sIdx) => (
                      <div key={sIdx} className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase">
                            Sent {new Date(summary.timestamp).toLocaleString()}
                          </span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                            Live on Telegram
                          </span>
                        </div>
                        <div className="space-y-2">
                          {summary.users.map((user, uIdx) => (
                            <div key={uIdx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-neutral-100 shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.paid ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                                  {user.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-neutral-900 leading-tight">{user.name}</p>
                                  <p className="text-[10px] text-neutral-500">
                                    {user.username ? `@${user.username}` : 'No username'} • ${user.total.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => togglePaidStatus(selectedPollForDetails.id, sIdx, uIdx)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  user.paid 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm' 
                                    : 'bg-white text-neutral-400 border border-neutral-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                              >
                                {user.paid ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                {user.paid ? 'Paid' : 'Mark Paid'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPollForDetails.sentLineups && selectedPollForDetails.sentLineups.length > 0 && (
                <div className="mb-10 space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Sent Lineups</h3>
                  </div>
                  <div className="space-y-4">
                    {selectedPollForDetails.sentLineups.map((lineup, lIdx) => (
                      <div key={lIdx} className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase">
                            Sent {new Date(lineup.timestamp).toLocaleString()}
                          </span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                            Live on Telegram
                          </span>
                        </div>
                        {editingLineup?.index === lIdx ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingLineup.text}
                              onChange={(e) => setEditingLineup({ ...editingLineup, text: e.target.value })}
                              rows={8}
                              className="w-full p-3 text-sm font-mono bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingLineup(null)}
                                className="px-4 py-1.5 text-xs font-bold text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveEditedLineup}
                                disabled={isSavingLineup}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {isSavingLineup ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
                                Save & Update
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="p-3 bg-white border border-neutral-100 rounded-xl shadow-sm">
                              <pre className="text-xs font-mono text-neutral-700 whitespace-pre-wrap font-sans" dangerouslySetInnerHTML={{ __html: lineup.text.replace(/\n/g, '<br/>') }} />
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() => setEditingLineup({ index: lIdx, text: lineup.text })}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                              >
                                Edit Message
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-neutral-300 rounded-full" />
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Poll Details</h3>
                  </div>
                  <button 
                    onClick={() => setShowPollDetails(!showPollDetails)}
                    className="text-xs font-bold text-neutral-500 hover:text-neutral-700"
                  >
                    {showPollDetails ? 'Hide' : 'Show'}
                  </button>
                </div>

                {showPollDetails && (
                  <div className="space-y-6">
                    <p className="text-lg font-bold text-neutral-900 leading-tight">
                      {selectedPollForDetails.question}
                    </p>
                    {selectedPollForDetails.options.map((opt, idx) => {
                      const voters = (Object.values(selectedPollForDetails.voterAnswers || {}) as VoterInfo[])
                        .filter(v => v.optionIds.includes(idx))
                        .sort((a, b) => a.votedAt - b.votedAt);
                      
                      return (
                        <div key={idx} className="space-y-3">
                          <div className="flex justify-between items-end">
                            <span className="text-sm font-semibold text-neutral-800">{opt.text}</span>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {voters.length} votes
                            </span>
                          </div>
                          
                          <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 transition-all duration-500" 
                              style={{ width: `${selectedPollForDetails.totalVoterCount > 0 ? (voters.length / selectedPollForDetails.totalVoterCount) * 100 : 0}%` }}
                            />
                          </div>

                          {voters.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {voters.map((v, i) => (
                                <div 
                                  key={v.userId} 
                                  className={`text-[10px] border px-2 py-1 rounded-lg flex items-center gap-1 ${
                                    i < 12 
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                      : 'bg-neutral-50 border-neutral-200 text-neutral-500 opacity-75'
                                  }`}
                                >
                                  <span className="font-bold opacity-50">{i + 1}.</span>
                                  <span className="font-medium">{v.name}</span>
                                  {v.username && <span className="opacity-70">@{v.username}</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-neutral-400 italic">No votes yet</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => prepareLineups(selectedPollForDetails)}
                  disabled={isSendingLineup || !selectedPollForDetails.voterAnswers || (selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0)}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
                >
                  <CheckSquare className="w-4 h-4" />
                  {selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0 ? 'Lineups Sent' : 'Prepare Lineups'}
                </button>
                {!(selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0) && (
                  <label className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 hover:text-neutral-600 cursor-pointer transition-colors" title="Ignore 12 vote limit (Debug)">
                    <input 
                      type="checkbox" 
                      checked={ignoreVoteLimit}
                      onChange={(e) => setIgnoreVoteLimit(e.target.checked)}
                      className="w-3 h-3 text-indigo-600 rounded-sm border-neutral-300 focus:ring-indigo-500"
                    />
                    Debug
                  </label>
                )}
              </div>
              <button 
                onClick={() => setSelectedPollForDetails(null)}
                className="px-6 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lineup Preview Modal */}
      {lineupPreviews && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-emerald-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900">Review Lineups</h3>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Edit messages before sending to Telegram
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setLineupPreviews(null)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
              {lineupPreviews.map((preview, idx) => (
                <div key={idx} className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-tight">
                    Message {idx + 1}
                  </label>
                  <textarea
                    value={preview.text}
                    onChange={(e) => {
                      const next = [...lineupPreviews];
                      next[idx].text = e.target.value;
                      setLineupPreviews(next);
                    }}
                    rows={10}
                    className="w-full p-4 text-sm font-mono bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                  />
                  <p className="text-[10px] text-neutral-400 italic">
                    Note: HTML tags like &lt;b&gt; and &lt;a&gt; are supported.
                  </p>
                </div>
              ))}
            </div>

            <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-between items-center">
              <button 
                onClick={() => setLineupPreviews(null)}
                className="px-6 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-all shadow-sm"
              >
                Back to Details
              </button>
              <button 
                onClick={handleSendFinalLineups}
                disabled={isSendingLineup}
                className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50"
              >
                {isSendingLineup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send to Telegram
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
