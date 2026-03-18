"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserStatusControl } from "./user-status-control";
import { 
  Users, 
  Mail,
  Calendar, 
  Shield,
  Building2, 
  Save, 
  Pencil,
  X
} from "lucide-react";

interface UserDetailsWorkingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onUserUpdated: () => void;
}

interface UserDetails {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  user_type: string;
  created_at: string;
  last_sign_in_at: string;
  email_confirmed_at?: string;
  is_suspended: boolean;
  suspended_at?: string;
  suspended_by?: string;
  suspension_reason?: string;
  user_metadata?: {
    name?: string;
    phone?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  memberships: Array<{
    id: string;
    role: string;
    status: string;
    created_at: string;
    organizations: {
      id: string;
      name: string;
    };
  }>;
}

export function UserDetailsWorking({ 
  open, 
  onOpenChange, 
  userId, 
  onUserUpdated 
}: UserDetailsWorkingProps) {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Form fields
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editOrganization, setEditOrganization] = useState("");
  
  // Available organizations for selection
  const [availableOrganizations, setAvailableOrganizations] = useState<Array<{id: string, name: string}>>([]);
  const [userType, setUserType] = useState<string>("");
  
  const { toast } = useToast();

  const loadUserDetails = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/enhanced?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.user) {
        setUser(data.user);
        
        // Populate form fields
        setEditFirstName(data.user.first_name || "");
        setEditLastName(data.user.last_name || "");
        setEditEmail(data.user.email || "");
        setEditPhone(data.user.phone || "");
        setUserType(data.user.user_type || "regular");
        
        // Set organization and role from first membership
        if (data.user.memberships && data.user.memberships.length > 0) {
          const firstMembership = data.user.memberships[0];
          setEditRole(firstMembership.role || "");
          setEditOrganization(firstMembership.organizations?.id || "");
        }
      } else {
        throw new Error(data.error || "Erro ao carregar usuário");
      }
    } catch (error) {
      console.error("❌ Erro ao carregar usuário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do usuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await fetch("/api/admin/organizations");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableOrganizations(data.organizations || []);
        }
      }
    } catch (error) {
      console.error("❌ Erro ao carregar organizações:", error);
    }
  };

  useEffect(() => {
    if (open && userId) {
      loadUserDetails();
      loadOrganizations();
    }
  }, [open, userId]);

  const handleEditClick = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    // Reset form fields to original values
    if (user) {
      setEditFirstName(user.first_name || "");
      setEditLastName(user.last_name || "");
      setEditEmail(user.email || "");
      setEditPhone(user.phone || "");
      setUserType(user.user_type || "regular");
      
      if (user.memberships && user.memberships.length > 0) {
        const firstMembership = user.memberships[0];
        setEditRole(firstMembership.role || "");
        setEditOrganization(firstMembership.organizations?.id || "");
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const updateData = {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        user_type: userType,
        role: editRole,
        organization_id: editOrganization
      };

      console.log("📤 Enviando dados para atualização:", updateData);

      const response = await fetch(`/api/admin/users/${userId}/update-simple`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const responseText = await response.text();
      console.log("📥 Resposta bruta da API:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("❌ Erro ao fazer parse da resposta:", parseError);
        throw new Error("Resposta inválida do servidor");
      }

      if (response.ok && data.success) {
        toast({
          title: "✅ Sucesso",
          description: "Usuário atualizado com sucesso!",
        });
        
        setEditMode(false);
        await loadUserDetails(); // Reload user data
        onUserUpdated(); // Notify parent component
      } else {
        const errorData = data;
        console.error("❌ Erro da API:", errorData || "Dados de erro não disponíveis");
        console.error("📨 Status da resposta:", response.status, response.statusText);
        
        // Determinar mensagem de erro mais informativa
        let errorMessage = "Erro desconhecido ao atualizar usuário";
        
        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (!response.ok) {
          errorMessage = `Erro ${response.status}: ${response.statusText}`;
        }

        toast({
          title: "❌ Erro",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Erro ao salvar:", error);
      toast({
        title: "❌ Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido ao salvar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Nunca";
    try {
      return new Date(dateString).toLocaleString("pt-BR");
    } catch {
      return "Data inválida";
    }
  };

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case "master": return "Master";
      case "regular": return "Regular";
      case "client": return "Cliente";
      default: return type || "Regular";
    }
  };

  const getUserTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "master": return "default" as const;
      case "regular": return "secondary" as const;
      case "client": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Carregando dados do usuário...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-muted-foreground">Usuário não encontrado</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Detalhes do Usuário
          </DialogTitle>
          <DialogDescription>
            Visualize e edite as informações do usuário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Type and Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={getUserTypeBadgeVariant(user.user_type)}>
                <Shield className="w-3 h-3 mr-1" />
                {getUserTypeLabel(user.user_type)}
              </Badge>
              
              <Badge variant={user.is_suspended ? "destructive" : "default"}>
                {user.is_suspended ? "Suspenso" : "Ativo"}
              </Badge>
            </div>
            
            <UserStatusControl 
              userId={user.id}
              isActive={!user.is_suspended}
              suspensionReason={user.suspension_reason}
              suspendedAt={user.suspended_at}
              onStatusChanged={loadUserDetails}
            />
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              {editMode ? (
                <Input
                  id="firstName"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="Nome do usuário"
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">
                  {user.first_name || "Não informado"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              {editMode ? (
                <Input
                  id="lastName"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Sobrenome do usuário"
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">
                  {user.last_name || "Não informado"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              {editMode ? (
                <Input
                  id="email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">
                  {user.email}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              {editMode ? (
                <Input
                  id="phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">
                  {user.phone || "Não informado"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="userType">Tipo de Usuário</Label>
              {editMode ? (
                <Select value={userType} onValueChange={setUserType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Master</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="client">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-2 bg-muted rounded-md">
                  {getUserTypeLabel(user.user_type)}
                </div>
              )}
            </div>
          </div>

          {/* Organization and Role */}
          {user.memberships && user.memberships.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Organização
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="organization">Organização</Label>
                  {editMode ? (
                    <Select value={editOrganization} onValueChange={setEditOrganization}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a organização" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOrganizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-2 bg-muted rounded-md">
                      {user.memberships[0]?.organizations?.name || "Não informado"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  {editMode ? (
                    <Select value={editRole} onValueChange={setEditRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-2 bg-muted rounded-md">
                      {user.memberships[0]?.role || "Não informado"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Informações de Acesso
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Criado em</Label>
                <div className="p-2 bg-muted rounded-md">
                  {formatDate(user.created_at)}
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Último acesso</Label>
                <div className="p-2 bg-muted rounded-md">
                  {formatDate(user.last_sign_in_at)}
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Email confirmado</Label>
                <div className="p-2 bg-muted rounded-md">
                  {user.email_confirmed_at ? formatDate(user.email_confirmed_at) : "Não confirmado"}
                </div>
              </div>
              
              {user.is_suspended && (
                <div>
                  <Label className="text-muted-foreground">Suspenso em</Label>
                  <div className="p-2 bg-muted rounded-md">
                    {formatDate(user.suspended_at)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    size="sm"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Salvando..." : "Salvar ✅"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCancelEdit}
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar ❌
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={handleEditClick}
                  size="sm"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar ✏️
                </Button>
              )}
            </div>

            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              size="sm"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}