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
import { 
  Users, 
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Lock,
  Building2,
  Eye,
  AlertCircle
} from "lucide-react";
import { GrantAccessDialog } from "@/components/admin/grant-access-dialog";
import { useToast } from "@/hooks/use-toast";
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

interface ClientAccess {
  id: string;
  clientId: string;
  clientName: string;
  organizationId: string;
  permissions: {
    read: boolean;
    write: boolean;
  };
  grantedAt: string;
  updatedAt: string;
  grantedBy: string;
  grantedByEmail: string;
  notes: string;
  isActive: boolean;
}

interface Client {
  id: string;
  name: string;
  orgId: string;
}

interface UserInfo {
  id: string;
  email: string;
  createdAt: string;
}

interface ClientAccessManagerProps {
  userId: string;
  userName?: string;
  userEmail?: string;
  organizationId?: string; // Optional for super admin
}

export function ClientAccessManager({ 
  userId, 
  userName, 
  userEmail,
  organizationId 
}: ClientAccessManagerProps) {
  const [accesses, setAccesses] = useState<ClientAccess[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<ClientAccess | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    loadUserAccess();
  }, [userId]);

  const loadUserAccess = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/user-client-access/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setAccesses(data.accesses || []);
        setAvailableClients(data.availableClients || []);
        setUserInfo(data.user);
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro ao carregar acessos",
          description: errorData?.error || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao carregar acessos:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = () => {
    setGrantDialogOpen(true);
  };

  const handleRevokeAccess = (access: ClientAccess) => {
    setSelectedAccess(access);
    setRevokeDialogOpen(true);
  };

  const handleAccessGranted = () => {
    loadUserAccess();
    setGrantDialogOpen(false);
  };

  const confirmRevokeAccess = async () => {
    if (!selectedAccess) return;

    try {
      const response = await fetch(
        `/api/admin/user-client-access?userId=${userId}&clientId=${selectedAccess.clientId}`,
        {
          method: "DELETE"
        }
      );

      if (response.ok) {
        toast({
          title: "Acesso revogado",
          description: `Acesso ao cliente "${selectedAccess.clientName}" foi revogado com sucesso`
        });
        
        loadUserAccess();
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro ao revogar acesso",
          description: errorData?.error || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao revogar acesso:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive"
      });
    } finally {
      setRevokeDialogOpen(false);
      setSelectedAccess(null);
    }
  };

  const getPermissionsBadge = (permissions: { read: boolean; write: boolean }) => {
    if (permissions.write) {
      return <Badge variant="default">Leitura e Escrita</Badge>;
    }
    return <Badge variant="secondary">Apenas Leitura</Badge>;
  };

  const filteredAccesses = accesses.filter(access => {
    if (!searchTerm) return true;
    return access.clientName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Get clients that don't have access yet
  const clientsWithoutAccess = availableClients.filter(client => 
    !accesses.some(access => access.clientId === client.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gerenciamento de Acesso a Clientes</h2>
          <p className="text-muted-foreground">
            Gerencie quais clientes {userName || userEmail || "o usuário"} pode acessar
          </p>
        </div>
        <Button 
          onClick={handleGrantAccess}
          disabled={clientsWithoutAccess.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Conceder Acesso
        </Button>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Informações do Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium text-blue-600">
                {(userName || userEmail || "U").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <div className="font-medium">{userName || "Nome não disponível"}</div>
              <div className="text-sm text-muted-foreground">
                {userInfo?.email || userEmail || "Email não disponível"}
              </div>
              {userInfo?.createdAt && (
                <div className="text-xs text-muted-foreground">
                  Criado em: {new Date(userInfo.createdAt).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes com Acesso</CardTitle>
            <Lock className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{accesses.length}</div>
            <p className="text-xs text-muted-foreground">clientes autorizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Disponíveis</CardTitle>
            <Building2 className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{availableClients.length}</div>
            <p className="text-xs text-muted-foreground">total na organização</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Acesso</CardTitle>
            <AlertCircle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{clientsWithoutAccess.length}</div>
            <p className="text-xs text-muted-foreground">clientes sem acesso</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nome do cliente..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={loadUserAccess}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Access Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Acessos</CardTitle>
          <CardDescription>
            {filteredAccesses.length} acesso(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Carregando acessos...
            </div>
          ) : filteredAccesses.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                {accesses.length === 0 
                  ? "Nenhum acesso concedido ainda" 
                  : "Nenhum acesso encontrado com os filtros aplicados"
                }
              </p>
              {clientsWithoutAccess.length > 0 && (
                <Button onClick={handleGrantAccess}>
                  <Plus className="w-4 h-4 mr-2" />
                  Conceder Primeiro Acesso
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Concedido por</TableHead>
                  <TableHead>Data de Concessão</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccesses.map((access) => (
                  <TableRow key={access.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium">{access.clientName}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {access.clientId.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {getPermissionsBadge(access.permissions)}
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div>{access.grantedByEmail}</div>
                        <div className="text-muted-foreground">
                          {access.grantedBy.slice(0, 8)}...
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        {new Date(access.grantedAt).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(access.grantedAt).toLocaleTimeString('pt-BR')}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        {new Date(access.updatedAt).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(access.updatedAt).toLocaleTimeString('pt-BR')}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRevokeAccess(access)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Grant Access Dialog */}
      <GrantAccessDialog
        open={grantDialogOpen}
        onOpenChange={setGrantDialogOpen}
        userId={userId}
        userName={userName}
        userEmail={userEmail}
        availableClients={clientsWithoutAccess}
        onSuccess={handleAccessGranted}
      />

      {/* Revoke Access Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-orange-500" />
              Confirmar Revogação de Acesso
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja revogar o acesso de{" "}
              <strong>{userName || userEmail}</strong> ao cliente{" "}
              <strong>{selectedAccess?.clientName}</strong>?
              <br /><br />
              Esta ação será aplicada imediatamente e o usuário não conseguirá mais 
              visualizar dados deste cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeAccess}
              className="bg-red-600 hover:bg-red-700"
            >
              Revogar Acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}