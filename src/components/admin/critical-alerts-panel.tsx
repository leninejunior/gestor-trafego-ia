/**
 * Painel de alertas críticos para problemas do sistema
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Alert,
  AlertDescription,
  AlertTitle
} from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  AlertCircle,
  X,
  Link
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CriticalAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'payment' | 'webhook' | 'system' | 'integration';
  created_at: string;
  resolved_at?: string;
  metadata?: any;
  action_url?: string;
}

interface CriticalAlertsPanelProps {
  className?: string;
}

export function CriticalAlertsPanel({ className }: CriticalAlertsPanelProps) {
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'critical'>('unresolved');

  const { toast } = useToast();

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filter !== 'all') {
        if (filter === 'unresolved') {
          params.append('resolved', 'false');
        } else if (filter === 'critical') {
          params.append('severity', 'critical');
        }
      }

      const response = await fetch(`/api/admin/alerts?${params}`);
      const data = await response.json();

      if (response.ok) {
        setAlerts(data.alerts || []);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar alertas',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    
    // Atualizar alertas a cada 30 segundos
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/resolve`, {
        method: 'POST'
      });

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Alerta marcado como resolvido'
        });
        fetchAlerts();
      } else {
        const data = await response.json();
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao resolver alerta',
        variant: 'destructive'
      });
    }
  };

  const getAlertIcon = (type: string, severity: string) => {
    if (severity === 'critical') {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200'
    };

    return (
      <Badge className={variants[severity as keyof typeof variants] || variants.medium}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const variants = {
      payment: 'bg-green-100 text-green-800',
      webhook: 'bg-purple-100 text-purple-800',
      system: 'bg-gray-100 text-gray-800',
      integration: 'bg-indigo-100 text-indigo-800'
    };

    return (
      <Badge variant="outline" className={variants[category as keyof typeof variants]}>
        {category}
      </Badge>
    );
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'unresolved') return !alert.resolved_at;
    if (filter === 'critical') return alert.severity === 'critical';
    return true;
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.resolved_at).length;
  const unresolvedCount = alerts.filter(a => !a.resolved_at).length;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Alertas Críticos</h3>
          {criticalCount > 0 && (
            <Badge className="bg-red-100 text-red-800">
              {criticalCount} críticos
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Todos ({alerts.length})
          </Button>
          <Button
            variant={filter === 'unresolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unresolved')}
          >
            Não Resolvidos ({unresolvedCount})
          </Button>
          <Button
            variant={filter === 'critical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('critical')}
          >
            Críticos ({criticalCount})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Carregando alertas...
            </div>
          </CardContent>
        </Card>
      ) : filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">Nenhum alerta encontrado</p>
              <p className="text-sm">
                {filter === 'critical' 
                  ? 'Não há alertas críticos no momento'
                  : filter === 'unresolved'
                  ? 'Todos os alertas foram resolvidos'
                  : 'Sistema funcionando normalmente'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <Alert 
              key={alert.id} 
              className={`${
                alert.severity === 'critical' 
                  ? 'border-red-200 bg-red-50' 
                  : alert.type === 'error'
                  ? 'border-orange-200 bg-orange-50'
                  : 'border-yellow-200 bg-yellow-50'
              } ${alert.resolved_at ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getAlertIcon(alert.type, alert.severity)}
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <AlertTitle className="text-sm font-medium">
                        {alert.title}
                      </AlertTitle>
                      {getSeverityBadge(alert.severity)}
                      {getCategoryBadge(alert.category)}
                      {alert.resolved_at && (
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          Resolvido
                        </Badge>
                      )}
                    </div>
                    
                    <AlertDescription className="text-sm">
                      {alert.description}
                    </AlertDescription>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.created_at).toLocaleString('pt-BR')}
                      </div>
                      
                      {alert.resolved_at && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Resolvido em {new Date(alert.resolved_at).toLocaleString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {alert.action_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(alert.action_url, '_blank')}
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {!alert.resolved_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}