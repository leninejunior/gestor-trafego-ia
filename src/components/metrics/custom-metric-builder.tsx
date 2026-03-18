'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, DollarSign, Percent, TrendingUp, Info, Plus, X } from 'lucide-react';
import { CustomMetric, CURRENCY_TYPES, METRIC_CATEGORIES } from '@/lib/types/custom-metrics';

interface CustomMetricBuilderProps {
  onSave: (metric: Partial<CustomMetric>) => void;
  onCancel: () => void;
  initialData?: Partial<CustomMetric>;
}

const BASE_METRICS = [
  { key: 'spend', label: 'Gasto', description: 'Valor total gasto na campanha' },
  { key: 'impressions', label: 'Impressões', description: 'Número total de impressões' },
  { key: 'clicks', label: 'Cliques', description: 'Número total de cliques' },
  { key: 'conversions', label: 'Conversões', description: 'Número total de conversões' },
  { key: 'revenue', label: 'Receita', description: 'Receita total gerada' },
  { key: 'reach', label: 'Alcance', description: 'Número de pessoas alcançadas' },
  { key: 'frequency', label: 'Frequência', description: 'Frequência média' },
  { key: 'ctr', label: 'CTR', description: 'Taxa de cliques' },
  { key: 'cpc', label: 'CPC', description: 'Custo por clique' },
  { key: 'cpm', label: 'CPM', description: 'Custo por mil impressões' },
];

const FORMULA_TEMPLATES = [
  {
    name: 'CPC Personalizado',
    formula: 'spend / clicks',
    description: 'Custo por clique calculado manualmente',
    category: 'CPC'
  },
  {
    name: 'ROAS',
    formula: 'revenue / spend',
    description: 'Retorno sobre investimento em publicidade',
    category: 'ROAS'
  },
  {
    name: 'CTR Personalizado',
    formula: '(clicks / impressions) * 100',
    description: 'Taxa de cliques em percentual',
    category: 'CTR'
  },
  {
    name: 'CPA',
    formula: 'spend / conversions',
    description: 'Custo por aquisição',
    category: 'CPA'
  },
  {
    name: 'Eficiência de Alcance',
    formula: '(reach / impressions) * 100',
    description: 'Percentual de alcance único',
    category: 'CUSTOM'
  }
];

export function CustomMetricBuilder({ onSave, onCancel, initialData }: CustomMetricBuilderProps) {
  const [formData, setFormData] = useState<Partial<CustomMetric>>({
    name: '',
    description: '',
    formula: '',
    base_metrics: [],
    currency_type: 'BRL',
    display_symbol: 'R$',
    decimal_places: 2,
    is_percentage: false,
    category: 'CUSTOM',
    ...initialData
  });

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(initialData?.base_metrics || []);
  const [formulaError, setFormulaError] = useState<string>('');

  const handleInputChange = (field: keyof CustomMetric, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-update display symbol based on currency
    if (field === 'currency_type') {
      const symbols = { BRL: 'R$', USD: '$', EUR: '€', POINTS: 'pts' };
      setFormData(prev => ({ 
        ...prev, 
        [field]: value,
        display_symbol: symbols[value as keyof typeof symbols] || 'R$'
      }));
    }
  };

  const addMetricToFormula = (metricKey: string) => {
    const currentFormula = formData.formula || '';
    const newFormula = currentFormula + (currentFormula ? ' + ' : '') + metricKey;
    setFormData(prev => ({ ...prev, formula: newFormula }));
    
    if (!selectedMetrics.includes(metricKey)) {
      setSelectedMetrics(prev => [...prev, metricKey]);
    }
  };

  const removeMetricFromSelection = (metricKey: string) => {
    setSelectedMetrics(prev => prev.filter(m => m !== metricKey));
    // Remove from formula as well
    const newFormula = (formData.formula || '').replace(new RegExp(`\\b${metricKey}\\b`, 'g'), '').replace(/\s+/g, ' ').trim();
    setFormData(prev => ({ ...prev, formula: newFormula }));
  };

  const validateFormula = (formula: string) => {
    // Validação básica da fórmula
    const validOperators = ['+', '-', '*', '/', '(', ')', ' '];
    const validMetrics = BASE_METRICS.map(m => m.key);
    
    let isValid = true;
    let error = '';

    // Verifica se contém apenas caracteres válidos
    const tokens = formula.split(/[\s+\-*/()]+/).filter(t => t.length > 0);
    
    for (const token of tokens) {
      if (!validMetrics.includes(token) && !/^\d+(\.\d+)?$/.test(token)) {
        isValid = false;
        error = `Token inválido: ${token}`;
        break;
      }
    }

    // Verifica se as métricas usadas estão selecionadas
    const usedMetrics = tokens.filter(t => validMetrics.includes(t));
    const missingMetrics = usedMetrics.filter(m => !selectedMetrics.includes(m));
    
    if (missingMetrics.length > 0) {
      isValid = false;
      error = `Métricas não selecionadas: ${missingMetrics.join(', ')}`;
    }

    setFormulaError(error);
    return isValid;
  };

  const handleFormulaChange = (formula: string) => {
    setFormData(prev => ({ ...prev, formula }));
    validateFormula(formula);
  };

  const applyTemplate = (template: typeof FORMULA_TEMPLATES[0]) => {
    setFormData(prev => ({
      ...prev,
      name: prev.name || template.name,
      formula: template.formula,
      category: template.category as any,
      description: prev.description || template.description
    }));

    // Extract metrics from template formula
    const metrics = BASE_METRICS.map(m => m.key).filter(key => 
      template.formula.includes(key)
    );
    setSelectedMetrics(metrics);
  };

  const handleSave = () => {
    if (!formData.name || !formData.formula) {
      return;
    }

    if (!validateFormula(formData.formula)) {
      return;
    }

    onSave({
      ...formData,
      base_metrics: selectedMetrics
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            {initialData ? 'Editar Métrica' : 'Nova Métrica Personalizada'}
          </h2>
          <p className="text-muted-foreground">
            Crie métricas customizadas com fórmulas matemáticas avançadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!formData.name || !formData.formula || !!formulaError}>
            Salvar Métrica
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="formula">Fórmula</TabsTrigger>
          <TabsTrigger value="display">Exibição</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>
                Configure o nome e descrição da sua métrica personalizada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Métrica *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ex: CPC Otimizado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METRIC_CATEGORIES.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
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
                  placeholder="Descreva o que esta métrica calcula e quando usar..."
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <Label>Templates Prontos</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {FORMULA_TEMPLATES.map((template, index) => (
                    <Card key={index} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => applyTemplate(template)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{template.name}</h4>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                            <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                              {template.formula}
                            </code>
                          </div>
                          <Badge variant="secondary">{template.category}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formula" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Métricas Disponíveis</CardTitle>
                <CardDescription>
                  Clique nas métricas para adicionar à fórmula
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2">
                  {BASE_METRICS.map(metric => (
                    <div
                      key={metric.key}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedMetrics.includes(metric.key)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => addMetricToFormula(metric.key)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{metric.label}</h4>
                          <p className="text-sm text-muted-foreground">{metric.description}</p>
                          <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">
                            {metric.key}
                          </code>
                        </div>
                        {selectedMetrics.includes(metric.key) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMetricFromSelection(metric.key);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Editor de Fórmula</CardTitle>
                <CardDescription>
                  Use operadores matemáticos: +, -, *, /, ( )
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="formula">Fórmula Matemática *</Label>
                  <Textarea
                    id="formula"
                    value={formData.formula}
                    onChange={(e) => handleFormulaChange(e.target.value)}
                    placeholder="Ex: spend / clicks"
                    rows={4}
                    className={formulaError ? 'border-destructive' : ''}
                  />
                  {formulaError && (
                    <p className="text-sm text-destructive">{formulaError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Métricas Selecionadas</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMetrics.map(metric => (
                      <Badge key={metric} variant="secondary" className="flex items-center gap-1">
                        {BASE_METRICS.find(m => m.key === metric)?.label}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => removeMetricFromSelection(metric)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium mb-1">Dicas para fórmulas:</p>
                      <ul className="space-y-1">
                        <li>• Use parênteses para controlar a ordem das operações</li>
                        <li>• Multiplique por 100 para percentuais: (clicks / impressions) * 100</li>
                        <li>• Use números decimais: 0.5, 1.25, etc.</li>
                        <li>• Evite divisão por zero verificando os dados</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="display" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Exibição</CardTitle>
              <CardDescription>
                Configure como a métrica será exibida nos relatórios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency_type">Tipo de Moeda</Label>
                    <Select value={formData.currency_type} onValueChange={(value) => handleInputChange('currency_type', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_TYPES.map(currency => (
                          <SelectItem key={currency} value={currency}>
                            {currency === 'BRL' && '🇧🇷 Real Brasileiro (BRL)'}
                            {currency === 'USD' && '🇺🇸 Dólar Americano (USD)'}
                            {currency === 'EUR' && '🇪🇺 Euro (EUR)'}
                            {currency === 'POINTS' && '🎯 Pontos'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display_symbol">Símbolo de Exibição</Label>
                    <Input
                      id="display_symbol"
                      value={formData.display_symbol}
                      onChange={(e) => handleInputChange('display_symbol', e.target.value)}
                      placeholder="R$"
                      className="w-20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="decimal_places">Casas Decimais</Label>
                    <Select value={formData.decimal_places?.toString()} onValueChange={(value) => handleInputChange('decimal_places', parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 casas</SelectItem>
                        <SelectItem value="1">1 casa</SelectItem>
                        <SelectItem value="2">2 casas</SelectItem>
                        <SelectItem value="3">3 casas</SelectItem>
                        <SelectItem value="4">4 casas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_percentage"
                      checked={formData.is_percentage}
                      onCheckedChange={(checked) => handleInputChange('is_percentage', checked)}
                    />
                    <Label htmlFor="is_percentage" className="flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Exibir como Percentual
                    </Label>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Preview da Formatação
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Valor exemplo:</span>
                        <span className="font-mono">
                          {formData.is_percentage 
                            ? `15.25%`
                            : `${formData.display_symbol}${(15.25).toFixed(formData.decimal_places || 2)}`
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor zero:</span>
                        <span className="font-mono">
                          {formData.is_percentage 
                            ? `0%`
                            : `${formData.display_symbol}${(0).toFixed(formData.decimal_places || 2)}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview da Métrica</CardTitle>
              <CardDescription>
                Veja como sua métrica aparecerá nos relatórios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-6 border-2 border-dashed border-muted rounded-lg">
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold">{formData.name || 'Nome da Métrica'}</h3>
                    <p className="text-muted-foreground">{formData.description || 'Descrição da métrica'}</p>
                    <div className="text-4xl font-bold text-primary">
                      {formData.is_percentage 
                        ? '15.25%'
                        : `${formData.display_symbol}${(15.25).toFixed(formData.decimal_places || 2)}`
                      }
                    </div>
                    <Badge variant="secondary">{formData.category}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fórmula</Label>
                    <code className="block p-3 bg-muted rounded text-sm">
                      {formData.formula || 'Nenhuma fórmula definida'}
                    </code>
                  </div>
                  <div className="space-y-2">
                    <Label>Métricas Base</Label>
                    <div className="flex flex-wrap gap-1">
                      {selectedMetrics.map(metric => (
                        <Badge key={metric} variant="outline">
                          {BASE_METRICS.find(m => m.key === metric)?.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}