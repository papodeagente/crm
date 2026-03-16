import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "react-day-picker/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  /** Value in YYYY-MM-DD format (or MM-DD for monthDay mode) */
  value?: string;
  /** Callback with value in YYYY-MM-DD format (or MM-DD for monthDay mode) */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional className for the trigger button */
  className?: string;
  /** If true, only month and day are used (MM-DD format) — for birthDate/weddingDate */
  monthDay?: boolean;
  /** Disable the picker */
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecionar data",
  className,
  monthDay = false,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // For monthDay mode, use year 2000 as dummy year
  const DUMMY_YEAR = 2000;

  // Parse the value string into a Date object for the calendar
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    if (monthDay) {
      // MM-DD format → use 2000 as a dummy year
      const parsed = parse(value, "MM-dd", new Date(DUMMY_YEAR, 0, 1));
      return isValid(parsed) ? parsed : undefined;
    }
    // YYYY-MM-DD format
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [value, monthDay]);

  // Default month: for monthDay mode, start at current month in year 2000
  const defaultMonth = React.useMemo(() => {
    if (selectedDate) return selectedDate;
    if (monthDay) {
      const now = new Date();
      return new Date(DUMMY_YEAR, now.getMonth(), 1);
    }
    return new Date();
  }, [selectedDate, monthDay]);

  // Format the display text
  const displayText = React.useMemo(() => {
    if (!selectedDate) return null;
    if (monthDay) {
      return format(selectedDate, "dd 'de' MMMM", { locale: ptBR });
    }
    return format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }, [selectedDate, monthDay]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange("");
      setOpen(false);
      return;
    }
    if (monthDay) {
      onChange(format(date, "MM-dd"));
    } else {
      onChange(format(date, "yyyy-MM-dd"));
    }
    setOpen(false);
  };

  // Custom formatters for monthDay mode to hide the year
  const monthDayFormatters = monthDay
    ? {
        formatMonthDropdown: (date: Date) =>
          date.toLocaleString("pt-BR", { month: "long" }),
      }
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !displayText && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {displayText || <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={defaultMonth}
          locale={ptBR}
          captionLayout={monthDay ? "dropdown" : "dropdown"}
          formatters={monthDayFormatters}
          startMonth={monthDay ? new Date(DUMMY_YEAR, 0) : new Date(1940, 0)}
          endMonth={monthDay ? new Date(DUMMY_YEAR, 11) : new Date(2040, 11)}
          hideNavigation={monthDay}
        />
      </PopoverContent>
    </Popover>
  );
}
