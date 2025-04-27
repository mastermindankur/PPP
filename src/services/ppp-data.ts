

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
 * Reads the ppp_data.xls file, dynamically identifies the data sheet, extracts country names
 * and codes, and returns a unique, sorted list of country information objects.
 *
 * Assumes 'Country Name' is the first column and 'Country Code' is the second column
 * in the data rows (starting from the 5th row usually).
 *
 * @returns A promise that resolves to an array of unique CountryInfo objects, sorted by name.
 */
export async function getCountries(): Promise<CountryInfo[]> {
  try {
    // Attempt to fetch the file from the public directory first.
    // If you intend to download directly from World Bank on the client-side,
    // be mindful of CORS issues. Fetching from `/public` is more reliable
    // if the file is placed there during build or setup.
    const response = await fetch('/ppp_data.xls');
    if (!response.ok) {
        // Consider adding a fallback or clearer error message here
        // e.g., if the file doesn't exist in /public
        throw new Error(`Failed to fetch ppp_data.xls (Status: ${response.status}). Ensure the file exists in the /public directory.`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

    // Dynamically find the data sheet name
    let sheetName = 'Data'; // Default guess
    let sheet;

    if (workbook.SheetNames.includes(sheetName)) {
        sheet = workbook.Sheets[sheetName];
    } else if (workbook.SheetNames.length > 1) {
        // Fallback: Assume the second sheet is the data sheet if 'Data' isn't found
        sheetName = workbook.SheetNames[1];
        sheet = workbook.Sheets[sheetName];
        console.warn(`Sheet 'Data' not found. Using the second sheet found: '${sheetName}'.`);
    } else if (workbook.SheetNames.length === 1) {
        // Fallback: Use the first sheet if only one exists
        sheetName = workbook.SheetNames[0];
        sheet = workbook.Sheets[sheetName];
         console.warn(`Sheet 'Data' not found and only one sheet exists. Using the first sheet found: '${sheetName}'.`);
    }


    if (!sheet) {
      // If still no sheet is found after fallbacks
      console.error(`Could not find a suitable data sheet in ppp_data.xls. Sheet names found: ${workbook.SheetNames.join(', ')}`);
      return []; // Return empty array or throw a more specific error
    }

    // Convert sheet to JSON, assuming headers are in row 4 (index 3) and data starts row 5 (index 4)
    // header: 1 creates an array of arrays.
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Data usually starts around row 5 (index 4) in World Bank files.
    // Find the actual start row by looking for 'Country Name' or 'Country Code' if necessary
    let dataStartIndex = 4; // Default assumption
    // Optional: Add logic here to find header row more robustly if needed

    const dataRows = jsonData.slice(dataStartIndex);

    const countriesMap = new Map<string, CountryInfo>();

    dataRows.forEach((row) => {
      // Gracefully handle rows that might not have enough columns
      if (!row || row.length < 2) return;

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

     if (uniqueCountries.length === 0) {
       console.warn("No valid country data extracted from the sheet. Check sheet format and data starting row.");
     }

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
  // TODO: Replace this with dynamic data loading from the XLS/CSV file for production use.
  // The hardcoded data below is just for initial UI testing.
  const yearData = pppDatabase[year];
  if (!yearData) {
    console.warn(`PPP data not found for year: ${year} in the hardcoded demonstration source.`);
    // TODO: Implement fallback to read from XLS/CSV here if needed
    return null; // No data for the requested year in hardcoded source
  }

  const pppFactor = yearData[countryCode];
  if (pppFactor === undefined) {
     console.warn(`PPP data not found for country code ${countryCode} in year ${year} in the hardcoded demonstration source.`);
     // TODO: Implement fallback to read from XLS/CSV here if needed
    return null; // No data for the requested country in that year in hardcoded source
  }

  return {
    countryCode,
    pppConversionFactor: pppFactor,
    year,
  };
  // --- End Using Hardcoded Data ---

  /*
  // --- Alternative: Reading from XLS/CSV on demand (Less efficient but dynamic) ---
  try {
    const response = await fetch('/ppp_data.xls');
    if (!response.ok) throw new Error(`Failed to fetch ppp_data.xls: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

    // Dynamically find the data sheet (similar logic to getCountries)
    let sheetName = 'Data';
    let sheet = workbook.Sheets[sheetName];
    if (!sheet && workbook.SheetNames.length > 1) {
        sheetName = workbook.SheetNames[1];
        sheet = workbook.Sheets[sheetName];
    } else if (!sheet && workbook.SheetNames.length === 1) {
       sheetName = workbook.SheetNames[0];
       sheet = workbook.Sheets[sheetName];
    }
     if (!sheet) throw new Error('Suitable data sheet not found.');

    // Convert sheet to JSON, find header row, find year column, find country row
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find the header row (usually row 4, index 3)
    const headerRowIndex = 3; // Adjust if needed
    const headers = jsonData[headerRowIndex];
    const yearColumnIndex = headers.findIndex(header => String(header).trim() === String(year).trim());

    if (yearColumnIndex === -1) {
        console.warn(`Year ${year} column not found in the sheet.`);
        return null;
    }

    // Find the row for the country code (usually starts row 5, index 4)
    const countryRow = jsonData.slice(4).find(row => row && row[1] === countryCode); // Assuming code is column 1

    if (!countryRow || countryRow.length <= yearColumnIndex) {
        console.warn(`Data row not found for country code ${countryCode}.`);
        return null;
    }

    const pppValue = countryRow[yearColumnIndex];

    // Validate the PPP value
    if (typeof pppValue !== 'number' || isNaN(pppValue)) {
       console.warn(`Invalid or missing PPP value found for ${countryCode}, ${year}. Value: ${pppValue}`);
       return null;
    }

    return {
        countryCode,
        pppConversionFactor: pppValue,
        year,
    };

  } catch (error) {
    console.error(`Error fetching/parsing PPP data for ${countryCode}, ${year}:`, error);
    return null;
  }
  */
}
