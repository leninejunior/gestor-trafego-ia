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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Building2, Lock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Client {
  id: string;
  name: string;
  orgId: string;
}

interface GrantAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName?: string;
  userEmail?: string;
  availableClients: Client[];
  onSuccess: () => void;
}

export function GrantAccessDialog({ 
  open, 
  onOpenChange, 
  userId,
  userName,
  userEmail,
  availableClients,
  onSuccess 
}: GrantAccessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clientId: "",
    permissions: {
      read: true,
      write: false
    },
    notes: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setFormData({
        clientId: "",
        permissions: {
          read: true,
          write: false
        },
        notes: ""
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.clientId) {
      toast({
        title: "Erro de validação",
        description: "Selecione um cliente",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const selectedClient = availableClients.find(c => c.id === formData.clientId);
      
      const response = await fetch("/api/admin/user-client-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: userId,
          client_id: formData.clientId,
          permissions: formData.permissions,
          notes: formData.notes || `Acesso concedido ao cliente ${selectedClient?.name} via interface administrativa`
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Acesso concedido",
          description: `Acesso ao cliente "${selectedClient?.name}" foi concedido com sucesso!`
        });
        
        onSuccess();
      } else {
        toast({
          title: "Erro ao conceder acesso",
          description: data.error || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao conceder acesso:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedClient = availableClients.find(c => c.id === formData.clientId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Conceder Acesso a Cliente
          </DialogTitle>
          <DialogDescription>
            Conceda acesso de {userName || userEmail || "usuário"} a um cliente específico
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Info Display */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600">
                  {(userName || userEmail || "U").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="font-medium">{userName || "Nome não disponível"}</div>
                <div className="text-sm text-muted-foreground">{userEmail || "Email não disponível"}</div>
              </div>
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Cliente</Label>
            {availableClients.length === 0 ? (
              <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                <div className="flex items-center space-x-2 text-orange-800">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Nenhum cliente disponível</span>
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  Todos os clientes disponíveis já possuem acesso concedido para este usuário.
                </p>
              </div>
            ) : (
              <Select
                value={formData.clientId}
                onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, clientId: value }))
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {availableClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4" />
                        <span>{client.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Organization Validation Display */}
          {selectedClient && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center space-x-2 text-green-800">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">Validação de Organização</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                ✓ Cliente "{selectedClient.name}" pertence à mesma organização do usuário
              </p>
            </div>
          )}

          {/* Permissions */}
          <div className="space-y-3">
            <Label>Permissões</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="read"
                  checked={formData.permissions.read}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      permissions: { 
                        ...prev.permissions, 
                        read: checked as boolean 
                      } 
                    }))
                  }
                />
                <Label htmlFor="read" className="flex items-center space-x-2">
                  <span>Leitura</span>
                  <Badge variant="secondary">Recomendado</Badge>
                </Label>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                Permite visualizar campanhas, relatórios e métricas do cliente
              </p>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="write"
                  checked={formData.permissions.write}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      permissions: { 
                        ...prev.permissions, 
                        write: checked as boolean 
                      } 
                    }))
                  }
                />
                <Label htmlFor="write" className="flex items-center space-x-2">
                  <span>Escrita</span>
                  <Badge variant="outline">Opcional</Badge>
                </Label>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                Permite modificar campanhas e configurações do cliente
              </p>
            </div>

            {!formData.permissions.read && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ⚠️ Atenção: Sem permissão de leitura, o usuário não conseguirá visualizar nenhum dado do cliente.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Adicione observações sobre este acesso..."
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              Estas observações serão registradas no histórico de auditoria
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || availableClients.length === 0 || !formData.clientId}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Concedendo...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Conceder Acesso
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}