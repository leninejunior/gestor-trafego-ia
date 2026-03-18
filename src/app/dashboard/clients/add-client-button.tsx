"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Crown, Shield, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addClient } from "./actions";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { UpgradePrompt } from "@/components/subscription/upgrade-prompt";
import { useUserAccessNew } from "@/hooks/use-user-access-new";
import { UserType } from "@/lib/services/user-access-control";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar Cliente"}
    </Button>
  );
}

export function AddClientButton() {
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { withinLimit, currentUsage, limit, loading, incrementUsage } = useFeatureGate('maxClients');
  const { 
    userType, 
    canCreateClients, 
    hasActiveSubscription, 
    planLimits,
    loading: accessLoading 
  } = useUserAccessNew();

  // Don't show button for common users
  if (userType === UserType.COMMON_USER) {
    return null;
  }

  const handleAddClient = () => {
    // Check access control first
    if (!canCreateClients) {
      if (!hasActiveSubscription) {
        toast.error("Assinatura expirada. Renove seu plano para criar novos clientes.");
        return;
      }
      setUpgradeOpen(true);
      return;
    }

    // Legacy feature gate check for backward compatibility
    if (!withinLimit) {
      setUpgradeOpen(true);
      return;
    }
    
    setOpen(true);
  };

  const getButtonText = () => {
    if (userType === UserType.SUPER_ADMIN) {
      return 'Adicionar Cliente';
    }
    
    if (!hasActiveSubscription) {
      return 'Renovar Plano';
    }
    
    if (!canCreateClients) {
      return 'Upgrade Necessário';
    }
    
    return 'Adicionar Cliente';
  };

  const getButtonIcon = () => {
    if (userType === UserType.SUPER_ADMIN) {
      return <Crown className="w-4 h-4 mr-2" />;
    }
    
    if (!hasActiveSubscription) {
      return <Lock className="w-4 h-4 mr-2" />;
    }
    
    if (!canCreateClients) {
      return <Crown className="w-4 h-4 mr-2" />;
    }
    
    return <Plus className="w-4 h-4 mr-2" />;
  };

  const getButtonVariant = () => {
    if (userType === UserType.SUPER_ADMIN) {
      return 'default';
    }
    
    if (!hasActiveSubscription || !canCreateClients) {
      return 'secondary';
    }
    
    return 'default';
  };

  const formAction = async (formData: FormData) => {
    console.log("Iniciando ação do formulário com dados:", Object.fromEntries(formData));
    
    // Check access control before adding
    if (!canCreateClients) {
      toast.error("Você não tem permissão para criar clientes ou atingiu o limite do seu plano.");
      return;
    }

    // Check limit one more time before adding
    if (!withinLimit) {
      toast.error("Limite de clientes atingido. Faça upgrade do seu plano.");
      return;
    }

    const result = await addClient(formData);
    
    if (result.success) {
      console.log("Cliente adicionado com sucesso!");
      // Increment usage after successful creation
      await incrementUsage();
      setOpen(false);
      toast.success("Cliente adicionado com sucesso!");
    } else {
      console.error("Erro ao adicionar cliente:", result.error);
      toast.error(`Erro: ${result.error}`);
    }
  };

  if (accessLoading) {
    return (
      <Button disabled variant="outline">
        <Plus className="w-4 h-4 mr-2" />
        Carregando...
      </Button>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        console.log("Estado do diálogo alterado para:", isOpen);
        setOpen(isOpen);
      }}>
        <DialogTrigger asChild>
          <Button 
            onClick={handleAddClient}
            variant={getButtonVariant()}
            disabled={loading || accessLoading}
          >
            {getButtonIcon()}
            {getButtonText()}
          </Button>
        </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {userType === UserType.SUPER_ADMIN && <Crown className="w-5 h-5 text-yellow-600" />}
            {userType === UserType.ORG_ADMIN && <Shield className="w-5 h-5 text-blue-600" />}
            Adicionar Novo Cliente
          </DialogTitle>
          <DialogDescription>
            Preencha os detalhes do seu novo cliente aqui. Clique em salvar quando terminar.
            {planLimits && planLimits.maxClients && (
              <div className="mt-2 text-sm text-muted-foreground">
                Uso atual: {planLimits.currentUsage.clients} de {planLimits.maxClients} clientes
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nome
              </Label>
              <Input
                id="name"
                name="name"
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <UpgradePrompt
      open={upgradeOpen}
      onOpenChange={setUpgradeOpen}
      feature="maxClients"
      currentUsage={currentUsage}
      limit={limit}
      title="Limite de Clientes Atingido"
      description="Você atingiu o limite de clientes do seu plano atual. Faça upgrade para adicionar mais clientes."
    />
    </>
  );
}