"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Building2, 
  Shield, 
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Ban,
  UserCheck
} from "lucide-react";

interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_suspended: boolean;
  suspended_at: string;
  suspended_by: string;
  suspension_reason: string;
  memberships: Array<{
    id: string;
    role: string;
    status: string;
    created_at: string;
    accepted_at: string;
    organization_id: string;
    role_id: string;
    organizations: {
      id: string;
      name: string;
      created_at: string;
    };
    user_roles: {
      id: string;
      name: string;
      permissions: string[];
      description: string;
    };
  }>;
}

interface Activity {
  id: string;
  action: string;
  details: any;
  created_at: string;
  performed_by: string;
}

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  onUserUpdated: () => void;
}

export function UserDetailsDialog({ open, onOpenChange, userId, onUserUpdated }: UserDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      loadUserData();
    }
  }, [open, userId]);

  const loadUserData = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
        setActivities(data.activities || []);
      } else {
        toast({
          title: "Erro",
          description: "Erro ao carregar dados do usuário",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!userId || !userData) return;

    const reason = prompt("Motivo da suspensão:");
    if (!reason) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "suspend",
          reason
        })
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Usuário suspenso com sucesso"
        });
        loadUserData();
        onUserUpdated();
      } else {
        const data = await response.json();
        toast({
          title: "Erro",
          description: data.error || "Erro ao suspender usuário",
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
    }
  };

  const handleUnsuspendUser = async () => {
    if (!userId || !userData) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "unsuspend"
        })
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Usuário reativado com sucesso"
        });
        loadUserData();
        onUserUpdated();
      } else {
        const data = await response.json();
        toast({
          title: "Erro",
          description: data.error || "Erro ao reativar usuário",
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
    }
  };



  if (!userData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>
              {loading ? "Carregando..." : "Usuário não encontrado"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            {loading ? "Carregando dados do usuário..." : "Usuário não encontrado"}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const fullName = `${userData.first_name} ${userData.last_name}`.trim() || 'Usuário';
  const activeMemberships = userData.memberships?.filter(m => m.status === 'active') || [];
  const hasActiveOrg = activeMemberships.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            Detalhes do Usuário
          </DialogTitle>
          <DialogDescription>
            Informações completas e histórico de atividades
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="organizations">Organizações</TabsTrigger>
            <TabsTrigger value="activity">Atividades</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Informações Pessoais
                  </span>
                  <div className="flex items-center space-x-2">
                    {userData.is_suspended ? (
                      <Badge variant="destructive">
                        <Ban className="w-3 h-3 mr-1" />
                        Suspenso
                      </Badge>
                    ) : hasActiveOrg ? (
                      <Badge variant="default">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="w-3 h-3 mr-1" />
                        Inativo
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nome Completo</label>
                    <p className="text-sm">{fullName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-sm">{userData.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Cadastrado em</label>
                    <p className="text-sm">{new Date(userData.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Último Acesso</label>
                    <p className="text-sm">
                      {userData.last_sign_in_at 
                        ? new Date(userData.last_sign_in_at).toLocaleDateString('pt-BR')
                        : 'Nunca'
                      }
                    </p>
                  </div>
                </div>

                {userData.is_suspended && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
                      <span className="font-medium text-red-800">Usuário Suspenso</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">
                      Motivo: {userData.suspension_reason}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      Suspenso em: {new Date(userData.suspended_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}

                <div className="flex space-x-2 pt-4">
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-1" />
                    Editar Perfil
                  </Button>
                  {userData.is_suspended ? (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={handleUnsuspendUser}
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      Reativar
                    </Button>
                  ) : (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleSuspendUser}
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Suspender
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organizations" className="space-y-4">
            {userData.memberships?.map((membership) => (
              <Card key={membership.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Building2 className="w-4 h-4 mr-2" />
                      {membership.organizations?.name || 'Organização'}
                    </span>
                    <Badge variant={membership.status === 'active' ? 'default' : 'secondary'}>
                      {membership.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Role</label>
                      <div className="flex items-center space-x-2">
                        <Shield className="w-3 h-3 text-gray-400" />
                        <span className="text-sm">{membership.user_roles?.name || membership.role || 'Usuário'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Membro desde</label>
                      <p className="text-sm">{new Date(membership.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>

                  {membership.user_roles?.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Descrição da Role</label>
                      <p className="text-sm text-gray-600">{membership.user_roles.description}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">Permissões</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {membership.user_roles?.permissions?.map((permission, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-1" />
                      Alterar Role
                    </Button>
                    <Button variant="destructive" size="sm">
                      <XCircle className="w-4 h-4 mr-1" />
                      Remover da Organização
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-4 h-4 mr-2" />
                  Histórico de Atividades
                </CardTitle>
                <CardDescription>
                  Últimas ações e eventos relacionados ao usuário
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.action}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.created_at).toLocaleString('pt-BR')}
                          </p>
                          {activity.details && (
                            <pre className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                              {JSON.stringify(activity.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nenhuma atividade registrada
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}