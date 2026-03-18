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
import { 
  Users, 
  Search,
  Plus,
  Edit,
  Trash2,
  Settings,
  Users as UserIcon,
  Crown,
  RefreshCw,
  ShieldIcon
} from "lucide-react";
import { UserCreateDialog } from "@/components/admin/user-create-dialog";
import { UserEditDialog } from "@/components/admin/user-edit-dialog";
import { UserDeleteDialog } from "@/components/admin/user-delete-dialog";
import { ClientAccessManager } from "@/components/admin/client-access-manager";
import { useToast } from "@/hooks/use-toast";
import { UserType } from "@/lib/services/user-access-control";

interface User {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  organizations: Array<{
    id: string;
    name: string;
    role: 'admin' | 'member';
  }>;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

interface Stats {
  total: number;
  active: number;
  admins: number;
  members: number;
  superAdmins: number;
}

interface UserManagementPanelProps {
  organizationId?: string; // Optional for super admin
}

export function UserManagementPanel({ organizationId }: UserManagementPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, admins: 0, members: 0, superAdmins: 0 });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'member'>('all');
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientAccessOpen, setClientAccessOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, [organizationId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (organizationId) {
        params.append('organizationId', organizationId);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (roleFilter !== 'all') {
        params.append('role', roleFilter);
      }

      const response = await fetch(`/api/admin/users?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setStats(data.stats || { total: 0, active: 0, admins: 0, members: 0, superAdmins: 0 });
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro ao carregar usuários",
          description: errorData.error || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setCreateDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleManageClientAccess = (user: User) => {
    setSelectedUser(user);
    setClientAccessOpen(true);
  };

  const handleUserCreated = () => {
    loadUsers();
    setCreateDialogOpen(false);
  };

  const handleUserUpdated = () => {
    loadUsers();
    setEditDialogOpen(false);
    setSelectedUser(null);
  };

  const handleUserDeleted = () => {
    loadUsers();
    setDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  const handleClientAccessClosed = () => {
    setClientAccessOpen(false);
    setSelectedUser(null);
  };

  const getUserTypeIcon = (userType: UserType) => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return <Crown className="w-4 h-4 text-purple-500" />;
      case UserType.ORG_ADMIN:
        return <Settings className="w-4 h-4 text-blue-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getUserTypeBadge = (userType: UserType) => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return <Badge variant="destructive">Super Admin</Badge>;
      case UserType.ORG_ADMIN:
        return <Badge variant="default">Admin</Badge>;
      default:
        return <Badge variant="secondary">Usuário</Badge>;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || 
      user.organizations.some(org => org.role === roleFilter);

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gerenciamento de Usuários</h2>
          <p className="text-muted-foreground">
            Gerencie usuários, roles e permissões da organização
          </p>
        </div>
        <Button onClick={handleCreateUser}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Usuário
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">usuários</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <UserIcon className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Settings className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.admins}</div>
            <p className="text-xs text-muted-foreground">administradores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros</CardTitle>
            <Users className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.members}</div>
            <p className="text-xs text-muted-foreground">membros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
            <Crown className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.superAdmins}</div>
            <p className="text-xs text-muted-foreground">super admins</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={roleFilter === 'all' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setRoleFilter('all')}
              >
                Todos
              </Button>
              <Button 
                variant={roleFilter === 'admin' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setRoleFilter('admin')}
              >
                Admins
              </Button>
              <Button 
                variant={roleFilter === 'member' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setRoleFilter('member')}
              >
                Membros
              </Button>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={loadUsers}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            {filteredUsers.length} usuário(s) encontrado(s)
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
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Organizações</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getUserTypeIcon(user.userType)}
                        {getUserTypeBadge(user.userType)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        {user.organizations.map((org) => (
                          <div key={org.id} className="flex items-center space-x-2">
                            <span className="text-sm">{org.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {org.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        {user.createdAt.toLocaleDateString('pt-BR')}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleManageClientAccess(user)}
                          title="Gerenciar acesso a clientes"
                        >
                          <ShieldIcon className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          title="Editar usuário"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          title="Deletar usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <UserCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleUserCreated}
        organizationId={organizationId}
      />

      {selectedUser && (
        <>
          <UserEditDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            user={selectedUser}
            onSuccess={handleUserUpdated}
          />

          <UserDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            user={selectedUser}
            onSuccess={handleUserDeleted}
          />
        </>
      )}

      {/* Client Access Manager */}
      {selectedUser && clientAccessOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-4 z-50 overflow-auto">
            <div className="mx-auto max-w-7xl">
              <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                  Gerenciar Acesso a Clientes - {selectedUser.name}
                </h1>
                <Button 
                  variant="outline" 
                  onClick={handleClientAccessClosed}
                >
                  Fechar
                </Button>
              </div>
              <ClientAccessManager
                userId={selectedUser.id}
                userName={selectedUser.name}
                userEmail={selectedUser.email}
                organizationId={organizationId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}