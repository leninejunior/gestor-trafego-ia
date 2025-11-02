/**
 * Componente de filtros avançados para analytics
 * Permite filtrar por plano, status, período personalizado
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnalyticsFilters {
  period_start?: string;
  period_end?: string;
  status_filter?: string;
  plan_filter?: string;
  billing_cycle_filter?: string;
}

interface Plan {
  id: string;
  name: string;
}

interface AnalyticsFiltersProps {
  onFiltersChange: (filters: AnalyticsFilters) => void;
  initialFilters?: AnalyticsFilters;
}

export function AnalyticsFilters({ onFiltersChange, initialFilters = {} }: AnalyticsFiltersProps) {
  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/admin/subscription-plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const handleFilterChange = (key: keyof AnalyticsFilters, value: string | undefined) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handlePeriodChange = (period: string) => {
    if (period === 'custom') {
      setShowCustomPeriod(true);
      return;
    }

    setShowCustomPeriod(false);
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const newFilters = {
      ...filters,
      period_start: startDate.toISOString(),
      period_end: now.toISOString()
    };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleCustomDateChange = () => {
    if (startDate && endDate) {
      const newFilters = {
        ...filters,
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString()
      };
      setFilters(newFilters);
      onFiltersChange(newFilters);
    }
  };

  const clearFilters = () => {
    const clearedFilters: AnalyticsFilters = {};
    setFilters(clearedFilters);
    setStartDate(undefined);
    setEndDate(undefined);
    setShowCustomPeriod(false);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = Object.keys(filters).some(key => 
    filters[key as keyof AnalyticsFilters] !== undefined && 
    filters[key as keyof AnalyticsFilters] !== ''
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtros Avançados
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-auto"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <Select onValueChange={handlePeriodChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="1y">Último ano</SelectItem>
                <SelectItem value="custom">Período personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select 
              value={filters.status_filter || ''} 
              onValueChange={(value) => handleFilterChange('status_filter', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="failed">Falhado</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Plano */}
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select 
              value={filters.plan_filter || ''} 
              onValueChange={(value) => handleFilterChange('plan_filter', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os planos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os planos</SelectItem>
                {plans.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ciclo de Cobrança */}
          <div className="space-y-2">
            <Label>Ciclo de Cobrança</Label>
            <Select 
              value={filters.billing_cycle_filter || ''} 
              onValueChange={(value) => handleFilterChange('billing_cycle_filter', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os ciclos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os ciclos</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Período Personalizado */}
        {showCustomPeriod && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleCustomDateChange}
                disabled={!startDate || !endDate}
                className="w-full"
              >
                Aplicar Período
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}