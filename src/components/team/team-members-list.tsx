"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  MoreHorizontal, 
  Shield, 
  UserX, 
  Edit,
  Crown,
  User,
  Eye
} from "lucide-react";

interface Member {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  accepted_at: string;
  user_profiles: {
    first_name: string;
    last_name: string;
    avatar_url: string;
    last_login_at: string;
  } | null;
  user_roles: {
    name: string;
    description: string;
  } | null;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

interface TeamMembersListProps {
  members: Member[];
  currentUserId: string;
  canManage: boolean;
  roles: Role[];
}

export function TeamMembersList({ members, currentUserId, canManage, roles }: TeamMembersListProps) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'manager':
        return <User className="h-4 w-4 text-green-500" />;
      default:
        return <Eye className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'manager':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao alterar função");
      }

      toast({
        title: "Sucesso",
        description: "Função alterada com sucesso!",
      });

      window.location.reload();

    } catch (error) {
      console.error("Erro ao alterar função:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao alterar função",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    setLoading(true);
    
    try {
      const response = await fetch(`/api/team/members/${selectedMember.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao remover membro");
      }

      toast({
        title: "Sucesso",
        description: "Membro removido com sucesso!",
      });

      setShowRemoveDialog(false);
      setSelectedMember(null);
      window.location.reload();

    } catch (error) {
      console.error("Erro ao remover membro:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao remover membro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!members || members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum membro encontrado</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {members.map((member) => {
          const isCurrentUser = member.user_id === currentUserId;
          const profile = member.user_profiles;
          const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Usuário';
          const displayName = fullName || 'Usuário';

          return (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback>
                    {getInitials(profile?.first_name, profile?.last_name)}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">
                      {displayName}
                      {isCurrentUser && (
                        <span className="text-sm text-muted-foreground ml-2">(Você)</span>
                      )}
                    </h3>
                    {getRoleIcon(member.role)}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.user_roles?.name || member.role}
                    </Badge>
                    
                    <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                      {member.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-1">
                    Membro desde {formatDate(member.accepted_at || member.created_at)}
                  </p>
                </div>
              </div>

              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Alterar função */}
                    {member.role !== 'owner' && (
                      <>
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          Alterar Função
                        </DropdownMenuLabel>
                        {roles
                          .filter(role => role.name !== member.role && role.name !== 'super_admin')
                          .map((role) => (
                          <DropdownMenuItem
                            key={role.id}
                            onClick={() => handleChangeRole(member.id, role.name)}
                            disabled={loading}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            {role.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </>
                    )}
                    
                    {/* Remover membro */}
                    {!isCurrentUser && (
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedMember(member);
                          setShowRemoveDialog(true);
                        }}
                        className="text-red-600"
                        disabled={loading}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Remover
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog de confirmação para remover membro */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este membro da organização? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}