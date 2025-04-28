
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CountryInfo } from '@/services/ppp-data'; // Import the type

interface CountryComboboxProps {
  options: CountryInfo[];
  value?: string; // Current value (country code)
  onChange: (value: string) => void; // Callback when value changes
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  label?: string; // Optional label for aria-label
}

export function CountryCombobox({
  options,
  value,
  onChange,
  placeholder = "Select country...",
  emptyMessage = "No country found.",
  disabled = false,
  className,
  label = "Country", // Default label
}: CountryComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find(
    (option) => option.code.toLowerCase() === value?.toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-sm", !value && "text-muted-foreground", className)}
          disabled={disabled}
          aria-label={`Select ${label}`} // More specific aria-label
        >
          {selectedOption
            ? `${selectedOption.name} (${selectedOption.code})`
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
        <Command
          shouldFilter={true} // Enable default filtering
          aria-label={`Search for ${label}`} // Add aria-label for Command
          // Use a simple filter based on name and code inclusion
          filter={(itemValue, search) => {
             const lowerSearch = search.toLowerCase();
             const lowerItemValue = itemValue.toLowerCase();
             // Prioritize matches starting with the search term in name or code
             const name = options.find(opt => `${opt.name} ${opt.code}`.toLowerCase() === lowerItemValue)?.name.toLowerCase() || '';
             const code = options.find(opt => `${opt.name} ${opt.code}`.toLowerCase() === lowerItemValue)?.code.toLowerCase() || '';

             if (name.startsWith(lowerSearch) || code.startsWith(lowerSearch)) {
                return 1;
             }
             // Then allow any inclusion
             return lowerItemValue.includes(lowerSearch) ? 0.5 : 0;
          }}
        >
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.code}
                  // Value used for filtering/searching should represent the item uniquely and contain searchable text
                  value={`${option.name} (${option.code})`} // Combine name and code for searching
                   // onSelect is triggered by BOTH keyboard (Enter) and mouse click in cmdk
                  onSelect={() => {
                     // Call the passed onChange function with the selected country code
                     onChange(option.code);
                     // Close the popover after selection
                     setOpen(false);
                  }}
                  // Apply pointer cursor to indicate clickability
                  className="cursor-pointer text-sm" // Added text-sm for consistency
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      // Check if the current option's code matches the selected value
                      value?.toLowerCase() === option.code.toLowerCase() ? "opacity-100" : "opacity-0"
                    )}
                  />
                   {/* Display name and code */}
                  <span>{option.name} ({option.code})</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
