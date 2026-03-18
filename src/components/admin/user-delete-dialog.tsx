"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, AlertTriangle, Settings, Users, Crown } from "lucide-react";
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
  updatedAt: Date;
  isActive: boolean;
}

interface UserDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData;
  onSuccess: () => void;
}

export function UserDeleteDialog({ 
  open, 
  onOpenChange, 
  user, 
  onSuccess 
}: UserDeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Usuário excluído",
          description: "O usuário foi excluído permanentemente do sistema."
        });
        
        onSuccess();
      } else {
        toast({
          title: "Erro ao excluir usuário",
          description: data.error || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getUserTypeIcon = (userType: UserType) => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return <Crown className="w-4 h-4 text-purple-500" />;
      case UserType.ORG_ADMIN:
        return <Settings className="w-4 h-4 text-blue-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-500" />;
    }
  };

  const getUserTypeLabel = (userType: UserType) => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return "Super Administrador";
      case UserType.ORG_ADMIN:
        return "Administrador da Organização";
      default:
        return "Usuário Comum";
    }
  };

  const getRelatedDataWarning = () => {
    const warnings = [];
    
    if (user.organizations.length > 0) {
      warnings.push(`• Memberships em ${user.organizations.length} organização(ões)`);
    }
    
    warnings.push("• Todos os acessos a clientes serão revogados");
    warnings.push("• Histórico de atividades será mantido para auditoria");
    
    return warnings;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Excluir Usuário Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-red-600">ATENÇÃO:</strong> Esta ação não pode ser desfeita. 
                O usuário será excluído permanentemente do sistema.
              </p>

              {/* User Info */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-red-600">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getUserTypeIcon(user.userType)}
                    <span className="text-sm font-medium">
                      {getUserTypeLabel(user.userType)}
                    </span>
                  </div>
                </div>
                
                {user.organizations.length > 0 && (
                  <div className="text-sm">
                    <strong>Organizações:</strong>
                    <ul className="mt-1 space-y-1">
                      {user.organizations.map(org => (
                        <li key={org.id} className="flex items-center justify-between">
                          <span>{org.name}</span>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {org.role}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Warning about cascade deletion */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 mb-2">
                      Os seguintes dados relacionados também serão removidos:
                    </p>
                    <ul className="text-yellow-700 space-y-1">
                      {getRelatedDataWarning().map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Special warning for super admins */}
              {user.userType === UserType.SUPER_ADMIN && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start space-x-2">
                    <Crown className="w-4 h-4 text-red-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-red-800 mb-1">
                        Atenção: Super Administrador
                      </p>
                      <p className="text-red-700">
                        Você está excluindo um Super Administrador. Certifique-se de que 
                        existem outros Super Admins no sistema antes de prosseguir.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-sm font-medium text-red-600">
                Digite o nome do usuário para confirmar a exclusão: <strong>{user.name}</strong>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Sim, excluir permanentemente
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}