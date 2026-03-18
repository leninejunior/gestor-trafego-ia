"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  RefreshCw, 
  Search, 
  CheckCircle,
  Clock,
  XCircle,
  Target,
  AlertCircle,
  Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DateRangeFilter, DateRange, getDefaultDateRange } from "@/components/meta/date-range-filter";

interface Client {
  id: string;
  name: string;
  has_meta_connection?: boolean;
}

interface Lead {
  id: string;
  external_id: string;
  campaign_name: string;
  ad_name: string;
  field_data: {
    full_name?: string;
    email?: string;
    phone_number?: string;
    [key: string]: any;
  };
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  platform: string;
  created_time: string;
  notes?: string;
}

interface LeadStats {
  overview: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    lost: number;
  };
  recent_leads_7d: number;
}

export default function MetaLeadsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const { toast } = useToast();

  // Buscar clientes com conexão Meta
  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const response = await fetch('/api/user/accessible-clients');
      
      if (!response.ok) {
        throw new Error('Erro ao buscar clientes');
      }
      
      const data = await response.json();
      console.log('Clientes recebidos:', data);
      
      if (data.clients && Array.isArray(data.clients)) {
        // Mostrar todos os clientes (não filtrar por conexão Meta)
        setClients(data.clients);
        
        // Selecionar primeiro cliente automaticamente
        if (data.clients.length > 0 && !selectedClientId) {
          setSelectedClientId(data.clients[0].id);
        }
      } else {
        console.error('Formato de resposta inválido:', data);
        setClients([]);
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os clientes",
        variant: "destructive"
      });
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  };

  // Buscar leads do cliente selecionado
  const fetchLeads = async () => {
    if (!selectedClientId) {
      setLeads([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        clientId: selectedClientId,
        since: dateRange.since,
        until: dateRange.until
      });
      const response = await fetch(`/api/meta/leads?${params}`);
      const data = await response.json();
      
      if (data.leads) {
        setLeads(data.leads);
      } else {
        setLeads([]);
      }
    } catch (error) {
      console.error('Erro ao buscar leads:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os leads",
        variant: "destructive"
      });
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  // Buscar estatísticas do cliente selecionado
  const fetchStats = async () => {
    if (!selectedClientId) {
      setStats(null);
      return;
    }

    try {
      const response = await fetch(`/api/meta/leads/stats?clientId=${selectedClientId}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      setStats({
        overview: {
          total: 0,
          new: 0,
          contacted: 0,
          qualified: 0,
          converted: 0,
          lost: 0
        },
        recent_leads_7d: 0
      });
    }
  };

  // Sincronizar leads do cliente selecionado
  const syncLeads = async () => {
    if (!selectedClientId) {
      toast({
        title: "Selecione um cliente",
        description: "Escolha um cliente para sincronizar os leads",
        variant: "destructive"
      });
      return;
    }

    try {
      setSyncing(true);
      const response = await fetch('/api/meta/leads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId })
      });
      
      // Verificar se a resposta tem conteúdo
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: 'Resposta inválida do servidor' };
      }
      
      if (response.ok) {
        // Verificar se há mensagem especial (ex: nenhum formulário encontrado)
        if (data.message) {
          toast({
            title: "Sincronização concluída",
            description: data.message,
          });
        } else {
          toast({
            title: "Sincronização concluída",
            description: `${data.leads_synced || 0} leads sincronizados (${data.leads_new || 0} novos)`,
          });
        }
        
        // Recarregar dados
        fetchLeads();
        fetchStats();
      } else {
        // Mostrar erro específico
        const errorMessage = data.details || data.error || 'Erro ao sincronizar';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar leads:', error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível sincronizar os leads",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  // Carregar clientes ao montar
  useEffect(() => {
    fetchClients();
  }, []);

  // Carregar leads quando cliente ou data mudar
  useEffect(() => {
    if (selectedClientId) {
      fetchLeads();
      fetchStats();
    }
  }, [selectedClientId, dateRange]);

  // Filtrar leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.field_data.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.field_data.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.campaign_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; icon: any }> = {
      new: { variant: "default", label: "Novo", icon: Clock },
      contacted: { variant: "secondary", label: "Contactado", icon: Eye },
      qualified: { variant: "default", label: "Qualificado", icon: CheckCircle },
      converted: { variant: "default", label: "Convertido", icon: Target },
      lost: { variant: "destructive", label: "Perdido", icon: XCircle }
    };
    
    const config = variants[status] || variants.new;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Leads Meta Ads
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os leads capturados via Facebook Lead Ads
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Seletor de Cliente */}
          <div className="w-64">
            <Select 
              value={selectedClientId} 
              onValueChange={setSelectedClientId}
              disabled={loadingClients}
            >
              <SelectTrigger>
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder={loadingClients ? "Carregando..." : "Selecione um cliente"} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={syncLeads} 
            disabled={syncing || !selectedClientId}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
      </div>

      {/* Aviso se não tiver cliente selecionado */}
      {!selectedClientId && !loadingClients && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Selecione um cliente
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-300">
                Escolha um cliente no seletor acima para visualizar e sincronizar os leads
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aviso se não tiver clientes */}
      {clients.length === 0 && !loadingClients && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                Nenhum cliente com conexão Meta
              </p>
              <p className="text-sm text-red-600 dark:text-red-300">
                Configure uma conexão Meta Ads em algum cliente para usar esta funcionalidade
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas */}
      {selectedClientId && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overview.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.recent_leads_7d} nos últimos 7 dias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Novos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.overview.new}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Aguardando contato
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Qualificados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.overview.qualified}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Prontos para conversão
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Convertidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.overview.converted}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Taxa: {stats.overview.total > 0 ? ((stats.overview.converted / stats.overview.total) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros - só mostra se tiver cliente selecionado */}
      {selectedClientId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar por nome, email ou campanha..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {/* Filtro de Data */}
              <DateRangeFilter 
                value={dateRange} 
                onChange={setDateRange} 
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
                size="sm"
              >
                Todos
              </Button>
              <Button
                variant={statusFilter === "new" ? "default" : "outline"}
                onClick={() => setStatusFilter("new")}
                size="sm"
              >
                Novos
              </Button>
              <Button
                variant={statusFilter === "contacted" ? "default" : "outline"}
                onClick={() => setStatusFilter("contacted")}
                size="sm"
              >
                Contactados
              </Button>
              <Button
                variant={statusFilter === "qualified" ? "default" : "outline"}
                onClick={() => setStatusFilter("qualified")}
                size="sm"
              >
                Qualificados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Leads - só mostra se tiver cliente selecionado */}
      {selectedClientId && (
        <Card>
          <CardHeader>
            <CardTitle>Leads Capturados</CardTitle>
            <CardDescription>
              {filteredLeads.length} lead(s) encontrado(s) para o cliente selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Carregando leads...
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum lead encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  {leads.length === 0 
                    ? "Sincronize os leads do Meta Ads para este cliente"
                    : "Tente ajustar os filtros de busca"
                  }
                </p>
                {leads.length === 0 && (
                  <Button onClick={syncLeads} disabled={syncing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    Sincronizar Leads
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLeads.map((lead) => (
                  <Card key={lead.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">
                              {lead.field_data.full_name || 'Nome não informado'}
                            </h3>
                            {getStatusBadge(lead.status)}
                          </div>
                          
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {lead.field_data.email && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs">📧</span>
                                {lead.field_data.email}
                              </div>
                            )}
                            {lead.field_data.phone_number && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs">📱</span>
                                {lead.field_data.phone_number}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4" />
                              {lead.campaign_name || 'Campanha não identificada'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              {new Date(lead.created_time).toLocaleString('pt-BR')}
                            </div>
                          </div>
                        </div>
                        
                        <Button variant="outline" size="sm">
                          Ver Detalhes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
