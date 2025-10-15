"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { 
  ArrowLeft,
  Users, 
  Search,
  Filter,
  UserCheck,
  Shield,
  Building2,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  UserPlus,
  RefreshCw
} from "lucide-react";
import { UserInviteDialog } from "./user-invite-dialog";
import { UserDetailsDialog } from "./user-details-dialog";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_suspended?: boolean;
  memberships?: Array<{
    id: string;
    role: string;
    status: string;
    organizations?: {
      name: string;
    };
    user_roles?: Array<{
      name: string;
    }>;
  }>;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  superAdmins: number;
}

interface UserManagementClientProps {
  initialUsers: User[];
  initialStats: Stats;
}

export function UserManagementClient({ initialUsers, initialStats }: UserManagementClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      // Tentar API normal primeiro, depois API simples, depois debug
      let response = await fetch(`/api/admin/users?${params}`);
      
      if (!response.ok) {
        console.log("API normal falhou, tentando API simples...");
        response = await fetch(`/api/admin/users/simple?${params}`);
      }
      
      if (!response.ok) {
        console.log("API simples falhou, tentando API debug...");
        response = await fetch(`/api/admin/users/debug?${params}`);
      }
      
      if (response.ok) {
        const data = await response.json();
        console.log("=== DADOS RECEBIDOS ===");
        console.log("Total users:", data.users?.length);
        console.log("Users array:", data.users);
        console.log("Stats:", data.stats);
        console.log("Debug info:", data.debug);
        
        // Forçar exibição dos dados
        const usersArray = data.users || [];
        console.log("Setting users:", usersArray);
        setUsers(usersArray);
        setStats(data.stats || { total: 0, active: 0, pending: 0, superAdmins: 0 });
        
        // Log adicional
        console.log("Users state after set:", usersArray.length);
      } else {
        const errorData = await response.json();
        console.error("Erro da API:", errorData);
        toast({
          title: "Erro",
          description: errorData.error || "Erro ao carregar usuários",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar usuários na inicialização
  useEffect(() => {
    console.log("=== COMPONENT MOUNTED ===");
    loadUsers();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== "" || statusFilter !== "all") {
        console.log("=== FILTER CHANGED ===");
        loadUsers();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter]);

  const handleViewUser = (userId: string) => {
    setSelectedUserId(userId);
    setDetailsDialogOpen(true);
  };

  const handleInviteSuccess = () => {
    loadUsers();
  };

  const handleUserUpdated = () => {
    loadUsers();
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    const email = user.email?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    
    const matchesSearch = !searchTerm || 
      fullName.includes(search) || 
      email.includes(search);

    if (!matchesSearch) {
      console.log("User filtered out by search:", user.email, "search:", searchTerm);
      return false;
    }

    let statusMatch = true;
    switch (statusFilter) {
      case 'active':
        statusMatch = (user.memberships?.some(m => m.status === 'active') ?? false) && !user.is_suspended;
        break;
      case 'pending':
        statusMatch = user.memberships?.some(m => m.status === 'pending') ?? false;
        break;
      case 'suspended':
        statusMatch = user.is_suspended ?? false;
        break;
      case 'inactive':
        statusMatch = !(user.memberships?.some(m => m.status === 'active') ?? false) && !(user.is_suspended ?? false);
        break;
      default:
        statusMatch = true;
    }
    
    if (!statusMatch) {
      console.log("User filtered out by status:", user.email, "filter:", statusFilter, "memberships:", user.memberships);
    }
    
    return statusMatch;
  });

  console.log("=== FILTER RESULTS ===");
  console.log("Total users:", users.length);
  console.log("Filtered users:", filteredUsers.length);
  console.log("Search term:", searchTerm);
  console.log("Status filter:", statusFilter);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Gerenciar Usuários
                </h1>
                <p className="text-gray-600 mt-1">
                  Controle de usuários, roles e permissões
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="destructive">SUPER ADMIN</Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadUsers}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button 
                size="sm"
                onClick={() => setInviteDialogOpen(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Convidar Usuário
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Total de Usuários
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Usuários registrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <UserCheck className="w-4 h-4 mr-2 text-green-500" />
                Usuários Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <p className="text-xs text-muted-foreground">
                Com acesso ativo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Clock className="w-4 h-4 mr-2 text-yellow-500" />
                Convites Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                Aguardando aceitação
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Shield className="w-4 h-4 mr-2 text-purple-500" />
                Super Admins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.superAdmins}</div>
              <p className="text-xs text-muted-foreground">
                Administradores do sistema
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filtros e Busca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por nome, email ou organização..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={statusFilter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  Todos
                </Button>
                <Button 
                  variant={statusFilter === 'active' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                >
                  Ativos
                </Button>
                <Button 
                  variant={statusFilter === 'pending' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setStatusFilter('pending')}
                >
                  Pendentes
                </Button>
                <Button 
                  variant={statusFilter === 'suspended' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setStatusFilter('suspended')}
                >
                  Suspensos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle>Todos os Usuários</CardTitle>
            <CardDescription>
              Lista completa de usuários do sistema ({filteredUsers.length} usuários)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Carregando usuários...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Organizações</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const fullName = `${user.first_name} ${user.last_name}`.trim() || 'Usuário';
                    const activeMemberships = user.memberships?.filter(m => m.status === 'active') || [];
                    const pendingMemberships = user.memberships?.filter(m => m.status === 'pending') || [];
                    const hasActiveOrg = activeMemberships.length > 0;
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {fullName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">{fullName}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                              <div className="text-xs text-gray-400">
                                Cadastrado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            {activeMemberships.map((membership) => (
                              <div key={membership.id} className="flex items-center space-x-2">
                                <Building2 className="w-3 h-3 text-gray-400" />
                                <span className="text-sm">{membership.organizations?.name}</span>
                                <Badge variant="default" className="text-xs">
                                  {membership.role}
                                </Badge>
                              </div>
                            ))}
                            {pendingMemberships.map((membership) => (
                              <div key={membership.id} className="flex items-center space-x-2">
                                <Building2 className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-500">{membership.organizations?.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  Pendente
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            {user.memberships?.map((membership, membershipIndex) => (
                              <div key={`membership-${membership.id}-${membershipIndex}`}>
                                {membership.user_roles && membership.user_roles.length > 0 ? (
                                  membership.user_roles.map((role, roleIndex) => (
                                    <Badge key={`${membership.id}-role-${roleIndex}`} variant="outline" className="text-xs mr-1 mb-1">
                                      <Shield className="w-3 h-3 mr-1" />
                                      {role.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <Badge key={`${membership.id}-simple`} variant="outline" className="text-xs">
                                    <Shield className="w-3 h-3 mr-1" />
                                    {membership.role}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {user.is_suspended ? (
                              <>
                                <Ban className="w-4 h-4 text-red-500" />
                                <Badge variant="destructive" className="text-xs">Suspenso</Badge>
                              </>
                            ) : hasActiveOrg ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <Badge variant="default" className="text-xs">Ativo</Badge>
                              </>
                            ) : pendingMemberships.length > 0 ? (
                              <>
                                <Clock className="w-4 h-4 text-yellow-500" />
                                <Badge variant="secondary" className="text-xs">Pendente</Badge>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-red-500" />
                                <Badge variant="destructive" className="text-xs">Inativo</Badge>
                              </>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            {user.last_sign_in_at ? (
                              <>
                                <div>{new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(user.last_sign_in_at).toLocaleTimeString('pt-BR', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-400">Nunca</span>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewUser(user.id)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <UserInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={handleInviteSuccess}
      />

      {selectedUserId && (
        <UserDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          userId={selectedUserId}
          onUserUpdated={handleUserUpdated}
        />
      )}
    </div>
  );
}