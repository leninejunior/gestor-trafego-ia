'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Plus, 
  Save, 
  Eye, 
  Filter, 
  SortAsc, 
  SortDesc, 
  BarChart3, 
  LineChart, 
  PieChart, 
  Table,
  X,
  Settings
} from 'lucide-react';
import { 
  CustomDashboardView, 
  DashboardViewConfig, 
  DashboardColumn, 
  DashboardFilter, 
  DashboardSort 
} from '@/lib/types/custom-metrics';

interface ViewBuilderProps {
  onSave: (view: Partial<CustomDashboardView>) => void;
  onCancel: () => void;
  initialData?: Partial<CustomDashboardView>;
  availableColumns: DashboardColumn[];
}

const FILTER_OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'contains', label: 'Contém' },
  { value: 'between', label: 'Entre' },
];

const CHART_TYPES = [
  { value: 'table', label: 'Tabela', icon: Table },
  { value: 'line', label: 'Linha', icon: LineChart },
  { value: 'bar', label: 'Barras', icon: BarChart3 },
  { value: 'pie', label: 'Pizza', icon: PieChart },
];

export function ViewBuilder({ onSave, onCancel, initialData, availableColumns }: ViewBuilderProps) {
  const [formData, setFormData] = useState<Partial<CustomDashboardView>>({
    name: '',
    description: '',
    is_default: false,
    is_shared: false,
    view_config: {
      columns: availableColumns.filter(col => col.visible),
      filters: [],
      sorting: [],
      chart_type: 'table'
    },
    ...initialData
  });

  const [activeTab, setActiveTab] = useState('basic');

  const handleInputChange = (field: keyof CustomDashboardView, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfigChange = (field: keyof DashboardViewConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      view_config: {
        ...prev.view_config!,
        [field]: value
      }
    }));
  };

  const addFilter = () => {
    const newFilter: DashboardFilter = {
      key: '',
      operator: 'equals',
      value: ''
    };

    handleConfigChange('filters', [...(formData.view_config?.filters || []), newFilter]);
  };

  const updateFilter = (index: number, field: keyof DashboardFilter, value: any) => {
    const filters = [...(formData.view_config?.filters || [])];
    filters[index] = { ...filters[index], [field]: value };
    handleConfigChange('filters', filters);
  };

  const removeFilter = (index: number) => {
    const filters = formData.view_config?.filters?.filter((_, i) => i !== index) || [];
    handleConfigChange('filters', filters);
  };

  const addSort = () => {
    const newSort: DashboardSort = {
      key: '',
      direction: 'asc'
    };

    handleConfigChange('sorting', [...(formData.view_config?.sorting || []), newSort]);
  };

  const updateSort = (index: number, field: keyof DashboardSort, value: any) => {
    const sorting = [...(formData.view_config?.sorting || [])];
    sorting[index] = { ...sorting[index], [field]: value };
    handleConfigChange('sorting', sorting);
  };

  const removeSort = (index: number) => {
    const sorting = formData.view_config?.sorting?.filter((_, i) => i !== index) || [];
    handleConfigChange('sorting', sorting);
  };

  const toggleColumnInView = (columnKey: string) => {
    const currentColumns = formData.view_config?.columns || [];
    const columnExists = currentColumns.some(col => col.key === columnKey);
    
    if (columnExists) {
      const newColumns = currentColumns.filter(col => col.key !== columnKey);
      handleConfigChange('columns', newColumns);
    } else {
      const columnToAdd = availableColumns.find(col => col.key === columnKey);
      if (columnToAdd) {
        handleConfigChange('columns', [...currentColumns, columnToAdd]);
      }
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.view_config) {
      return;
    }

    onSave(formData);
  };

  const selectedColumns = formData.view_config?.columns || [];
  const filters = formData.view_config?.filters || [];
  const sorting = formData.view_config?.sorting || [];

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {initialData ? 'Editar Visualização' : 'Nova Visualização Personalizada'}
          </DialogTitle>
          <DialogDescription>
            Configure uma visualização personalizada com colunas, filtros e ordenação específicos
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="columns">Colunas</TabsTrigger>
              <TabsTrigger value="filters">Filtros</TabsTrigger>
              <TabsTrigger value="sorting">Ordenação</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto mt-4">
              <TabsContent value="basic" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Informações Básicas</CardTitle>
                    <CardDescription>
                      Configure o nome e descrição da visualização
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome da Visualização *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Ex: Campanhas de Conversão"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chart_type">Tipo de Visualização</Label>
                        <Select 
                          value={formData.view_config?.chart_type} 
                          onValueChange={(value) => handleConfigChange('chart_type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CHART_TYPES.map(type => {
                              const Icon = type.icon;
                              return (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    {type.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Descreva o propósito desta visualização..."
                        rows={3}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_default"
                          checked={formData.is_default}
                          onCheckedChange={(checked) => handleInputChange('is_default', checked)}
                        />
                        <Label htmlFor="is_default">Definir como padrão</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_shared"
                          checked={formData.is_shared}
                          onCheckedChange={(checked) => handleInputChange('is_shared', checked)}
                        />
                        <Label htmlFor="is_shared">Compartilhar com equipe</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="columns" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Seleção de Colunas</CardTitle>
                    <CardDescription>
                      Escolha quais colunas serão exibidas nesta visualização
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {selectedColumns.length} de {availableColumns.length} colunas selecionadas
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigChange('columns', availableColumns)}
                        >
                          Selecionar Todas
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availableColumns.map(column => {
                          const isSelected = selectedColumns.some(col => col.key === column.key);
                          return (
                            <div
                              key={column.key}
                              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                              }`}
                              onClick={() => toggleColumnInView(column.key)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">{column.label}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {column.key} • {column.format || 'padrão'}
                                  </p>
                                </div>
                                <Badge variant={isSelected ? 'default' : 'secondary'}>
                                  {column.type === 'custom_metric' ? 'Personalizada' : 
                                   column.type === 'metric' ? 'Métrica' : 'Dimensão'}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="filters" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros Avançados
                      </span>
                      <Button onClick={addFilter} size="sm" className="flex items-center gap-1">
                        <Plus className="h-4 w-4" />
                        Adicionar Filtro
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Configure filtros para refinar os dados exibidos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filters.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum filtro configurado</p>
                        <p className="text-sm">Clique em "Adicionar Filtro" para começar</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filters.map((filter, index) => (
                          <Card key={index} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                              <div className="space-y-2">
                                <Label>Coluna</Label>
                                <Select
                                  value={filter.key}
                                  onValueChange={(value) => updateFilter(index, 'key', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecionar coluna" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableColumns.map(column => (
                                      <SelectItem key={column.key} value={column.key}>
                                        {column.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Operador</Label>
                                <Select
                                  value={filter.operator}
                                  onValueChange={(value) => updateFilter(index, 'operator', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FILTER_OPERATORS.map(op => (
                                      <SelectItem key={op.value} value={op.value}>
                                        {op.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Valor</Label>
                                <Input
                                  value={filter.value}
                                  onChange={(e) => updateFilter(index, 'value', e.target.value)}
                                  placeholder="Digite o valor"
                                />
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFilter(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sorting" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <SortAsc className="h-5 w-5" />
                        Ordenação
                      </span>
                      <Button onClick={addSort} size="sm" className="flex items-center gap-1">
                        <Plus className="h-4 w-4" />
                        Adicionar Ordenação
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Configure a ordem de exibição dos dados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sorting.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <SortAsc className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma ordenação configurada</p>
                        <p className="text-sm">Os dados serão exibidos na ordem padrão</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sorting.map((sort, index) => (
                          <Card key={index} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                              <div className="space-y-2">
                                <Label>Coluna</Label>
                                <Select
                                  value={sort.key}
                                  onValueChange={(value) => updateSort(index, 'key', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecionar coluna" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedColumns.map(column => (
                                      <SelectItem key={column.key} value={column.key}>
                                        {column.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Direção</Label>
                                <Select
                                  value={sort.direction}
                                  onValueChange={(value) => updateSort(index, 'direction', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="asc">
                                      <div className="flex items-center gap-2">
                                        <SortAsc className="h-4 w-4" />
                                        Crescente
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="desc">
                                      <div className="flex items-center gap-2">
                                        <SortDesc className="h-4 w-4" />
                                        Decrescente
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSort(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!formData.name}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Visualização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}