'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { 
  Calculator, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  TrendingUp,
  DollarSign,
  Percent
} from 'lucide-react';
import { CustomMetric, METRIC_CATEGORIES } from '@/lib/types/custom-metrics';
import { useToast } from '@/hooks/use-toast';

interface CustomMetricsListProps {
  onCreateNew: () => void;
  onEdit: (metric: CustomMetric) => void;
}

export function CustomMetricsList({ onCreateNew, onEdit }: CustomMetricsListProps) {
  const [metrics, setMetrics] = useState<CustomMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteMetricId, setDeleteMetricId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMetrics();
  }, [categoryFilter, statusFilter]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      
      if (statusFilter !== 'all') {
        params.append('active', statusFilter);
      }

      const response = await fetch(`/api/metrics/custom?${params}`);
      const data = await response.json();

      if (response.ok) {
        setMetrics(data.metrics || []);
      } else {
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao carregar métricas',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar métricas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (metricId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/metrics/custom', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: metricId,
          is_active: !currentStatus,
        }),
      });

      if (response.ok) {
        await loadMetrics();
        toast({
          title: 'Sucesso',
          description: `Métrica ${!currentStatus ? 'ativada' : 'desativada'} com sucesso`,
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao alterar status da métrica',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao alterar status da métrica',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteMetricId) return;

    try {
      const response = await fetch(`/api/metrics/custom?id=${deleteMetricId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadMetrics();
        toast({
          title: 'Sucesso',
          description: 'Métrica deletada com sucesso',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao deletar métrica',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao deletar métrica',
        variant: 'destructive',
      });
    } finally {
      setDeleteMetricId(null);
    }
  };

  const filteredMetrics = metrics.filter(metric => {
    const matchesSearch = metric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (metric.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'CPC':
      case 'CPA':
        return <DollarSign className="h-4 w-4" />;
      case 'CTR':
        return <Percent className="h-4 w-4" />;
      case 'ROAS':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Calculator className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'CPC': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'CTR': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'ROAS': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'CPA': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

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
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Métricas Personalizadas
          </h2>
          <p className="text-muted-foreground">
            Gerencie suas métricas customizadas e fórmulas de cálculo
          </p>
        </div>
        <Button onClick={onCreateNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Métrica
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar métricas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {METRIC_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Ativas</SelectItem>
                  <SelectItem value="false">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Métricas */}
      {filteredMetrics.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma métrica encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Comece criando sua primeira métrica personalizada'
              }
            </p>
            {!searchTerm && categoryFilter === 'all' && statusFilter === 'all' && (
              <Button onClick={onCreateNew} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeira Métrica
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMetrics.map((metric) => (
            <Card key={metric.id} className={`transition-all hover:shadow-md ${!metric.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(metric.category)}
                    <div>
                      <CardTitle className="text-lg">{metric.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getCategoryColor(metric.category)}>
                          {metric.category}
                        </Badge>
                        {!metric.is_active && (
                          <Badge variant="secondary">Inativa</Badge>
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
                      <DropdownMenuItem onClick={() => onEdit(metric)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(metric.id, metric.is_active)}>
                        {metric.is_active ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setDeleteMetricId(metric.id)}
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
                  {metric.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {metric.description}
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Fórmula:</span>
                      <code className="ml-2 px-2 py-1 bg-muted rounded text-xs">
                        {metric.formula}
                      </code>
                    </div>
                    
                    <div className="text-sm">
                      <span className="font-medium">Formato:</span>
                      <span className="ml-2">
                        {metric.is_percentage 
                          ? '15.25%'
                          : `${metric.display_symbol}${(15.25).toFixed(metric.decimal_places)}`
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {metric.base_metrics.slice(0, 3).map(baseMetric => (
                      <Badge key={baseMetric} variant="outline" className="text-xs">
                        {baseMetric}
                      </Badge>
                    ))}
                    {metric.base_metrics.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{metric.base_metrics.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Confirmação de Deleção */}
      <AlertDialog open={!!deleteMetricId} onOpenChange={() => setDeleteMetricId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Métrica</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta métrica? Esta ação não pode ser desfeita.
              Todos os valores calculados também serão removidos.
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