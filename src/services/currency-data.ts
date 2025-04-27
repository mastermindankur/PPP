
/**
 * Represents currency data for a specific country or region.
 */
export interface CurrencyData {
  /**
   * The country or region code (e.g., 'USA', 'IND', 'EUR').
   */
  countryCode: string;
  /**
   * The name of the currency (e.g., 'US Dollar', 'Indian Rupee', 'Euro').
   */
  currencyName: string;
  /**
   * The symbol of the currency (e.g., '$', '₹', '€').
   */
  currencySymbol: string;
}

// In a real application, this might come from an API or a more comprehensive list.
// Added more common currencies based on likely World Bank data usage.
const currencyDatabase: { [countryCode: string]: Omit<CurrencyData, 'countryCode'> } = {
  USA: { currencyName: 'US Dollar', currencySymbol: '$' },
  IND: { currencyName: 'Indian Rupee', currencySymbol: '₹' },
  EUR: { currencyName: 'Euro', currencySymbol: '€' }, // Represents Eurozone countries using the Euro
  GBR: { currencyName: 'British Pound', currencySymbol: '£' },
  JPN: { currencyName: 'Japanese Yen', currencySymbol: '¥' },
  CAN: { currencyName: 'Canadian Dollar', currencySymbol: 'CA$' },
  AUD: { currencyName: 'Australian Dollar', currencySymbol: 'A$' },
  CHF: { currencyName: 'Swiss Franc', currencySymbol: 'CHF' },
  CNY: { currencyName: 'Chinese Yuan', currencySymbol: '¥' }, // Note: Same symbol as JPY sometimes
  INR: { currencyName: 'Indian Rupee', currencySymbol: '₹' }, // Alias for IND
  BRA: { currencyName: 'Brazilian Real', currencySymbol: 'R$' },
  RUS: { currencyName: 'Russian Ruble', currencySymbol: '₽' },
  ZAF: { currencyName: 'South African Rand', currencySymbol: 'R' },
  MEX: { currencyName: 'Mexican Peso', currencySymbol: 'Mex$' },
  SGP: { currencyName: 'Singapore Dollar', currencySymbol: 'S$' },
  KOR: { currencyName: 'South Korean Won', currencySymbol: '₩' },
  // Add more country/currency mappings as needed
};


/**
 * Asynchronously retrieves currency data for a given country code.
 *
 * @param countryCode The country or region code (e.g., 'USA', 'IND', 'EUR').
 * @returns A promise that resolves to CurrencyData or null if no data is found.
 */
export async function getCurrencyData(
  countryCode: string
): Promise<CurrencyData | null> {
  // Simulate API call delay (optional)
  // await new Promise(resolve => setTimeout(resolve, 100));

  // Handle Eurozone countries explicitly if needed, otherwise they might use 'EUR' code
  // Example: if countryCode is 'DEU' (Germany), map it to 'EUR'
  const effectiveCode = countryCode === 'DEU' || countryCode === 'FRA' || countryCode === 'ITA' || countryCode === 'ESP' ? 'EUR' : countryCode; // Add more Eurozone codes if necessary


  const data = currencyDatabase[effectiveCode];

  if (!data) {
    console.warn(`Currency data not found for country code: ${countryCode} (effective code: ${effectiveCode})`);
    // Attempt a fallback for common variations if needed (e.g., 'UK' -> 'GBR') - not implemented here for simplicity
    return null; // Indicate that no data was found.
  }

  return {
    countryCode: countryCode, // Return the original requested code
    ...data,
  };
}
