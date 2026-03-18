"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface DateRange {
  since: string;
  until: string;
  label: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESET_RANGES = [
  { id: "today", label: "Hoje", getDates: () => {
    const today = new Date();
    return { since: format(today, "yyyy-MM-dd"), until: format(today, "yyyy-MM-dd") };
  }},
  { id: "yesterday", label: "Ontem", getDates: () => {
    const yesterday = subDays(new Date(), 1);
    return { since: format(yesterday, "yyyy-MM-dd"), until: format(yesterday, "yyyy-MM-dd") };
  }},
  { id: "last7days", label: "Últimos 7 dias", getDates: () => {
    const today = new Date();
    return { since: format(subDays(today, 6), "yyyy-MM-dd"), until: format(today, "yyyy-MM-dd") };
  }},
  { id: "last14days", label: "Últimos 14 dias", getDates: () => {
    const today = new Date();
    return { since: format(subDays(today, 13), "yyyy-MM-dd"), until: format(today, "yyyy-MM-dd") };
  }},
  { id: "last30days", label: "Últimos 30 dias", getDates: () => {
    const today = new Date();
    return { since: format(subDays(today, 29), "yyyy-MM-dd"), until: format(today, "yyyy-MM-dd") };
  }},
  { id: "thisMonth", label: "Este mês", getDates: () => {
    const today = new Date();
    return { since: format(startOfMonth(today), "yyyy-MM-dd"), until: format(today, "yyyy-MM-dd") };
  }},
  { id: "lastMonth", label: "Mês passado", getDates: () => {
    const lastMonth = subMonths(new Date(), 1);
    return { since: format(startOfMonth(lastMonth), "yyyy-MM-dd"), until: format(endOfMonth(lastMonth), "yyyy-MM-dd") };
  }},
  { id: "last90days", label: "Últimos 90 dias", getDates: () => {
    const today = new Date();
    return { since: format(subDays(today, 89), "yyyy-MM-dd"), until: format(today, "yyyy-MM-dd") };
  }},
  { id: "thisYear", label: "Este ano", getDates: () => {
    const today = new Date();
    return { since: format(startOfYear(today), "yyyy-MM-dd"), until: format(today, "yyyy-MM-dd") };
  }},
  { id: "custom", label: "Personalizado", getDates: () => {
    const today = new Date();
    return { since: format(subDays(today, 29), "yyyy-MM-dd"), until: format(today, "yyyy-MM-dd") };
  }},
];

export function getDefaultDateRange(): DateRange {
  const preset = PRESET_RANGES.find(p => p.id === "last30days")!;
  const dates = preset.getDates();
  return { ...dates, label: preset.label };
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(
    value.since ? new Date(value.since) : undefined
  );
  const [customTo, setCustomTo] = useState<Date | undefined>(
    value.until ? new Date(value.until) : undefined
  );

  const handlePresetChange = (presetId: string) => {
    if (presetId === "custom") {
      setIsCustomOpen(true);
      return;
    }

    const preset = PRESET_RANGES.find(p => p.id === presetId);
    if (preset) {
      const dates = preset.getDates();
      onChange({ ...dates, label: preset.label });
    }
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange({
        since: format(customFrom, "yyyy-MM-dd"),
        until: format(customTo, "yyyy-MM-dd"),
        label: `${format(customFrom, "dd/MM/yyyy")} - ${format(customTo, "dd/MM/yyyy")}`
      });
      setIsCustomOpen(false);
    }
  };

  const currentPresetId = PRESET_RANGES.find(p => {
    if (p.id === "custom") return false;
    const dates = p.getDates();
    return dates.since === value.since && dates.until === value.until;
  })?.id || "custom";

  return (
    <div className="flex items-center gap-2">
      <Select value={currentPresetId} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
          {PRESET_RANGES.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Popover para datas personalizadas */}
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal",
              currentPresetId === "custom" ? "border-primary" : ""
            )}
          >
            <span className="text-xs text-muted-foreground">
              {value.label}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4 space-y-4">
            <div className="text-sm font-medium">Período personalizado</div>
            <div className="flex gap-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">De</div>
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  locale={ptBR}
                  disabled={(date) => date > new Date()}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Até</div>
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  locale={ptBR}
                  disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsCustomOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCustomApply} disabled={!customFrom || !customTo}>
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
