
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
let isFetchingData = false; // Prevent concurrent fetches

// Define the World Bank API URL
const worldBankApiUrl = 'https://api.worldbank.org/v2/en/indicator/PA.NUS.PPP?downloadformat=excel';

/**
 * Fetches and parses the World Bank PPP data, populating the cache.
 * This function is intended to be called once.
 * @returns A promise that resolves when the cache is populated or rejects on error.
 */
async function fetchAndCachePPPData(): Promise<void> {
    if (pppDataCache && countriesCache) {
        console.log("Data already cached.");
        return; // Already cached
    }
    if (isFetchingData) {
         console.log("Data fetch already in progress.");
         // Simple wait mechanism if needed, or rely on the first call completing
         // For now, just return to avoid concurrent fetches, the first caller handles it.
         return;
    }

    isFetchingData = true;
    console.log("Fetching PPP data from World Bank API...");

    try {
        const response = await fetch(worldBankApiUrl, { cache: 'force-cache' }); // Use caching
        if (!response.ok) {
            throw new Error(`Failed to fetch PPP data from World Bank (Status: ${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

        // World Bank Excel usually names the data sheet like 'Data' or similar, often the second sheet
        let sheetName = workbook.SheetNames[0]; // Start with the first sheet
        let sheet = workbook.Sheets[sheetName];

        // Attempt to find a sheet named 'Data', otherwise use the likely data sheet (often index 1 if Metadata is first)
        if (workbook.SheetNames.includes('Data')) {
            sheetName = 'Data';
            sheet = workbook.Sheets[sheetName];
        } else if (workbook.SheetNames.length > 1 && !workbook.SheetNames[0].toLowerCase().includes('metadata')) {
             // If first sheet isn't metadata, it might be the data
             sheetName = workbook.SheetNames[0];
             sheet = workbook.Sheets[sheetName];
        } else if (workbook.SheetNames.length > 1) {
            // Often the second sheet is the data
            sheetName = workbook.SheetNames[1];
            sheet = workbook.Sheets[sheetName];
        }


        if (!sheet) {
            throw new Error(`Could not find a suitable data sheet in the downloaded Excel file. Sheets found: ${workbook.SheetNames.join(', ')}`);
        }
         console.log(`Using sheet: ${sheetName}`);

        // Convert sheet to JSON array of arrays
        const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Find the header row (usually row 4, index 3) - look for 'Country Name'
        let headerRowIndex = -1;
        for(let i = 0; i < Math.min(10, jsonData.length); i++) { // Check first 10 rows
            if (jsonData[i]?.[0] === 'Country Name') {
                headerRowIndex = i;
                break;
            }
        }
        if (headerRowIndex === -1) {
             throw new Error("Could not find header row ('Country Name') in the sheet.");
        }

        const headers = jsonData[headerRowIndex];
        const dataStartIndex = headerRowIndex + 1;

        // Find column indices
        const countryNameIndex = headers.findIndex(h => h === 'Country Name');
        const countryCodeIndex = headers.findIndex(h => h === 'Country Code');
        // Year columns usually start after 'Indicator Name' and 'Indicator Code'
        const firstYearIndex = headers.findIndex(h => /^\d{4}$/.test(String(h).trim())); // Find first column that looks like a year

        if (countryNameIndex === -1 || countryCodeIndex === -1 || firstYearIndex === -1) {
             throw new Error('Could not find required columns (Country Name, Country Code, Year columns) in header row.');
        }

        const years = headers.slice(firstYearIndex).map(h => parseInt(String(h).trim(), 10)).filter(y => !isNaN(y));
        const yearIndices = years.map(y => headers.indexOf(String(y))); // Get exact indices for found years

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

                // Add PPP data to cache
                years.forEach((year, i) => {
                    const yearIndex = yearIndices[i];
                    const pppValueRaw = row[yearIndex];
                    // World bank uses '..' for no data, check for numbers
                    if (typeof pppValueRaw === 'number' && !isNaN(pppValueRaw)) {
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

        console.log(`Successfully fetched and cached data. ${uniqueCountries.length} countries found.`);
        // console.log("Years found:", years);
        // console.log("Sample Cache (2022, USA):", pppDataCache?.[2022]?.['USA']);


    } catch (error) {
        console.error('Error fetching or processing World Bank PPP data:', error);
        // Reset cache on error to allow retry
        pppDataCache = null;
        countriesCache = null;
        throw error; // Re-throw to signal failure
    } finally {
        isFetchingData = false;
    }
}


/**
 * Retrieves the list of countries from the cached data.
 * If the cache is empty, it triggers the data fetching process.
 *
 * @returns A promise that resolves to an array of CountryInfo objects.
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
 * Asynchronously retrieves PPP data for a given country code and year from the cache.
 * Relies on `getCountries` having been called successfully first to populate the cache.
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
        console.warn("PPP data cache is not populated. Fetching data first...");
         try {
            await fetchAndCachePPPData();
        } catch (error) {
            console.error("Failed to populate PPP cache:", error);
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

    return {
        countryCode,
        pppConversionFactor: pppFactor,
        year,
    };
}
