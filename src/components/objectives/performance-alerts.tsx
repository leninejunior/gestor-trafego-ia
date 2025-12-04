'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  BellOff,
  MoreVertical,
  Search,
  Filter,
  Clock,
  Target,
  X,
  Eye
} from 'lucide-react';
import { PerformanceAlert } from '@/lib/types/custom-metrics';
import { useToast } from '@/hooks/use-toast';

interface PerformanceAlertsProps {
  onViewDetails?: (alert: PerformanceAlert) => void;
}

export function PerformanceAlerts({ onViewDetails }: PerformanceAlertsProps) {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('unread');
  const { toast } = useToast();

  useEffect(() => {
    loadAlerts();
  }, [severityFilter, statusFilter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (severityFilter !== 'all') {
        params.append('severity', severityFilter);
      }
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/objectives/alerts?${params}`);
      const data = await response.json();

      if (response.ok) {
        setAlerts(data.alerts || []);
      } else {
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao carregar alertas',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar alertas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const response = await fetch('/api/objectives/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: alertId,
          is_read: true,
        }),
      });

      if (response.ok) {
        await loadAlerts();
        toast({
          title: 'Sucesso',
          description: 'Alerta marcado como lido',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao marcar alerta como lido',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao marcar alerta como lido',
        variant: 'destructive',
      });
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      const response = await fetch('/api/objectives/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: alertId,
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        await loadAlerts();
        toast({
          title: 'Sucesso',
          description: 'Alerta resolvido',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao resolver alerta',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao resolver alerta',
        variant: 'destructive',
      });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'high':
        return <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
      case 'medium':
        return <TrendingUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'above_max':
        return 'Acima do Máximo';
      case 'below_min':
        return 'Abaixo do Mínimo';
      case 'target_reached':
        return 'Meta Atingida';
      default:
        return type;
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'above_max':
        return <TrendingUp className="h-4 w-4" />;
      case 'below_min':
        return <TrendingDown className="h-4 w-4" />;
      case 'target_reached':
        return <Target className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const unreadCount = alerts.filter(alert => !alert.is_read).length;
  const criticalCount = alerts.filter(alert => alert.severity === 'critical' && !alert.is_resolved).length;

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas de Performance
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">
            Monitore métricas que saíram dos ranges ideais
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <div className="text-sm text-muted-foreground">Críticos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {alerts.filter(a => a.severity === 'high' && !a.is_resolved).length}
            </div>
            <div className="text-sm text-muted-foreground">Alta Prioridade</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
            <div className="text-sm text-muted-foreground">Não Lidos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {alerts.filter(a => a.is_resolved).length}
            </div>
            <div className="text-sm text-muted-foreground">Resolvidos</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar alertas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Severidade
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSeverityFilter('all')}>
                    Todas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter('critical')}>
                    Crítica
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter('high')}>
                    Alta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter('medium')}>
                    Média
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter('low')}>
                    Baixa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                    Todos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('unread')}>
                    Não Lidos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('unresolved')}>
                    Não Resolvidos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('resolved')}>
                    Resolvidos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm ? 'Nenhum alerta encontrado' : 'Nenhum alerta ativo'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Tente ajustar os filtros de busca'
                : 'Todas as métricas estão dentro dos ranges ideais'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <Card 
              key={alert.id} 
              className={`transition-all hover:shadow-md ${
                !alert.is_read ? 'border-l-4 border-l-primary bg-primary/5' : ''
              } ${alert.is_resolved ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                      {getSeverityIcon(alert.severity)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">
                          {alert.campaign_id ? `Campanha ${alert.campaign_id}` : 'Alerta Geral'}
                        </h4>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getAlertTypeIcon(alert.alert_type)}
                          {getAlertTypeLabel(alert.alert_type)}
                        </Badge>
                        {!alert.is_read && (
                          <Badge variant="secondary" className="text-xs">Novo</Badge>
                        )}
                        {alert.is_resolved && (
                          <Badge variant="outline" className="text-xs text-green-600">Resolvido</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.message}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Valor: {alert.current_value}
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Limite: {alert.threshold_value}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(alert.triggered_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onViewDetails && (
                        <DropdownMenuItem onClick={() => onViewDetails(alert)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                      )}
                      {!alert.is_read && (
                        <DropdownMenuItem onClick={() => handleMarkAsRead(alert.id)}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Marcar como Lido
                        </DropdownMenuItem>
                      )}
                      {!alert.is_resolved && (
                        <DropdownMenuItem onClick={() => handleResolve(alert.id)}>
                          <X className="h-4 w-4 mr-2" />
                          Resolver
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}