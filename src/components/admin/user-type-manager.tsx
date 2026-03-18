"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Crown,
  Settings,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { UserType } from "@/lib/services/user-access-control";

interface UserData {
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
  isActive: boolean;
}

interface UserTypeManagerProps {
  organizationId: string;
  organizationName: string;
  superAdminId: string;
}

export function UserTypeManager({ organizationId, organizationName, superAdminId }: UserTypeManagerProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [changingUserId, setChangingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [organizationId]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, typeFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/super-admin/organizations/${organizationId}/users`);
      if (!response.ok) throw new Error("Erro ao carregar usuários");
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar usuários da organização");
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    // Filtrar por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por tipo
    if (typeFilter !== "all") {
      filtered = filtered.filter(user => user.userType === typeFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleUserTypeChange = async (userId: string, newType: UserType) => {
    if (userId === superAdminId) {
      toast.error("Você não pode alterar seu próprio tipo de usuário");
      return;
    }

    try {
      setChangingUserId(userId);

      const response = await fetch("/api/super-admin/users/change-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: userId,
          newType,
          adminUserId: superAdminId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao alterar tipo de usuário");
      }

      const result = await response.json();
      toast.success(result.message);
      
      // Recarregar usuários
      await loadUsers();

    } catch (error) {
      console.error("Erro ao alterar tipo de usuário:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao alterar tipo de usuário");
    } finally {
      setChangingUserId(null);
    }
  };

  const getUserTypeIcon = (userType: UserType) => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return <Crown className="w-4 h-4 text-red-500" />;
      case UserType.ORG_ADMIN:
        return <Settings className="w-4 h-4 text-blue-500" />;
      case UserType.COMMON_USER:
        return <Users className="w-4 h-4 text-gray-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-400" />;
    }
  };

  const getUserTypeBadge = (userType: UserType) => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return <Badge variant="destructive">Super Admin</Badge>;
      case UserType.ORG_ADMIN:
        return <Badge variant="default">Admin Org</Badge>;
      case UserType.COMMON_USER:
        return <Badge variant="secondary">Usuário Comum</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  const getUserTypeOptions = (currentType: UserType) => {
    // Super admins podem alterar para qualquer tipo
    return [
      { value: UserType.SUPER_ADMIN, label: "Super Admin", disabled: false },
      { value: UserType.ORG_ADMIN, label: "Admin de Organização", disabled: false },
      { value: UserType.COMMON_USER, label: "Usuário Comum", disabled: false }
    ];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Carregando usuários...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Gerenciar Tipos de Usuário - {organizationName}
        </CardTitle>
        <CardDescription>
          Altere os tipos de usuário dentro desta organização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value={UserType.SUPER_ADMIN}>Super Admin</SelectItem>
                <SelectItem value={UserType.ORG_ADMIN}>Admin de Org</SelectItem>
                <SelectItem value={UserType.COMMON_USER}>Usuário Comum</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{users.length}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => u.userType === UserType.SUPER_ADMIN).length}
            </div>
            <div className="text-sm text-red-600">Super Admins</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {users.filter(u => u.userType === UserType.ORG_ADMIN).length}
            </div>
            <div className="text-sm text-blue-600">Admins Org</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">
              {users.filter(u => u.userType === UserType.COMMON_USER).length}
            </div>
            <div className="text-sm text-gray-600">Usuários Comuns</div>
          </div>
        </div>

        {/* Lista de usuários */}
        <div className="space-y-4">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum usuário encontrado
              </h3>
              <p className="text-gray-600">
                {searchTerm || typeFilter !== "all" 
                  ? "Tente ajustar os filtros de busca"
                  : "Esta organização não possui usuários"
                }
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    {getUserTypeIcon(user.userType)}
                  </div>
                  <div>
                    <h3 className="font-medium">{user.name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {getUserTypeBadge(user.userType)}
                      {user.organizations.map(org => (
                        <Badge key={org.id} variant="outline" className="text-xs">
                          {org.role === 'admin' ? 'Admin' : 'Membro'} em {org.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {user.id === superAdminId && (
                    <div className="flex items-center space-x-1 text-yellow-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">Você</span>
                    </div>
                  )}
                  
                  <Select
                    value={user.userType}
                    onValueChange={(newType: UserType) => handleUserTypeChange(user.id, newType)}
                    disabled={changingUserId === user.id || user.id === superAdminId}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getUserTypeOptions(user.userType).map((option) => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {changingUserId === user.id && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Aviso importante */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Importante</h4>
              <p className="text-sm text-yellow-700 mt-1">
                • Super Admins têm acesso total ao sistema, incluindo todas as organizações<br/>
                • Admins de Organização podem gerenciar usuários e clientes dentro de sua organização<br/>
                • Usuários Comuns têm acesso apenas aos clientes autorizados pelo admin<br/>
                • Você não pode alterar seu próprio tipo de usuário
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}