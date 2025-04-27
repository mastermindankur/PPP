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

// In a real application, this data would likely come from an API (e.g., World Bank, IMF)
// or a regularly updated database/file.
const pppDatabase: { [year: number]: { [countryCode: string]: number } } = {
  2022: {
    USA: 1.0,    // Base currency (USD)
    IND: 23.5,   // Example: 23.5 INR has the same purchasing power as 1 USD in 2022
    EUR: 0.85,   // Example: 0.85 EUR has the same purchasing power as 1 USD in 2022 (Eurozone average)
    // Add more 2022 data...
  },
  2021: {
    USA: 1.0,
    IND: 22.0,
    EUR: 0.83,
     // Add more 2021 data...
  },
   2020: {
    USA: 1.0,
    IND: 21.0,
    EUR: 0.88,
     // Add more 2020 data...
  },
  // Add more years as needed
};


/**
 * Asynchronously retrieves PPP data for a given country and year.
 *
 * @param countryCode The country code to retrieve PPP data for.
 * @param year The year for which to retrieve PPP data.
 * @returns A promise that resolves to PPPData or null if no data is found.
 */
export async function getPPPData(
  countryCode: string,
  year: number
): Promise<PPPData | null> {
  // Simulate API call delay (optional)
  // await new Promise(resolve => setTimeout(resolve, 100));

  const yearData = pppDatabase[year];
  if (!yearData) {
    console.warn(`PPP data not found for year: ${year}`);
    return null; // No data for the requested year
  }

  const pppFactor = yearData[countryCode];
  if (pppFactor === undefined) {
     console.warn(`PPP data not found for country ${countryCode} in year ${year}`);
    return null; // No data for the requested country in that year
  }

  return {
    countryCode,
    pppConversionFactor: pppFactor,
    year,
  };
}
