
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
          filter={(itemValue, search) => {
            // Customize filtering logic if needed, default is usually sufficient
            // Example: Ensure case-insensitive search on the combined name and code
            const lowerSearch = search.toLowerCase();
            const lowerItemValue = itemValue.toLowerCase();
            // Prioritize matches starting with the search term
            if (lowerItemValue.startsWith(lowerSearch)) {
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
                  value={`${option.name} ${option.code}`} // Value used for filtering/searching and passed to onSelect
                  onSelect={(currentValue) => {
                    // currentValue is the string from the 'value' prop of the selected CommandItem
                    const selected = options.find(opt => `${opt.name} ${opt.code}`.toLowerCase() === currentValue.toLowerCase());

                    if (selected) {
                      // Call onChange with the actual country code (e.g., 'USA')
                      // Toggle selection: if clicking the already selected item, deselect it (pass "")
                      onChange(selected.code === value ? "" : selected.code);
                    } else {
                       // Fallback if something goes wrong
                       onChange("");
                    }
                    // Close the popover after selection
                    setOpen(false);
                  }}
                  // Adding explicit onClick handler (though onSelect should handle this)
                  // This can sometimes help in complex component interactions.
                  // Remove if onSelect alone proves sufficient after testing.
                  // onClick={() => {
                  //   const currentValue = `${option.name} ${option.code}`;
                  //   const selected = options.find(opt => `${opt.name} ${opt.code}`.toLowerCase() === currentValue.toLowerCase());
                  //   if (selected) {
                  //     onChange(selected.code === value ? "" : selected.code);
                  //   } else {
                  //     onChange("");
                  //   }
                  //   setOpen(false);
                  // }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.name} ({option.code})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
