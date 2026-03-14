import { useState } from 'react';
import { MergedSlot } from '../types';
import { processJsonData } from '../services/sportsHouseService';

export function useSportsHouse() {
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState('');
  const [results, setResults] = useState<MergedSlot[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      const processedResults = processJsonData(combinedJson);
      setResults(processedResults);
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
    setResults
  };
}
