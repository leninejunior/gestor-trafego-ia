"use client";

/**
 * Google Ads Campaign Summary Component
 * 
 * Shows campaign distribution by status and top performers
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Play, Pause, Trash2, TrendingUp, DollarSign } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface GoogleCampaignSummaryProps {
  clientId?: string;
  startDate?: string;
  endDate?: string;
}

interface CampaignData {
  id: string;
  name: string;
  status: string;
  cost: number;
  conversions: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
}

interface StatusSummary {
  status: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  ENABLED: { label: 'Ativas', color: '#10b981', bgColor: 'bg-green-100' },
  PAUSED: { label: 'Pausadas', color: '#f59e0b', bgColor: 'bg-amber-100' },
  REMOVED: { label: 'Removidas', color: '#ef4444', bgColor: 'bg-red-100' },
};

export function GoogleCampaignSummary({ clientId, startDate, endDate }: GoogleCampaignSummaryProps) {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!clientId) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          clientId,
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
        });

        const response = await fetch(`/api/google/campaigns?${params}`);
        
        if (!response.ok) {
          throw new Error('Erro ao carregar campanhas');
        }

        const data = await response.json();
        setCampaigns(data.campaigns || []);
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [clientId, startDate, endDate]);

  // Calculate status distribution
  const statusDistribution = Object.entries(STATUS_CONFIG).map(([status, config]) => ({
    name: config.label,
    value: campaigns.filter(c => c.status === status).length,
    color: config.color,
  })).filter(s => s.value > 0);

  // Get top performers by conversions
  const topPerformers = [...campaigns]
    .filter(c => c.status === 'ENABLED')
    .sort((a, b) => (b.metrics?.conversions || 0) - (a.metrics?.conversions || 0))
    .slice(0, 5);

  // Calculate totals
  const totalCost = campaigns.reduce((sum, c) => sum + (c.metrics?.cost || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.metrics?.conversions || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (!clientId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Campanhas</CardTitle>
          <CardDescription>Selecione um cliente para ver o resumo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Selecione um cliente para visualizar os dados
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Status</CardTitle>
          <CardDescription>
            {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} no total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Nenhuma campanha encontrada
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-[150px] h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} campanhas`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                  const count = campaigns.filter(c => c.status === status).length;
                  const percentage = campaigns.length > 0 ? (count / campaigns.length) * 100 : 0;
                  
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: config.color }}
                          />
                          <span>{config.label}</span>
                        </div>
                        <span className="font-medium">{count}</span>
                      </div>
                      <Progress value={percentage} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Campanhas</CardTitle>
          <CardDescription>
            Campanhas com melhor performance por conversões
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topPerformers.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Nenhuma campanha ativa encontrada
            </div>
          ) : (
            <div className="space-y-4">
              {topPerformers.map((campaign, index) => {
                const costPercentage = totalCost > 0 
                  ? ((campaign.metrics?.cost || 0) / totalCost) * 100 
                  : 0;
                
                return (
                  <div key={campaign.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {campaign.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">
                          {(campaign.metrics?.conversions || 0).toFixed(1)} conv.
                        </span>
                        <span className="font-medium">
                          {formatCurrency(campaign.metrics?.cost || 0)}
                        </span>
                      </div>
                    </div>
                    <Progress value={costPercentage} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
