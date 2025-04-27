
'use server';

import * as XLSX from 'xlsx';

/**
 * Represents Purchasing Power Parity (PPP) data for a specific country and year.
 */
export interface PPPData {
  /**
   * The country code (e.g., 'USA', 'IND').
   */
  countryCode: string;
  /**
   * The PPP conversion factor to USD. This represents the number of units
   * of the country's currency required to buy what $1 would buy in the U.S.
   */
  pppConversionFactor: number;
  /**
   * The year for which this PPP data is valid.
   */
  year: number;
}

/**
 * Represents basic country information including name and code.
 */
export interface CountryInfo {
    name: string;
    code: string;
    // Optional: Add flag if available/needed later
    // flag?: string;
}

/**
 * Represents a single data point for historical PPP data.
 */
export interface HistoricalDataPoint {
    year: number;
    pppConversionFactor: number;
}


// Cache to store parsed PPP data { year: { countryCode: pppValue } }
let pppDataCache: { [year: number]: { [countryCode: string]: number } } | null = null;
// Cache to store historical data per country { countryCode: [ {year, pppValue}, ... ] }
let historicalDataCache: { [countryCode: string]: HistoricalDataPoint[] } | null = null;
let countriesCache: CountryInfo[] | null = null;
let cachedLatestYear: number | null = null; // Cache for the latest year found
let isFetchingData = false; // Prevent concurrent fetches
let fetchPromise: Promise<void> | null = null; // Store the fetch promise

// Define the World Bank API URL
const worldBankApiUrl = 'https://api.worldbank.org/v2/en/indicator/PA.NUS.PPP?downloadformat=excel';

/**
 * Fetches and parses the World Bank PPP data, populating the cache.
 * This function handles concurrent requests and ensures data is fetched only once.
 * @returns A promise that resolves when the cache is populated or rejects on error.
 */
async function fetchAndCachePPPData(): Promise<void> {
    if (pppDataCache && countriesCache && cachedLatestYear !== null && historicalDataCache) {
        console.log("Data already cached.");
        return Promise.resolve(); // Already cached
    }

    if (isFetchingData && fetchPromise) {
         console.log("Data fetch already in progress, awaiting result...");
         return fetchPromise; // Return the existing promise
    }

    isFetchingData = true;
    console.log("Fetching PPP data from World Bank API...");

    fetchPromise = (async () => {
      try {
          const response = await fetch(worldBankApiUrl, { cache: 'force-cache' }); // Use caching
          if (!response.ok) {
              throw new Error(`Failed to fetch PPP data from World Bank (Status: ${response.status})`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

          // World Bank Excel usually names the data sheet like 'Data' or similar
          // Prioritize 'Data', then check common patterns
          let sheetName = '';
          let sheet = null;
          const potentialSheetNames = ['Data', 'Sheet1']; // Common names

          for (const name of potentialSheetNames) {
              if (workbook.SheetNames.includes(name)) {
                  sheetName = name;
                  sheet = workbook.Sheets[name];
                  break;
              }
          }

          // Fallback: try the first sheet if specific names aren't found
          if (!sheet && workbook.SheetNames.length > 0) {
               // Check if the first sheet *isn't* obviously metadata
               if (!workbook.SheetNames[0].toLowerCase().includes('metadata')) {
                 sheetName = workbook.SheetNames[0];
                 sheet = workbook.Sheets[sheetName];
               } else if (workbook.SheetNames.length > 1) {
                  // If first is metadata, try the second sheet
                  sheetName = workbook.SheetNames[1];
                  sheet = workbook.Sheets[sheetName];
               }
          }


          if (!sheet) {
              throw new Error(`Could not find a suitable data sheet in the downloaded Excel file. Sheets found: ${workbook.SheetNames.join(', ')}`);
          }
          console.log(`Using sheet: ${sheetName}`);

          // Convert sheet to JSON array of arrays
          const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }); // Ignore blank rows

           // Filter out potential metadata rows at the top if they exist (e.g., "Last Updated Date")
          const dataStartIndexRaw = jsonData.findIndex(row => Array.isArray(row) && row[0] === 'Country Name');
           if (dataStartIndexRaw === -1) {
               throw new Error("Could not find header row starting with 'Country Name' in the sheet.");
           }

          const headers = jsonData[dataStartIndexRaw];
          const dataStartIndex = dataStartIndexRaw + 1;

          // Find column indices
          const countryNameIndex = headers.findIndex(h => h === 'Country Name');
          const countryCodeIndex = headers.findIndex(h => h === 'Country Code');
          // Year columns: Find all columns that are 4-digit numbers starting from 1990
          const yearColumns = headers
              .map((h, index) => ({ header: String(h).trim(), index }))
              .filter(({ header }) => /^\d{4}$/.test(header) && parseInt(header, 10) >= 1990); // Filter years >= 1990

           if (countryNameIndex === -1 || countryCodeIndex === -1) {
                throw new Error('Could not find required columns (Country Name, Country Code) in header row.');
           }
           if (yearColumns.length === 0) {
               console.warn('No year columns found from 1990 onwards in the header row. Historical data might be limited.');
           }


          const years = yearColumns.map(yc => parseInt(yc.header, 10));
          const latestAvailableYear = Math.max(...years, 0); // Use 0 as default if no years found
          const yearIndicesMap = new Map(yearColumns.map(yc => [parseInt(yc.header, 10), yc.index]));

          const tempPppDataCache: { [year: number]: { [countryCode: string]: number } } = {};
          const tempHistoricalDataCache: { [countryCode: string]: HistoricalDataPoint[] } = {};
          const tempCountriesMap = new Map<string, CountryInfo>();
          const dataRows = jsonData.slice(dataStartIndex);

          dataRows.forEach((row) => {
              if (!row || row.length <= Math.max(countryNameIndex, countryCodeIndex)) return;

              const countryName = String(row[countryNameIndex]).trim();
              const countryCode = String(row[countryCodeIndex]).trim();

              // Basic validation
              if (countryName && countryCode && countryCode.length === 3) {
                  // Add to countries list (unique by code)
                  if (!tempCountriesMap.has(countryCode)) {
                      tempCountriesMap.set(countryCode, { name: countryName, code: countryCode });
                      tempHistoricalDataCache[countryCode] = []; // Initialize historical array
                  }

                  // Add PPP data to caches for all valid years >= 1990
                  years.forEach((year) => {
                      const yearIndex = yearIndicesMap.get(year);
                      if (yearIndex === undefined) return; // Should not happen

                      const pppValueRaw = row[yearIndex];
                      // World bank uses '..' for no data, check for numbers, exclude 0 if it's invalid
                      if (typeof pppValueRaw === 'number' && !isNaN(pppValueRaw) && pppValueRaw > 0) { // Ensure > 0
                          // Populate year-based cache
                          if (!tempPppDataCache[year]) {
                              tempPppDataCache[year] = {};
                          }
                          tempPppDataCache[year][countryCode] = pppValueRaw;

                          // Populate country-based historical cache
                          if (tempHistoricalDataCache[countryCode]) {
                              tempHistoricalDataCache[countryCode].push({ year: year, pppConversionFactor: pppValueRaw });
                          }
                      }
                  });
                   // Sort historical data for the country by year
                   if (tempHistoricalDataCache[countryCode]) {
                       tempHistoricalDataCache[countryCode].sort((a, b) => a.year - b.year);
                   }
              }
          });

          // Sort countries
          const uniqueCountries = Array.from(tempCountriesMap.values());
          uniqueCountries.sort((a, b) => a.name.localeCompare(b.name));

          // Commit to cache
          pppDataCache = tempPppDataCache;
          historicalDataCache = tempHistoricalDataCache;
          countriesCache = uniqueCountries;
          cachedLatestYear = latestAvailableYear > 0 ? latestAvailableYear : null; // Set to null if no valid years

          console.log(`Successfully fetched and cached data. ${uniqueCountries.length} countries found. Latest year with data >= 1990: ${cachedLatestYear}`);

      } catch (error) {
          console.error('Error fetching or processing World Bank PPP data:', error);
          // Reset cache on error to allow retry
          pppDataCache = null;
          historicalDataCache = null;
          countriesCache = null;
          cachedLatestYear = null;
          fetchPromise = null; // Reset promise on error
          throw error; // Re-throw to signal failure
      } finally {
          isFetchingData = false;
          // Keep fetchPromise reference until success or definitive failure handled by caller
      }
    })();

    return fetchPromise;

}


/**
 * Retrieves the list of countries from the cached data.
 * If the cache is empty, it triggers the data fetching process.
 *
 * @returns A promise that resolves to an array of CountryInfo objects. Returns empty array on failure.
 */
export async function getCountries(): Promise<CountryInfo[]> {
    if (!countriesCache) {
        try {
            await fetchAndCachePPPData();
        } catch (error) {
            console.error("Failed to populate country cache:", error);
            return []; // Return empty on failure
        }
    }
    return countriesCache || []; // Return cached data or empty if fetch failed
}

/**
 * Retrieves the latest year for which PPP data is available in the cache (since 1990).
 * If the cache is empty, it triggers the data fetching process.
 *
 * @returns A promise that resolves to the latest available year (number) or null if data cannot be loaded or no data >= 1990 exists.
 */
export async function getLatestAvailableYear(): Promise<number | null> {
    if (cachedLatestYear === null && !isFetchingData) { // Check isFetchingData to avoid infinite loop on initial load error
        try {
            await fetchAndCachePPPData();
        } catch (error) {
            console.error("Failed to determine latest available year:", error);
            return null; // Return null on failure
        }
    }
    return cachedLatestYear; // Return cached year or null if fetch failed/no data
}


/**
 * Asynchronously retrieves PPP data for a given country code and year from the cache.
 * Relies on `fetchAndCachePPPData` having been called successfully first to populate the cache.
 *
 * @param countryCode The 3-letter country code (e.g., 'USA', 'IND').
 * @param year The year for which to retrieve PPP data.
 * @returns A promise that resolves to PPPData or null if no data is found in the cache.
 */
export async function getPPPData(
  countryCode: string,
  year: number
): Promise<PPPData | null> {
    if (!pppDataCache) {
        console.warn("PPP data cache is not populated. Ensuring data is fetched first...");
         try {
            await fetchAndCachePPPData();
        } catch (error) {
            console.error("Failed to populate PPP cache before getting data:", error);
            return null; // Return null on failure
        }
        // If fetch succeeded, pppDataCache should now be populated
        if (!pppDataCache) {
            console.error("Cache population failed unexpectedly after fetch.");
            return null;
        }
    }

    const yearData = pppDataCache[year];
    if (!yearData) {
        // console.warn(`PPP data not found in cache for year: ${year}.`); // Less noisy log
        return null;
    }

    const pppFactor = yearData[countryCode];
    if (pppFactor === undefined) {
        // console.warn(`PPP data not found in cache for country code ${countryCode} in year ${year}.`); // Less noisy log
        return null;
    }

    // Validation happened during caching (pppFactor > 0)

    return {
        countryCode,
        pppConversionFactor: pppFactor,
        year,
    };
}


/**
 * Asynchronously retrieves all available historical PPP data points for a given country code from the cache.
 * Relies on `fetchAndCachePPPData` having been called successfully first to populate the cache.
 *
 * @param countryCode The 3-letter country code (e.g., 'USA', 'IND').
 * @returns A promise that resolves to an array of HistoricalDataPoint objects, or an empty array if no data is found.
 */
export async function getHistoricalPPPData(
    countryCode: string
): Promise<HistoricalDataPoint[]> {
    if (!historicalDataCache) {
         console.warn("Historical PPP data cache is not populated. Ensuring data is fetched first...");
         try {
             await fetchAndCachePPPData();
         } catch (error) {
             console.error("Failed to populate historical PPP cache before getting data:", error);
             return []; // Return empty on failure
         }
         if (!historicalDataCache) {
             console.error("Historical cache population failed unexpectedly after fetch.");
             return [];
         }
    }

    const countryHistory = historicalDataCache[countryCode];

    if (!countryHistory) {
        console.warn(`No historical PPP data found in cache for country code: ${countryCode}.`);
        return [];
    }

    return countryHistory; // Returns the cached (and sorted) array
}

    