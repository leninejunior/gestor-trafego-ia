import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
  UserX,
  Shield,
  Mail,
  Calendar,
  Building2,
  Settings,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  Eye
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Verificar se é super admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/login");
  }

  // Buscar todos os usuários com suas organizações e roles
  const { data: users } = await supabase
    .from("user_profiles")
    .select(`
      id,
      first_name,
      last_name,
      email,
      created_at,
      last_sign_in_at,
      memberships (
        id,
        role,
        status,
        created_at,
        accepted_at,
        organization_id,
        organizations (
          name
        ),
        user_roles!memberships_role_id_fkey (
          name,
          permissions
        )
      )
    `)
    .order("created_at", { ascending: false });

  // Estatísticas dos usuários
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter(u => 
    u.memberships?.some(m => m.status === 'active')
  ).length || 0;
  const pendingUsers = users?.filter(u => 
    u.memberships?.some(m => m.status === 'pending')
  ).length || 0;
  const superAdmins = users?.filter(u => 
    u.memberships?.some(m => m.user_roles?.[0]?.name === 'super_admin')
  ).length || 0;

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
              <Button size="sm">
                <Mail className="w-4 h-4 mr-2" />
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
              <div className="text-2xl font-bold">{totalUsers}</div>
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
              <div className="text-2xl font-bold text-green-600">{activeUsers}</div>
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
              <div className="text-2xl font-bold text-yellow-600">{pendingUsers}</div>
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
              <div className="text-2xl font-bold text-purple-600">{superAdmins}</div>
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
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Todos
                </Button>
                <Button variant="outline" size="sm">
                  Ativos
                </Button>
                <Button variant="outline" size="sm">
                  Pendentes
                </Button>
                <Button variant="outline" size="sm">
                  Admins
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
              Lista completa de usuários do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                {users?.map((user) => {
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
                          {user.memberships?.map((membership) => {
                            const role = membership.user_roles?.[0];
                            if (role) {
                              return (
                                <Badge key={membership.id} variant="outline" className="text-xs">
                                  <Shield className="w-3 h-3 mr-1" />
                                  {role.name}
                                </Badge>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {hasActiveOrg ? (
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
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm">
                            <Ban className="w-4 h-4 mr-1" />
                            Suspender
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}