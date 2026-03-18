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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { 
  Edit, 
  Trash2, 
  UserX, 
  UserCheck, 
  MoreHorizontal,
  Eye,
  Shield,
  ShieldOff,
  AlertTriangle
} from "lucide-react";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  is_suspended: boolean;
  user_type: string;
  memberships: any[];
  suspension_reason?: string;
  suspended_at?: string;
  suspended_by?: string;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  superAdmins: number;
}

interface EditUserData {
  firstName: string;
  lastName: string;
  email: string;
}

interface SuspendUserData {
  reason: string;
}

export default function UserManagementSimple() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, pending: 0, suspended: 0, superAdmins: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const { user } = useUser();
  const supabase = createClient();

  // Função auxiliar para fazer chamadas autenticadas
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        ...options.headers,
      },
    });
  };

  // Estados para modais
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Estados para formulários
  const [editData, setEditData] = useState<EditUserData>({
    firstName: "",
    lastName: "",
    email: ""
  });
  const [suspendData, setSuspendData] = useState<SuspendUserData>({
    reason: ""
  });

  useEffect(() => {
    console.log("=== COMPONENT MOUNTED ===");
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log("🔄 Fetching users...");

      // Try multiple APIs in order
      let response = await authenticatedFetch(`/api/admin/users/simple`);
      
      if (!response.ok) {
        console.log("API simple falhou, tentando API debug...");
        response = await authenticatedFetch(`/api/admin/users/simple-test`);
      }
      
      if (response.ok) {
        const data = await response.json();
        console.log("=== DADOS RECEBIDOS ===");
        console.log("Total users:", data.users?.length);
        console.log("Stats:", data.stats);
        
        setUsers(data.users || []);
        setStats(data.stats || { total: 0, active: 0, pending: 0, suspended: 0, superAdmins: 0 });
        
        toast({
          title: "Usuários carregados",
          description: `${data.users?.length || 0} usuários encontrados`,
        });
      } else {
        const errorData = await response.json();
        console.error("Erro da API:", errorData);
        toast({
          title: "Erro ao carregar usuários",
          description: errorData.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para abrir modal de edição
  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditData({
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      email: user.email || ""
    });
    setEditDialogOpen(true);
  };

  // Função para abrir modal de suspensão
  const openSuspendDialog = (user: User) => {
    setSelectedUser(user);
    setSuspendData({ reason: "" });
    setSuspendDialogOpen(true);
  };

  // Função para abrir modal de exclusão
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  // Função para editar usuário
  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      
      const response = await authenticatedFetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'update_profile',
          firstName: editData.firstName,
          lastName: editData.lastName,
          email: editData.email
        }),
      });

      if (response.ok) {
        toast({
          title: "Usuário atualizado",
          description: "Os dados do usuário foram atualizados com sucesso.",
        });
        setEditDialogOpen(false);
        fetchUsers(); // Recarregar lista
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro ao atualizar usuário",
          description: errorData.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao editar usuário:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Função para suspender usuário
  const handleSuspendUser = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      
      const response = await authenticatedFetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'suspend',
          reason: suspendData.reason
        }),
      });

      if (response.ok) {
        toast({
          title: "Usuário suspenso",
          description: "O usuário foi suspenso com sucesso.",
        });
        setSuspendDialogOpen(false);
        fetchUsers(); // Recarregar lista
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro ao suspender usuário",
          description: errorData.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao suspender usuário:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Função para reativar usuário
  const handleUnsuspendUser = async (user: User) => {
    try {
      setActionLoading(true);
      
      const response = await authenticatedFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'unsuspend'
        }),
      });

      if (response.ok) {
        toast({
          title: "Usuário reativado",
          description: "O usuário foi reativado com sucesso.",
        });
        fetchUsers(); // Recarregar lista
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro ao reativar usuário",
          description: errorData.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao reativar usuário:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Função para deletar usuário
  const handleDeleteUser = async () => {
    if (!selectedUser || !user) return;

    try {
      setActionLoading(true);
      
      const response = await authenticatedFetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Usuário excluído",
          description: "O usuário foi excluído permanentemente do sistema.",
        });
        setDeleteDialogOpen(false);
        fetchUsers(); // Recarregar lista
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro ao excluir usuário",
          description: errorData.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const searchMatch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const statusMatch = statusFilter === "all" || 
      (statusFilter === "active" && !user.is_suspended) ||
      (statusFilter === "suspended" && user.is_suspended);

    return searchMatch && statusMatch;
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
                  ← Voltar
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Gerenciar Usuários
                </h1>
                <p className="text-gray-600 mt-1">
                  Visualize e gerencie todos os usuários do sistema
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <span className="text-2xl">👥</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativos</CardTitle>
              <span className="text-2xl">✅</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <span className="text-2xl">⏳</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspensos</CardTitle>
              <span className="text-2xl">🚫</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.suspended}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
              <span className="text-2xl">👑</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.superAdmins}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="pending">Pendentes</option>
                <option value="suspended">Suspensos</option>
              </select>
              <Button onClick={fetchUsers} variant="outline">
                🔄 Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários ({filteredUsers.length})</CardTitle>
            <CardDescription>
              Lista de todos os usuários do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando usuários...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Nenhum usuário encontrado</p>
                <Button onClick={fetchUsers} variant="outline" className="mt-4">
                  🔄 Tentar novamente
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo de Usuário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {user.id.substring(0, 8)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            user.user_type === 'Super Admin' ? 'destructive' :
                            user.user_type === 'Admin' ? 'default' :
                            user.user_type === 'Membro' ? 'secondary' :
                            'outline'
                          }
                        >
                          {user.user_type === 'Super Admin' && '👑 '}
                          {user.user_type === 'Admin' && '🛡️ '}
                          {user.user_type === 'Membro' && '👤 '}
                          {user.user_type === 'Usuário' && '👥 '}
                          {user.user_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.is_suspended ? (
                          <Badge variant="destructive">Suspenso</Badge>
                        ) : (
                          <Badge variant="default">Ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {user.last_sign_in_at 
                          ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')
                          : 'Nunca'
                        }
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar usuário
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.is_suspended ? (
                              <DropdownMenuItem 
                                onClick={() => handleUnsuspendUser(user)}
                                className="text-green-600"
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Reativar usuário
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => openSuspendDialog(user)}
                                className="text-yellow-600"
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Suspender usuário
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => openDeleteDialog(user)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir usuário
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere os dados do usuário {selectedUser?.first_name} {selectedUser?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">
                Nome
              </Label>
              <Input
                id="firstName"
                value={editData.firstName}
                onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">
                Sobrenome
              </Label>
              <Input
                id="lastName"
                value={editData.lastName}
                onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setEditDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              onClick={handleEditUser}
              disabled={actionLoading}
            >
              {actionLoading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Suspensão */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Suspender Usuário
            </DialogTitle>
            <DialogDescription>
              Você está prestes a suspender o usuário {selectedUser?.first_name} {selectedUser?.last_name}.
              O usuário não poderá mais acessar o sistema até ser reativado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">
                Motivo da suspensão *
              </Label>
              <Textarea
                id="reason"
                placeholder="Digite o motivo da suspensão..."
                value={suspendData.reason}
                onChange={(e) => setSuspendData({ reason: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setSuspendDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              onClick={handleSuspendUser}
              disabled={actionLoading || !suspendData.reason.trim()}
            >
              {actionLoading ? "Suspendendo..." : "Suspender usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Excluir Usuário Permanentemente
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>ATENÇÃO:</strong> Você está prestes a excluir permanentemente o usuário:
            </p>
            <div className="bg-gray-100 p-3 rounded-md space-y-1">
              <div><strong>Nome:</strong> {selectedUser?.first_name} {selectedUser?.last_name}</div>
              <div><strong>Email:</strong> {selectedUser?.email}</div>
              <div><strong>Tipo:</strong> {selectedUser?.user_type}</div>
            </div>
            <p className="text-red-600 font-medium">
              Esta ação NÃO pode ser desfeita. Todos os dados do usuário serão removidos do sistema.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? "Excluindo..." : "Sim, excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}