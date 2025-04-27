
"use client";

import type React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getPPPData } from '@/services/ppp-data';
import { getCurrencyData } from '@/services/currency-data';
import type { PPPData } from '@/services/ppp-data';
import type { CurrencyData } from '@/services/currency-data';

const formSchema = z.object({
  country1: z.string().min(1, "Please select the first country."),
  country2: z.string().min(1, "Please select the second country."),
  amount: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().positive("Amount must be a positive number.")
  ),
  year: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().int().min(2000, "Year must be 2000 or later.").max(new Date().getFullYear(), `Year cannot be in the future. Max year is ${new Date().getFullYear()}.`)
  ),
});

type FormData = z.infer<typeof formSchema>;

interface CalculationResult {
  equivalentAmount: number;
  currency1: CurrencyData;
  currency2: CurrencyData;
}

// Hardcoded country list for the dropdowns
const countries = [
  { code: 'USA', name: 'United States', flag: '🇺🇸' },
  { code: 'IND', name: 'India', flag: '🇮🇳' },
  { code: 'EUR', name: 'Eurozone', flag: '🇪🇺' }, // Placeholder for Eurozone
  // Add more countries as needed based on available data
];

export default function Home() {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      country1: '',
      country2: '',
      amount: 100,
      year: 2022, // Default to a year with available data
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const [pppData1, pppData2, currencyData1, currencyData2] = await Promise.all([
        getPPPData(values.country1, values.year),
        getPPPData(values.country2, values.year),
        getCurrencyData(values.country1),
        getCurrencyData(values.country2),
      ]);

      if (!pppData1 || !pppData2) {
        setError(`PPP data not available for the selected countries/year combination (${values.year}). Please try a different year or ensure data exists.`);
        setIsLoading(false);
        return;
      }
      if (!currencyData1 || !currencyData2) {
         setError(`Currency data not available for one or both selected countries.`);
         setIsLoading(false);
         return;
      }


      const pppRatio = pppData2.pppConversionFactor / pppData1.pppConversionFactor;
      const equivalentAmount = values.amount * pppRatio;

      setResult({
        equivalentAmount,
        currency1: currencyData1,
        currency2: currencyData2,
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
            Compare purchasing power across countries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="country1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Country</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                           <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select first country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countries.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.flag} {country.name}
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                         <FormControl>
                           <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select second country" />
                           </SelectTrigger>
                         </FormControl>
                        <SelectContent>
                          {countries.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.flag} {country.name}
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
                          <Input type="number" placeholder="Enter year (e.g., 2022)" {...field} min="2000" max={new Date().getFullYear()} className="bg-secondary focus:bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                 />
              </div>


              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
                {isLoading ? 'Calculating...' : 'Calculate PPP'}
              </Button>
            </form>
          </Form>

          {error && (
            <p className="mt-6 text-center text-destructive font-medium">{error}</p>
          )}

          {result && !isLoading && (
            <div className="mt-8 p-6 bg-accent/10 rounded-lg text-center border border-accent">
              <p className="text-lg text-foreground">
                <span className="font-semibold">{result.currency1.currencySymbol}{form.getValues('amount').toLocaleString()}</span> in {countries.find(c => c.code === form.getValues('country1'))?.name || form.getValues('country1')} ({form.getValues('year')})
              </p>
              <p className="text-lg text-foreground mt-1">
                has the same purchasing power as
              </p>
              <p className="text-3xl font-bold text-accent mt-2">
                {result.currency2.currencySymbol}{result.equivalentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-lg text-foreground mt-1">
                in {countries.find(c => c.code === form.getValues('country2'))?.name || form.getValues('country2')} ({form.getValues('year')}).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
       <footer className="mt-8 text-center text-sm text-muted-foreground">
        PPP Data is illustrative. Ensure you have accurate, up-to-date data for real-world use.
      </footer>
    </main>
  );
}
