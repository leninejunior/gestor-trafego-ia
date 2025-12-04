'use client';

import { useParams } from 'next/navigation';
import { GoogleCampaignsList } from '@/components/google/google-campaigns-list';
import { GoogleMetricsCards } from '@/components/google/google-metrics-cards';
import { GoogleSyncStatus } from '@/components/google/sync-status';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

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
];

export default function GoogleAdsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [dateFilter, setDateFilter] = useState<string>('last_30_days');
  const [clientName, setClientName] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch client information
  useEffect(() => {
    const fetchClientInfo = async () => {
      try {
        const response = await fetch(`/api/clients?includeGoogleConnections=true`);
        if (response.ok) {
          const data = await response.json();
          const client = data.clients?.find((c: any) => c.id === clientId);
          if (client) {
            setClientName(client.name);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar informações do cliente:', error);
      }
    };

    if (clientId) {
      fetchClientInfo();
    }
  }, [clientId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Force refresh of all components
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/dashboard/clients/${clientId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-2">
            Google Ads - {clientName || 'Carregando...'}
          </h1>
          <p className="text-gray-600 mt-1">
            Visualize e gerencie suas campanhas sincronizadas do Google Ads
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <Select value={dateFilter} onValueChange={setDateFilter}>
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
          
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Google Metrics Cards */}
      <GoogleMetricsCards
        clientId={clientId}
        dateFilter={dateFilter}
      />

      {/* Sync Status and Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sync Status - Takes 1/3 of space */}
        <div className="lg:col-span-1">
          <GoogleSyncStatus
            clientId={clientId}
            compact={false}
          />
        </div>
        
        {/* Campaigns List - Takes 2/3 of space */}
        <div className="lg:col-span-2">
          <GoogleCampaignsList clientId={clientId} />
        </div>
      </div>
    </div>
  );
}
