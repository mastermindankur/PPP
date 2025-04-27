
"use client";

import type React from 'react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Keep Label if used elsewhere, otherwise remove
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getPPPData, getCountries } from '@/services/ppp-data';
import { getCurrencyData } from '@/services/currency-data';
import type { PPPData, CountryInfo } from '@/services/ppp-data';
import type { CurrencyData } from '@/services/currency-data';
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

const formSchema = z.object({
  // Use country *code* for the value
  country1: z.string().min(1, "Please select the first country."),
  country2: z.string().min(1, "Please select the second country."),
  amount: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().positive("Amount must be a positive number.")
  ),
  year: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    // Update year range based on actual data availability if known, keep dynamic for now
    z.number().int().min(1960, "Year must be 1960 or later.").max(new Date().getFullYear(), `Year cannot be in the future. Max year is ${new Date().getFullYear()}.`)
  ),
});

type FormData = z.infer<typeof formSchema>;

interface CalculationResult {
  equivalentAmount: number;
  currency1: CurrencyData;
  currency2: CurrencyData;
  country1Name: string;
  country2Name: string;
}

export default function Home() {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCountriesLoading, setIsCountriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryInfo[]>([]);

  useEffect(() => {
    async function fetchCountries() {
      setIsCountriesLoading(true);
      setCountriesError(null);
      try {
        const fetchedCountries = await getCountries();
        if (fetchedCountries.length === 0) {
          setCountriesError("Could not load country list. Please ensure 'ppp_data.xls' is available.");
        } else {
          setCountryOptions(fetchedCountries);
        }
      } catch (err) {
        console.error("Failed to fetch countries:", err);
        setCountriesError("Failed to load country list.");
      } finally {
        setIsCountriesLoading(false);
      }
    }
    fetchCountries();
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      country1: '', // Default to empty, user must select
      country2: '', // Default to empty, user must select
      amount: 100,
      year: 2022, // Default to a recent year, adjust if needed
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    if (values.country1 === values.country2) {
      setError("Please select two different countries.");
      setIsLoading(false);
      return;
    }

    try {
      // Fetch PPP data using country *codes*
      const [pppData1, pppData2, currencyData1, currencyData2] = await Promise.all([
        getPPPData(values.country1, values.year),
        getPPPData(values.country2, values.year),
        getCurrencyData(values.country1), // Assume getCurrencyData uses the code
        getCurrencyData(values.country2),
      ]);

      // Find country names from the fetched list
      const country1Info = countryOptions.find(c => c.code === values.country1);
      const country2Info = countryOptions.find(c => c.code === values.country2);

      if (!pppData1 || !pppData2) {
        setError(`PPP data not available for one or both selected countries/year combination (${values.year}). Please try a different year or ensure data exists.`);
        setIsLoading(false);
        return;
      }
      // Basic currency data check - enhance getCurrencyData if needed
      if (!currencyData1 || !currencyData2) {
         setError(`Currency data not available for one or both selected countries. Displaying result without symbols.`);
         // Allow calculation but log warning or handle default symbols
         console.warn(`Missing currency data for ${values.country1} or ${values.country2}`);
      }
       if (!country1Info || !country2Info) {
         setError(`Could not find country names for the selected codes.`);
         setIsLoading(false);
         return;
      }


      const pppRatio = pppData2.pppConversionFactor / pppData1.pppConversionFactor;
      const equivalentAmount = values.amount * pppRatio;

      setResult({
        equivalentAmount,
        // Use fetched currency data, provide defaults if missing
        currency1: currencyData1 ?? { countryCode: values.country1, currencyName: '', currencySymbol: '' },
        currency2: currencyData2 ?? { countryCode: values.country2, currencyName: '', currencySymbol: '' },
        country1Name: country1Info.name,
        country2Name: country2Info.name,
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
          {countriesError && (
            <p className="mb-4 text-center text-destructive font-medium">{countriesError}</p>
          )}
          {isCountriesLoading ? (
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
            </div>
          ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="country1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Country</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isCountriesLoading || !!countriesError}>
                        <FormControl>
                           <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select first country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countryOptions.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {/* Optional: Add flag later {country.flag} */} {country.name} ({country.code})
                            </SelectItem>
                          ))}
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
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isCountriesLoading || !!countriesError}>
                         <FormControl>
                           <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select second country" />
                           </SelectTrigger>
                         </FormControl>
                        <SelectContent>
                          {countryOptions.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                               {/* Optional: Add flag later {country.flag} */} {country.name} ({country.code})
                            </SelectItem>
                          ))}
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
                          <Input type="number" placeholder="Enter amount" {...field} step="any" className="bg-secondary focus:bg-background" />
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
                          <Input type="number" placeholder="Enter year (e.g., 2022)" {...field} min="1960" max={new Date().getFullYear()} className="bg-secondary focus:bg-background" />
                        </FormControl>
                         <FormMessage />
                         {/* Optional: Add description for data availability */}
                         {/* <FormDescription>PPP data availability varies by year.</FormDescription> */}
                      </FormItem>
                    )}
                 />
              </div>


              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading || isCountriesLoading || !!countriesError}>
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
                <span className="font-semibold">{result.currency1?.currencySymbol || ''}{form.getValues('amount').toLocaleString()}</span> in {result.country1Name} ({form.getValues('year')})
              </p>
              <p className="text-lg text-foreground mt-1">
                has the same purchasing power as
              </p>
              <p className="text-3xl font-bold text-accent mt-2">
                {result.currency2?.currencySymbol || ''}{result.equivalentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-lg text-foreground mt-1">
                in {result.country2Name} ({form.getValues('year')}).
              </p>
               {(!result.currency1?.currencySymbol || !result.currency2?.currencySymbol) && (
                   <p className="text-sm text-muted-foreground mt-2">(Currency symbols might be missing for some selections)</p>
               )}
            </div>
          )}
        </CardContent>
      </Card>
       <footer className="mt-8 text-center text-sm text-muted-foreground px-4">
         Data sourced from World Bank (Indicator: PA.NUS.PPP). Currency symbols are illustrative. PPP values may not be available for all country/year combinations in the demonstration data. For official use, consult the original World Bank data.
      </footer>
    </main>
  );
}
