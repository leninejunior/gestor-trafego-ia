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
  Users as UserIcon,         
  Shield,   
  Building2,
  XCircle,      
  CheckCircle,
  Clock,
  Eye,
  Plus,         
  RefreshCw,
  Crown
} from "lucide-react";
import { UserInviteDialog } from "./user-invite-dialog";
import { UserCreateDialog } from "./user-create-dialog";
import { UserDetailsDialogEnhanced } from "./user-details-dialog-enhanced";
import { UserAccessIndicator, UserTypeBadge } from "@/components/ui/user-access-indicator";
import { useUserAccess, useUserType } from "@/hooks/use-user-access";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  user_type?: string;
  is_suspended?: boolean;
  memberships?: Array<{
    id: string;
    role: string;
    status: string;
    user_type?: 'master' | 'regular' | 'client';
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Hooks do novo sistema de controle de acesso
  const { userType: currentUserType, isSuperAdmin } = useUserType();
  const { currentUser } = useUserAccess();

  // Função para obter o tipo de usuário baseado no novo sistema
  const getUserTypeFromMembership = (user: User): 'master' | 'regular' | 'client' => {
    // Verificar se tem membership com user_type definido
    const membership = user.memberships?.[0];
    if (membership?.user_type) {
      return membership.user_type;
    }
    
    // Fallback para o user_type antigo
    if (user.user_type === 'Super Admin') return 'master';
    if (user.user_type === 'Admin') return 'regular';
    return 'regular'; // Default
  };

  // Função para obter badge do tipo de usuário
  const getUserTypeBadgeVariant = (userType: 'master' | 'regular' | 'client') => {
    switch (userType) {
      case 'master':
        return 'destructive'; // Vermelho para master
      case 'regular':
        return 'default'; // Azul para regular
      case 'client':
        return 'secondary'; // Cinza para client
      default:
        return 'outline';
    }
  };

  // Função para obter label do tipo de usuário
  const getUserTypeLabel = (userType: 'master' | 'regular' | 'client') => {
    switch (userType) {
      case 'master':
        return 'Master';
      case 'regular':
        return 'Regular';
      case 'client':
        return 'Cliente';
      default:
        return 'Indefinido';
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      // Usar a nova API simple-test
      const response = await fetch(`/api/admin/users/simple-test?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        
        const usersArray = data.users || [];
        setUsers(usersArray);
        setStats(data.stats || { total: 0, active: 0, pending: 0, superAdmins: 0 });
        
        toast({
          title: "Sucesso",
          description: `${usersArray.length} usuários carregados`,
          variant: "default"
        });
      } else {
        const errorData = await response.json();
        console.error("Erro da API:", errorData);
        toast({
          title: "Erro",
          description: errorData?.error || "Erro ao carregar usuários",
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
    console.log('👁️ handleViewUser chamado com userId:', userId);
    setSelectedUserId(userId);
    setDetailsDialogOpen(true);
    console.log('🔄 Estado atualizado - selectedUserId:', userId, 'detailsDialogOpen:', true);
  };

  const handleInviteSuccess = () => {
    loadUsers();
  };

  const handleCreateSuccess = () => {
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
      return false;
    }

    // Lógica de filtro simplificada baseada apenas em is_suspended
    switch (statusFilter) {
      case 'active':
        return !user.is_suspended;
      case 'suspended':
        return user.is_suspended;
      case 'all':
      default:
        return true;
    }
  });


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
                  Gerenciar Usuários ✅ NOVO
                </h1>
                <p className="text-gray-600 mt-1">
                  Controle de usuários, roles e permissões
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <UserTypeBadge />
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
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Usuário
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setInviteDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
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
                <UserIcon className="w-4 h-4 mr-2 text-green-500" />
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
                <XCircle className="w-4 h-4 mr-2 text-red-500" />
                Usuários Suspensos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                Com acesso bloqueado
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
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {users.length === 0 
                    ? "Nenhum usuário encontrado no sistema" 
                    : `Nenhum usuário encontrado com os filtros aplicados (${users.length} usuários no total)`
                  }
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  className="mt-2"
                >
                  Limpar Filtros
                </Button>
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
                            {user.memberships && user.memberships.length > 0 ? (
                              user.memberships.map((membership, membershipIndex) => {
                                const userType = getUserTypeFromMembership(user);
                                return (
                                  <div key={`membership-${membership.id}-${membershipIndex}`} className="flex items-center space-x-2">
                                    <Shield className="w-3 h-3 text-gray-400" />
                                    <Badge 
                                      variant={getUserTypeBadgeVariant(userType)} 
                                      className="text-xs"
                                    >
                                      {getUserTypeLabel(userType)}
                                    </Badge>
                                    {userType === 'master' && <Crown className="w-3 h-3 text-yellow-500" />}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="flex items-center space-x-2">
                                <Shield className="w-3 h-3 text-gray-400" />
                                <Badge variant="outline" className="text-xs">
                                  Sem Tipo
                                </Badge>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {user.is_suspended ? (
                              <>
                                <XCircle className="w-4 h-4 text-red-500" />
                                <Badge variant="destructive" className="text-xs">Suspenso</Badge>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <Badge variant="default" className="text-xs">Ativo</Badge>
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
                              Ver ✅
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
      <UserCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      <UserInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={handleInviteSuccess}
      />

      {selectedUserId && (
        <>
          {console.log('🎭 Renderizando modal ENHANCED - selectedUserId:', selectedUserId, 'detailsDialogOpen:', detailsDialogOpen)}
          <UserDetailsDialogEnhanced
            open={detailsDialogOpen}
            onOpenChange={(open) => {
              console.log('🔄 Modal onOpenChange chamado com:', open);
              setDetailsDialogOpen(open);
              if (!open) {
                console.log('🧹 Limpando selectedUserId');
                setSelectedUserId(null);
              }
            }}
            userId={selectedUserId}
            onUserUpdated={handleUserUpdated}
          />
        </>
      )}
    </div>
  );
}