'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RangeSlider } from '@/components/objectives/range-slider';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  Percent,
  BarChart3,
  Lightbulb,
  Save,
  X
} from 'lucide-react';
import { MetricObjective, CustomMetric } from '@/lib/types/custom-metrics';

interface ObjectiveBuilderProps {
  onSave: (objective: Partial<MetricObjective>) => void;
  onCancel: () => void;
  initialData?: Partial<MetricObjective>;
  customMetrics?: CustomMetric[];
}

const STANDARD_METRICS = [
  { key: 'cpc', label: 'CPC', format: 'currency', defaultRange: [0, 5], unit: 'R$' },
  { key: 'ctr', label: 'CTR', format: 'percentage', defaultRange: [1, 15], unit: '%' },
  { key: 'cpm', label: 'CPM', format: 'currency', defaultRange: [5, 50], unit: 'R$' },
  { key: 'cpa', label: 'CPA', format: 'currency', defaultRange: [10, 200], unit: 'R$' },
  { key: 'roas', label: 'ROAS', format: 'number', defaultRange: [2, 10], unit: 'x' },
  { key: 'frequency', label: 'Frequência', format: 'number', defaultRange: [1, 5], unit: 'x' },
  { key: 'conversion_rate', label: 'Taxa de Conversão', format: 'percentage', defaultRange: [1, 10], unit: '%' },
];

const CAMPAIGN_OBJECTIVES = [
  'CONVERSIONS',
  'TRAFFIC',
  'AWARENESS',
  'ENGAGEMENT',
  'APP_INSTALLS',
  'VIDEO_VIEWS',
  'LEAD_GENERATION',
  'MESSAGES',
  'STORE_VISITS'
];

export function ObjectiveBuilder({ onSave, onCancel, initialData, customMetrics = [] }: ObjectiveBuilderProps) {
  const [formData, setFormData] = useState<Partial<MetricObjective>>({
    metric_name: '',
    metric_type: 'standard',
    min_value: 0,
    max_value: 100,
    target_value: 50,
    campaign_objective: '',
    is_active: true,
    ...initialData
  });

  const [selectedMetric, setSelectedMetric] = useState<any>(null);
  const [rangeValues, setRangeValues] = useState<[number, number]>([0, 100]);
  const [targetValue, setTargetValue] = useState<number>(50);

  useEffect(() => {
    if (formData.metric_name && formData.metric_type === 'standard') {
      const metric = STANDARD_METRICS.find(m => m.key === formData.metric_name);
      if (metric) {
        setSelectedMetric(metric);
        setRangeValues([formData.min_value || metric.defaultRange[0], formData.max_value || metric.defaultRange[1]]);
        setTargetValue(formData.target_value || (metric.defaultRange[0] + metric.defaultRange[1]) / 2);
      }
    } else if (formData.metric_name && formData.metric_type === 'custom') {
      const metric = customMetrics.find(m => m.id === formData.custom_metric_id);
      if (metric) {
        setSelectedMetric({
          key: metric.id,
          label: metric.name,
          format: metric.is_percentage ? 'percentage' : 'currency',
          defaultRange: [0, 100],
          unit: metric.display_symbol
        });
        setRangeValues([formData.min_value || 0, formData.max_value || 100]);
        setTargetValue(formData.target_value || 50);
      }
    }
  }, [formData.metric_name, formData.metric_type, formData.custom_metric_id, customMetrics]);

  const handleInputChange = (field: keyof MetricObjective, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMetricChange = (metricKey: string, metricType: 'standard' | 'custom') => {
    if (metricType === 'standard') {
      const metric = STANDARD_METRICS.find(m => m.key === metricKey);
      if (metric) {
        setFormData(prev => ({
          ...prev,
          metric_name: metricKey,
          metric_type: 'standard',
          custom_metric_id: undefined
        }));
        setSelectedMetric(metric);
        setRangeValues(metric.defaultRange as [number, number]);
        setTargetValue((metric.defaultRange[0] + metric.defaultRange[1]) / 2);
      }
    } else {
      const metric = customMetrics.find(m => m.id === metricKey);
      if (metric) {
        setFormData(prev => ({
          ...prev,
          metric_name: metric.name,
          metric_type: 'custom',
          custom_metric_id: metric.id
        }));
        setSelectedMetric({
          key: metric.id,
          label: metric.name,
          format: metric.is_percentage ? 'percentage' : 'currency',
          defaultRange: [0, 100],
          unit: metric.display_symbol
        });
        setRangeValues([0, 100]);
        setTargetValue(50);
      }
    }
  };

  const handleRangeChange = (values: [number, number]) => {
    setRangeValues(values);
    setFormData(prev => ({
      ...prev,
      min_value: values[0],
      max_value: values[1]
    }));
  };

  const handleTargetChange = (value: number) => {
    setTargetValue(value);
    setFormData(prev => ({
      ...prev,
      target_value: value
    }));
  };

  const getMetricIcon = (format: string) => {
    switch (format) {
      case 'currency':
        return <DollarSign className="h-4 w-4" />;
      case 'percentage':
        return <Percent className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getPerformanceStatus = (value: number) => {
    if (!selectedMetric) return 'neutral';
    
    const { min_value = rangeValues[0], max_value = rangeValues[1] } = formData;
    
    if (value < min_value) return 'poor';
    if (value > max_value) return 'poor';
    if (value >= (targetValue || 0) * 0.9) return 'excellent';
    if (value >= (min_value + max_value) / 2) return 'good';
    return 'warning';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="h-4 w-4" />;
      case 'good': return <TrendingUp className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'poor': return <TrendingDown className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const handleSave = () => {
    if (!formData.metric_name) return;

    onSave({
      ...formData,
      min_value: rangeValues[0],
      max_value: rangeValues[1],
      target_value: targetValue
    });
  };

  const formatValue = (value: number) => {
    if (!selectedMetric) return value.toString();
    
    switch (selectedMetric.format) {
      case 'currency':
        return `${selectedMetric.unit}${value.toFixed(2)}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return `${value.toFixed(2)}${selectedMetric.unit || ''}`;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            {initialData ? 'Editar Objetivo' : 'Novo Objetivo Inteligente'}
          </h2>
          <p className="text-muted-foreground">
            Configure ranges ideais e metas para suas métricas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!formData.metric_name}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Objetivo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="setup">Configuração</TabsTrigger>
          <TabsTrigger value="ranges">Ranges & Metas</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Seleção de Métrica</CardTitle>
              <CardDescription>
                Escolha a métrica para definir objetivos e ranges ideais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Métricas Padrão</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {STANDARD_METRICS.map(metric => (
                      <div
                        key={metric.key}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.metric_name === metric.key && formData.metric_type === 'standard'
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleMetricChange(metric.key, 'standard')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getMetricIcon(metric.format)}
                            <span className="font-medium">{metric.label}</span>
                          </div>
                          <Badge variant="outline">
                            {formatValue(metric.defaultRange[0])} - {formatValue(metric.defaultRange[1])}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Métricas Personalizadas</h4>
                  {customMetrics.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma métrica personalizada</p>
                      <p className="text-sm">Crie métricas personalizadas primeiro</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {customMetrics.map(metric => (
                        <div
                          key={metric.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            formData.custom_metric_id === metric.id && formData.metric_type === 'custom'
                              ? 'bg-primary/10 border-primary'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleMetricChange(metric.id, 'custom')}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4" />
                              <span className="font-medium">{metric.name}</span>
                            </div>
                            <Badge variant="secondary">Personalizada</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="campaign_objective">Objetivo da Campanha (Opcional)</Label>
                  <Select value={formData.campaign_objective} onValueChange={(value) => handleInputChange('campaign_objective', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar objetivo da campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os objetivos</SelectItem>
                      {CAMPAIGN_OBJECTIVES.map(objective => (
                        <SelectItem key={objective} value={objective}>
                          {objective.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                  />
                  <Label htmlFor="is_active">Objetivo ativo</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranges" className="space-y-4">
          {selectedMetric ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getMetricIcon(selectedMetric.format)}
                  Configurar Ranges para {selectedMetric.label}
                </CardTitle>
                <CardDescription>
                  Defina os valores mínimo, máximo e meta ideal para esta métrica
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RangeSlider
                  min={0}
                  max={selectedMetric.format === 'percentage' ? 100 : 1000}
                  step={selectedMetric.format === 'percentage' ? 0.1 : 0.01}
                  value={rangeValues}
                  onValueChange={handleRangeChange}
                  formatValue={formatValue}
                  label="Range Ideal"
                />

                <div className="space-y-4">
                  <Label>Meta Específica</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      value={targetValue}
                      onChange={(e) => handleTargetChange(parseFloat(e.target.value) || 0)}
                      min={rangeValues[0]}
                      max={rangeValues[1]}
                      step={selectedMetric.format === 'percentage' ? 0.1 : 0.01}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">
                      {formatValue(targetValue)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Mínimo</div>
                    <div className="font-bold text-lg">{formatValue(rangeValues[0])}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Meta</div>
                    <div className="font-bold text-lg text-primary">{formatValue(targetValue)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Máximo</div>
                    <div className="font-bold text-lg">{formatValue(rangeValues[1])}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Sugestões de Otimização
                  </Label>
                  <div className="space-y-2 text-sm">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="font-medium text-green-800">✓ Excelente Performance</div>
                      <div className="text-green-700">Valores próximos à meta ({formatValue(targetValue * 0.9)} - {formatValue(targetValue * 1.1)})</div>
                    </div>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="font-medium text-yellow-800">⚠ Atenção Necessária</div>
                      <div className="text-yellow-700">Valores fora do range ideal (&lt; {formatValue(rangeValues[0])} ou &gt; {formatValue(rangeValues[1])})</div>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="font-medium text-red-800">🚨 Performance Crítica</div>
                      <div className="text-red-700">Valores muito distantes da meta (diferença &gt; 50%)</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Selecione uma Métrica</h3>
                <p className="text-muted-foreground">
                  Escolha uma métrica na aba "Configuração" para definir ranges e metas
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          {selectedMetric ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getMetricIcon(selectedMetric.format)}
                    Preview: {selectedMetric.label}
                  </CardTitle>
                  <CardDescription>
                    Veja como o objetivo será exibido nos dashboards
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center p-6 border-2 border-dashed border-muted rounded-lg">
                      <div className="text-3xl font-bold mb-2">{formatValue(targetValue)}</div>
                      <div className="text-muted-foreground">Meta Definida</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Range: {formatValue(rangeValues[0])} - {formatValue(rangeValues[1])}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Simulação de Performance</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { value: targetValue * 1.05, label: 'Campanha A' },
                          { value: rangeValues[0] * 0.8, label: 'Campanha B' },
                          { value: targetValue * 0.95, label: 'Campanha C' },
                          { value: rangeValues[1] * 1.2, label: 'Campanha D' },
                        ].map((campaign, index) => {
                          const status = getPerformanceStatus(campaign.value);
                          return (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <div className={`p-1 rounded ${getStatusColor(status)}`}>
                                  {getStatusIcon(status)}
                                </div>
                                <span className="font-medium">{campaign.label}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">{formatValue(campaign.value)}</div>
                                <div className={`text-xs capitalize ${getStatusColor(status).split(' ')[0]}`}>
                                  {status === 'excellent' && 'Excelente'}
                                  {status === 'good' && 'Bom'}
                                  {status === 'warning' && 'Atenção'}
                                  {status === 'poor' && 'Crítico'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma Métrica Selecionada</h3>
                <p className="text-muted-foreground">
                  Configure uma métrica para ver o preview do objetivo
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}