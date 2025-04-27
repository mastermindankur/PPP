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
const currencyDatabase: { [countryCode: string]: Omit<CurrencyData, 'countryCode'> } = {
  USA: { currencyName: 'US Dollar', currencySymbol: '$' },
  IND: { currencyName: 'Indian Rupee', currencySymbol: '₹' },
  EUR: { currencyName: 'Euro', currencySymbol: '€' }, // Represents Eurozone countries using the Euro
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

  const data = currencyDatabase[countryCode];

  if (!data) {
    console.warn(`Currency data not found for country code: ${countryCode}`);
    return null; // Indicate that no data was found.
  }

  return {
    countryCode,
    ...data,
  };
}
