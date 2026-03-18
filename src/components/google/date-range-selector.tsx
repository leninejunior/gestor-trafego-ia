'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  X
} from "lucide-react";
import { addDays, format, parseISO, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DateRange {
  from: string;
  to: string;
}

interface GoogleDateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  maxRange?: number; // Maximum days allowed
  minDate?: Date;
  maxDate?: Date;
  presets?: boolean;
  compact?: boolean;
}

interface DatePreset {
  label: string;
  value: string;
  getRange: () => DateRange;
  description?: string;
}

const toDateInputValue = (date: Date) => format(date, 'yyyy-MM-dd');
const parseDateInput = (value: string) => parseISO(value);

const DATE_PRESETS: DatePreset[] = [
  {
    label: 'Hoje',
    value: 'today',
    getRange: () => {
      const today = new Date();
      return {
        from: toDateInputValue(today),
        to: toDateInputValue(today),
      };
    },
    description: 'Dados de hoje',
  },
  {
    label: 'Ontem',
    value: 'yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1);
      return {
        from: toDateInputValue(yesterday),
        to: toDateInputValue(yesterday),
      };
    },
    description: 'Dados de ontem',
  },
  {
    label: 'Últimos 7 dias',
    value: 'last_7_days',
    getRange: () => {
      const today = new Date();
      const from = subDays(today, 6);
      return {
        from: toDateInputValue(from),
        to: toDateInputValue(today),
      };
    },
    description: 'Últimos 7 dias incluindo hoje',
  },
  {
    label: 'Últimos 14 dias',
    value: 'last_14_days',
    getRange: () => {
      const today = new Date();
      const from = subDays(today, 13);
      return {
        from: toDateInputValue(from),
        to: toDateInputValue(today),
      };
    },
    description: 'Últimos 14 dias incluindo hoje',
  },
  {
    label: 'Últimos 30 dias',
    value: 'last_30_days',
    getRange: () => {
      const today = new Date();
      const from = subDays(today, 29);
      return {
        from: toDateInputValue(from),
        to: toDateInputValue(today),
      };
    },
    description: 'Últimos 30 dias incluindo hoje',
  },
  {
    label: 'Esta semana',
    value: 'this_week',
    getRange: () => {
      const today = new Date();
      const from = startOfWeek(today, { weekStartsOn: 1 });
      return {
        from: toDateInputValue(from),
        to: toDateInputValue(today),
      };
    },
    description: 'Segunda-feira até hoje',
  },
  {
    label: 'Semana passada',
    value: 'last_week',
    getRange: () => {
      const lastWeek = subWeeks(new Date(), 1);
      const from = startOfWeek(lastWeek, { weekStartsOn: 1 });
      const to = endOfWeek(lastWeek, { weekStartsOn: 1 });
      return {
        from: toDateInputValue(from),
        to: toDateInputValue(to),
      };
    },
    description: 'Segunda a domingo da semana passada',
  },
  {
    label: 'Este mês',
    value: 'this_month',
    getRange: () => {
      const today = new Date();
      const from = startOfMonth(today);
      return {
        from: toDateInputValue(from),
        to: toDateInputValue(today),
      };
    },
    description: 'Primeiro dia do mês até hoje',
  },
  {
    label: 'Mês passado',
    value: 'last_month',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      const from = startOfMonth(lastMonth);
      const to = endOfMonth(lastMonth);
      return {
        from: toDateInputValue(from),
        to: toDateInputValue(to),
      };
    },
    description: 'Mês passado completo',
  },
  {
    label: 'Últimos 90 dias',
    value: 'last_90_days',
    getRange: () => {
      const today = new Date();
      const from = subDays(today, 89);
      return {
        from: toDateInputValue(from),
        to: toDateInputValue(today),
      };
    },
    description: 'Últimos 90 dias incluindo hoje',
  },
];

export function GoogleDateRangeSelector({
  value,
  onChange,
  maxRange = 365,
  minDate,
  maxDate = new Date(),
  presets = true,
  compact = false,
}: GoogleDateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
        Carregando período...
      </div>
    );
  }

  const formatDateRange = (range: DateRange) => {
    const fromDate = parseDateInput(range.from);
    const toDate = parseDateInput(range.to);
    
    if (range.from === range.to) {
      return format(fromDate, 'dd/MM/yyyy', { locale: ptBR });
    }
    
    return `${format(fromDate, 'dd/MM', { locale: ptBR })} - ${format(toDate, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  const getDaysDifference = (range: DateRange) => {
    const fromDate = parseDateInput(range.from);
    const toDate = parseDateInput(range.to);
    return Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const isValidRange = (range: DateRange) => {
    const fromDate = parseDateInput(range.from);
    const toDate = parseDateInput(range.to);
    
    if (fromDate > toDate) return false;
    if (minDate && fromDate < minDate) return false;
    if (maxDate && toDate > maxDate) return false;
    if (getDaysDifference(range) > maxRange) return false;
    
    return true;
  };

  const handlePresetSelect = (presetValue: string) => {
    const preset = DATE_PRESETS.find(p => p.value === presetValue);
    if (preset) {
      const range = preset.getRange();
      if (isValidRange(range)) {
        onChange(range);
        setSelectedPreset(presetValue);
        setCustomFrom(range.from);
        setCustomTo(range.to);
        setIsOpen(false);
      }
    }
  };

  const handleCustomRangeApply = () => {
    const range = { from: customFrom, to: customTo };
    if (isValidRange(range)) {
      onChange(range);
      setSelectedPreset('');
      setIsOpen(false);
    }
  };

  const handleQuickNavigation = (direction: 'prev' | 'next') => {
    const currentDays = getDaysDifference(value);
    const fromDate = parseDateInput(value.from);
    
    let newFrom: Date;
    let newTo: Date;
    
    if (direction === 'prev') {
      newTo = subDays(fromDate, 1);
      newFrom = subDays(newTo, currentDays - 1);
    } else {
      newFrom = addDays(parseDateInput(value.to), 1);
      newTo = addDays(newFrom, currentDays - 1);
    }
    
    const newRange = {
      from: toDateInputValue(newFrom),
      to: toDateInputValue(newTo),
    };
    
    if (isValidRange(newRange)) {
      onChange(newRange);
      setCustomFrom(newRange.from);
      setCustomTo(newRange.to);
      setSelectedPreset('');
    }
  };

  const getCurrentPreset = () => {
    return DATE_PRESETS.find(preset => {
      const presetRange = preset.getRange();
      return presetRange.from === value.from && presetRange.to === value.to;
    });
  };

  const currentPreset = getCurrentPreset();
  const daysDiff = getDaysDifference(value);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickNavigation('prev')}
          disabled={!isValidRange({
            from: toDateInputValue(subDays(parseDateInput(value.from), daysDiff)),
            to: toDateInputValue(subDays(parseDateInput(value.to), daysDiff)),
          })}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[140px]">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {formatDateRange(value)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-4 space-y-4">
              {presets && (
                <div>
                  <Label className="text-sm font-medium">Períodos Rápidos</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DATE_PRESETS.slice(0, 6).map((preset) => (
                      <Button
                        key={preset.value}
                        variant={selectedPreset === preset.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePresetSelect(preset.value)}
                        className="text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Período Personalizado</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">De</Label>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      max={maxDate ? toDateInputValue(maxDate) : undefined}
                      min={minDate ? toDateInputValue(minDate) : undefined}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Até</Label>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      max={maxDate ? toDateInputValue(maxDate) : undefined}
                      min={customFrom}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleCustomRangeApply}
                  size="sm"
                  className="w-full"
                  disabled={!isValidRange({ from: customFrom, to: customTo })}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickNavigation('next')}
          disabled={!isValidRange({
            from: toDateInputValue(addDays(parseDateInput(value.to), 1)),
            to: toDateInputValue(addDays(parseDateInput(value.to), daysDiff)),
          })}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Selection Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{formatDateRange(value)}</span>
          {currentPreset && (
            <Badge variant="secondary" className="text-xs">
              {currentPreset.label}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          {daysDiff} {daysDiff === 1 ? 'dia' : 'dias'}
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickNavigation('prev')}
          disabled={!isValidRange({
            from: toDateInputValue(subDays(parseDateInput(value.from), daysDiff)),
            to: toDateInputValue(subDays(parseDateInput(value.to), daysDiff)),
          })}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Anterior
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickNavigation('next')}
          disabled={!isValidRange({
            from: toDateInputValue(addDays(parseDateInput(value.to), 1)),
            to: toDateInputValue(addDays(parseDateInput(value.to), daysDiff)),
          })}
        >
          Próximo
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="w-4 h-4 mr-1" />
              Personalizar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start">
            <div className="p-4 space-y-4">
              {presets && (
                <div>
                  <Label className="text-sm font-medium">Períodos Rápidos</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DATE_PRESETS.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={selectedPreset === preset.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePresetSelect(preset.value)}
                        className="text-xs justify-start"
                        title={preset.description}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <Label className="text-sm font-medium">Período Personalizado</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Data inicial</Label>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      max={maxDate ? toDateInputValue(maxDate) : undefined}
                      min={minDate ? toDateInputValue(minDate) : undefined}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data final</Label>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      max={maxDate ? toDateInputValue(maxDate) : undefined}
                      min={customFrom}
                    />
                  </div>
                </div>
                
                {!isValidRange({ from: customFrom, to: customTo }) && (
                  <p className="text-xs text-red-600">
                    Período inválido. Máximo de {maxRange} dias permitido.
                  </p>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCustomRangeApply}
                    size="sm"
                    className="flex-1"
                    disabled={!isValidRange({ from: customFrom, to: customTo })}
                  >
                    Aplicar Período
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Range Info */}
      {daysDiff > 30 && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          ⚠️ Períodos longos podem afetar a performance. Considere usar granularidade semanal ou mensal.
        </div>
      )}
    </div>
  );
}
