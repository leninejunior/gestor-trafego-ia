'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Zap
} from "lucide-react";

interface RealTimeInsightsProps {
  clientId?: string;
}

interface Alert {
  id: string;
  type: 'warning' | 'success' | 'info' | 'error';
  title: string;
  message: string;
  campaignName: string;
  timestamp: Date;
}

export function RealTimeInsights({ clientId }: RealTimeInsightsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (clientId && isMonitoring) {
      const interval = setInterval(() => {
        checkForAlerts();
      }, 30000); // Verificar a cada 30 segundos

      return () => clearInterval(interval);
    }
  }, [clientId, isMonitoring]);

  const checkForAlerts = async () => {
    if (!clientId) return;

    try {
      // Buscar campanhas ativas
      const campaignsResponse = await fetch(`/api/meta/campaigns?clientId=${clientId}`);
      if (!campaignsResponse.ok) return;

      const campaignsData = await campaignsResponse.json();
      const activeCampaigns = campaignsData.campaigns?.filter((c: any) => c.status === 'ACTIVE') || [];

      const newAlerts: Alert[] = [];

      // Verificar cada campanha ativa
      for (const campaign of activeCampaigns) {
        try {
          const insightsResponse = await fetch(
            `/api/meta/insights?clientId=${clientId}&campaignId=${campaign.id}`
          );
          
          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json();
            const insights = insightsData.insights[0];

            if (insights) {
              // Verificar alertas baseados nas métricas
              const ctr = insights.ctr || 0;
              const cpm = insights.cpm || 0;
              const spend = insights.spend || 0;
              const dailyBudget = campaign.daily_budget || 0;

              // Alerta: CTR muito baixo
              if (ctr < 0.005) {
                newAlerts.push({
                  id: `${campaign.id}-low-ctr`,
                  type: 'warning',
                  title: 'CTR Baixo Detectado',
                  message: `CTR de ${(ctr * 100).toFixed(2)}% está abaixo do esperado`,
                  campaignName: campaign.name,
                  timestamp: new Date()
                });
              }

              // Alerta: CTR excelente
              if (ctr > 0.02) {
                newAlerts.push({
                  id: `${campaign.id}-high-ctr`,
                  type: 'success',
                  title: 'Excelente Performance!',
                  message: `CTR de ${(ctr * 100).toFixed(2)}% está muito acima da média`,
                  campaignName: campaign.name,
                  timestamp: new Date()
                });
              }

              // Alerta: CPM alto
              if (cpm > 30) {
                newAlerts.push({
                  id: `${campaign.id}-high-cpm`,
                  type: 'error',
                  title: 'CPM Elevado',
                  message: `CPM de R$ ${cpm.toFixed(2)} pode estar impactando o ROI`,
                  campaignName: campaign.name,
                  timestamp: new Date()
                });
              }

              // Alerta: Orçamento quase esgotado
              if (dailyBudget > 0 && spend > dailyBudget * 0.8) {
                newAlerts.push({
                  id: `${campaign.id}-budget-alert`,
                  type: 'info',
                  title: 'Orçamento Quase Esgotado',
                  message: `Já gastou R$ ${spend.toFixed(2)} de R$ ${dailyBudget.toFixed(2)} do orçamento diário`,
                  campaignName: campaign.name,
                  timestamp: new Date()
                });
              }
            }
          }
        } catch (error) {
          console.error(`Erro ao verificar campanha ${campaign.id}:`, error);
        }
      }

      // Atualizar alertas (manter apenas os mais recentes)
      setAlerts(prev => {
        const combined = [...prev, ...newAlerts];
        const unique = combined.filter((alert, index, self) => 
          index === self.findIndex(a => a.id === alert.id)
        );
        return unique.slice(-10); // Manter apenas os 10 mais recentes
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao verificar alertas:', error);
    }
  };

  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring);
    if (!isMonitoring) {
      checkForAlerts(); // Verificar imediatamente ao ativar
    }
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'info':
        return <Activity className="w-4 h-4 text-blue-500" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getAlertBadgeVariant = (type: Alert['type']) => {
    switch (type) {
      case 'success':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      case 'info':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Insights em Tempo Real
            </CardTitle>
            <CardDescription>
              Monitoramento automático de performance das campanhas
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={isMonitoring ? "destructive" : "default"}
              size="sm"
              onClick={toggleMonitoring}
              disabled={!clientId}
            >
              {isMonitoring ? (
                <>
                  <Activity className="w-4 h-4 mr-2 animate-pulse" />
                  Parar
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  Iniciar
                </>
              )}
            </Button>
            {alerts.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAlerts}>
                Limpar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!clientId && (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Selecione um cliente para ativar o monitoramento em tempo real</p>
          </div>
        )}

        {clientId && !isMonitoring && alerts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Zap className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Clique em "Iniciar" para começar o monitoramento automático</p>
          </div>
        )}

        {isMonitoring && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Activity className="w-4 h-4 text-green-500 mr-2 animate-pulse" />
              <span className="text-sm text-green-700">
                Monitoramento ativo
                {lastUpdate && (
                  <span className="ml-2 text-green-600">
                    • Última verificação: {lastUpdate.toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Alertas Recentes</h4>
              <Badge variant="secondary">{alerts.length}</Badge>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 border rounded-lg bg-white shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h5 className="font-medium text-sm">{alert.title}</h5>
                          <Badge variant={getAlertBadgeVariant(alert.type)} className="text-xs">
                            {alert.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{alert.message}</p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>{alert.campaignName}</span>
                          <span>•</span>
                          <span>{alert.timestamp.toLocaleTimeString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}