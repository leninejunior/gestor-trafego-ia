'use client';

import { useParams } from 'next/navigation';
import { GoogleCampaignsList } from '@/components/google/google-campaigns-list';
import { GoogleMetricsCards } from '@/components/google/google-metrics-cards';
import { GoogleSyncStatus } from '@/components/google/sync-status';
import { GoogleDateRangeSelector } from '@/components/google/date-range-selector';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const getDefaultGoogleDateRange = () => {
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);

  const startDate = new Date(today);
  startDate.setUTCDate(startDate.getUTCDate() - 29);

  return {
    from: startDate.toISOString().slice(0, 10),
    to: endDate,
  };
};

export default function GoogleAdsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [dateRange, setDateRange] = useState(getDefaultGoogleDateRange);
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
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtro Avançado de Data */}
      <div className="rounded-lg border bg-white p-4">
        <GoogleDateRangeSelector
          value={dateRange}
          onChange={setDateRange}
          maxRange={3650}
        />
      </div>

      {/* Google Metrics Cards */}
      <GoogleMetricsCards
        clientId={clientId}
        startDate={dateRange.from}
        endDate={dateRange.to}
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
          <GoogleCampaignsList
            clientId={clientId}
            startDate={dateRange.from}
            endDate={dateRange.to}
          />
        </div>
      </div>
    </div>
  );
}
