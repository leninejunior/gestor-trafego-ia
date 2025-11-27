'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface GoogleCampaign {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  budget_amount_micros?: number;
  created_at: string;
  connection?: {
    customer_id: string;
  };
}

interface GoogleCampaignsListProps {
  clientId: string;
  connectionId?: string;
}

export function GoogleCampaignsList({ clientId, connectionId }: GoogleCampaignsListProps) {
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, [clientId, connectionId]);

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      const url = `/api/google/campaigns?clientId=${clientId}${connectionId ? `&connectionId=${connectionId}` : ''}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        setCampaigns(data.campaigns || []);
      } else {
        toast.error(data.error || 'Erro ao carregar campanhas');
        setCampaigns([]);
      }
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast.error('Erro ao carregar campanhas');
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      ENABLED: { label: 'Ativa', variant: 'default' },
      PAUSED: { label: 'Pausada', variant: 'secondary' },
      REMOVED: { label: 'Removida', variant: 'destructive' },
    };
    
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatBudget = (budgetMicros?: number) => {
    if (!budgetMicros) return '-';
    const value = budgetMicros / 1000000; // Converter de micros para valor real
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Carregando campanhas...
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma Campanha Sincronizada
            </h3>
            <p className="text-gray-500 mb-4">
              Suas campanhas do Google Ads serão sincronizadas automaticamente após a conexão.
            </p>
            <Button onClick={fetchCampaigns} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Campanhas Google Ads</CardTitle>
            <CardDescription>
              {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} sincronizada{campaigns.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Button onClick={fetchCampaigns} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Orçamento</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Sincronizada em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">{campaign.name}</TableCell>
                <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                <TableCell>{formatBudget(campaign.budget_amount_micros)}</TableCell>
                <TableCell>
                  {campaign.connection?.customer_id || '-'}
                </TableCell>
                <TableCell>
                  {new Date(campaign.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`https://ads.google.com/aw/campaigns?campaignId=${campaign.campaign_id}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
