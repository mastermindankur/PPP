
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


// In a real application, this data would likely come directly from parsing
// the XLS/CSV file based on country code and year, or a more robust database.
// This hardcoded data is illustrative and limited.
// Ensure the country codes ('USA', 'IND', 'EUR') match those in the XLS file
// or create a mapping if they differ. The `getCountries` function now reads
// codes directly from the file.
const pppDatabase: { [year: number]: { [countryCode: string]: number } } = {
  2022: {
    USA: 1.0,    // United States
    IND: 23.5,   // India
    DEU: 0.85,   // Germany (Example for Eurozone - use specific codes if available)
    // Add more 2022 data based on codes from the XLS file...
  },
  2021: {
    USA: 1.0,
    IND: 22.0,
    DEU: 0.83,
     // Add more 2021 data...
  },
   2020: {
    USA: 1.0,
    IND: 21.0,
    DEU: 0.88,
     // Add more 2020 data...
  },
  // Add more years as needed
};


/**
 * Reads the ppp_data.xls file, extracts country names and codes from the 'Data' sheet,
 * and returns a unique, sorted list of country information objects.
 *
 * Assumes 'Country Name' is the first column and 'Country Code' is the second column
 * in the data rows (starting from the 5th row usually).
 *
 * @returns A promise that resolves to an array of unique CountryInfo objects, sorted by name.
 */
export async function getCountries(): Promise<CountryInfo[]> {
  try {
    const response = await fetch('/ppp_data.xls'); // Fetch from public folder
    if (!response.ok) {
        throw new Error(`Failed to fetch ppp_data.xls: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const sheetName = 'Data'; // Standard sheet name in World Bank downloads
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      console.error(`Sheet '${sheetName}' not found in ppp_data.xls`);
      return [];
    }

    // Convert sheet to JSON, assuming headers are in row 4 (index 3) and data starts row 5 (index 4)
    // header: 1 creates an array of arrays.
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Data usually starts around row 5 (index 4)
    const dataRows = jsonData.slice(4);

    const countriesMap = new Map<string, CountryInfo>();

    dataRows.forEach((row) => {
      const countryName = row[0]; // Assuming Country Name is in the first column (index 0)
      const countryCode = row[1]; // Assuming Country Code is in the second column (index 1)

      // Basic validation: ensure both name and code are valid strings and code is typically 3 letters
      if (typeof countryName === 'string' && countryName.trim() &&
          typeof countryCode === 'string' && countryCode.trim().length === 3) {
         // Use country code as the key to ensure uniqueness based on code
         if (!countriesMap.has(countryCode)) {
            countriesMap.set(countryCode, { name: countryName.trim(), code: countryCode.trim() });
         }
      }
    });

    const uniqueCountries = Array.from(countriesMap.values());

    // Sort countries alphabetically by name
    uniqueCountries.sort((a, b) => a.name.localeCompare(b.name));

    // console.log("Fetched Countries:", uniqueCountries.slice(0, 10)); // Log first 10 for verification

    return uniqueCountries;
  } catch (error) {
    console.error('Error reading or processing ppp_data.xls:', error);
    // Consider returning a more specific error or re-throwing
    return []; // Return empty array on error
  }
}


/**
 * Asynchronously retrieves PPP data for a given country code and year.
 * Uses the hardcoded `pppDatabase` for demonstration.
 *
 * @param countryCode The 3-letter country code (e.g., 'USA', 'IND').
 * @param year The year for which to retrieve PPP data.
 * @returns A promise that resolves to PPPData or null if no data is found in the hardcoded source.
 */
export async function getPPPData(
  countryCode: string,
  year: number
): Promise<PPPData | null> {
  // Simulate API call delay (optional)
  // await new Promise(resolve => setTimeout(resolve, 100));

  // --- Using Hardcoded Data ---
  const yearData = pppDatabase[year];
  if (!yearData) {
    console.warn(`PPP data not found for year: ${year} in hardcoded source.`);
    return null; // No data for the requested year
  }

  const pppFactor = yearData[countryCode];
  if (pppFactor === undefined) {
     console.warn(`PPP data not found for country code ${countryCode} in year ${year} in hardcoded source.`);
     // TODO: Implement fallback to read from XLS/CSV if needed
    return null; // No data for the requested country in that year
  }

  return {
    countryCode,
    pppConversionFactor: pppFactor,
    year,
  };
  // --- End Using Hardcoded Data ---

  /*
  // --- Alternative: Reading from XLS/CSV on demand (Less efficient) ---
  try {
    // Fetch and parse the Excel file (similar logic to getCountries)
    // Find the row matching countryCode
    // Find the column matching the year (requires parsing header row)
    // Extract the value
    // Return PPPData or null
  } catch (error) {
    console.error(`Error fetching PPP data for ${countryCode}, ${year}:`, error);
    return null;
  }
  */
}
