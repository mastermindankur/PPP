

"use client";

import type React from 'react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getPPPData, getCountries, getLatestAvailableYear } from '@/services/ppp-data'; // Added getLatestAvailableYear
import { getCurrencyData } from '@/services/currency-data';
import type { PPPData, CountryInfo } from '@/services/ppp-data';
import type { CurrencyData } from '@/services/currency-data';
import { Skeleton } from "@/components/ui/skeleton";

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
  year: number; // Add year to result
}

export default function Home() {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Combined loading state
  const [error, setError] = useState<string | null>(null);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryInfo[]>([]);
  const [latestYear, setLatestYear] = useState<number | null>(null);
  const [formSchema, setFormSchema] = useState<z.ZodSchema<any> | null>(null); // State for the dynamic schema

  // UseEffect to fetch initial data (countries and latest year)
  useEffect(() => {
    async function fetchInitialData() {
      setIsInitialLoading(true);
      setDataLoadError(null);
      try {
        // Fetch countries and latest year concurrently
        const [fetchedCountries, fetchedLatestYear] = await Promise.all([
          getCountries(),
          getLatestAvailableYear()
        ]);

        setCountryOptions(fetchedCountries);
        setLatestYear(fetchedLatestYear);

        if (fetchedCountries.length === 0) {
          setDataLoadError("Could not load country list. Please check your connection or try again later.");
          console.warn("Country list is empty after fetching.");
        }
        if (fetchedLatestYear === null) {
           setDataLoadError((prevError) => prevError ? `${prevError} Could not determine the latest data year.` : "Could not determine the latest data year.");
           console.warn("Latest year could not be determined.");
        } else {
          // Dynamically create the full form schema once the latest year is known
          const fullSchema = baseFormSchema.extend({
            year: z.preprocess(
              (val) => (val === "" ? undefined : Number(val)),
              z.number().int().min(1960, "Year must be 1960 or later.")
                .max(fetchedLatestYear, `Data only available up to ${fetchedLatestYear}.`)
            ),
          });
          setFormSchema(fullSchema);
        }

      } catch (err) {
        console.error("Failed to fetch initial data:", err);
        setDataLoadError("Failed to load required data. An error occurred.");
      } finally {
        setIsInitialLoading(false);
      }
    }
    fetchInitialData();
  }, []); // Run only once on mount

  // Initialize the form - Re-initialize when schema is ready
  const form = useForm<BaseFormData & { year?: number }>({ // Add optional year initially
    resolver: formSchema ? zodResolver(formSchema) : undefined, // Use dynamic schema when available
    defaultValues: {
      country1: '',
      country2: '',
      amount: 100,
      // Default year will be set once latestYear is fetched
    },
  });

   // Effect to update default year once latestYear is fetched and schema is set
   useEffect(() => {
     if (latestYear && formSchema) {
       form.reset({
         ...form.getValues(), // Keep other values
         year: latestYear, // Set default year
       });
     }
   }, [latestYear, formSchema, form]); // Depend on latestYear and formSchema


  async function onSubmit(values: BaseFormData & { year: number }) { // Year is now required
    setIsLoading(true);
    setError(null);
    setResult(null);

    if (values.country1 === values.country2) {
      setError("Please select two different countries.");
      setIsLoading(false);
      return;
    }

    try {
      // Ensure country options are loaded
      if (countryOptions.length === 0) {
         setError("Country data is not available. Please wait or refresh.");
         setIsLoading(false);
         return;
      }

      // Fetch PPP data using country *codes*
      const [pppData1, pppData2, currencyData1, currencyData2] = await Promise.all([
        getPPPData(values.country1, values.year),
        getPPPData(values.country2, values.year),
        getCurrencyData(values.country1),
        getCurrencyData(values.country2),
      ]);

      // Find country names from the fetched list
      const country1Info = countryOptions.find(c => c.code === values.country1);
      const country2Info = countryOptions.find(c => c.code === values.country2);

       if (!country1Info || !country2Info) {
         setError(`Could not find country information for the selected codes.`);
         setIsLoading(false);
         return;
      }


      if (!pppData1 || !pppData2) {
        setError(`PPP data not available for one or both selected countries/year combination (${values.country1}/${values.country2}, ${values.year}). Please try a different year or check data availability.`);
        setIsLoading(false);
        return;
      }

      if (!currencyData1 || !currencyData2) {
         console.warn(`Currency data not available for ${values.country1} or ${values.country2}. Displaying result without symbols.`);
      }

      const pppRatio = pppData2.pppConversionFactor / pppData1.pppConversionFactor;
      const equivalentAmount = values.amount * pppRatio;

      setResult({
        equivalentAmount,
        currency1: currencyData1,
        currency2: currencyData2,
        country1Name: country1Info.name,
        country2Name: country2Info.name,
        year: values.year, // Include year in the result
      });

    } catch (err) {
      console.error("Calculation error:", err);
      setError("An error occurred during calculation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 md:p-12 bg-background">
      <Card className="w-full max-w-2xl shadow-lg rounded-xl">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-3xl font-bold text-primary">PPP Compare</CardTitle>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
              </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
               </div>
               <Skeleton className="h-10 w-full" />
               <p className="text-center text-muted-foreground">Loading initial data from World Bank...</p>
            </div>
          ) : formSchema && ( // Only render form when schema is ready
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="country1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Country</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value} // Use value for controlled component
                        disabled={countryOptions.length === 0}
                       >
                        <FormControl>
                           <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select first country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countryOptions.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.name} ({country.code})
                            </SelectItem>
                          ))}
                           {countryOptions.length === 0 && (
                              <SelectItem value="loading" disabled>No countries loaded</SelectItem>
                           )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Country</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value} // Use value for controlled component
                        disabled={countryOptions.length === 0}
                        >
                         <FormControl>
                           <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select second country" />
                           </SelectTrigger>
                         </FormControl>
                        <SelectContent>
                          {countryOptions.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                               {country.name} ({country.code})
                            </SelectItem>
                          ))}
                           {countryOptions.length === 0 && (
                              <SelectItem value="loading" disabled>No countries loaded</SelectItem>
                           )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                           {/* Ensure value is handled correctly for number input */}
                          <Input
                             type="number"
                             placeholder="Enter amount"
                             step="any"
                             className="bg-secondary focus:bg-background"
                             {...field}
                             value={field.value ?? ''} // Handle potential undefined/null
                             onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
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
                           {/* Ensure value is handled correctly for number input */}
                           <Input
                             type="number"
                             placeholder={`e.g., ${latestYear || new Date().getFullYear()}`}
                             min="1960"
                             max={latestYear ?? new Date().getFullYear()} // Use dynamic max year
                             className="bg-secondary focus:bg-background"
                             {...field}
                             value={field.value ?? ''} // Handle potential undefined/null
                             onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
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


              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading || isInitialLoading || countryOptions.length === 0}>
                {isLoading ? 'Calculating...' : 'Calculate PPP'}
              </Button>
            </form>
          </Form>
          )}

          {error && (
            <p className="mt-6 text-center text-destructive font-medium">{error}</p>
          )}

          {result && !isLoading && (
            <div className="mt-8 p-6 bg-accent/10 rounded-lg text-center border border-accent">
              <p className="text-lg text-foreground">
                <span className="font-semibold">{result.currency1?.currencySymbol || ''}{form.getValues('amount').toLocaleString()}</span> in {result.country1Name} ({result.year})
              </p>
              <p className="text-lg text-foreground mt-1">
                has the same purchasing power as
              </p>
              <p className="text-3xl font-bold text-accent mt-2">
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
        </CardContent>
      </Card>
       <footer className="mt-8 text-center text-sm text-muted-foreground px-4">
         Data sourced from World Bank (Indicator: PA.NUS.PPP). Currency symbols are illustrative. PPP values may not be available for all country/year combinations. For official use, consult the original World Bank data.
      </footer>
    </main>
  );
}
