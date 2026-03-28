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
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

interface UserInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UserInviteDialog({ open, onOpenChange, onSuccess }: UserInviteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    organizationId: "",
    roleId: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadOrganizations();
      loadRoles();
    }
  }, [open]);

  const loadOrganizations = async () => {
    try {
      const response = await fetch("/api/admin/organizations");
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations);
      }
    } catch (error) {
      console.error("Erro ao carregar organizaÃ§Ãµes:", error);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await fetch("/api/admin/roles");
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles);
      }
    } catch (error) {
      console.error("Erro ao carregar roles:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.firstName || !formData.organizationId || !formData.roleId) {
      toast({
        title: "Erro",
        description: "Todos os campos sÃ£o obrigatÃ³rios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const selectedRole = roles.find((role) => role.id === formData.roleId);
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...formData,
          roleId: formData.roleId,
          role: selectedRole?.name || ""
        })
      });

      const data = await response.json();

      if (response.ok) {
        const deliveryOk = data?.emailDelivery?.ok !== false;
        const deliveryWarning = data?.emailDelivery?.warning as string | undefined;
        const inviteLink = data?.emailDelivery?.inviteLink as string | undefined;

        if (!deliveryOk) {
          if (inviteLink && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(inviteLink);
          }

          toast({
            title: "Convite criado, mas email nao foi enviado",
            description: inviteLink
              ? `${deliveryWarning || "Falha de envio no Supabase."} Link de convite copiado para a area de transferencia.`
              : (deliveryWarning || "Falha de envio no Supabase."),
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sucesso",
            description: "Convite enviado com sucesso!",
          });
        }
        
        setFormData({
          email: "",
          firstName: "",
          lastName: "",
          organizationId: "",
          roleId: ""
        });
        
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao enviar convite",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao enviar convite:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            Convidar Novo UsuÃ¡rio
          </DialogTitle>
          <DialogDescription>
            Envie um convite para um novo usuÃ¡rio se juntar ao sistema
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="Nome"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Sobrenome"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="usuario@exemplo.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization">OrganizaÃ§Ã£o</Label>
            <Select
              value={formData.organizationId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, organizationId: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma organizaÃ§Ã£o" />
              </SelectTrigger>
              <SelectContent>
                {organizations.length > 0 ? (
                  organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    Nenhuma organizacao disponivel para selecao
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.roleId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, roleId: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div>
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="text-xs text-gray-500">{role.description}</div>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={loading || organizations.length === 0 || roles.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar Convite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

