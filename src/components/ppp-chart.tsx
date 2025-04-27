
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
import type { HistoricalEquivalentDataPoint } from '@/app/page'; // Updated type import

interface PPPChartProps {
  data: HistoricalEquivalentDataPoint[];
  currencySymbol?: string; // Add currency symbol prop
}

// Updated chart config for equivalent amount
const chartConfig = {
  equivalentAmount: {
    label: "Equivalent Amount", // Updated label
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function PPPChart({ data, currencySymbol = '' }: PPPChartProps) {
   // Determine a sensible domain for the Y-axis based on equivalent amounts
   const amounts = data.map(d => d.equivalentAmount);
   const minAmount = Math.min(...amounts);
   const maxAmount = Math.max(...amounts);
   // Add some padding to the domain
   const yDomainPadding = Math.max(1, (maxAmount - minAmount) * 0.1); // Ensure at least 1 unit padding
   const yDomain: [number, number] = [
      Math.max(0, minAmount - yDomainPadding), // Don't go below 0
      maxAmount + yDomainPadding
   ];

   // Formatter for the Y-axis and Tooltip
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
            right: 30, // Increased right margin for currency labels
            left: 20, // Increased left margin for currency labels
            bottom: 5,
          }}
          accessibilityLayer // Add accessibility layer
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            padding={{ left: 10, right: 10 }}
            aria-label="Year"
            interval="preserveStartEnd"
          />
          <YAxis
             tickLine={false}
             axisLine={false}
             tickMargin={8}
             tickFormatter={formatCurrency} // Use currency formatter
             domain={yDomain} // Set dynamic domain
             aria-label="Equivalent Purchasing Power Amount" // Updated aria-label
             padding={{ top: 10, bottom: 10 }}
             allowDataOverflow={false}
             width={80} // Allocate more width for currency labels
          />
          <ChartTooltip
            cursor={false}
            content={
               <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(label) => `Year: ${label}`}
                  formatter={(value, name, props) => {
                     const pointData = props.payload as HistoricalEquivalentDataPoint | undefined;
                     const label = pointData?.label || 'Equivalent Amount';
                     return [`${label}: ${formatCurrency(Number(value))}`, null]; // Format value as currency
                  }}
                   labelClassName="font-semibold"
                   className="shadow-lg rounded-md bg-background/90 backdrop-blur-sm"
               />
             }
          />
           <ChartLegend content={<ChartLegendContent />} />
          <Line
            dataKey="equivalentAmount" // Use the new data key
            type="monotone"
            stroke="var(--color-equivalentAmount)" // Use color from config
            strokeWidth={2}
            dot={false}
            name="Equivalent Amount" // Updated name for Legend/Tooltip
            aria-label={(payload) => payload ? `Equivalent amount in year ${payload.year} was ${formatCurrency(payload.equivalentAmount)}` : 'Equivalent amount trend'}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
