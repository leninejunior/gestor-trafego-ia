'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users } from 'lucide-react';
import { DateRangeFilter, DateRange } from '@/components/shared/date-range-filter';

interface Client {
  id: string;
  name: string;
}

interface GoogleFiltersHeaderProps {
  selectedClient: string;
  onClientChange: (value: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  clients: Client[];
  connectedClients: Client[];
}

export function GoogleFiltersHeader({
  selectedClient,
  onClientChange,
  dateRange,
  onDateRangeChange,
  clients,
  connectedClients,
}: GoogleFiltersHeaderProps) {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 pb-4">
      <div className="flex gap-4 items-center flex-wrap">
        {/* Filtro de Data */}
        <DateRangeFilter
          value={dateRange}
          onChange={onDateRangeChange}
        />
        
        {/* Filtro de Cliente */}
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
    </div>
  );
}
