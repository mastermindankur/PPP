
'use server';

import * as XLSX from 'xlsx';

/**
 * Represents Purchasing Power Parity (PPP) data for a specific country.
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

// Cache to store parsed PPP data { year: { countryCode: pppValue } }
let pppDataCache: { [year: number]: { [countryCode: string]: number } } | null = null;
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
    if (pppDataCache && countriesCache && cachedLatestYear !== null) {
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
          // Year columns: Find all columns that are 4-digit numbers
          const yearColumns = headers
              .map((h, index) => ({ header: String(h).trim(), index }))
              .filter(({ header }) => /^\d{4}$/.test(header));

          if (countryNameIndex === -1 || countryCodeIndex === -1 || yearColumns.length === 0) {
               throw new Error('Could not find required columns (Country Name, Country Code, Year columns) in header row.');
          }

          const years = yearColumns.map(yc => parseInt(yc.header, 10));
          const latestAvailableYear = Math.max(...years);
          const yearIndicesMap = new Map(yearColumns.map(yc => [parseInt(yc.header, 10), yc.index]));

          const tempPppDataCache: { [year: number]: { [countryCode: string]: number } } = {};
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
                  }

                  // Add PPP data to cache for all valid years
                  years.forEach((year) => {
                      const yearIndex = yearIndicesMap.get(year);
                      if (yearIndex === undefined) return; // Should not happen

                      const pppValueRaw = row[yearIndex];
                      // World bank uses '..' for no data, check for numbers, exclude 0 if it's invalid
                      if (typeof pppValueRaw === 'number' && !isNaN(pppValueRaw) && pppValueRaw !== 0) {
                          if (!tempPppDataCache[year]) {
                              tempPppDataCache[year] = {};
                          }
                          tempPppDataCache[year][countryCode] = pppValueRaw;
                      }
                  });
              }
          });

          // Sort countries
          const uniqueCountries = Array.from(tempCountriesMap.values());
          uniqueCountries.sort((a, b) => a.name.localeCompare(b.name));

          // Commit to cache
          pppDataCache = tempPppDataCache;
          countriesCache = uniqueCountries;
          cachedLatestYear = latestAvailableYear; // Cache the latest year

          console.log(`Successfully fetched and cached data. ${uniqueCountries.length} countries found. Latest year: ${latestAvailableYear}`);

      } catch (error) {
          console.error('Error fetching or processing World Bank PPP data:', error);
          // Reset cache on error to allow retry
          pppDataCache = null;
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
 * Retrieves the latest year for which PPP data is available in the cache.
 * If the cache is empty, it triggers the data fetching process.
 *
 * @returns A promise that resolves to the latest available year (number) or null if data cannot be loaded.
 */
export async function getLatestAvailableYear(): Promise<number | null> {
    if (cachedLatestYear === null) {
        try {
            await fetchAndCachePPPData();
        } catch (error) {
            console.error("Failed to determine latest available year:", error);
            return null; // Return null on failure
        }
    }
    return cachedLatestYear; // Return cached year or null if fetch failed
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
        console.warn(`PPP data not found in cache for year: ${year}.`);
        return null;
    }

    const pppFactor = yearData[countryCode];
    if (pppFactor === undefined) {
        console.warn(`PPP data not found in cache for country code ${countryCode} in year ${year}.`);
        return null;
    }

    // Validate PPP factor (optional, basic check)
    if (typeof pppFactor !== 'number' || isNaN(pppFactor) || pppFactor <= 0) {
         console.warn(`Invalid PPP factor found for ${countryCode} in ${year}: ${pppFactor}`);
         return null;
    }


    return {
        countryCode,
        pppConversionFactor: pppFactor,
        year,
    };
}
