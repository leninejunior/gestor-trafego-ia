"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Edit, Loader2, Settings, Users as UserIcon, Crown } from "lucide-react";
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

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onSuccess: () => void;
}

export function UserEditDialog({ 
  open, 
  onOpenChange, 
  user, 
  onSuccess 
}: UserEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "member" as "admin" | "member",
    isActive: true
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && user) {
      // Initialize form with user data
      setFormData({
        name: user.name,
        role: user.organizations[0]?.role || "member",
        isActive: user.isActive
      });
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Erro de validação",
        description: "O nome é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Usuário atualizado",
          description: "As informações do usuário foram atualizadas com sucesso!"
        });
        
        onSuccess();
      } else {
        toast({
          title: "Erro ao atualizar usuário",
          description: data.error || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
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
        return <Crown className="w-5 h-5 text-purple-500" />;
      case UserType.ORG_ADMIN:
        return <Settings className="w-5 h-5 text-blue-500" />;
      default:
        return <UserIcon className="w-5 h-5 text-gray-500" />;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Edit className="w-5 h-5 mr-2" />
            Editar Usuário
          </DialogTitle>
          <DialogDescription>
            Atualize as informações e permissões do usuário
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Info Display */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600">
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
              <div className="text-sm text-muted-foreground">
                <strong>Organizações:</strong> {user.organizations.map(org => org.name).join(", ")}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          {/* Only allow role changes for non-super admins */}
          {user.userType !== UserType.SUPER_ADMIN && (
            <div className="space-y-2">
              <Label htmlFor="role">Função na Organização</Label>
              <Select
                value={formData.role}
                onValueChange={(value: "admin" | "member") => 
                  setFormData(prev => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    <div className="flex items-center space-x-2">
                      <span>👤</span>
                      <div>
                        <div className="font-medium">Membro</div>
                        <div className="text-xs text-muted-foreground">
                          Acesso limitado aos clientes autorizados
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center space-x-2">
                      <span>🛡️</span>
                      <div>
                        <div className="font-medium">Administrador</div>
                        <div className="text-xs text-muted-foreground">
                          Pode gerenciar usuários e clientes da organização
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, isActive: checked }))
              }
            />
            <Label htmlFor="isActive">Usuário ativo</Label>
          </div>

          {!formData.isActive && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                ⚠️ Desativar o usuário impedirá que ele acesse o sistema.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}