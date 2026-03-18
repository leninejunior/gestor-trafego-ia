'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface CampaignComparisonProps {
  clientId: string;
  selectedCampaigns?: string[];
  campaigns?: Campaign[];
}

export function CampaignComparison({ clientId, selectedCampaigns: propSelectedCampaigns, campaigns: propCampaigns }: CampaignComparisonProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(propCampaigns || []);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(propSelectedCampaigns || []);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (propCampaigns) {
      setCampaigns(propCampaigns);
    } else if (clientId) {
      loadCampaigns();
    }
  }, [clientId, propCampaigns]);

  useEffect(() => {
    if (propSelectedCampaigns) {
      setSelectedCampaigns(propSelectedCampaigns);
      if (propSelectedCampaigns.length >= 2) {
        compareSelected(propSelectedCampaigns);
      }
    }
  }, [propSelectedCampaigns]);

  const loadCampaigns = async () => {
    try {
      const response = await fetch(`/api/dashboard/campaigns?client_id=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
    }
  };

  const handleCampaignToggle = (campaignId: string) => {
    // If props are provided, we don't allow internal toggling (controlled by parent)
    if (propSelectedCampaigns) return;

    setSelectedCampaigns(prev => {
      if (prev.includes(campaignId)) {
        return prev.filter(id => id !== campaignId);
      } else if (prev.length < 3) { // Máximo 3 campanhas
        return [...prev, campaignId];
      }
      return prev;
    });
  };

  const compareSelected = async (campaignsToCompare = selectedCampaigns) => {
    if (campaignsToCompare.length < 2) return;

    setIsLoading(true);
    try {
      const promises = campaignsToCompare.map(async (campaignId) => {
        const response = await fetch(`/api/meta/insights?clientId=${clientId}&campaignId=${campaignId}`);
        if (response.ok) {
          const data = await response.json();
          const campaign = campaigns.find(c => c.id === campaignId);
          return {
            id: campaignId,
            name: campaign?.name || 'Campanha',
            ...data.insights[0]
          };
        }
        return null;
      });

      const results = (await Promise.all(promises)).filter(Boolean);
      setComparisonData(results);
    } catch (error) {
      console.error('Erro ao comparar campanhas:', error);
    } finally {
      setIsLoading(false);
    }
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
    return `${(value * 100).toFixed(2)}%`;
  };

  const getBestPerformer = (metric: string) => {
    if (comparisonData.length === 0) return null;

    return comparisonData.reduce((best, current) => {
      const currentValue = current[metric] || 0;
      const bestValue = best[metric] || 0;

      // Para CTR, queremos o maior valor
      if (metric === 'ctr') {
        return currentValue > bestValue ? current : best;
      }
      // Para CPM e CPC, queremos o menor valor
      if (metric === 'cpm' || metric === 'cpc') {
        return currentValue < bestValue ? current : best;
      }
      // Para impressões, cliques, queremos o maior valor
      return currentValue > bestValue ? current : best;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <BarChart3 className="w-5 h-5 mr-2" />
          Comparação de Campanhas
        </CardTitle>
        <CardDescription>
          Compare a performance de até 3 campanhas lado a lado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Only show selector if not controlled by props */}
        {!propSelectedCampaigns && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              Selecionar Campanhas (máximo 3)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedCampaigns.includes(campaign.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-border hover:border-muted-foreground'
                    }`}
                  onClick={() => handleCampaignToggle(campaign.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{campaign.name}</span>
                    <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show button only if not auto-comparing (or maybe always show to refresh?) */}
        {/* If controlled, we auto-compare, but maybe user wants to retry? */}
        <Button
          onClick={() => compareSelected()}
          disabled={selectedCampaigns.length < 2 || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Comparando...
            </>
          ) : (
            `Comparar ${selectedCampaigns.length} Campanhas`
          )}
        </Button>

        {comparisonData.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Resultados da Comparação</h4>

            {/* Tabela de Comparação */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border p-3 text-left">Métrica</th>
                    {comparisonData.map((campaign) => (
                      <th key={campaign.id} className="border border-border p-3 text-left">
                        {campaign.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border p-3 font-medium">Impressões</td>
                    {comparisonData.map((campaign) => {
                      const best = getBestPerformer('impressions');
                      const isBest = best?.id === campaign.id;
                      return (
                        <td key={campaign.id} className="border border-border p-3">
                          <div className="flex items-center">
                            {formatNumber(campaign.impressions || 0)}
                            {isBest && <TrendingUp className="w-4 h-4 text-green-500 dark:text-green-400 ml-2" />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="border border-border p-3 font-medium">Cliques</td>
                    {comparisonData.map((campaign) => {
                      const best = getBestPerformer('clicks');
                      const isBest = best?.id === campaign.id;
                      return (
                        <td key={campaign.id} className="border border-border p-3">
                          <div className="flex items-center">
                            {formatNumber(campaign.clicks || 0)}
                            {isBest && <TrendingUp className="w-4 h-4 text-green-500 dark:text-green-400 ml-2" />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="border border-border p-3 font-medium">CTR</td>
                    {comparisonData.map((campaign) => {
                      const best = getBestPerformer('ctr');
                      const isBest = best?.id === campaign.id;
                      return (
                        <td key={campaign.id} className="border border-border p-3">
                          <div className="flex items-center">
                            {formatPercentage(campaign.ctr || 0)}
                            {isBest && <TrendingUp className="w-4 h-4 text-green-500 dark:text-green-400 ml-2" />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="border border-border p-3 font-medium">Gasto</td>
                    {comparisonData.map((campaign) => (
                      <td key={campaign.id} className="border border-border p-3">
                        {formatCurrency(campaign.spend || 0)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-border p-3 font-medium">CPM</td>
                    {comparisonData.map((campaign) => {
                      const best = getBestPerformer('cpm');
                      const isBest = best?.id === campaign.id;
                      return (
                        <td key={campaign.id} className="border border-border p-3">
                          <div className="flex items-center">
                            {formatCurrency(campaign.cpm || 0)}
                            {isBest && <TrendingDown className="w-4 h-4 text-green-500 dark:text-green-400 ml-2" />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="border border-border p-3 font-medium">CPC</td>
                    {comparisonData.map((campaign) => {
                      const best = getBestPerformer('cpc');
                      const isBest = best?.id === campaign.id;
                      return (
                        <td key={campaign.id} className="border border-border p-3">
                          <div className="flex items-center">
                            {formatCurrency(campaign.cpc || 0)}
                            {isBest && <TrendingDown className="w-4 h-4 text-green-500 dark:text-green-400 ml-2" />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Insights da Comparação */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 rounded">
              <h5 className="font-medium mb-2 text-blue-800 dark:text-blue-300">💡 Insights da Comparação</h5>
              <ul className="text-sm space-y-1 text-blue-700 dark:text-blue-400">
                <li>🏆 Melhor CTR: {getBestPerformer('ctr')?.name} ({formatPercentage(getBestPerformer('ctr')?.ctr || 0)})</li>
                <li>💰 Menor CPM: {getBestPerformer('cpm')?.name} ({formatCurrency(getBestPerformer('cpm')?.cpm || 0)})</li>
                <li>🎯 Menor CPC: {getBestPerformer('cpc')?.name} ({formatCurrency(getBestPerformer('cpc')?.cpc || 0)})</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}