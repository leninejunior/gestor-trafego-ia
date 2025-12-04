'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  ChevronUp as ArrowUp, 
  ChevronDown as ArrowDown,
  ChevronsUpDown as ArrowUpDown,
  Eye,
  RefreshCw,
  SlidersHorizontal as Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GoogleCampaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  budget_amount: number;
  budget_currency: string;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    ctr: number;
    conversion_rate: number;
    cpc: number;
    cpa: number;
    roas: number;
  };
  start_date: string;
  end_date?: string;
  updated_at: string;
}

interface CampaignsListProps {
  clientId: string;
  onCampaignSelect?: (campaign: GoogleCampaign) => void;
}

type SortField = 'campaign_name' | 'status' | 'cost' | 'conversions' | 'ctr' | 'roas';
type SortDirection = 'asc' | 'desc';

export function GoogleCampaignsList({ clientId, onCampaignSelect }: CampaignsListProps) {
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('campaign_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const { toast } = useToast();

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/google/campaigns?clientId=${clientId}`);
      
      if (!response.ok) {
        throw new Error('Falha ao carregar campanhas');
      }

      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as campanhas do Google Ads.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchCampaigns();
    }
  }, [clientId]);

  const filteredAndSortedCampaigns = useMemo(() => {
    let filtered = campaigns.filter(campaign => {
      const matchesSearch = campaign.campaign_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        campaign.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort campaigns
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'campaign_name':
          aValue = a.campaign_name.toLowerCase();
          bValue = b.campaign_name.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'cost':
          aValue = a.metrics.cost;
          bValue = b.metrics.cost;
          break;
        case 'conversions':
          aValue = a.metrics.conversions;
          bValue = b.metrics.conversions;
          break;
        case 'ctr':
          aValue = a.metrics.ctr;
          bValue = b.metrics.ctr;
          break;
        case 'roas':
          aValue = a.metrics.roas;
          bValue = b.metrics.roas;
          break;
        default:
          aValue = a.campaign_name.toLowerCase();
          bValue = b.campaign_name.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [campaigns, searchTerm, statusFilter, sortField, sortDirection]);

  const paginatedCampaigns = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedCampaigns.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedCampaigns, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedCampaigns.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ENABLED':
        return <Badge className="bg-green-100 text-green-800">Ativa</Badge>;
      case 'PAUSED':
        return <Badge variant="secondary">Pausada</Badge>;
      case 'REMOVED':
        return <Badge variant="destructive">Removida</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, _currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Carregando campanhas...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Campanhas Google Ads</span>
          <Button onClick={fetchCampaigns} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </CardTitle>
        
        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar campanhas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ENABLED">Ativas</SelectItem>
              <SelectItem value="PAUSED">Pausadas</SelectItem>
              <SelectItem value="REMOVED">Removidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredAndSortedCampaigns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {campaigns.length === 0 
              ? 'Nenhuma campanha encontrada. Conecte sua conta Google Ads para ver as campanhas.'
              : 'Nenhuma campanha corresponde aos filtros aplicados.'
            }
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('campaign_name')}
                  >
                    <div className="flex items-center gap-2">
                      Nome da Campanha
                      {getSortIcon('campaign_name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('cost')}
                  >
                    <div className="flex items-center gap-2 justify-end">
                      Gasto
                      {getSortIcon('cost')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('conversions')}
                  >
                    <div className="flex items-center gap-2 justify-end">
                      Conversões
                      {getSortIcon('conversions')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('ctr')}
                  >
                    <div className="flex items-center gap-2 justify-end">
                      CTR
                      {getSortIcon('ctr')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('roas')}
                  >
                    <div className="flex items-center gap-2 justify-end">
                      ROAS
                      {getSortIcon('roas')}
                    </div>
                  </TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCampaigns.map((campaign) => (
                  <TableRow key={campaign.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {campaign.campaign_name}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(campaign.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(campaign.metrics.cost, campaign.budget_currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.metrics.impressions.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.metrics.clicks.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.metrics.conversions.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercentage(campaign.metrics.ctr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.metrics.roas.toFixed(2)}x
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCampaignSelect?.(campaign)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a{' '}
                  {Math.min(currentPage * itemsPerPage, filteredAndSortedCampaigns.length)} de{' '}
                  {filteredAndSortedCampaigns.length} campanhas
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => 
                        page === 1 || 
                        page === totalPages || 
                        Math.abs(page - currentPage) <= 1
                      )
                      .map((page, index, array) => (
                        <div key={page} className="flex items-center">
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-2 text-muted-foreground">...</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        </div>
                      ))
                    }
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}