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
  DropdownMenuTrigger,
  DropdownMenuSeparator
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
  Eye, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Copy, 
  Share, 
  Star, 
  StarOff,
  Search,
  Plus,
  Table,
  LineChart,
  BarChart3,
  PieChart,
  Users,
  Lock
} from 'lucide-react';
import { CustomDashboardView } from '@/lib/types/custom-metrics';
import { useToast } from '@/hooks/use-toast';

interface SavedViewsProps {
  onCreateNew: () => void;
  onEdit: (view: CustomDashboardView) => void;
  onApply: (view: CustomDashboardView) => void;
}

export function SavedViews({ onCreateNew, onEdit, onApply }: SavedViewsProps) {
  const [views, setViews] = useState<CustomDashboardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadViews();
  }, []);

  const loadViews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/views');
      const data = await response.json();

      if (response.ok) {
        setViews(data.views || []);
      } else {
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao carregar visualizações',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar visualizações',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (viewId: string) => {
    try {
      const response = await fetch('/api/dashboard/views', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: viewId,
          is_default: true,
        }),
      });

      if (response.ok) {
        await loadViews();
        toast({
          title: 'Sucesso',
          description: 'Visualização definida como padrão',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao definir como padrão',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao definir como padrão',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (view: CustomDashboardView) => {
    try {
      const response = await fetch('/api/dashboard/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${view.name} (Cópia)`,
          description: view.description,
          view_config: view.view_config,
          is_default: false,
          is_shared: false,
        }),
      });

      if (response.ok) {
        await loadViews();
        toast({
          title: 'Sucesso',
          description: 'Visualização duplicada com sucesso',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao duplicar visualização',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao duplicar visualização',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteViewId) return;

    try {
      const response = await fetch(`/api/dashboard/views?id=${deleteViewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadViews();
        toast({
          title: 'Sucesso',
          description: 'Visualização deletada com sucesso',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Erro',
          description: data.error || 'Erro ao deletar visualização',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao deletar visualização',
        variant: 'destructive',
      });
    } finally {
      setDeleteViewId(null);
    }
  };

  const getChartIcon = (chartType: string) => {
    switch (chartType) {
      case 'line':
        return <LineChart className="h-4 w-4" />;
      case 'bar':
        return <BarChart3 className="h-4 w-4" />;
      case 'pie':
        return <PieChart className="h-4 w-4" />;
      default:
        return <Table className="h-4 w-4" />;
    }
  };

  const getChartTypeLabel = (chartType: string) => {
    switch (chartType) {
      case 'line':
        return 'Linha';
      case 'bar':
        return 'Barras';
      case 'pie':
        return 'Pizza';
      default:
        return 'Tabela';
    }
  };

  const filteredViews = views.filter(view =>
    view.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (view.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h3 className="text-lg font-semibold">Visualizações Salvas</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie suas visualizações personalizadas
          </p>
        </div>
        <Button onClick={onCreateNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Visualização
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar visualizações..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Views Grid */}
      {filteredViews.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm ? 'Nenhuma visualização encontrada' : 'Nenhuma visualização criada'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? 'Tente ajustar os termos de busca'
                : 'Comece criando sua primeira visualização personalizada'
              }
            </p>
            {!searchTerm && (
              <Button onClick={onCreateNew} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeira Visualização
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredViews.map((view) => (
            <Card key={view.id} className="transition-all hover:shadow-md cursor-pointer group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getChartIcon(view.view_config.chart_type || 'table')}
                      <CardTitle className="text-base truncate">{view.name}</CardTitle>
                      {view.is_default && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getChartTypeLabel(view.view_config.chart_type || 'table')}
                      </Badge>
                      {view.is_shared ? (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Compartilhada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Privada
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onApply(view)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Aplicar Visualização
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(view)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(view)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {!view.is_default && (
                        <DropdownMenuItem onClick={() => handleSetDefault(view.id)}>
                          <Star className="h-4 w-4 mr-2" />
                          Definir como Padrão
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => setDeleteViewId(view.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Deletar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent onClick={() => onApply(view)}>
                <div className="space-y-3">
                  {view.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {view.description}
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Colunas:</span>
                      <span className="font-medium">{view.view_config.columns?.length || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Filtros:</span>
                      <span className="font-medium">{view.view_config.filters?.length || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ordenação:</span>
                      <span className="font-medium">{view.view_config.sorting?.length || 0}</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Criada em {new Date(view.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteViewId} onOpenChange={() => setDeleteViewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Visualização</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta visualização? Esta ação não pode ser desfeita.
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