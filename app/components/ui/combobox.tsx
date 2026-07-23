import { IconCheck, IconChevronDown, IconX } from "@tabler/icons-react";
import * as React from "react";

import { Badge } from "~/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export interface ComboboxOption {
  label: string;
  value: string;
}

interface ComboboxMultipleProps {
  options: Array<ComboboxOption>;
  value: Array<string>;
  onChange: (value: Array<string>) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function ComboboxMultiple({
  options,
  value,
  onChange,
  placeholder = "Select...",
  emptyText = "No results found.",
  disabled,
  className,
}: ComboboxMultipleProps) {
  const [open, setOpen] = React.useState(false);
  const selected = new Set(value);
  const selectedOptions = options.filter((o) => selected.has(o.value));

  function toggle(optionValue: string) {
    if (selected.has(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  function remove(optionValue: string) {
    onChange(value.filter((v) => v !== optionValue));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "shadow-xs flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <Badge key={option.value} variant="secondary" className="gap-1 rounded-sm font-normal">
                {option.label}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${option.label}`}
                  className="-mr-1 rounded-sm opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(option.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      remove(option.value);
                    }
                  }}
                >
                  <IconX className="size-3" />
                </span>
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <IconChevronDown className="ml-auto size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-9 py-1.5" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                    <IconCheck className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")} />
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
