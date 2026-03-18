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
import { 
  UserPlus, 
  Mail, 
  User, 
  Shield, 
  Building2,
  Save,
  X
} from "lucide-react";

interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Organization {
  id: string;
  name: string;
}

export function UserCreateDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: UserCreateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  
  // Form data
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [organizationId, setOrganizationId] = useState("");
  
  const { toast } = useToast();

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/organizations');
      
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
        
        // Auto-selecionar primeira organização se houver apenas uma
        if (data.organizations?.length === 1) {
          setOrganizationId(data.organizations[0].id);
        }
      } else {
        console.warn('Erro ao carregar organizações');
      }
    } catch (error) {
      console.error('Erro ao carregar organizações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !name || !role) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          name,
          role,
          organizationId: organizationId || undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sucesso",
          description: data.message || "Usuário criado com sucesso",
          variant: "default"
        });
        
        // Reset form
        setEmail("");
        setName("");
        setRole("member");
        setOrganizationId("");
        
        onOpenChange(false);
        onSuccess();
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro",
          description: errorData?.error || "Erro ao criar usuário",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    setEmail("");
    setName("");
    setRole("member");
    setOrganizationId("");
    onOpenChange(false);
  };

  useEffect(() => {
    if (open) {
      loadOrganizations();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Criar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Adicionar um novo usuário ao sistema
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo do usuário"
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Tipo de Usuário *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <SelectValue placeholder="Selecione o tipo" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Membro
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Admin
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Organização */}
          {organizations.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="organization">Organização</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <SelectValue placeholder="Selecione a organização" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button 
              type="button"
              variant="outline" 
              onClick={handleCancel}
              disabled={creating}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={creating || loading}
            >
              <Save className="w-4 h-4 mr-2" />
              {creating ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </form>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-gray-500">Carregando organizações...</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}