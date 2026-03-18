'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ColumnManager } from '@/components/dashboard/column-manager';
import { ViewBuilder } from '@/components/dashboard/view-builder';
import { SavedViews } from '@/components/dashboard/saved-views';
import { 
  Eye, 
  Settings, 
  Plus, 
  Table, 
  Filter, 
  SortAsc,
  BarChart3,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  CustomDashboardView, 
  DashboardColumn, 
  CustomMetric 
} from '@/lib/types/custom-metrics';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_COLUMNS: DashboardColumn[] = [
  { key: 'campaign_name', label: 'Campanha', type: 'dimension', visible: true, width: 200 },
  { key: 'objective', label: 'Objetivo', type: 'dimension', visible: true, width: 120 },
  { key: 'status', label: 'Status', type: 'dimension', visible: true, width: 100 },
  { key: 'spend', label: 'Gasto', type: 'metric', visible: true, width: 120, format: 'currency' },
  { key: 'impressions', label: 'Impressões', type: 'metric', visible: true, width: 120, format: 'number' },
  { key: 'clicks', label: 'Cliques', type: 'metric', visible: true, width: 100, format: 'number' },
  { key: 'ctr', label: 'CTR', type: 'metric', visible: true, width: 80, format: 'percentage' },
  { key: 'cpc', label: 'CPC', type: 'metric', visible: true, width: 100, format: 'currency' },
  { key: 'conversions', label: 'Conversões', type: 'metric', visible: false, width: 120, format: 'number' },
  { key: 'cpa', label: 'CPA', type: 'metric', visible: false, width: 100, format: 'currency' },
  { key: 'roas', label: 'ROAS', type: 'metric', visible: false, width: 100, format: 'number' },
];

export default function CustomViewsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentColumns, setCurrentColumns] = useState<DashboardColumn[]>(DEFAULT_COLUMNS);
  const [currentView, setCurrentView] = useState<CustomDashboardView | null>(null);
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [showViewBuilder, setShowViewBuilder] = useState(false);
  const [editingView, setEditingView] = useState<CustomDashboardView | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadCustomMetrics();
    loadDefaultView();
  }, []);

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

  const loadDefaultView = async () => {
    try {
      const response = await fetch('/api/dashboard/views?default=true');
      const data = await response.json();
      
      if (response.ok && data.views?.length > 0) {
        const defaultView = data.views[0];
        setCurrentView(defaultView);
        setCurrentColumns(defaultView.view_config.columns || DEFAULT_COLUMNS);
      }
    } catch (error) {
      console.error('Erro ao carregar visualização padrão:', error);
    }
  };

  const handleCreateNewView = () => {
    setEditingView(null);
    setShowViewBuilder(true);
  };

  const handleEditView = (view: CustomDashboardView) => {
    setEditingView(view);
    setShowViewBuilder(true);
  };

  const handleApplyView = (view: CustomDashboardView) => {
    setCurrentView(view);
    setCurrentColumns(view.view_config.columns || DEFAULT_COLUMNS);
    toast({
      title: 'Visualização Aplicada',
      description: `Visualização "${view.name}" foi aplicada com sucesso`,
    });
  };

  const handleSaveView = async (viewData: Partial<CustomDashboardView>) => {
    try {
      const isEditing = !!editingView;
      const url = '/api/dashboard/views';
      const method = isEditing ? 'PUT' : 'POST';
      const body = isEditing 
        ? { id: editingView.id, ...viewData }
        : viewData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: `Visualização ${isEditing ? 'atualizada' : 'criada'} com sucesso`,
        });
        setShowViewBuilder(false);
        setEditingView(null);
        
        // Se foi definida como padrão, aplicar automaticamente
        if (viewData.is_default) {
          handleApplyView(data.view);
        }
      } else {
        toast({
          title: 'Erro',
          description: data.error || `Erro ao ${isEditing ? 'atualizar' : 'criar'} visualização`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Erro ao ${editingView ? 'atualizar' : 'criar'} visualização`,
        variant: 'destructive',
      });
    }
  };

  const handleCancelViewBuilder = () => {
    setShowViewBuilder(false);
    setEditingView(null);
  };

  const visibleColumns = currentColumns.filter(col => col.visible);
  const totalFilters = currentView?.view_config.filters?.length || 0;
  const totalSorting = currentView?.view_config.sorting?.length || 0;

  if (showViewBuilder) {
    return (
      <ViewBuilder
        onSave={handleSaveView}
        onCancel={handleCancelViewBuilder}
        initialData={editingView || undefined}
        availableColumns={currentColumns}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Layers className="h-8 w-8" />
            Dashboard Personalizável
          </h1>
          <p className="text-muted-foreground">
            Configure visualizações customizadas com colunas, filtros e ordenação específicos
          </p>
        </div>
        <div className="flex gap-2">
          <ColumnManager
            columns={currentColumns}
            onColumnsChange={setCurrentColumns}
            customMetrics={customMetrics.map(m => ({ id: m.id, name: m.name, category: m.category }))}
          />
          <Button onClick={handleCreateNewView} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Visualização
          </Button>
        </div>
      </div>

      {/* Current View Info */}
      {currentView && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {currentView.name}
                    {currentView.is_default && (
                      <Badge variant="secondary" className="text-xs">Padrão</Badge>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {currentView.description || 'Visualização personalizada ativa'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Table className="h-4 w-4 text-muted-foreground" />
                  <span>{visibleColumns.length} colunas</span>
                </div>
                <div className="flex items-center gap-1">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span>{totalFilters} filtros</span>
                </div>
                <div className="flex items-center gap-1">
                  <SortAsc className="h-4 w-4 text-muted-foreground" />
                  <span>{totalSorting} ordenações</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="views" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Visualizações
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-blue-600">{visibleColumns.length}</div>
                <div className="text-sm text-muted-foreground">Colunas Visíveis</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-green-600">{totalFilters}</div>
                <div className="text-sm text-muted-foreground">Filtros Ativos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-purple-600">{totalSorting}</div>
                <div className="text-sm text-muted-foreground">Ordenações</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {currentColumns.filter(col => col.type === 'custom_metric').length}
                </div>
                <div className="text-sm text-muted-foreground">Métricas Personalizadas</div>
              </CardContent>
            </Card>
          </div>

          {/* Current Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table className="h-5 w-5" />
                  Colunas Configuradas
                </CardTitle>
                <CardDescription>
                  Colunas atualmente visíveis na visualização
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {visibleColumns.map(column => (
                    <div key={column.key} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <span className="font-medium">{column.label}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({column.format || 'padrão'})
                        </span>
                      </div>
                      <Badge variant={column.type === 'custom_metric' ? 'default' : 'secondary'}>
                        {column.type === 'custom_metric' ? 'Personalizada' : 
                         column.type === 'metric' ? 'Métrica' : 'Dimensão'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Recursos Disponíveis
                </CardTitle>
                <CardDescription>
                  Funcionalidades do dashboard personalizável
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2">
                    <div className="p-1 bg-blue-100 rounded">
                      <Settings className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">Gerenciamento de Colunas</div>
                      <div className="text-sm text-muted-foreground">Drag & drop, visibilidade, largura</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2">
                    <div className="p-1 bg-green-100 rounded">
                      <Filter className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium">Filtros Avançados</div>
                      <div className="text-sm text-muted-foreground">Múltiplos operadores e condições</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2">
                    <div className="p-1 bg-purple-100 rounded">
                      <SortAsc className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium">Ordenação Customizada</div>
                      <div className="text-sm text-muted-foreground">Múltiplos níveis de ordenação</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2">
                    <div className="p-1 bg-orange-100 rounded">
                      <Eye className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <div className="font-medium">Visualizações Salvas</div>
                      <div className="text-sm text-muted-foreground">Salvar e compartilhar configurações</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="views">
          <SavedViews
            onCreateNew={handleCreateNewView}
            onEdit={handleEditView}
            onApply={handleApplyView}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Dashboard</CardTitle>
              <CardDescription>
                Ajuste as configurações gerais do dashboard personalizável
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Configurações Atuais</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Visualização Ativa:</span>
                      <span className="ml-2 font-medium">{currentView?.name || 'Padrão'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo de Gráfico:</span>
                      <span className="ml-2 font-medium">{currentView?.view_config.chart_type || 'Tabela'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Colunas Visíveis:</span>
                      <span className="ml-2 font-medium">{visibleColumns.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Filtros Ativos:</span>
                      <span className="ml-2 font-medium">{totalFilters}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleCreateNewView} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Visualização
                  </Button>
                  <ColumnManager
                    columns={currentColumns}
                    onColumnsChange={setCurrentColumns}
                    customMetrics={customMetrics.map(m => ({ id: m.id, name: m.name, category: m.category }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}