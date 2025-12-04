'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, RefreshCw, Calendar, Crown } from "lucide-react";
import { CampaignComparison } from "@/components/reports/campaign-comparison";
import { AdSetComparison } from "@/components/analytics/adset-comparison";
import { AdComparison } from "@/components/analytics/ad-comparison";
import { LevelSelector, type AnalysisLevel } from "@/components/analytics/level-selector";
import { ClickableFilters } from "@/components/analytics/clickable-filters";
import { useClients } from "@/hooks/use-clients";
import { DateRangeButtons } from "@/components/campaigns/date-range-buttons";
import { useAvailablePeriods } from "@/hooks/use-available-periods";
// import { useFeatureAccess } from "@/hooks/use-feature-gate";
// import { UpgradePrompt } from "@/components/subscription/upgrade-prompt";
import Link from "next/link";

export default function AnalyticsPage() {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [dateRange, setDateRange] = useState('this_month');
  const [refreshKey, setRefreshKey] = useState(0);
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>('campaign');

  // Feature gating for advanced analytics - DISABLED for now
  // const { hasAccess, loading: featureLoading, upgradeRequired } = useFeatureAccess('advancedAnalytics');
  const hasAccess = true;
  const featureLoading = false;

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

  const { clients, isLoading: clientsLoading } = useClients();
  const { availablePeriods, isLoading: periodsLoading } = useAvailablePeriods({ clientId: selectedClient });

  const fetchCampaigns = async () => {
    try {
      const params = new URLSearchParams({
        client_id: selectedClient,
        days: dateRange
      });
      const response = await fetch(`/api/dashboard/campaigns?${params}`);
      const data = await response.json();
      
      // Marcar campanhas com dados (impressões > 0)
      const campaignsWithDataFlag = (data.campaigns || []).map((campaign: any) => ({
        ...campaign,
        hasData: (campaign.impressions || 0) > 0
      }));
      
      setCampaigns(campaignsWithDataFlag);
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
      
      // Marcar conjuntos com dados (impressões > 0)
      const adsetsWithDataFlag = (data.adsets || []).map((adset: any) => ({
        ...adset,
        hasData: (adset.impressions || 0) > 0
      }));
      
      setAdsets(adsetsWithDataFlag);
    } catch (error) {
      console.error('Erro ao buscar conjuntos:', error);
    }
  };



  // Buscar campanhas quando cliente mudar
  useEffect(() => {
    if (selectedClient) {
      fetchCampaigns();
    }
  }, [selectedClient, dateRange]);

  // Buscar conjuntos quando campanha mudar (nível adset ou ad)
  useEffect(() => {
    if ((analysisLevel === 'adset' || analysisLevel === 'ad') && selectedCampaign) {
      fetchAdSets();
    }
  }, [selectedCampaign, dateRange, analysisLevel]);



  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    if (analysisLevel === 'campaign') fetchCampaigns();
    if (analysisLevel === 'adset' || analysisLevel === 'ad') fetchAdSets();
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

  // Calculate derived values
  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign);
  const selectedAdSetData = adsets.find(a => a.id === selectedAdSet);

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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Período</label>
              {periodsLoading && (
                <span className="text-xs text-muted-foreground">(verificando dados...)</span>
              )}
            </div>
            <DateRangeButtons 
              value={dateRange} 
              onChange={setDateRange}
              availablePeriods={availablePeriods}
            />
            {!periodsLoading && availablePeriods.length === 0 && selectedClient && (
              <p className="text-xs text-muted-foreground">
                Nenhum período com dados encontrado. Sincronize suas campanhas primeiro.
              </p>
            )}
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
                  <CardDescription>Selecione apenas campanhas que tiveram dados neste período para comparar</CardDescription>
                </CardHeader>
                <CardContent>
                  <ClickableFilters
                    options={campaigns.map(c => ({
                      id: c.id,
                      name: c.name,
                      hasData: c.hasData
                    }))}
                    selectedIds={selectedCampaigns}
                    onSelectionChange={setSelectedCampaigns}
                    multiSelect={true}
                    emptyMessage="Nenhuma campanha com dados neste período"
                  />
                </CardContent>
              </Card>

              {selectedCampaigns.length > 0 && (
                <CampaignComparison
                  key={`${selectedClient}-${dateRange}-${refreshKey}`}
                  clientId={selectedClient}
                  selectedCampaigns={selectedCampaigns}
                  campaigns={campaigns}
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
                    Clique em uma campanha que teve dados neste período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ClickableFilters
                    options={campaigns.map(c => ({
                      id: c.id,
                      name: c.name,
                      hasData: c.hasData
                    }))}
                    selectedIds={selectedCampaign ? [selectedCampaign] : []}
                    onSelectionChange={(ids) => setSelectedCampaign(ids[0] || '')}
                    multiSelect={false}
                    emptyMessage="Nenhuma campanha com dados neste período"
                  />
                </CardContent>
              </Card>

              {selectedCampaign && selectedCampaignData && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Selecionar Conjuntos de Anúncios</CardTitle>
                      <CardDescription>
                        Clique nos conjuntos que tiveram dados neste período para comparar
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ClickableFilters
                        options={adsets.map(a => ({
                          id: a.id,
                          name: a.name,
                          hasData: a.hasData
                        }))}
                        selectedIds={selectedAdSets}
                        onSelectionChange={setSelectedAdSets}
                        multiSelect={true}
                        emptyMessage="Nenhum conjunto de anúncios com dados neste período"
                      />
                    </CardContent>
                  </Card>

                  {selectedAdSets.length > 0 && (
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
            </>
          )}

          {/* Nível: Anúncios */}
          {analysisLevel === 'ad' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Selecionar Campanha</CardTitle>
                  <CardDescription>
                    Clique em uma campanha que teve dados neste período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ClickableFilters
                    options={campaigns.map(c => ({
                      id: c.id,
                      name: c.name,
                      hasData: c.hasData
                    }))}
                    selectedIds={selectedCampaign ? [selectedCampaign] : []}
                    onSelectionChange={(ids) => setSelectedCampaign(ids[0] || '')}
                    multiSelect={false}
                    emptyMessage="Nenhuma campanha com dados neste período"
                  />
                </CardContent>
              </Card>

              {selectedCampaign && selectedCampaignData && (
                <Card>
                  <CardHeader>
                    <CardTitle>Selecionar Conjunto de Anúncios</CardTitle>
                    <CardDescription>
                      Clique em um conjunto que teve dados neste período
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ClickableFilters
                      options={adsets.map(a => ({
                        id: a.id,
                        name: a.name,
                        hasData: a.hasData
                      }))}
                      selectedIds={selectedAdSet ? [selectedAdSet] : []}
                      onSelectionChange={(ids) => setSelectedAdSet(ids[0] || '')}
                      multiSelect={false}
                      emptyMessage="Nenhum conjunto de anúncios com dados neste período"
                    />
                  </CardContent>
                </Card>
              )}

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