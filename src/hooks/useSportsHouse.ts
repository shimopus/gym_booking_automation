import { useState } from 'react';
import { MergedSlot } from '../types';
import { processJsonData } from '../services/sportsHouseService';

export function useSportsHouse() {
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState('');
  const [results, setResults] = useState<MergedSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetchedRange, setFetchedRange] = useState<{start: string, end: string} | null>(null);

  const fetchFromSportsHouse = async (
    username: string, 
    password: string, 
    startDate: string, 
    endDate: string,
    rememberMe: boolean
  ) => {
    setIsFetching(true);
    setFetchProgress('Authenticating...');
    setError(null);
    
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

      setFetchProgress('Authentication successful. Fetching availability...');
      
      const startParam = encodeURIComponent(`${startDate} 00:00:00`);
      const endParam = encodeURIComponent(`${endDate} 23:59:59`);
      
      const fetchAllPages = async (initialUrl: string) => {
        let allData: any[] = [];
        let nextUrl: string | null = initialUrl;
        let pageCount = 0;

        while (nextUrl) {
          pageCount++;
          setFetchProgress(`Fetching page ${pageCount}...`);
          
          const response = await fetch(nextUrl, {
            headers: {
              'accept': 'application/vnd.api+json',
              'authorization': `Bearer ${accessToken}`,
              'x-requested-with': 'XMLHttpRequest'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status}`);
          }

          const json = await response.json();
          allData.push(json);
          
          const itemCount = json.data?.length || 0;
          console.log(`Page ${pageCount} fetched: ${itemCount} items`);

          // Check for next page - handle both string and object formats
          const next = json.links?.next;
          let rawNextUrl = typeof next === 'string' ? next : (next?.href || null);
          
          if (rawNextUrl) {
            // Ensure the URL is absolute and points to the correct domain
            if (rawNextUrl.startsWith('/')) {
              nextUrl = `https://apps.daysmartrecreation.com${rawNextUrl}`;
            } else if (rawNextUrl.startsWith('http://')) {
              nextUrl = rawNextUrl.replace('http://', 'https://');
            } else {
              nextUrl = rawNextUrl;
            }
            console.log(`Following next link: ${nextUrl}`);
          } else {
            nextUrl = null;
          }

          // Safety break to prevent infinite loops
          if (pageCount > 100) {
            console.warn('Reached maximum page limit (100)');
            break;
          }
        }
        return allData;
      };

      const url1 = `https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/resource-availabilities?cache[save]=false&page[size]=1000&include=resource.address%2Cresource.resourceType%2Cresource.facility.address%2Cresource.files%2Cfees.product.locations%2CbookingOption%2CbookingOptionAvailability&filter[is_available]=true&filter[resource_type_id]=14&filter[facility_id]=1&filter[start__gte]=${startParam}&filter[end__lte]=${endParam}&filter[and][or][0][and][start_time__lte]=23%3A59%3A59&filter[and][or][0][and][end_time__gte]=17%3A00%3A00&filter[day_of_week__in][]=2&filter[day_of_week__in][]=4&filter[day_of_week__in][]=8&filter[day_of_week__in][]=16&filter[day_of_week__in][]=32&filterRelations[fees.is_online]=true&filterRelations[fees.is_active]=true&fields[resource-availabilities]=id%2Cstart%2Cend%2Conline_type%2Crental_price%2Crental_price_non_resident%2Cresource%2Cfees%2CbookingOption%2CbookingOptionAvailability&fields[resource]=id%2Cname%2Cdesc%2Clat%2Clng%2Caddress%2CresourceType%2Cfacility%2Cfiles&fields[facilities]=id%2Cname%2Cemail%2Cphone%2Clat%2Clng%2Caddress&sort=start%2Cend&company=sportshouse`;
      
      const data1 = await fetchAllPages(url1);
      
      const url2 = url1.replace('filter[resource_type_id]=14', 'filter[resource_type_id]=17');
      const data2 = await fetchAllPages(url2);
      
      setFetchProgress('Processing data...');
      
      const combinedData = [...data1, ...data2];
      setFetchProgress('');
      const processedResults = processJsonData(combinedData);
      setResults(processedResults);
      setFetchedRange({ start: startDate, end: endDate });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data from SportsHouse.");
      return false;
    } finally {
      setIsFetching(false);
    }
  };

  return {
    isFetching,
    fetchProgress,
    results,
    error,
    setError,
    fetchFromSportsHouse,
    setResults,
    fetchedRange
  };
}
