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
import { useUserAccess, useUserType } from "@/hooks/use-user-access";
import { UserAccessIndicator } from "@/components/ui/user-access-indicator";
import { 
  Users, 
  Calendar, 
  Building2, 
  Save, 
  Trash2,
  AlertTriangle,
  Crown,
  Edit,
  X,
  Shield as ShieldIcon,
  CheckCircle
} from "lucide-react";

interface UserDetailsDialogProps {
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
    user_type?: 'master' | 'regular' | 'client';
    created_at: string;
    organizations: {
      id: string;
      name: string;
    };
  }>;
}

export function UserDetailsDialogEnhanced({ 
  open, 
  onOpenChange, 
  userId, 
  onUserUpdated 
}: UserDetailsDialogProps) {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Form fields
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editOrganization, setEditOrganization] = useState("");
  const [editUserType, setEditUserType] = useState<'master' | 'regular' | 'client'>('regular');
  const [suspensionReason, setSuspensionReason] = useState("");
  
  // Available organizations for selection
  const [availableOrganizations, setAvailableOrganizations] = useState<Array<{id: string, name: string}>>([]);
  const { toast } = useToast();

  // Hooks do novo sistema de controle de acesso
  const { userType: currentUserType, isSuperAdmin } = useUserType();
  const { currentUser } = useUserAccess();

  // Função para obter o tipo de usuário baseado no novo sistema
  const getUserTypeFromMembership = (user: UserDetails): 'master' | 'regular' | 'client' => {
    // Usar o user_type que vem da API
    if (user.user_type === 'master') return 'master';
    if (user.user_type === 'client') return 'client';
    return 'regular';
  };

  // Função para obter badge do tipo de usuário
  const getUserTypeBadge = (userType: 'master' | 'regular' | 'client') => {
    switch (userType) {
      case 'master':
        return <Badge variant="destructive" className="gap-1"><Crown className="w-3 h-3" />Master</Badge>;
      case 'regular':
        return <Badge variant="default" className="gap-1"><ShieldIcon className="w-3 h-3" />Regular</Badge>;
      case 'client':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="w-3 h-3" />Cliente</Badge>;
      default:
        return <Badge variant="outline">Indefinido</Badge>;
    }
  };

  const loadUserDetails = async () => {
    if (!userId) return;
    
    console.log('🔍 Carregando detalhes do usuário:', userId);
    setLoading(true);
    try {
      // Carregar dados do usuário e organizações em paralelo
      const [userResponse, orgsResponse] = await Promise.all([
        fetch(`/api/admin/users/enhanced?userId=${userId}`),
        fetch(`/api/admin/organizations`)
      ]);
      
      console.log('📡 Resposta da API users:', userResponse.status);
      console.log('📡 Resposta da API orgs:', orgsResponse.status);
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('📊 Dados recebidos:', userData);
        
        if (userData.success && userData.user) {
          const foundUser = userData.user;
          console.log('👤 Usuário encontrado:', foundUser);
          
          setUser(foundUser);
          setEditFirstName(foundUser.first_name || '');
          setEditLastName(foundUser.last_name || '');
          setEditEmail(foundUser.email || '');
          setEditPhone(foundUser.phone || foundUser.user_metadata?.phone || '');
          setEditRole(foundUser.memberships[0]?.role || 'member');
          setEditOrganization(foundUser.memberships[0]?.organizations?.id || '');
          setEditUserType(getUserTypeFromMembership(foundUser));
          console.log('✅ Estado do usuário atualizado');
        } else {
          console.error('❌ Usuário não encontrado');
          toast({
            title: "Erro",
            description: "Usuário não encontrado",
            variant: "destructive"
          });
        }
      } else {
        const errorData = await userResponse.json();
        console.error('❌ Erro na API users:', errorData);
        toast({
          title: "Erro",
          description: errorData?.error || "Erro ao carregar detalhes do usuário",
          variant: "destructive"
        });
      }
      
      if (orgsResponse.ok) {
        const orgsData = await orgsResponse.json();
        console.log('🏢 Organizações recebidas:', orgsData.organizations?.length);
        setAvailableOrganizations(orgsData.organizations || []);
      } else {
        console.warn('⚠️ Erro ao carregar organizações');
      }
      
    } catch (error) {
      console.error("❌ Erro ao carregar usuário:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/update-complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          email: editEmail,
          phone: editPhone,
          role: editRole,
          organizationId: editOrganization,
          userType: editUserType
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sucesso",
          description: data.message || "Usuário atualizado com sucesso",
          variant: "default"
        });
        setEditMode(false);
        onUserUpdated();
        // Fechar o modal após salvar com sucesso
        setTimeout(() => {
          onOpenChange(false);
        }, 500);
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro",
          description: errorData?.error || "Erro ao atualizar usuário",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!user || !suspensionReason.trim()) {
      toast({
        title: "Erro",
        description: "Motivo da suspensão é obrigatório",
        variant: "destructive"
      });
      return;
    }
    
    setSuspending(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: suspensionReason
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sucesso",
          description: data.message || "Usuário suspenso com sucesso",
          variant: "default"
        });
        setSuspensionReason("");
        loadUserDetails();
        onUserUpdated();
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro",
          description: errorData?.error || "Erro ao suspender usuário",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao suspender usuário:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setSuspending(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!user) return;
    
    setSuspending(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/unsuspend`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sucesso",
          description: data.message || "Usuário reativado com sucesso",
          variant: "default"
        });
        loadUserDetails();
        onUserUpdated();
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro",
          description: errorData?.error || "Erro ao reativar usuário",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao reativar usuário:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setSuspending(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    
    const userName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    
    if (!confirm(`Tem certeza que deseja deletar o usuário ${userName}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/delete`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sucesso",
          description: data.message || "Usuário deletado com sucesso",
          variant: "default"
        });
        onOpenChange(false);
        onUserUpdated();
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro",
          description: errorData?.error || "Erro ao deletar usuário",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    console.log('🔄 useEffect triggered - open:', open, 'userId:', userId);
    if (open && userId) {
      loadUserDetails();
      setEditMode(false);
    }
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Detalhes do Usuário {editMode && '✏️ EDITANDO'}
          </DialogTitle>
          <DialogDescription>
            {editMode ? 'Modo de edição ativo - Altere os campos e clique em Salvar' : 'Visualizar e editar informações do usuário'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : user ? (
          <div className="space-y-6">
            {/* Informações Básicas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome</Label>
                {editMode ? (
                  <Input
                    id="firstName"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="Nome"
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{user.first_name || 'Não informado'}</span>
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
                    placeholder="Sobrenome"
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{user.last_name || 'Não informado'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Email e Telefone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                {editMode ? (
                  <Input
                    id="email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <span className="text-sm">{user.email}</span>
                    {user.email_confirmed_at && (
                      <Badge variant="outline" className="text-xs">Verificado</Badge>
                    )}
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
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <span className="text-sm">{user.phone || user.user_metadata?.phone || 'Não informado'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tipo de Usuário */}
            <div className="space-y-2">
              <Label>Tipo de Usuário</Label>
              {editMode && isSuperAdmin ? (
                <Select value={editUserType} onValueChange={(value: 'master' | 'regular' | 'client') => setEditUserType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Master (Acesso Ilimitado)</SelectItem>
                    <SelectItem value="regular">Regular (Limitado por Plano)</SelectItem>
                    <SelectItem value="client">Cliente (Acesso Restrito)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  {user && getUserTypeBadge(getUserTypeFromMembership(user))}
                  {getUserTypeFromMembership(user!) === 'master' && (
                    <span className="text-xs text-yellow-600">Acesso ilimitado</span>
                  )}
                </div>
              )}
            </div>

            {/* Role e Organização */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role na Organização</Label>
                {editMode ? (
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <ShieldIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm capitalize">{user.memberships[0]?.role || 'Sem role'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Organização</Label>
                {editMode ? (
                  <Select value={editOrganization} onValueChange={setEditOrganization}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma organização" />
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
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{user.memberships[0]?.organizations?.name || 'Sem organização'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status da Conta */}
            <div className="space-y-2">
              <Label>Status da Conta</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  {user.is_suspended ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <Badge variant="destructive">Suspenso</Badge>
                      {user.suspended_at && (
                        <span className="text-xs text-gray-500">
                          desde {new Date(user.suspended_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <Badge variant="default">Ativo</Badge>
                    </>
                  )}
                </div>
                
                {user.is_suspended && user.suspension_reason && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Motivo:</strong> {user.suspension_reason}
                  </div>
                )}
                
                {!editMode && user.user_type !== 'Super Admin' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {user.is_suspended ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleUnsuspend}
                          disabled={suspending}
                        >
                          {suspending ? 'Reativando...' : 'Reativar Usuário'}
                        </Button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <Input
                            placeholder="Motivo da suspensão"
                            value={suspensionReason}
                            onChange={(e) => setSuspensionReason(e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={handleSuspend}
                            disabled={suspending || !suspensionReason.trim()}
                          >
                            {suspending ? 'Suspendendo...' : 'Suspender'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Criado em</Label>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Último Acesso</Label>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">
                    {user.last_sign_in_at 
                      ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')
                      : 'Nunca'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Ações */}
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
                      {saving ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditMode(false);
                        setEditFirstName(user.first_name || '');
                        setEditLastName(user.last_name || '');
                        setEditEmail(user.email || '');
                        setEditPhone(user.phone || user.user_metadata?.phone || '');
                        setEditRole(user.memberships[0]?.role || 'member');
                        setEditOrganization(user.memberships[0]?.organizations?.id || '');
                        setEditUserType(getUserTypeFromMembership(user));
                      }}
                      size="sm"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      console.log('🔧 Botão Editar clicado!');
                      setEditMode(true);
                      console.log('✅ Modo de edição ativado:', true);
                    }}
                    size="sm"
                    disabled={!isSuperAdmin && getUserTypeFromMembership(user) === 'master'}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar ✏️
                  </Button>
                )}
              </div>

              {getUserTypeFromMembership(user) !== 'master' && (
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deleting}
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? 'Deletando...' : 'Deletar'}
                </Button>
              )}
            </div>

            {getUserTypeFromMembership(user) === 'master' && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">
                  Usuários Master têm acesso ilimitado e só podem ser editados por outros Masters
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Usuário não encontrado</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}