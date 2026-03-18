"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Pause, ExternalLink } from "lucide-react";

interface AdInsights {
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  ctr: string;
  cpc: string;
  cpm: string;
  frequency: string;
  actions?: any[];
  cost_per_action_type?: any[];
}

interface MetaAd {
  id: string;
  name: string;
  status: string;
  creative?: {
    id: string;
    name?: string;
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;
    video_id?: string;
    call_to_action_type?: string;
  };
  created_time: string;
  effective_status?: string;
  insights?: AdInsights | null;
}

interface AdsListProps {
  adsetId: string;
  adsetName: string;
  clientId?: string;
  adAccountId?: string;
  dateRange?: { since: string; until: string };
}

export function AdsList({ adsetId, adsetName, clientId, adAccountId, dateRange }: AdsListProps) {
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showOnlyWithResults, setShowOnlyWithResults] = useState(false);

  useEffect(() => {
    fetchAds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adsetId, dateRange?.since, dateRange?.until]);

  const fetchAds = async () => {
    setIsLoading(true);
    console.log('🔍 [ADS LIST] Buscando anúncios para conjunto:', adsetId);
    console.log('🔍 [ADS LIST] Parâmetros:', { clientId, adAccountId, dateRange });
    
    try {
      let url = `/api/meta/ads?adsetId=${adsetId}`;
      if (clientId && adAccountId) {
        url += `&clientId=${clientId}&adAccountId=${adAccountId}`;
      }
      if (dateRange) {
        url += `&since=${dateRange.since}&until=${dateRange.until}`;
      }
      console.log('🔗 [ADS LIST] URL completa:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📊 [ADS LIST] Resposta completa:', { 
        status: response.status, 
        ok: response.ok,
        dataKeys: Object.keys(data),
        adsCount: data.ads?.length || 0,
        data 
      });

      if (response.ok) {
        const adsData = data.ads || [];
        setAds(adsData);
        console.log('✅ [ADS LIST] Anúncios carregados:', adsData.length);
        
        // Debug detalhado de cada anúncio
        adsData.forEach((ad: any, index: number) => {
          console.log(`🔍 [ADS LIST] Anúncio ${index + 1}:`, {
            id: ad.id,
            name: ad.name,
            status: ad.status,
            hasCreative: !!ad.creative,
            creativeId: ad.creative?.id,
            hasTitle: !!ad.creative?.title,
            hasBody: !!ad.creative?.body,
            hasImage: !!ad.creative?.image_url,
            hasVideo: !!ad.creative?.video_id,
            title: ad.creative?.title,
            bodyPreview: ad.creative?.body?.substring(0, 50),
            hasInsights: !!ad.insights,
            insightsKeys: ad.insights ? Object.keys(ad.insights) : [],
            spend: ad.insights?.spend,
            impressions: ad.insights?.impressions,
            clicks: ad.insights?.clicks
          });
        });
      } else {
        console.error('❌ [ADS LIST] Erro na resposta:', data.error);
        toast.error(data.error || 'Erro ao carregar anúncios');
        setAds([]);
      }
    } catch (error) {
      console.error('💥 [ADS LIST] Erro na requisição:', error);
      toast.error('Erro ao carregar anúncios');
      setAds([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (ad: MetaAd) => {
    const newStatus = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setUpdatingStatus(ad.id);

    console.log('🔄 Alterando status do anúncio:', {
      adId: ad.id,
      currentStatus: ad.status,
      newStatus
    });

    try {
      const response = await fetch(`/api/meta/ads/${ad.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        fetchAds();
      } else {
        console.error('❌ Erro ao atualizar status:', data);
        toast.error(data.error || 'Erro ao atualizar status');
      }
    } catch (error) {
      console.error('💥 Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      ACTIVE: { label: 'Ativo', variant: 'default' as const },
      PAUSED: { label: 'Pausado', variant: 'secondary' as const },
      DELETED: { label: 'Excluído', variant: 'destructive' as const },
      ARCHIVED: { label: 'Arquivado', variant: 'outline' as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { 
      label: status, 
      variant: 'outline' as const 
    };
    
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatCurrency = (value: string | undefined) => {
    if (value === undefined || value === null || value === '') return 'R$ 0,00';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  };

  const formatNumber = (value: string | undefined) => {
    if (value === undefined || value === null || value === '') return '0';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '0';
    return new Intl.NumberFormat('pt-BR').format(numValue);
  };

  const formatPercent = (value: string | undefined) => {
    if (value === undefined || value === null || value === '') return '0,00%';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '0,00%';
    return `${numValue.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="ml-8 mt-2 border-l-2 border-border pl-4">
        <div className="text-center py-4 text-sm text-muted-foreground">
          Carregando anúncios...
        </div>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="ml-8 mt-2 border-l-2 border-border pl-4">
        <div className="text-center py-4 text-sm text-muted-foreground">
          Nenhum anúncio encontrado
        </div>
      </div>
    );
  }

  // Filtrar anúncios com resultados se necessário
  const filteredAds = showOnlyWithResults 
    ? ads.filter(ad => {
        const insights = ad.insights;
        return insights && (
          parseFloat(insights.impressions || '0') > 0 ||
          parseFloat(insights.clicks || '0') > 0 ||
          parseFloat(insights.spend || '0') > 0
        );
      })
    : ads;

  return (
    <div className="ml-8 mt-2 border-l-2 border-border pl-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">
          Anúncios ({filteredAds.length}{showOnlyWithResults ? ` de ${ads.length}` : ''}) - {adsetName}
        </div>
        <Button
          onClick={() => setShowOnlyWithResults(!showOnlyWithResults)}
          variant={showOnlyWithResults ? "default" : "outline"}
          size="sm"
        >
          {showOnlyWithResults ? "Mostrar Todos" : "Apenas com Resultados"}
        </Button>
      </div>
      
      <div className="space-y-3">
        {filteredAds.map((ad) => (
          <div 
            key={ad.id} 
            className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex gap-4">
              {/* Preview da imagem/vídeo */}
              <div className="flex-shrink-0">
                {ad.creative ? (
                  <>
                    {ad.creative.image_url || ad.creative.thumbnail_url ? (
                      <div className="relative group">
                        <img 
                          src={ad.creative.image_url || ad.creative.thumbnail_url} 
                          alt="Creative" 
                          className="w-32 h-32 object-cover rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => {
                            const url = ad.creative?.image_url || ad.creative?.thumbnail_url;
                            if (url) window.open(url, '_blank');
                          }}
                        />
                        {ad.creative.video_id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                              <Play className="h-5 w-5 text-gray-900 ml-0.5" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : ad.creative.video_id ? (
                      <div className="w-32 h-32 rounded-lg border border-border flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                        <Play className="h-10 w-10 text-blue-600 dark:text-blue-400 mb-1" />
                        <span className="text-xs text-muted-foreground font-medium">Vídeo</span>
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                        <span className="text-3xl">📄</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                    <span className="text-3xl">❓</span>
                  </div>
                )}
              </div>

              {/* Conteúdo do anúncio */}
              <div className="flex-1 min-w-0">
                {/* Cabeçalho com nome e status */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate mb-1">
                      {ad.name}
                    </h4>
                    {ad.creative?.name && ad.creative.name !== ad.name && (
                      <div className="text-xs text-muted-foreground">
                        {ad.creative.name}
                      </div>
                    )}
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    {getStatusBadge(ad.status)}
                  </div>
                </div>

                {/* Conteúdo do criativo */}
                {ad.creative ? (
                  <div className="space-y-2">
                    {/* Título */}
                    {ad.creative.title && (
                      <div className="font-medium text-sm text-foreground line-clamp-2">
                        {ad.creative.title}
                      </div>
                    )}
                    
                    {/* Corpo do texto */}
                    {ad.creative.body && (
                      <div className="text-sm text-muted-foreground line-clamp-3">
                        {ad.creative.body}
                      </div>
                    )}
                    
                    {/* Call to Action */}
                    {ad.creative.call_to_action_type && (
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">
                        <ExternalLink className="h-3 w-3" />
                        {ad.creative.call_to_action_type}
                      </div>
                    )}
                    
                    {/* Mensagem quando não há preview */}
                    {!ad.creative.title && !ad.creative.body && !ad.creative.image_url && !ad.creative.thumbnail_url && !ad.creative.video_id && (
                      <div className="text-sm text-muted-foreground/70 italic">
                        Criativo sem preview disponível
                        <div className="text-xs text-muted-foreground/50 mt-1">
                          ID: {ad.creative.id}
                        </div>
                      </div>
                    )}
                    
                    {/* Apenas imagem sem texto */}
                    {!ad.creative.title && !ad.creative.body && (ad.creative.image_url || ad.creative.thumbnail_url || ad.creative.video_id) && (
                      <div className="text-sm text-muted-foreground italic">
                        {ad.creative.video_id ? 'Vídeo sem texto' : 'Apenas imagem (sem texto)'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Criativo não disponível
                  </div>
                )}

                {/* Métricas do anúncio */}
                <div className="grid grid-cols-6 gap-3 mt-3 pt-3 border-t border-border">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Gasto</div>
                    <div className="font-semibold text-sm">
                      {ad.insights && parseFloat(ad.insights.spend || '0') > 0 ? (
                        formatCurrency(ad.insights.spend)
                      ) : (
                        <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado. Tente um período maior ou verifique se o anúncio está ativo.">
                          Sem dados
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Impressões</div>
                    <div className="font-semibold text-sm">
                      {ad.insights && parseFloat(ad.insights.impressions || '0') > 0 ? (
                        formatNumber(ad.insights.impressions)
                      ) : (
                        <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Cliques</div>
                    <div className="font-semibold text-sm">
                      {ad.insights && parseFloat(ad.insights.clicks || '0') > 0 ? (
                        formatNumber(ad.insights.clicks)
                      ) : (
                        <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">CTR</div>
                    <div className="font-semibold text-sm">
                      {ad.insights && parseFloat(ad.insights.ctr || '0') > 0 ? (
                        formatPercent(ad.insights.ctr)
                      ) : (
                        <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">CPC</div>
                    <div className="font-semibold text-sm">
                      {ad.insights && parseFloat(ad.insights.cpc || '0') > 0 ? (
                        formatCurrency(ad.insights.cpc)
                      ) : (
                        <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Alcance</div>
                    <div className="font-semibold text-sm">
                      {ad.insights && parseFloat(ad.insights.reach || '0') > 0 ? (
                        formatNumber(ad.insights.reach)
                      ) : (
                        <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rodapé com data e ações */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    Criado em {new Date(ad.created_time).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={ad.status === 'ACTIVE' ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleToggleStatus(ad)}
                      disabled={updatingStatus === ad.id}
                    >
                      {updatingStatus === ad.id ? (
                        'Atualizando...'
                      ) : ad.status === 'ACTIVE' ? (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Ativar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`https://business.facebook.com/adsmanager/manage/ads?act=${adAccountId}&selected_ad_ids=${ad.id}`, '_blank')}
                      title="Ver no Gerenciador de Anúncios"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
