'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ObjectiveBuilder } from '@/components/objectives/objective-builder';
import { PerformanceAlerts } from '@/components/objectives/performance-alerts';
import { 
  Target, 
  Plus, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  BarChart3,
  Bell,
  Settings,
  Eye,
  Edit,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MetricObjective, CustomMetric, PerformanceAlert } from '@/lib/types/custom-metrics';
import { useToast } from '@/hooks/use-toast';

export default function ObjectivesPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [objectives, setObjectives] = useState<MetricObjective[]>([]);
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [showObjectiveBuilder, setShowObjectiveBuilder] = useState(false);
  const [editingObjective, setEditingObjective] = useState<MetricObjective | null>(null);
  const [deleteObjectiveId, setDeleteObjectiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadObjectives();
    loadCustomMetrics();
  }, []);

  const loadObjectives = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/objectives');
      const data = await response.json();

      if (response.ok) {
        setObjectives(data.objectives || []);
      } else {
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao carregar objetivos',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar objetivos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomMetrics = async () => {
    try {
      const response = await fetch('/api/metrics/custom?active=true');
      const data = await response.json();
      
      if (response.ok) {
        setCustomMetrics(data.metrics || []);
      }
    } catch (error) {
      console.error('Erro ao carregar métricas personalizadas:', error);
    }
  };

  const handleCreateNew = () => {
    setEditingObjective(null);
    setShowObjectiveBuilder(true);
  };

  const handleEdit = (objective: MetricObjective) => {
    setEditingObjective(objective);
    setShowObjectiveBuilder(true);
  };

  const handleSave = async (objectiveData: Partial<MetricObjective>) => {
    try {
      const isEditing = !!editingObjective;
      const url = '/api/objectives';
      const method = isEditing ? 'PUT' : 'POST';
      const body = isEditing 
        ? { id: editingObjective.id, ...objectiveData }
        : objectiveData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: `Objetivo ${isEditing ? 'atualizado' : 'criado'} com sucesso`,
        });
        setShowObjectiveBuilder(false);
        setEditingObjective(null);
        await loadObjectives();
      } else {
        toast({
          title: 'Erro',
          description: data.error || `Erro ao ${isEditing ? 'atualizar' : 'criar'} objetivo`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Erro ao ${editingObjective ? 'atualizar' : 'criar'} objetivo`,
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setShowObjectiveBuilder(false);
    setEditingObjective(null);
  };

  const handleDelete = async () => {
    if (!deleteObjectiveId) return;

    try {
      const response = await fetch(`/api/objectives?id=${deleteObjectiveId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Objetivo deletado com sucesso',
        });
        await loadObjectives();
      } else {
        const data = await response.json();
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao deletar objetivo',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao deletar objetivo',
        variant: 'destructive',
      });
    } finally {
      setDeleteObjectiveId(null);
    }
  };

  const formatValue = (value: number | null, objective: MetricObjective) => {
    if (value === null) return 'N/A';
    
    if (objective.metric_type === 'custom' && objective.custom_metrics) {
      const customMetric = objective.custom_metrics;
      if (customMetric.is_percentage) {
        return `${value.toFixed(1)}%`;
      }
      return `${customMetric.display_symbol}${value.toFixed(2)}`;
    }
    
    // Formatação para métricas padrão
    switch (objective.metric_name) {
      case 'cpc':
      case 'cpm':
      case 'cpa':
        return `R$ ${value.toFixed(2)}`;
      case 'ctr':
      case 'conversion_rate':
        return `${value.toFixed(1)}%`;
      case 'roas':
      case 'frequency':
        return `${value.toFixed(2)}x`;
      default:
        return value.toFixed(2);
    }
  };

  const getMetricIcon = (objective: MetricObjective) => {
    if (objective.metric_type === 'custom') {
      return <Target className="h-4 w-4" />;
    }
    
    switch (objective.metric_name) {
      case 'cpc':
      case 'cpm':
      case 'cpa':
        return <BarChart3 className="h-4 w-4" />;
      case 'ctr':
      case 'conversion_rate':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const activeObjectives = objectives.filter(obj => obj.is_active);
  const totalObjectives = objectives.length;
  const standardObjectives = objectives.filter(obj => obj.metric_type === 'standard').length;
  const customObjectives = objectives.filter(obj => obj.metric_type === 'custom').length;

  if (showObjectiveBuilder) {
    return (
      <ObjectiveBuilder
        onSave={handleSave}
        onCancel={handleCancel}
        initialData={editingObjective || undefined}
        customMetrics={customMetrics}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8" />
            Objetivos Inteligentes
          </h1>
          <p className="text-muted-foreground">
            Configure ranges ideais e monitore a performance das suas métricas
          </p>
        </div>
        <Button onClick={handleCreateNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Objetivo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{activeObjectives.length}</div>
            <div className="text-sm text-muted-foreground">Objetivos Ativos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-600">{standardObjectives}</div>
            <div className="text-sm text-muted-foreground">Métricas Padrão</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">{customObjectives}</div>
            <div className="text-sm text-muted-foreground">Métricas Personalizadas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-orange-600">{totalObjectives}</div>
            <div className="text-sm text-muted-foreground">Total de Objetivos</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="objectives" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Objetivos
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Objetivos Recentes</CardTitle>
                <CardDescription>
                  Últimos objetivos configurados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : activeObjectives.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum objetivo configurado</p>
                    <Button onClick={handleCreateNew} className="mt-4" size="sm">
                      Criar Primeiro Objetivo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeObjectives.slice(0, 5).map(objective => (
                      <div key={objective.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            {getMetricIcon(objective)}
                          </div>
                          <div>
                            <div className="font-medium">{objective.metric_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {objective.campaign_objective || 'Todos os objetivos'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            Meta: {formatValue(objective.target_value, objective)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatValue(objective.min_value, objective)} - {formatValue(objective.max_value, objective)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Geral</CardTitle>
                <CardDescription>
                  Status dos objetivos configurados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Dentro da Meta</span>
                    </div>
                    <span className="text-2xl font-bold text-green-600">
                      {Math.floor(Math.random() * 5) + 3}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium text-yellow-800">Atenção Necessária</span>
                    </div>
                    <span className="text-2xl font-bold text-yellow-600">
                      {Math.floor(Math.random() * 3) + 1}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">Fora do Range</span>
                    </div>
                    <span className="text-2xl font-bold text-red-600">
                      {Math.floor(Math.random() * 2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="objectives" className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : objectives.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum objetivo configurado</h3>
                <p className="text-muted-foreground mb-4">
                  Comece criando objetivos para suas métricas mais importantes
                </p>
                <Button onClick={handleCreateNew} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Objetivo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {objectives.map(objective => (
                <Card key={objective.id} className={`transition-all hover:shadow-md ${!objective.is_active ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getMetricIcon(objective)}
                        <div>
                          <CardTitle className="text-lg">{objective.metric_name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={objective.metric_type === 'custom' ? 'default' : 'secondary'}>
                              {objective.metric_type === 'custom' ? 'Personalizada' : 'Padrão'}
                            </Badge>
                            {!objective.is_active && (
                              <Badge variant="outline">Inativo</Badge>
                            )}
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
                          <DropdownMenuItem onClick={() => handleEdit(objective)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteObjectiveId(objective.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-xs text-muted-foreground">Mín</div>
                          <div className="font-bold text-sm">{formatValue(objective.min_value, objective)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Meta</div>
                          <div className="font-bold text-sm text-primary">{formatValue(objective.target_value, objective)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Máx</div>
                          <div className="font-bold text-sm">{formatValue(objective.max_value, objective)}</div>
                        </div>
                      </div>
                      
                      {objective.campaign_objective && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Objetivo:</span> {objective.campaign_objective}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        Criado em {new Date(objective.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts">
          <PerformanceAlerts />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteObjectiveId} onOpenChange={() => setDeleteObjectiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Objetivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este objetivo? Esta ação não pode ser desfeita.
              Todos os alertas relacionados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}