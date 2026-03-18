"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Building2, 
  CreditCard, 
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Eye,
  Crown,
  Activity,
  Database,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { UserAccessControlService, UserType } from "@/lib/services/user-access-control";
import { userManagementService } from "@/lib/services/user-management";
import { AuditDashboard } from './audit-dashboard'
import { UserTypeManager } from "./user-type-manager";

interface Organization {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  memberCount: number;
  clientCount: number;
  subscriptionStatus: string;
  planName: string;
}

interface SystemStats {
  totalOrganizations: number;
  totalUsers: number;
  totalSuperAdmins: number;
  totalOrgAdmins: number;
  totalCommonUsers: number;
  totalActiveSubscriptions: number;
  monthlyRevenue: number;
  totalClients: number;
  totalConnections: number;
}

interface PlanUsage {
  organizationId: string;
  organizationName: string;
  maxUsers: number | null;
  currentUsers: number;
  maxClients: number | null;
  currentClients: number;
  maxConnections: number | null;
  currentConnections: number;
  maxCampaigns: number | null;
  currentCampaigns: number;
  subscriptionStatus: string;
  planName: string;
}

interface AuditLogEntry {
  id: string;
  operation: string;
  targetUserId: string;
  targetUserName: string;
  organizationId: string;
  organizationName: string;
  details: string;
  createdAt: Date;
  success: boolean;
}

interface SuperAdminDashboardProps {
  userId: string;
}

export function SuperAdminDashboard({ userId }: SuperAdminDashboardProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [planUsages, setPlanUsages] = useState<PlanUsage[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const accessControl = new UserAccessControlService();

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (selectedOrgId !== "all") {
      loadOrganizationSpecificData(selectedOrgId);
    }
  }, [selectedOrgId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Verificar se é super admin
      const isSuperAdmin = await accessControl.isSuperAdmin(userId);
      if (!isSuperAdmin) {
        toast.error("Acesso negado: você não é um super admin");
        return;
      }

      // Carregar dados do sistema
      await Promise.all([
        loadOrganizations(),
        loadSystemStats(),
        loadPlanUsages(),
        loadAuditLogs()
      ]);

    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await fetch("/api/super-admin/organizations");
      if (!response.ok) throw new Error("Erro ao carregar organizações");
      
      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error("Erro ao carregar organizações:", error);
      toast.error("Erro ao carregar organizações");
    }
  };

  const loadSystemStats = async () => {
    try {
      const response = await fetch("/api/super-admin/stats");
      if (!response.ok) throw new Error("Erro ao carregar estatísticas");
      
      const data = await response.json();
      setSystemStats(data.stats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      toast.error("Erro ao carregar estatísticas do sistema");
    }
  };

  const loadPlanUsages = async () => {
    try {
      const response = await fetch("/api/super-admin/plan-usage");
      if (!response.ok) throw new Error("Erro ao carregar uso de planos");
      
      const data = await response.json();
      setPlanUsages(data.usages || []);
    } catch (error) {
      console.error("Erro ao carregar uso de planos:", error);
      toast.error("Erro ao carregar uso de planos");
    }
  };

  const loadAuditLogs = async () => {
    try {
      const response = await fetch("/api/super-admin/audit-logs");
      if (!response.ok) throw new Error("Erro ao carregar logs de auditoria");
      
      const data = await response.json();
      setAuditLogs(data.logs || []);
    } catch (error) {
      console.error("Erro ao carregar logs de auditoria:", error);
      toast.error("Erro ao carregar logs de auditoria");
    }
  };

  const loadOrganizationSpecificData = async (orgId: string) => {
    try {
      // Carregar dados específicos da organização selecionada
      const response = await fetch(`/api/super-admin/organizations/${orgId}/details`);
      if (!response.ok) throw new Error("Erro ao carregar detalhes da organização");
      
      const data = await response.json();
      // Atualizar dados específicos da organização
      // Implementar conforme necessário
    } catch (error) {
      console.error("Erro ao carregar dados da organização:", error);
      toast.error("Erro ao carregar dados da organização");
    }
  };

  const handleUserTypeChange = async (targetUserId: string, newType: UserType) => {
    try {
      const response = await fetch("/api/super-admin/users/change-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          newType,
          adminUserId: userId
        })
      });

      if (!response.ok) throw new Error("Erro ao alterar tipo de usuário");

      toast.success("Tipo de usuário alterado com sucesso");
      await loadSystemStats(); // Recarregar estatísticas
      await loadAuditLogs(); // Recarregar logs
    } catch (error) {
      console.error("Erro ao alterar tipo de usuário:", error);
      toast.error("Erro ao alterar tipo de usuário");
    }
  };

  const getUsageColor = (current: number, max: number | null) => {
    if (max === null) return "text-green-600"; // Unlimited
    const percentage = (current / max) * 100;
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 75) return "text-yellow-600";
    return "text-green-600";
  };

  const getUsagePercentage = (current: number, max: number | null) => {
    if (max === null) return 0;
    return Math.min((current / max) * 100, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Crown className="w-8 h-8 mr-3 text-red-600" />
                Super Admin Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Controle total do sistema - Gerenciamento cross-organizacional
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Organization Selector */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Organização:</label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Selecionar organização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Organizações</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.memberCount} membros)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="destructive" className="px-3 py-1">
                <Crown className="w-4 h-4 mr-1" />
                SUPER ADMIN
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* System Overview Stats */}
        {systemStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Organizações</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats.totalOrganizations}</div>
                <p className="text-xs text-muted-foreground">
                  {systemStats.totalActiveSubscriptions} com assinatura ativa
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats.totalUsers}</div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span className="flex items-center">
                    <Crown className="w-3 h-3 mr-1 text-red-500" />
                    {systemStats.totalSuperAdmins} Super
                  </span>
                  <span className="flex items-center">
                    <Settings className="w-3 h-3 mr-1 text-blue-500" />
                    {systemStats.totalOrgAdmins} Admins
                  </span>
                  <span className="flex items-center">
                    <Users className="w-3 h-3 mr-1 text-gray-500" />
                    {systemStats.totalCommonUsers} Comuns
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  R$ {systemStats.monthlyRevenue.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {systemStats.totalActiveSubscriptions} assinaturas ativas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recursos Totais</CardTitle>
                <Database className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{systemStats.totalClients}</div>
                <p className="text-xs text-muted-foreground">
                  {systemStats.totalConnections} conexões ativas
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="users">Gerenciar Usuários</TabsTrigger>
            <TabsTrigger value="limits">Limites & Uso</TabsTrigger>
            <TabsTrigger value="audit">Logs de Auditoria</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Organizations Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="w-5 h-5 mr-2" />
                    Organizações por Status
                  </CardTitle>
                  <CardDescription>
                    Status das assinaturas por organização
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {organizations.slice(0, 8).map((org) => (
                      <div key={org.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <h3 className="font-medium">{org.name}</h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center">
                              <Users className="w-3 h-3 mr-1" />
                              {org.memberCount} membros
                            </span>
                            <span className="flex items-center">
                              <Building2 className="w-3 h-3 mr-1" />
                              {org.clientCount} clientes
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={org.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                            {org.planName || 'Sem plano'}
                          </Badge>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedOrgId(org.id)}
                          >
                            Gerenciar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    Saúde do Sistema
                  </CardTitle>
                  <CardDescription>
                    Indicadores de performance e alertas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <h4 className="font-medium text-green-800">Sistema Operacional</h4>
                          <p className="text-sm text-green-700">Todos os serviços funcionando</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        100% Uptime
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <div>
                          <h4 className="font-medium text-yellow-800">Assinaturas Vencendo</h4>
                          <p className="text-sm text-yellow-700">3 organizações com vencimento próximo</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Ver Detalhes
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <div>
                          <h4 className="font-medium text-blue-800">Crescimento</h4>
                          <p className="text-sm text-blue-700">+12% novos usuários este mês</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-blue-700 border-blue-300">
                        Crescendo
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Management Tab */}
          <TabsContent value="users" className="space-y-6">
            {selectedOrgId === "all" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Gerenciamento de Tipos de Usuário
                  </CardTitle>
                  <CardDescription>
                    Alterar tipos de usuário em qualquer organização
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Gerenciamento de Usuários
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Selecione uma organização para gerenciar seus usuários
                    </p>
                    <Button 
                      onClick={() => setActiveTab("overview")}
                      variant="outline"
                    >
                      Selecionar Organização
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <UserTypeManager 
                organizationId={selectedOrgId}
                organizationName={organizations.find(org => org.id === selectedOrgId)?.name || "Organização"}
                superAdminId={userId}
              />
            )}
          </TabsContent>

          {/* Plan Limits Tab */}
          <TabsContent value="limits" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Limites e Uso por Organização
                </CardTitle>
                <CardDescription>
                  Monitoramento de uso de recursos por plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {planUsages.map((usage) => (
                    <div key={usage.organizationId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-medium">{usage.organizationName}</h3>
                          <p className="text-sm text-gray-600">
                            Plano: {usage.planName} • Status: {usage.subscriptionStatus}
                          </p>
                        </div>
                        <Badge variant={usage.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                          {usage.subscriptionStatus}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Users */}
                        <div className="text-center">
                          <div className="text-2xl font-bold mb-1">
                            <span className={getUsageColor(usage.currentUsers, usage.maxUsers)}>
                              {usage.currentUsers}
                            </span>
                            <span className="text-gray-400">
                              /{usage.maxUsers || '∞'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Usuários</p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${getUsagePercentage(usage.currentUsers, usage.maxUsers)}%` }}
                            />
                          </div>
                        </div>

                        {/* Clients */}
                        <div className="text-center">
                          <div className="text-2xl font-bold mb-1">
                            <span className={getUsageColor(usage.currentClients, usage.maxClients)}>
                              {usage.currentClients}
                            </span>
                            <span className="text-gray-400">
                              /{usage.maxClients || '∞'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Clientes</p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${getUsagePercentage(usage.currentClients, usage.maxClients)}%` }}
                            />
                          </div>
                        </div>

                        {/* Connections */}
                        <div className="text-center">
                          <div className="text-2xl font-bold mb-1">
                            <span className={getUsageColor(usage.currentConnections, usage.maxConnections)}>
                              {usage.currentConnections}
                            </span>
                            <span className="text-gray-400">
                              /{usage.maxConnections || '∞'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Conexões</p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full transition-all"
                              style={{ width: `${getUsagePercentage(usage.currentConnections, usage.maxConnections)}%` }}
                            />
                          </div>
                        </div>

                        {/* Campaigns */}
                        <div className="text-center">
                          <div className="text-2xl font-bold mb-1">
                            <span className={getUsageColor(usage.currentCampaigns, usage.maxCampaigns)}>
                              {usage.currentCampaigns}
                            </span>
                            <span className="text-gray-400">
                              /{usage.maxCampaigns || '∞'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Campanhas</p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-orange-600 h-2 rounded-full transition-all"
                              style={{ width: `${getUsagePercentage(usage.currentCampaigns, usage.maxCampaigns)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="space-y-6">
            <AuditDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}