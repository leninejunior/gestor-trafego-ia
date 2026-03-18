'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserPlus, MoreVertical, Trash2, Shield, Eye, User } from 'lucide-react';
import { InviteUserDialog } from './invite-user-dialog';
import { useToast } from '@/hooks/use-toast';

interface OrganizationUser {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  last_sign_in_at: string | null;
}

interface UserLimits {
  current_users: number;
  max_users: number;
  can_add_more: boolean;
  plan_name: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [limits, setLimits] = useState<UserLimits | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<OrganizationUser | null>(null);
  const { toast } = useToast();

  const isAdmin = ['admin', 'owner'].includes(currentUserRole);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const response = await fetch('/api/organization/users');
      
      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setLimits(data.limits);
      setCurrentUserRole(data.currentUserRole);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar usuários',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveUser(user: OrganizationUser) {
    try {
      const response = await fetch(
        `/api/organization/users?membershipId=${user.membership_id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove user');
      }

      toast({
        title: 'Sucesso',
        description: 'Usuário removido com sucesso'
      });

      loadUsers();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao remover usuário',
        variant: 'destructive'
      });
    } finally {
      setUserToRemove(null);
    }
  }

  async function handleChangeRole(userId: string, newRole: string) {
    try {
      const response = await fetch(`/api/organization/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      toast({
        title: 'Sucesso',
        description: 'Permissão atualizada com sucesso'
      });

      loadUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao atualizar permissão',
        variant: 'destructive'
      });
    }
  }

  function getRoleIcon(role: string) {
    switch (role) {
      case 'admin':
      case 'owner':
        return <Shield className="h-4 w-4" />;
      case 'viewer':
        return <Eye className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  }

  function getRoleBadgeVariant(role: string): "default" | "secondary" | "outline" {
    switch (role) {
      case 'admin':
      case 'owner':
        return 'default';
      case 'viewer':
        return 'outline';
      default:
        return 'secondary';
    }
  }

  function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
      owner: 'Proprietário',
      admin: 'Administrador',
      member: 'Membro',
      viewer: 'Visualizador'
    };
    return labels[role] || role;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usuários da Organização</CardTitle>
              <CardDescription>
                Gerencie os usuários e suas permissões
              </CardDescription>
            </div>
            {isAdmin && (
              <Button
                onClick={() => setInviteDialogOpen(true)}
                disabled={!limits?.can_add_more}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar Usuário
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Informações do Plano */}
          {limits && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Plano: {limits.plan_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {limits.current_users} de {limits.max_users} usuários
                  </p>
                </div>
                {!limits.can_add_more && (
                  <Badge variant="destructive">Limite atingido</Badge>
                )}
              </div>
            </div>
          )}

          {/* Tabela de Usuários */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead>Entrou em</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.membership_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {user.full_name?.[0] || user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {user.full_name || 'Sem nome'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      <span className="flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        {getRoleLabel(user.role)}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.joined_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(user.user_id, 'admin')}
                            disabled={user.role === 'admin' || user.role === 'owner'}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Tornar Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(user.user_id, 'member')}
                            disabled={user.role === 'member'}
                          >
                            <User className="h-4 w-4 mr-2" />
                            Tornar Membro
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(user.user_id, 'viewer')}
                            disabled={user.role === 'viewer'}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Tornar Visualizador
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setUserToRemove(user)}
                            disabled={user.role === 'owner'}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Convite */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={loadUsers}
      />

      {/* Dialog de Confirmação de Remoção */}
      <AlertDialog open={!!userToRemove} onOpenChange={() => setUserToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {userToRemove?.full_name || userToRemove?.email} da organização?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToRemove && handleRemoveUser(userToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
