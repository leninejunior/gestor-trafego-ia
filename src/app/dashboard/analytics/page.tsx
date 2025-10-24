'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, RefreshCw, Calendar, Crown, Lock } from "lucide-react";
import { CampaignComparison } from "@/components/reports/campaign-comparison";
import { AdSetComparison } from "@/components/analytics/adset-comparison";
import { AdComparison } from "@/components/analytics/ad-comparison";
import { LevelSelector, type AnalysisLevel } from "@/components/analytics/level-selector";
import { CampaignMultiSelect } from "@/components/campaigns/campaign-multi-select";
import { useClients } from "@/hooks/use-clients";
import { DateRangePicker } from "@/components/campaigns/date-range-picker";
import { useFeatureAccess } from "@/hooks/use-feature-gate";
import { UpgradePrompt } from "@/components/subscription/upgrade-prompt";
import Link from "next/link";

export default function AnalyticsPage() {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [dateRange, setDateRange] = useState('this_month');
  const [refreshKey, setRefreshKey] = useState(0);
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>('campaign');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  
  // Feature gating for advanced analytics
  const { hasAccess, loading: featureLoading, upgradeRequired } = useFeatureAccess('advancedAnalytics');
  
  // Para nível de campanha
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  
  // Para nível de conjunto
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedAdSets, setSelectedAdSets] = useState<string[]>([]);
  const [adsets, setAdsets] = useState<any[]>([]);
  
  // Para nível de anúncio
  const [selectedAdSet, setSelectedAdSet] = useState<string>('');
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  
  const { clients, isLoading: clientsLoading } = useClients();

  // Show upgrade prompt if feature is not available
  if (!featureLoading && !hasAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">
            Análise detalhada de performance e métricas em múltiplos níveis
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mb-6">
                <Crown className="w-12 h-12 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Analytics Avançados
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Acesse análises detalhadas em múltiplos níveis, comparações avançadas e insights profundos sobre suas campanhas.
              </p>
              
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg mb-6 max-w-md mx-auto">
                <h4 className="font-semibold text-gray-900 mb-3">Com Analytics Avançados você terá:</h4>
                <ul className="text-sm text-gray-700 space-y-2 text-left">
                  <li className="flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
                    Análise multi-nível (campanhas, conjuntos, anúncios)
                  </li>
                  <li className="flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
                    Comparações detalhadas de performance
                  </li>
                  <li className="flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
                    Insights avançados e recomendações
                  </li>
                  <li className="flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
                    Visualizações de criativos
                  </li>
                </ul>
              </div>

              <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Link href="/dashboard/billing">
                  <Crown className="w-4 h-4 mr-2" />
                  Fazer Upgrade
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Buscar campanhas quando cliente mudar
  useEffect(() => {
    if (selectedClient) {
      fetchCampaigns();
    }
  }, [selectedClient, dateRange]);

  // Buscar conjuntos quando campanha mudar (nível adset)
  useEffect(() => {
    if (analysisLevel === 'adset' && selectedCampaign) {
      fetchAdSets();
    }
  }, [selectedCampaign, dateRange]);

  // Buscar anúncios quando conjunto mudar (nível ad)
  useEffect(() => {
    if (analysisLevel === 'ad' && selectedAdSet) {
      fetchAds();
    }
  }, [selectedAdSet, dateRange]);

  const fetchCampaigns = async () => {
    try {
      const params = new URLSearchParams({
        client_id: selectedClient,
        days: dateRange
      });
      const response = await fetch(`/api/dashboard/campaigns?${params}`);
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Erro ao buscar campanhas:', error);
    }
  };

  const fetchAdSets = async () => {
    try {
      const params = new URLSearchParams({
        client_id: selectedClient,
        campaign_id: selectedCampaign,
        date_range: dateRange
      });
      const response = await fetch(`/api/analytics/adsets?${params}`);
      const data = await response.json();
      setAdsets(data.adsets || []);
    } catch (error) {
      console.error('Erro ao buscar conjuntos:', error);
    }
  };

  const fetchAds = async () => {
    try {
      const params = new URLSearchParams({
        client_id: selectedClient,
        campaign_id: selectedCampaign,
        adset_id: selectedAdSet,
        date_range: dateRange
      });
      const response = await fetch(`/api/analytics/ads?${params}`);
      const data = await response.json();
      setAds(data.ads || []);
    } catch (error) {
      console.error('Erro ao buscar anúncios:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    if (analysisLevel === 'campaign') fetchCampaigns();
    if (analysisLevel === 'adset') fetchAdSets();
    if (analysisLevel === 'ad') fetchAds();
  };

  const handleLevelChange = (level: AnalysisLevel) => {
    setAnalysisLevel(level);
    // Limpar seleções ao mudar de nível
    setSelectedCampaigns([]);
    setSelectedCampaign('');
    setSelectedAdSets([]);
    setSelectedAdSet('');
    setSelectedAds([]);
  };

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign);
  const selectedAdSetData = adsets.find(a => a.id === selectedAdSet);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">
          Análise detalhada de performance e métricas em múltiplos níveis
        </p>
      </div>

      {/* Filtros Globais */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Escolha um cliente e período para análise
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cliente e Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={selectedClient} onValueChange={setSelectedClient} disabled={clientsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={clientsLoading ? "Carregando clientes..." : "Selecione um cliente"} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={!selectedClient}
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Período */}
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-3 shrink-0" />
            <div className="flex-1 min-w-0">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClient ? (
        <>
          {/* Seletor de Nível */}
          <LevelSelector value={analysisLevel} onChange={handleLevelChange} />

          {/* Nível: Campanhas */}
          {analysisLevel === 'campaign' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Selecionar Campanhas</CardTitle>
                  <CardDescription>
                    Escolha uma ou mais campanhas para comparar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CampaignMultiSelect
                    campaigns={campaigns}
                    selectedCampaigns={selectedCampaigns}
                    onSelectionChange={setSelectedCampaigns}
                  />
                </CardContent>
              </Card>

              {selectedCampaigns.length > 0 && (
                <CampaignComparison 
                  key={`${selectedClient}-${dateRange}-${refreshKey}`}
                  clientId={selectedClient} 
                />
              )}
            </>
          )}

          {/* Nível: Conjuntos de Anúncios */}
          {analysisLevel === 'adset' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Selecionar Campanha</CardTitle>
                  <CardDescription>
                    Escolha uma campanha para ver seus conjuntos de anúncios
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {selectedCampaign && selectedCampaignData && (
                <AdSetComparison
                  key={`${selectedCampaign}-${dateRange}-${refreshKey}`}
                  clientId={selectedClient}
                  campaignId={selectedCampaign}
                  campaignName={selectedCampaignData.name}
                  dateRange={dateRange}
                  selectedAdSets={selectedAdSets}
                />
              )}
            </>
          )}

          {/* Nível: Anúncios */}
          {analysisLevel === 'ad' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Selecionar Campanha e Conjunto</CardTitle>
                  <CardDescription>
                    Escolha uma campanha e um conjunto para ver os anúncios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Campanha</label>
                    <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma campanha" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCampaign && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Conjunto de Anúncios</label>
                      <Select value={selectedAdSet} onValueChange={setSelectedAdSet}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um conjunto" />
                        </SelectTrigger>
                        <SelectContent>
                          {adsets.map((adset) => (
                            <SelectItem key={adset.id} value={adset.id}>
                              {adset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedAdSet && selectedCampaignData && selectedAdSetData && (
                <AdComparison
                  key={`${selectedAdSet}-${dateRange}-${refreshKey}`}
                  clientId={selectedClient}
                  campaignId={selectedCampaign}
                  campaignName={selectedCampaignData.name}
                  adsetId={selectedAdSet}
                  adsetName={selectedAdSetData.name}
                  dateRange={dateRange}
                  selectedAds={selectedAds}
                />
              )}
            </>
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Selecione um Cliente</CardTitle>
            <CardDescription>
              Escolha um cliente acima para ver os analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Analytics Multi-Nível
              </h3>
              <p className="text-gray-500 mb-4">
                Compare performance em diferentes níveis: campanhas, conjuntos de anúncios ou anúncios individuais com criativos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}