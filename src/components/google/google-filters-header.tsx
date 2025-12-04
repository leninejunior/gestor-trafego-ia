'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Users } from 'lucide-react';

interface DateFilter {
  value: string;
  label: string;
  days: number;
}

const DATE_FILTERS: DateFilter[] = [
  { value: 'today', label: 'Hoje', days: 1 },
  { value: 'yesterday', label: 'Ontem', days: 1 },
  { value: 'last_7_days', label: 'Últimos 7 dias', days: 7 },
  { value: 'last_14_days', label: 'Últimos 14 dias', days: 14 },
  { value: 'last_30_days', label: 'Últimos 30 dias', days: 30 },
  { value: 'last_90_days', label: 'Últimos 90 dias', days: 90 },
  { value: 'custom', label: 'Personalizado', days: 0 },
];

interface Client {
  id: string;
  name: string;
}

interface GoogleFiltersHeaderProps {
  selectedClient: string;
  onClientChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  clients: Client[];
  connectedClients: Client[];
  showCustomDateInputs?: boolean;
  customStartDate?: string;
  customEndDate?: string;
  onCustomStartDateChange?: (value: string) => void;
  onCustomEndDateChange?: (value: string) => void;
  onCustomDateApply?: () => void;
}

export function GoogleFiltersHeader({
  selectedClient,
  onClientChange,
  dateFilter,
  onDateFilterChange,
  clients,
  connectedClients,
  showCustomDateInputs = false,
  customStartDate = '',
  customEndDate = '',
  onCustomStartDateChange,
  onCustomEndDateChange,
  onCustomDateApply,
}: GoogleFiltersHeaderProps) {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 pb-4">
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={dateFilter} onValueChange={onDateFilterChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecionar período" />
            </SelectTrigger>
            <SelectContent>
              {DATE_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedClient} onValueChange={onClientChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {connectedClients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Custom Date Inputs */}
      {showCustomDateInputs && (
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mt-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">Data Inicial:</label>
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange?.(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">Data Final:</label>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange?.(e.target.value)}
              className="w-40"
            />
          </div>
          <Button 
            onClick={onCustomDateApply}
            size="sm"
            className="mt-0"
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}