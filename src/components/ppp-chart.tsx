
"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Dot } from "recharts"

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

// Custom Dot component to make dots slightly larger and interactive
const CustomDot = (props: any) => {
  const { cx, cy, stroke, payload, value } = props;
  // You can add mouse events here if needed
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={4} // Slightly larger radius for visibility
      fill={stroke} // Use the line color
      stroke={stroke}
      strokeWidth={1}
    />
  );
};


export default function PPPChart({ data, currencySymbol = '' }: PPPChartProps) {
   // Determine a sensible domain for the Y-axis based on equivalent amounts
   const amounts = data.map(d => d.equivalentAmount);
   const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;
   const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 100; // Default max if no data
   // Add some padding to the domain, ensure it's reasonable
   const yDomainPadding = Math.max(5, Math.abs(maxAmount - minAmount) * 0.1); // Increased base padding
   const yDomain: [number, number] = [
      Math.max(0, Math.floor(minAmount - yDomainPadding)), // Floor to avoid overly precise start, don't go below 0
      Math.ceil(maxAmount + yDomainPadding) // Ceil for nice end point
   ];

   // Formatter for the Y-axis and Tooltip to show currency
   const formatCurrency = (value: number) => {
     // Format with currency symbol and locale-specific number formatting
     return `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
   };

    // Prepare ticks for X-axis to show all available years
    const yearTicks = data.map(d => d.year);
    // Removed interval calculation as we are angling labels

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full h-80"> {/* Increased height */}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 40, // Adjusted margins for potentially angled/longer labels
            left: 30,
            bottom: 25, // Increased bottom margin for angled labels
          }}
          accessibilityLayer // Add accessibility layer
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" /> {/* Lighter grid */}
          <XAxis
            dataKey="year" // X-axis represents the year
            type="number" // Treat year as a number
            domain={['dataMin', 'dataMax']} // Use data min/max for domain
            ticks={yearTicks} // Explicitly set ticks to all available years
            tickLine={false}
            axisLine={false}
            tickMargin={10} // Increased margin for angled labels
            padding={{ left: 15, right: 15 }} // Add padding
            aria-label="Year"
            tickFormatter={(value) => value.toString()} // Ensure year is displayed as string
            angle={-45} // Angle the labels to prevent overlap
            textAnchor="end" // Anchor angled labels correctly
            height={50} // Allocate more height for angled labels
            interval={0} // Try to show every tick specified in `ticks` array
          />
          <YAxis
             // Y-axis implicitly uses the 'equivalentAmount' from the Line component
             tickLine={false}
             axisLine={false}
             tickMargin={8}
             tickFormatter={formatCurrency} // Use currency formatter
             domain={yDomain} // Set dynamic domain based on calculated amounts
             aria-label="Equivalent Purchasing Power Amount" // Correct label for Y-axis
             padding={{ top: 15, bottom: 15 }} // Added more padding
             allowDataOverflow={false} // Prevent ticks outside the calculated domain
             width={95} // Allocate more width for potentially longer currency labels
             tickCount={8} // Suggest more ticks for better granularity (Recharts might adjust)
          />
          <ChartTooltip
            cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }} // Customize cursor
            content={
               <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(label) => `Year: ${label}`} // Show year in tooltip title
                  formatter={(value, name, props) => {
                     // value is the equivalentAmount, name is 'equivalentAmount' key
                     // props.payload contains the full data point { year, equivalentAmount, label }
                     const pointData = props.payload as HistoricalEquivalentDataPoint | undefined;
                     // Get the pre-formatted label from the data point
                     const descriptiveLabel = pointData?.label || 'Equivalent Amount';
                     // Format the currency value
                     const formattedValue = formatCurrency(Number(value));
                     // Get the year from the point data
                     const year = pointData?.year;
                     // Construct the final string including "in the year xx"
                     const displayString = year
                        ? `${descriptiveLabel}: ${formattedValue} in the year ${year}`
                        : `${descriptiveLabel}: ${formattedValue}`; // Fallback if year is missing

                     // Return array: [display string, label (optional, null here)]
                     // The Year is already shown by labelFormatter, so we just show the description and value.
                     return [displayString, null];
                  }}
                   labelClassName="font-bold text-foreground" // Make year bold
                   className="shadow-lg rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3" // Enhanced tooltip style
               />
             }
          />
           <ChartLegend content={<ChartLegendContent verticalAlign="top" align="center"/>} /> {/* Move legend to top */}
          <Line
            dataKey="equivalentAmount" // Y-axis value comes from this key in the data
            type="monotone"
            stroke="var(--color-equivalentAmount)" // Use color from config
            strokeWidth={2.5} // Slightly thicker line
            // dot={true} // Enable default dots
            dot={<CustomDot />} // Use custom dots for better visibility
            activeDot={{ r: 6, strokeWidth: 1, fill: 'hsl(var(--background))', stroke: 'hsl(var(--accent))' }} // Style for dot on hover
            name={chartConfig.equivalentAmount.label} // Use label from config for Legend
            aria-label={(payload) => payload ? `Equivalent amount in year ${payload.year} was ${formatCurrency(payload.equivalentAmount)}` : 'Equivalent amount trend over time'}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}


    