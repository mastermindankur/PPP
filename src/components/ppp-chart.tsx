
"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { HistoricalEquivalentDataPoint } from '@/app/page'; // Use the correct type

interface PPPChartProps {
  data: HistoricalEquivalentDataPoint[];
  currencySymbol?: string; // Add currency symbol prop
}

// Updated chart config for equivalent amount
const chartConfig = {
  equivalentAmount: {
    label: "Equivalent Amount", // Updated label for legend/tooltip reference
    color: "hsl(var(--accent))", // Use accent color for the line
  },
} satisfies ChartConfig

export default function PPPChart({ data, currencySymbol = '' }: PPPChartProps) {
   // Determine a sensible domain for the Y-axis based on equivalent amounts
   const amounts = data.map(d => d.equivalentAmount);
   const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;
   const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 100; // Default max if no data
   // Add some padding to the domain, ensure it's reasonable
   const yDomainPadding = Math.max(1, Math.abs(maxAmount - minAmount) * 0.1);
   const yDomain: [number, number] = [
      Math.max(0, minAmount - yDomainPadding), // Don't go below 0
      maxAmount + yDomainPadding
   ];

   // Formatter for the Y-axis and Tooltip to show currency
   const formatCurrency = (value: number) => {
     return `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
   };

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 35, // Increased right margin for currency labels if needed
            left: 25, // Increased left margin for currency labels
            bottom: 5,
          }}
          accessibilityLayer // Add accessibility layer
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="year" // X-axis represents the year
            type="number" // Treat year as a number
            domain={['dataMin', 'dataMax']} // Use data min/max for domain
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            padding={{ left: 10, right: 10 }}
            aria-label="Year"
            tickFormatter={(value) => value.toString()} // Ensure year is displayed as string
             // Show all ticks if space allows, otherwise let recharts decide. minTickGap prevents overlap.
            interval={0}
            minTickGap={5} // Minimum gap between ticks to prevent overlap
            // Consider adding angle={-45} textAnchor="end" if labels still overlap horizontally
          />
          <YAxis
             // Y-axis implicitly uses the 'equivalentAmount' from the Line component
             tickLine={false}
             axisLine={false}
             tickMargin={8}
             tickFormatter={formatCurrency} // Use currency formatter
             domain={yDomain} // Set dynamic domain based on calculated amounts
             aria-label="Equivalent Purchasing Power Amount" // Correct label for Y-axis
             padding={{ top: 10, bottom: 10 }}
             allowDataOverflow={false} // Prevent ticks outside the calculated domain
             width={85} // Allocate more width for potentially longer currency labels
          />
          <ChartTooltip
            cursor={false}
            content={
               <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(label) => `Year: ${label}`} // Show year in tooltip title
                  formatter={(value, name, props) => {
                     // value is the equivalentAmount, name is 'equivalentAmount' key
                     // props.payload contains the full data point { year, equivalentAmount, label }
                     const pointData = props.payload as HistoricalEquivalentDataPoint | undefined;
                     const descriptiveLabel = pointData?.label || 'Equivalent Amount'; // Use the label from data if available
                     // Format the currency value
                     const formattedValue = formatCurrency(Number(value));
                     // Return array: [display string, label (optional, null here)]
                     // The Year is already shown by labelFormatter, so we just show the description and value.
                     return [`${descriptiveLabel}: ${formattedValue}`, null];
                  }}
                   labelClassName="font-semibold"
                   className="shadow-lg rounded-md bg-background/90 backdrop-blur-sm"
               />
             }
          />
           <ChartLegend content={<ChartLegendContent />} />
          <Line
            dataKey="equivalentAmount" // Y-axis value comes from this key in the data
            type="monotone"
            stroke="var(--color-equivalentAmount)" // Use color from config
            strokeWidth={2}
            dot={false}
            name={chartConfig.equivalentAmount.label} // Use label from config for Legend
            aria-label={(payload) => payload ? `Equivalent amount in year ${payload.year} was ${formatCurrency(payload.equivalentAmount)}` : 'Equivalent amount trend over time'}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
