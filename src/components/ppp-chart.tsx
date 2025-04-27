
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
import type { ChartDataPoint } from '@/app/page'; // Assuming the type is exported from page.tsx

interface PPPChartProps {
  data: ChartDataPoint[];
}

const chartConfig = {
  ratio: {
    label: "PPP Ratio",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function PPPChart({ data }: PPPChartProps) {
   // Determine a sensible domain for the Y-axis
   const ratios = data.map(d => d.ratio);
   const minRatio = Math.min(...ratios);
   const maxRatio = Math.max(...ratios);
   // Add some padding to the domain
   const yDomainPadding = Math.max(0.1, (maxRatio - minRatio) * 0.1); // Ensure at least 0.1 padding
   const yDomain: [number, number] = [
      Math.max(0, minRatio - yDomainPadding), // Don't go below 0
      maxRatio + yDomainPadding
   ];

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 20, // Increased right margin for labels
            left: 10, // Increased left margin for labels
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
            // tickFormatter={(value) => value.toString()} // Keep years as numbers
            padding={{ left: 10, right: 10 }} // Add padding to X-axis
            aria-label="Year"
             interval="preserveStartEnd" // Show first and last tick
              // Consider adding more ticks dynamically based on data range if needed
            // ticks={data.map(d => d.year).filter((y, i, arr) => i % Math.max(1, Math.floor(arr.length / 5)) === 0)} // Example: show every ~5th year
          />
          <YAxis
             tickLine={false}
             axisLine={false}
             tickMargin={8}
             tickFormatter={(value) => value.toFixed(2)} // Format ratio to 2 decimal places
             domain={yDomain} // Set dynamic domain
             aria-label="PPP Ratio (Country 2 / Country 1)"
             padding={{ top: 10, bottom: 10 }} // Add padding to Y-axis
             allowDataOverflow={false} // Prevent line going outside plot area
          />
          <ChartTooltip
            cursor={false} // Disable default cursor line
            content={
               <ChartTooltipContent
                  indicator="line" // Use a line indicator
                  labelFormatter={(label, payload) => `Year: ${label}`} // Show year in label
                  formatter={(value, name, props) => {
                     const label = props.payload?.label || 'Ratio'; // Get label from data or default
                     return [`${label}: ${Number(value).toFixed(4)}`, null]; // Show detailed ratio
                  }}
                   labelClassName="font-semibold"
                   className="shadow-lg rounded-md bg-background/90 backdrop-blur-sm" // Style tooltip
               />
             }
          />
           <ChartLegend content={<ChartLegendContent />} />
          <Line
            dataKey="ratio"
            type="monotone"
            stroke="var(--color-ratio)"
            strokeWidth={2}
            dot={false} // Hide dots on the line for cleaner look
            name="PPP Ratio" // Name for Legend/Tooltip
            aria-label={(payload) => `PPP Ratio in year ${payload?.year} was ${payload?.ratio.toFixed(4)}`}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

    