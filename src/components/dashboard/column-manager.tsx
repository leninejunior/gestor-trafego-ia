'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult 
} from '@hello-pangea/dnd';
import { 
  Settings, 
  GripVertical, 
  Eye, 
  EyeOff, 
  Plus, 
  Calculator,
  TrendingUp,
  DollarSign,
  MousePointer,
  BarChart3
} from 'lucide-react';
import { DashboardColumn } from '@/lib/types/custom-metrics';

interface ColumnManagerProps {
  columns: DashboardColumn[];
  onColumnsChange: (columns: DashboardColumn[]) => void;
  customMetrics?: Array<{ id: string; name: string; category: string }>;
}

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
  { key: 'reach', label: 'Alcance', type: 'metric', visible: false, width: 120, format: 'number' },
  { key: 'frequency', label: 'Frequência', type: 'metric', visible: false, width: 100, format: 'number' },
];

export function ColumnManager({ columns, onColumnsChange, customMetrics = [] }: ColumnManagerProps) {
  const [localColumns, setLocalColumns] = useState<DashboardColumn[]>(columns);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);

  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(localColumns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setLocalColumns(items);
    onColumnsChange(items);
  };

  const toggleColumnVisibility = (columnKey: string) => {
    const updatedColumns = localColumns.map(col =>
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    );
    setLocalColumns(updatedColumns);
    onColumnsChange(updatedColumns);
  };

  const updateColumnWidth = (columnKey: string, width: number) => {
    const updatedColumns = localColumns.map(col =>
      col.key === columnKey ? { ...col, width } : col
    );
    setLocalColumns(updatedColumns);
    onColumnsChange(updatedColumns);
  };

  const addCustomMetricColumn = (metricId: string, metricName: string) => {
    const newColumn: DashboardColumn = {
      key: `custom_${metricId}`,
      label: metricName,
      type: 'custom_metric',
      visible: true,
      width: 120,
      format: 'number',
      custom_metric_id: metricId
    };

    const updatedColumns = [...localColumns, newColumn];
    setLocalColumns(updatedColumns);
    onColumnsChange(updatedColumns);
  };

  const removeColumn = (columnKey: string) => {
    const updatedColumns = localColumns.filter(col => col.key !== columnKey);
    setLocalColumns(updatedColumns);
    onColumnsChange(updatedColumns);
  };

  const resetToDefault = () => {
    setLocalColumns(DEFAULT_COLUMNS);
    onColumnsChange(DEFAULT_COLUMNS);
  };

  const getColumnIcon = (type: string) => {
    switch (type) {
      case 'metric':
        return <BarChart3 className="h-4 w-4" />;
      case 'custom_metric':
        return <Calculator className="h-4 w-4" />;
      default:
        return <MousePointer className="h-4 w-4" />;
    }
  };

  const getColumnTypeColor = (type: string) => {
    switch (type) {
      case 'metric':
        return 'bg-blue-100 text-blue-800';
      case 'custom_metric':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const filteredColumns = localColumns.filter(column => {
    const matchesSearch = column.label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVisibility = !showOnlyVisible || column.visible;
    return matchesSearch && matchesVisibility;
  });

  const visibleCount = localColumns.filter(col => col.visible).length;
  const totalCount = localColumns.length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Gerenciar Colunas
          <Badge variant="secondary" className="ml-1">
            {visibleCount}/{totalCount}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Gerenciar Colunas do Dashboard
          </DialogTitle>
          <DialogDescription>
            Personalize quais colunas são exibidas e sua ordem. Arraste para reordenar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Controles */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Buscar colunas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-visible"
                  checked={showOnlyVisible}
                  onCheckedChange={setShowOnlyVisible}
                />
                <Label htmlFor="show-visible" className="text-sm">
                  Apenas visíveis
                </Label>
              </div>
              <Button variant="outline" size="sm" onClick={resetToDefault}>
                Restaurar Padrão
              </Button>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{visibleCount}</div>
                <div className="text-sm text-muted-foreground">Visíveis</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{totalCount - visibleCount}</div>
                <div className="text-sm text-muted-foreground">Ocultas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {localColumns.filter(col => col.type === 'custom_metric').length}
                </div>
                <div className="text-sm text-muted-foreground">Personalizadas</div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Colunas */}
          <div className="flex-1 overflow-auto">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="columns">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {filteredColumns.map((column, index) => (
                      <Draggable key={column.key} draggableId={column.key} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`transition-all ${
                              snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                            } ${!column.visible ? 'opacity-60' : ''}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                {/* Drag Handle */}
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                                </div>

                                {/* Column Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {getColumnIcon(column.type)}
                                    <h4 className="font-medium truncate">{column.label}</h4>
                                    <Badge className={getColumnTypeColor(column.type)}>
                                      {column.type === 'custom_metric' ? 'Personalizada' : 
                                       column.type === 'metric' ? 'Métrica' : 'Dimensão'}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Chave: {column.key} • Formato: {column.format || 'padrão'}
                                  </div>
                                </div>

                                {/* Width Control */}
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-muted-foreground">Largura:</Label>
                                  <Input
                                    type="number"
                                    value={column.width || 120}
                                    onChange={(e) => updateColumnWidth(column.key, parseInt(e.target.value) || 120)}
                                    className="w-20 h-8"
                                    min="50"
                                    max="500"
                                  />
                                </div>

                                {/* Visibility Toggle */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleColumnVisibility(column.key)}
                                  className="flex items-center gap-1"
                                >
                                  {column.visible ? (
                                    <>
                                      <Eye className="h-4 w-4" />
                                      <span className="hidden sm:inline">Visível</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="h-4 w-4" />
                                      <span className="hidden sm:inline">Oculta</span>
                                    </>
                                  )}
                                </Button>

                                {/* Remove Custom Metric */}
                                {column.type === 'custom_metric' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeColumn(column.key)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    ×
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* Add Custom Metrics */}
          {customMetrics.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Métricas Personalizadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {customMetrics
                    .filter(metric => !localColumns.some(col => col.custom_metric_id === metric.id))
                    .map(metric => (
                      <Button
                        key={metric.id}
                        variant="outline"
                        size="sm"
                        onClick={() => addCustomMetricColumn(metric.id, metric.name)}
                        className="flex items-center gap-1"
                      >
                        <Calculator className="h-3 w-3" />
                        {metric.name}
                      </Button>
                    ))
                  }
                </div>
                {customMetrics.every(metric => 
                  localColumns.some(col => col.custom_metric_id === metric.id)
                ) && (
                  <p className="text-sm text-muted-foreground">
                    Todas as métricas personalizadas já foram adicionadas
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}