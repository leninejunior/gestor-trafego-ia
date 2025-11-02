/**
 * Lista de subscription intents com filtros e ações
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Mail, 
  RefreshCw,
  Download
} from 'lucide-react';
import { SubscriptionIntentWithPlan, SubscriptionIntentStatus } from '@/lib/types/subscription-intent';
import { SubscriptionIntentDetails } from './subscription-intent-details';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionIntentsListProps {
  className?: string;
}

export function SubscriptionIntentsList({ className }: SubscriptionIntentsListProps) {
  const [intents, setIntents] = useState<SubscriptionIntentWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    email: '',
    planId: '',
    dateRange: '30'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });
  
  const { toast } = useToast();

  const fetchIntents = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.status) params.append('status', filters.status);
      if (filters.email) params.append('user_email', filters.email);
      if (filters.planId) params.append('plan_id', filters.planId);
      
      if (filters.dateRange !== 'all') {
        const days = parseInt(filters.dateRange);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.append('created_after', startDate.toISOString());
      }

      const response = await fetch(`/api/admin/subscription-intents?${params}`);
      const data = await response.json();

      if (response.ok) {
        setIntents(data.intents);
        setPagination(prev => ({ ...prev, total: data.total }));
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching intents:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar subscription intents',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntents();
  }, [pagination.page, filters]);

  const getStatusBadge = (status: SubscriptionIntentStatus) => {
    const variants = {
      pending: 'secondary',
      processing: 'default',
      completed: 'default',
      failed: 'destructive',
      expired: 'outline'
    } as const;

    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800'
    };

    return (
      <Badge className={colors[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const handleAction = async (intentId: string, action: string) => {
    try {
      const response = await fetch(`/api/admin/subscription-intents/${intentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: data.message
        });
        fetchIntents(); // Refresh list
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error performing action:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao executar ação',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por email..."
            value={filters.email}
            onChange={(e) => setFilters(prev => ({ ...prev, email: e.target.value }))}
            className="w-full"
          />
        </div>
        
        <Select
          value={filters.status}
          onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="processing">Processando</SelectItem>
            <SelectItem value="completed">Completo</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.dateRange}
          onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={fetchIntents}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Organização</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : intents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Nenhum subscription intent encontrado
                </TableCell>
              </TableRow>
            ) : (
              intents.map((intent) => (
                <TableRow key={intent.id}>
                  <TableCell className="font-medium">
                    {intent.user_email}
                  </TableCell>
                  <TableCell>{intent.organization_name}</TableCell>
                  <TableCell>
                    {intent.plan?.name} ({intent.billing_cycle})
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(intent.status)}
                  </TableCell>
                  <TableCell>
                    {new Date(intent.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {new Date(intent.expires_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedIntent(intent.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Detalhes do Subscription Intent</DialogTitle>
                          </DialogHeader>
                          {selectedIntent && (
                            <SubscriptionIntentDetails 
                              intentId={selectedIntent}
                              onAction={handleAction}
                            />
                          )}
                        </DialogContent>
                      </Dialog>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {intent.status === 'pending' && (
                            <DropdownMenuItem
                              onClick={() => handleAction(intent.id, 'activate')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Ativar Manualmente
                            </DropdownMenuItem>
                          )}
                          
                          {['pending', 'processing'].includes(intent.status) && (
                            <DropdownMenuItem
                              onClick={() => handleAction(intent.id, 'cancel')}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem
                            onClick={() => handleAction(intent.id, 'resend_email')}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Reenviar Email
                          </DropdownMenuItem>
                          
                          {intent.status === 'expired' && (
                            <DropdownMenuItem
                              onClick={() => handleAction(intent.id, 'regenerate_checkout')}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Nova URL de Checkout
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
            {pagination.total} resultados
          </p>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page * pagination.limit >= pagination.total}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}