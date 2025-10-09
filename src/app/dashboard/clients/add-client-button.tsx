"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

  const formAction = async (formData: FormData) => {
    console.log("Iniciando ação do formulário com dados:", Object.fromEntries(formData));
    
    const result = await addClient(formData);
    
    if (result.success) {
      console.log("Cliente adicionado com sucesso!");
      setOpen(false);
      toast.success("Cliente adicionado com sucesso!");
    } else {
      console.error("Erro ao adicionar cliente:", result.error);
      toast.error(`Erro: ${result.error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      console.log("Estado do diálogo alterado para:", isOpen);
      setOpen(isOpen);
    }}>
      <DialogTrigger asChild>
        <Button 
          onClick={() => console.log("Botão 'Adicionar Cliente' clicado")}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Cliente
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
  );
}