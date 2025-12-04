"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Pause, ExternalLink } from "lucide-react";

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
}

interface AdsListProps {
  adsetId: string;
  adsetName: string;
  clientId?: string;
  adAccountId?: string;
}

export function AdsList({ adsetId, adsetName, clientId, adAccountId }: AdsListProps) {
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchAds();
  }, [adsetId]);

  const fetchAds = async () => {
    setIsLoading(true);
    console.log('🔍 [ADS LIST] Buscando anúncios para conjunto:', adsetId);
    try {
      let url = `/api/meta/ads?adsetId=${adsetId}`;
      if (clientId && adAccountId) {
        url += `&clientId=${clientId}&adAccountId=${adAccountId}`;
      }
      console.log('🔗 [ADS LIST] URL:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📊 [ADS LIST] Resposta:', { status: response.status, data });

      if (response.ok) {
        setAds(data.ads || []);
        console.log('✅ [ADS LIST] Anúncios carregados:', data.ads?.length || 0);
        // Log detalhado do primeiro anúncio
        if (data.ads?.[0]) {
          console.log('🔍 [ADS LIST] Primeiro anúncio:', {
            id: data.ads[0].id,
            name: data.ads[0].name,
            creative: data.ads[0].creative,
            hasTitle: !!data.ads[0].creative?.title,
            hasBody: !!data.ads[0].creative?.body,
            title: data.ads[0].creative?.title,
            bodyPreview: data.ads[0].creative?.body?.substring(0, 50)
          });
        }
      } else {
        console.error('❌ [ADS LIST] Erro:', data.error);
        toast.error(data.error || 'Erro ao carregar anúncios');
      }
    } catch (error) {
      console.error('💥 [ADS LIST] Erro na requisição:', error);
      toast.error('Erro ao carregar anúncios');
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

  return (
    <div className="ml-8 mt-2 border-l-2 border-border pl-4">
      <div className="mb-3 text-sm font-medium text-muted-foreground">
        Anúncios ({adsetName}) - {ads.length} {ads.length === 1 ? 'anúncio' : 'anúncios'}
      </div>
      
      <div className="space-y-3">
        {ads.map((ad) => (
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
