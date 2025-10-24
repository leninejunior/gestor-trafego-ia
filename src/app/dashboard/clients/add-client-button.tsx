"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Crown } from "lucide-react";
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

  const handleAddClient = () => {
    if (!withinLimit) {
      setUpgradeOpen(true);
      return;
    }
    setOpen(true);
  };

  const formAction = async (formData: FormData) => {
    console.log("Iniciando ação do formulário com dados:", Object.fromEntries(formData));
    
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

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        console.log("Estado do diálogo alterado para:", isOpen);
        setOpen(isOpen);
      }}>
        <DialogTrigger asChild>
          <Button 
            onClick={handleAddClient}
            className={`${withinLimit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
            disabled={loading}
          >
            {withinLimit ? (
              <Plus className="w-4 h-4 mr-2" />
            ) : (
              <Crown className="w-4 h-4 mr-2" />
            )}
            {withinLimit ? 'Adicionar Cliente' : 'Upgrade Necessário'}
          </Button>
        </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Cliente</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do seu novo cliente aqui. Clique em salvar quando terminar.
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