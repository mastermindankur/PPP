

"use client";

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getPPPData, getCountries, getLatestAvailableYear, getHistoricalPPPData, getDataLastUpdatedTimestamp } from '@/services/ppp-data';
import { getCurrencyData } from '@/services/currency-data';
import type { PPPData, CountryInfo, HistoricalDataPoint } from '@/services/ppp-data';
import type { CurrencyData } from '@/services/currency-data';
import { Skeleton } from "@/components/ui/skeleton";
import PPPChart from '@/components/ppp-chart';
import { ArrowRightLeft } from 'lucide-react';
import { CountryCombobox } from '@/components/country-combobox';
import { Separator } from "@/components/ui/separator"; // Import Separator

// Define the base schema structure first
const baseFormSchema = z.object({
  country1: z.string().min(1, "Please select the first country."),
  country2: z.string().min(1, "Please select the second country."),
  amount: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().positive("Amount must be a positive number.")
  ),
  // Year validation will be added dynamically
});

// Type derived from the base schema
type BaseFormData = z.infer<typeof baseFormSchema>;

interface CalculationResult {
  equivalentAmount: number;
  currency1: CurrencyData | null;
  currency2: CurrencyData | null;
  country1Name: string;
  country2Name: string;
  year: number;
  baseAmount: number;
}

export type HistoricalEquivalentDataPoint = {
  year: number;
  equivalentAmount: number;
  label: string;
};


export default function Home() {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryInfo[]>([]);
  const [latestYear, setLatestYear] = useState<number | null>(null);
  const [formSchema, setFormSchema] = useState<z.ZodSchema<any> | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalEquivalentDataPoint[] | null>(null);
  const [isFetchingHistoricalData, setIsFetchingHistoricalData] = useState(false);
  const [dataTimestamp, setDataTimestamp] = useState<string | null>(null); // State for timestamp


  // UseEffect to fetch initial data (countries, latest year, and timestamp)
  useEffect(() => {
    async function fetchInitialData() {
      setIsInitialLoading(true);
      setDataLoadError(null);
      try {
        // Fetch all data concurrently
        const [fetchedCountries, fetchedLatestYear, fetchedTimestamp] = await Promise.all([
          getCountries(),
          getLatestAvailableYear(),
          getDataLastUpdatedTimestamp() // Fetch timestamp
        ]);

        // Set state after all fetches complete
        setCountryOptions(fetchedCountries);
        setLatestYear(fetchedLatestYear);
        setDataTimestamp(fetchedTimestamp); // Set timestamp state

        // Handle potential issues after setting state
        if (fetchedCountries.length === 0) {
          setDataLoadError("Could not load country list. Please check your connection or try again later.");
          console.warn("Country list is empty after fetching.");
        }
        if (fetchedLatestYear === null) {
           setDataLoadError((prevError) => prevError ? `${prevError} Could not determine the latest data year.` : "Could not determine the latest data year.");
           console.warn("Latest year could not be determined.");
        } else {
          // Dynamically create the full form schema only if latestYear is available
          const fullSchema = baseFormSchema.extend({
            year: z.preprocess(
              (val) => (val === "" ? undefined : Number(val)),
              z.number().int().min(1990, "Year must be 1990 or later.")
                .max(fetchedLatestYear, `Data only available up to ${fetchedLatestYear}.`)
            ),
          });
          setFormSchema(fullSchema);
        }

      } catch (err) {
        console.error("Failed to fetch initial data:", err);
        setDataLoadError("Failed to load required data. An error occurred. Please try refreshing the page.");
        // Ensure form schema is not set if data loading failed fundamentally
        setFormSchema(null);
      } finally {
        setIsInitialLoading(false);
      }
    }
    fetchInitialData();
  }, []); // Run only once on mount


  // Initialize the form
  const form = useForm<BaseFormData & { year?: number }>({
    resolver: formSchema ? zodResolver(formSchema) : undefined, // Resolver is set conditionally based on schema
    defaultValues: {
      country1: '',
      country2: '',
      amount: 100,
      // Default year will be set in the useEffect below once latestYear is known and schema is ready
    },
  });

   // Effect to update default year once latestYear is fetched and schema is set
   // Default to 2023 if available, otherwise use latestYear
   useEffect(() => {
     if (latestYear && formSchema && !form.getValues('year')) { // Only set if year isn't already set/modified by user
       const defaultYear = latestYear >= 2023 ? 2023 : latestYear;
       form.reset({
         ...form.getValues(), // Keep other values
         year: defaultYear, // Set default year
       }, { keepDefaultValues: true }); // Prevent overwriting existing values if they were set
     }
   }, [latestYear, formSchema, form]); // Depend on latestYear and formSchema


  async function onSubmit(values: BaseFormData & { year: number }) {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setHistoricalData(null);
    setIsFetchingHistoricalData(false);

    if (values.country1 === values.country2) {
      setError("Please select two different countries.");
      setIsLoading(false);
      return;
    }

    try {
      if (countryOptions.length === 0) {
         setError("Country data is not available. Please wait or refresh.");
         setIsLoading(false);
         return;
      }

      // Get country info directly from the fetched options (which came from the Excel)
      const country1Info = countryOptions.find(c => c.code === values.country1);
      const country2Info = countryOptions.find(c => c.code === values.country2);

       if (!country1Info || !country2Info) {
         setError(`Could not find country information for the selected codes.`);
         setIsLoading(false);
         return;
      }

      // Fetch PPP data and currency data (currency is still separate for symbols etc.)
      const [pppData1, pppData2, currencyData1, currencyData2] = await Promise.all([
        getPPPData(values.country1, values.year),
        getPPPData(values.country2, values.year),
        getCurrencyData(values.country1), // Currency data might still be useful for symbols
        getCurrencyData(values.country2),
      ]);

      if (!pppData1 || !pppData2) {
        setError(`PPP data not available for one or both selected countries/year combination (${country1Info.name}/${country2Info.name}, ${values.year}). Please try a different year or check data availability.`);
        setIsLoading(false);
        return;
      }

      // Use names from the CountryInfo objects obtained from the Excel data
      const country1Name = country1Info.name;
      const country2Name = country2Info.name;


      if (!currencyData1 || !currencyData2) {
         console.warn(`Currency data not available for ${country1Name} or ${country2Name}. Displaying result without symbols.`);
      }

      const pppRatio = pppData2.pppConversionFactor / pppData1.pppConversionFactor;
      const equivalentAmount = values.amount * pppRatio;

      const resultData = {
        equivalentAmount,
        currency1: currencyData1, // Keep for symbol
        currency2: currencyData2, // Keep for symbol
        country1Name: country1Name, // Use name from Excel
        country2Name: country2Name, // Use name from Excel
        year: values.year,
        baseAmount: values.amount,
      };
      setResult(resultData);

      // Fetch historical data after successful calculation
      // Pass the correct names sourced from the Excel file
      fetchHistorical(values.country1, values.country2, country1Name, country2Name, values.amount, currencyData1?.currencySymbol, currencyData2?.currencySymbol);

    } catch (err) {
      console.error("Calculation error:", err);
      setError("An error occurred during calculation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch historical data
  const fetchHistorical = useCallback(async (code1: string, code2: string, name1: string, name2: string, baseAmount: number, symbol1?: string, symbol2?: string) => {
    setIsFetchingHistoricalData(true);
    setHistoricalData(null);
    try {
      const [history1, history2] = await Promise.all([
        getHistoricalPPPData(code1),
        getHistoricalPPPData(code2),
      ]);

      const combinedData: HistoricalEquivalentDataPoint[] = [];
      const years = new Set([...history1.map(d => d.year), ...history2.map(d => d.year)]);

      years.forEach(year => {
        const ppp1 = history1.find(d => d.year === year)?.pppConversionFactor;
        const ppp2 = history2.find(d => d.year === year)?.pppConversionFactor;

        if (ppp1 && ppp2 && ppp1 > 0 && ppp2 > 0) {
          const pppRatio = ppp2 / ppp1;
          const equivalentAmount = baseAmount * pppRatio;
          const baseAmountString = `${symbol1 || ''}${baseAmount.toLocaleString()}`;
          const label = `Equivalent value of ${baseAmountString} (${name1}) in ${name2}`; // Use correct names

          combinedData.push({
            year: year,
            equivalentAmount: equivalentAmount,
            label: label
          });
        }
      });

      combinedData.sort((a, b) => a.year - b.year);

      if (combinedData.length > 0) {
        setHistoricalData(combinedData);
      } else {
         console.warn(`No common historical PPP data found for ${name1} and ${name2}.`); // Use correct names
      }

    } catch (error) {
      console.error("Failed to fetch or process historical PPP data:", error);
    } finally {
      setIsFetchingHistoricalData(false);
    }
  }, []); // Removed dependencies as it's called with explicit params

  // Function to handle swapping countries
  const handleSwapCountries = () => {
    const country1Value = form.getValues('country1');
    const country2Value = form.getValues('country2');

    if (country1Value || country2Value) { // Only swap if at least one is selected
      form.setValue('country1', country2Value, { shouldValidate: true });
      form.setValue('country2', country1Value, { shouldValidate: true });
      setResult(null); // Clear results
      setHistoricalData(null); // Clear historical data
      setError(null); // Clear errors
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-8 md:p-12 bg-background">
      <Card className="w-full max-w-2xl shadow-lg rounded-xl mt-8">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-3xl font-bold text-primary">Purchasing Power Parity Calculator</CardTitle>
          <CardDescription className="text-muted-foreground">
            Compare purchasing power across countries using World Bank data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dataLoadError && (
            <p className="mb-4 text-center text-destructive font-medium">{dataLoadError}</p>
          )}
          {isInitialLoading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                 <Skeleton className="h-10 flex-1" />
                 <Skeleton className="h-8 w-8" />
                 <Skeleton className="h-10 flex-1" />
              </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
               </div>
               <Skeleton className="h-10 w-full" />
               <p className="text-center text-muted-foreground">Loading initial data from World Bank...</p>
            </div>
          ) : formSchema ? ( // Render form only if schema is ready
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Country Selectors + Swap Button */}
              <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
                <FormField
                  control={form.control}
                  name="country1"
                  render={({ field }) => (
                    <FormItem className="flex-1 w-full">
                      <FormLabel>From Country</FormLabel>
                       <FormControl>
                         <CountryCombobox
                           options={countryOptions} // Use options fetched from Excel
                           value={field.value}
                           onChange={(value) => {
                             field.onChange(value);
                             setResult(null);
                             setHistoricalData(null);
                             setError(null);
                           }}
                           placeholder="Select first country"
                           disabled={countryOptions.length === 0 || !formSchema}
                           emptyMessage={countryOptions.length === 0 ? "No countries loaded" : "No country found."}
                           label="From Country" // Pass label
                         />
                       </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Swap Button */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleSwapCountries}
                    className="mt-2 md:mt-6 flex-shrink-0" // Adjust margin for alignment
                    aria-label="Swap countries"
                    disabled={countryOptions.length === 0 || !formSchema}
                >
                    <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                </Button>
                <FormField
                  control={form.control}
                  name="country2"
                  render={({ field }) => (
                    <FormItem className="flex-1 w-full">
                      <FormLabel>To Country</FormLabel>
                       <FormControl>
                          <CountryCombobox
                            options={countryOptions} // Use options fetched from Excel
                            value={field.value}
                            onChange={(value) => {
                               field.onChange(value);
                               setResult(null);
                               setHistoricalData(null);
                               setError(null);
                            }}
                            placeholder="Select second country"
                            disabled={countryOptions.length === 0 || !formSchema}
                            emptyMessage={countryOptions.length === 0 ? "No countries loaded" : "No country found."}
                            label="To Country" // Pass label
                          />
                       </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Amount and Year */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                         {/* Dynamically update label with symbol if available */}
                         <FormLabel>Amount ({form.watch('country1') ? (countryOptions.find(c => c.code === form.getValues('country1'))?.currencySymbol || '...') : '...'})</FormLabel>
                        <FormControl>
                          <Input
                             type="number"
                             placeholder="Enter amount"
                             step="any"
                             min="0.01"
                             className="bg-secondary focus:bg-background"
                             {...field}
                             value={field.value ?? ''}
                             onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                             disabled={!formSchema} // Disable if formSchema is not ready
                             />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                           <Input
                             type="number"
                             placeholder={`e.g., ${latestYear && latestYear >= 2023 ? 2023 : (latestYear || new Date().getFullYear())}`}
                             min="1990"
                             max={latestYear ?? new Date().getFullYear()}
                             step="1"
                             className="bg-secondary focus:bg-background"
                             {...field}
                             value={field.value ?? ''}
                             onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                              disabled={!formSchema} // Disable if formSchema is not ready
                             />
                        </FormControl>
                         <FormMessage />
                         <p className="text-xs text-muted-foreground pt-1">
                            Latest available data: {latestYear ? latestYear : 'Loading...'}
                         </p>
                      </FormItem>
                    )}
                 />
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading || isInitialLoading || countryOptions.length === 0 || !formSchema}>
                {isLoading ? 'Calculating...' : 'Calculate PPP'}
              </Button>
            </form>
          </Form>
          ) : (
              // Show a message or different loading state if form schema couldn't be created
              !isInitialLoading && <p className="text-center text-muted-foreground">Could not initialize form due to data loading issues.</p>
          )}

          {error && (
            <p className="mt-6 text-center text-destructive font-medium">{error}</p>
          )}

          {result && !isLoading && (
            <div className="mt-8 p-6 bg-accent/10 rounded-lg text-center border border-accent">
               <p className="text-lg text-foreground">
                  {/* Use symbol from currencyData if available, else empty */}
                 <span className="font-semibold">{result.currency1?.currencySymbol || ''}{result.baseAmount.toLocaleString()}</span> in {result.country1Name} ({result.year})
               </p>
               <p className="text-lg text-foreground mt-1">
                 has the same purchasing power as
               </p>
               <p className="text-3xl font-bold text-accent mt-2">
                  {/* Use symbol from currencyData if available, else empty */}
                 {result.currency2?.currencySymbol || ''}{result.equivalentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
               </p>
               <p className="text-lg text-foreground mt-1">
                 in {result.country2Name} ({result.year}).
               </p>
                {(!result.currency1?.currencySymbol || !result.currency2?.currencySymbol) && (
                    <p className="text-sm text-muted-foreground mt-2">(Currency symbols might be missing for some selections)</p>
                )}
             </div>
          )}

           {/* Historical Data Chart */}
           {result && !isLoading && (
             <div className="mt-8">
               <h3 className="text-xl font-semibold text-center mb-2">Historical Purchasing Power Equivalent</h3>
               <p className="text-sm text-muted-foreground text-center mb-4">
                 {/* Dynamically explain what the chart shows */}
                 Trend showing the equivalent value in {result.country2Name} ({result.currency2?.currencySymbol || ''})
                 for {result.currency1?.currencySymbol || ''}{result.baseAmount.toLocaleString()} from {result.country1Name} over the years.
               </p>
               {isFetchingHistoricalData ? (
                  <div className="flex justify-center items-center h-64">
                     <Skeleton className="h-full w-full" />
                     <p className="absolute text-muted-foreground">Loading historical data...</p>
                  </div>
               ) : historicalData && historicalData.length > 0 ? (
                  <PPPChart
                     data={historicalData}
                     currencySymbol={result?.currency2?.currencySymbol || ''} // Pass symbol from currencyData
                  />
               ) : historicalData && historicalData.length === 0 ? (
                 <p className="text-center text-muted-foreground p-4 border rounded-md">No common historical data found for the selected countries.</p>
               ) : !isFetchingHistoricalData && !historicalData ? (
                  <p className="text-center text-muted-foreground p-4 border rounded-md">Historical data comparison will appear here.</p>
               ) : null}
             </div>
           )}

        </CardContent>
      </Card>

       {/* PPP Explanation Accordion */}
       <Accordion type="single" collapsible className="w-full max-w-2xl mt-8">
         <AccordionItem value="item-1">
           <AccordionTrigger className="text-lg font-medium">What is Purchasing Power Parity (PPP)?</AccordionTrigger>
           <AccordionContent className="text-base text-muted-foreground space-y-3">
             <p>
               Purchasing Power Parity (PPP) is a way to compare the cost of living between countries.
               It shows how much money you would need in one country to buy the same goods and services
               you could buy for a certain amount in another country.
             </p>
             <p>
               Using this calculator, you can see if a product or lifestyle is cheaper or more expensive
               in a different country.
             </p>
             <p>
               To use the calculator, select the two countries you want to compare, enter the amount you are
               spending (or want to spend) in your home country, and the calculator will show you the
               equivalent amount needed in the other country based on their cost of living. This helps you
               plan your expenses better when traveling, working abroad, or making investment decisions.
             </p>
           </AccordionContent>
         </AccordionItem>
       </Accordion>

        {/* Footer Separator */}
       <Separator className="w-full max-w-2xl mt-8 mb-4" />

       <footer className="mb-8 text-center text-sm text-muted-foreground px-4 w-full max-w-2xl">
         Data sourced from World Bank (Indicator: PA.NUS.PPP).{' '}
         {/* Display data timestamp */}
         {dataTimestamp ? `${dataTimestamp}. ` : ''}
         Currency symbols are illustrative. PPP values may not be available for all country/year combinations. For official use, consult the original World Bank data.
         {/* Updated dynamic explanation for the chart */}
         {result && historicalData && historicalData.length > 0 && (
            <>
                {' '}The chart shows the historical equivalent value in {result?.country2Name || 'the second country'}'s currency for the amount entered in {result?.country1Name || 'the first country'}'s currency.
            </>
         )}
       </footer>
    </main>
  );
}
