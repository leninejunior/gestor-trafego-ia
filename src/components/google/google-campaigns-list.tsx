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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, ExternalLink, Filter, Search, TrendingUp, TrendingDown, DollarSign, MousePointer, Eye, Target } from 'lucide-react';
import { toast } from 'sonner';

interface GoogleCampaign {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  budget_amount_micros?: number;
  created_at: string;
  start_date?: string;
  end_date?: string;
  connection?: {
    customer_id: string;
  };
  metrics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
  };
}

interface FilterOptions {
  status: string;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface GoogleCampaignsListProps {
  clientId: string;
  connectionId?: string;
}

export function GoogleCampaignsList({ clientId, connectionId }: GoogleCampaignsListProps) {
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<GoogleCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, [clientId, connectionId]);

  // Forçar atualização quando a página for carregada
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCampaigns();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getKPIIcon = (type: string) => {
    switch (type) {
      case 'cost': return <DollarSign className="w-4 h-4" />;
      case 'clicks': return <MousePointer className="w-4 h-4" />;
      case 'impressions': return <Eye className="w-4 h-4" />;
      case 'conversions': return <Target className="w-4 h-4" />;
      default: return <TrendingUp className="w-4 h-4" />;
    }
  };

  // Aplicar filtros quando as campanhas ou filtros mudarem
  useEffect(() => {
    let filtered = [...campaigns];

    // Filtro por status
    if (filters.status !== 'all') {
      filtered = filtered.filter(campaign => campaign.status === filters.status);
    }

    // Filtro por busca
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(searchLower) ||
        campaign.campaign_id.toLowerCase().includes(searchLower) ||
        campaign.connection?.customer_id.toLowerCase().includes(searchLower)
      );
    }

    // Ordenação
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'cost':
          aValue = a.metrics?.cost || 0;
          bValue = b.metrics?.cost || 0;
          break;
        case 'impressions':
          aValue = a.metrics?.impressions || 0;
          bValue = b.metrics?.impressions || 0;
          break;
        case 'clicks':
          aValue = a.metrics?.clicks || 0;
          bValue = b.metrics?.clicks || 0;
          break;
        case 'conversions':
          aValue = a.metrics?.conversions || 0;
          bValue = b.metrics?.conversions || 0;
          break;
        case 'ctr':
          aValue = a.metrics?.ctr || 0;
          bValue = b.metrics?.ctr || 0;
          break;
        case 'cpc':
          aValue = a.metrics?.cpc || 0;
          bValue = b.metrics?.cpc || 0;
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
      }

      if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredCampaigns(filtered);
  }, [campaigns, filters]);

  const updateFilter = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      search: '',
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  };

  const calculateTotals = () => {
    return filteredCampaigns.reduce((acc: any, campaign) => {
      const metrics = campaign.metrics || {};
      return {
        impressions: acc.impressions + (metrics.impressions || 0),
        clicks: acc.clicks + (metrics.clicks || 0),
        conversions: acc.conversions + (metrics.conversions || 0),
        cost: acc.cost + (metrics.cost || 0),
        cpa: acc.cpa + (metrics.cpa || 0)
      };
    }, { impressions: 0, clicks: 0, conversions: 0, cost: 0, cpa: 0 });
  };

  const calculateAverageCPA = () => {
    const validCPACampaigns = filteredCampaigns.filter(campaign =>
      campaign.metrics && campaign.metrics.cpa && campaign.metrics.cpa > 0
    );
    
    if (validCPACampaigns.length === 0) return 0;
    
    const totalCPA = validCPACampaigns.reduce((sum, campaign) =>
      sum + (campaign.metrics?.cpa || 0), 0
    );
    
    return totalCPA / validCPACampaigns.length;
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

  const totals = calculateTotals();
  const averageCPA = calculateAverageCPA();

  return (
    <div className="space-y-6">
      {/* KPIs Summary */}
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm font-medium text-green-800">
          💰 <strong>Valores exibidos em Real Brasileiro (BRL)</strong> - Taxa de conversão: 1 USD = 5.8 BRL
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gasto Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.cost)}</p>
                <p className="text-xs text-green-600 mt-1 font-semibold">BRL • últimos 30 dias</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                {getKPIIcon('cost')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversões</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(totals.conversions)}</p>
                <p className="text-xs text-green-600 mt-1 font-semibold">conversões totais</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-full">
                {getKPIIcon('conversions')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CPA Médio</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(averageCPA)}</p>
                <p className="text-xs text-green-600 mt-1 font-semibold">BRL • custo por aquisição</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-full">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Investimento Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.cost)}</p>
                <p className="text-xs text-green-600 mt-1 font-semibold">BRL • total investido</p>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campanhas Google Ads</CardTitle>
              <CardDescription>
                {filteredCampaigns.length} de {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
                {filteredCampaigns.length !== campaigns.length && ' (filtradas)'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
              <Button onClick={() => {
                // Forçar limpeza de cache e atualização
                setCampaigns([]);
                setFilteredCampaigns([]);
                setTimeout(() => {
                  fetchCampaigns();
                }, 100);
              }} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Forçar Atualização
              </Button>
              <Button onClick={fetchCampaigns} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Nome da campanha..."
                      value={filters.search}
                      onChange={(e) => updateFilter('search', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="ENABLED">Ativas</SelectItem>
                      <SelectItem value="PAUSED">Pausadas</SelectItem>
                      <SelectItem value="REMOVED">Removidas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Ordenar por</label>
                  <Select value={filters.sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Data de criação</SelectItem>
                      <SelectItem value="name">Nome</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="cost">Custo</SelectItem>
                      <SelectItem value="impressions">Impressões</SelectItem>
                      <SelectItem value="clicks">Cliques</SelectItem>
                      <SelectItem value="conversions">Conversões</SelectItem>
                      <SelectItem value="ctr">CTR</SelectItem>
                      <SelectItem value="cpc">CPC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Ordem</label>
                  <Select value={filters.sortOrder} onValueChange={(value: 'asc' | 'desc') => updateFilter('sortOrder', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ordem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Maior para menor</SelectItem>
                      <SelectItem value="asc">Menor para maior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Investimento</TableHead>
                <TableHead>Impressões</TableHead>
                <TableHead>Cliques</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>CPC</TableHead>
                <TableHead>Conversões</TableHead>
                <TableHead>CPA</TableHead>
                <TableHead>Orçamento</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell className="font-medium">
                    {campaign.metrics?.cost ? formatCurrency(campaign.metrics.cost) : '-'}
                  </TableCell>
                  <TableCell>
                    {campaign.metrics?.impressions ? formatNumber(campaign.metrics.impressions) : '-'}
                  </TableCell>
                  <TableCell>
                    {campaign.metrics?.clicks ? formatNumber(campaign.metrics.clicks) : '-'}
                  </TableCell>
                  <TableCell>
                    {campaign.metrics?.ctr !== undefined ? formatPercentage(campaign.metrics.ctr) : '-'}
                  </TableCell>
                  <TableCell>
                    {campaign.metrics?.cpc ? formatCurrency(campaign.metrics.cpc) : '-'}
                  </TableCell>
                  <TableCell>
                    {campaign.metrics?.conversions ? formatNumber(campaign.metrics.conversions) : '-'}
                  </TableCell>
                  <TableCell>
                    {campaign.metrics?.cpa ? formatCurrency(campaign.metrics.cpa) : '-'}
                  </TableCell>
                  <TableCell>{formatBudget(campaign.budget_amount_micros)}</TableCell>
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
    </div>
  );
}
