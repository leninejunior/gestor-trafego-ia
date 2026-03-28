"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string;
}

interface TeamInviteDialogProps {
  children: React.ReactNode;
  roles: Role[];
}

export function TeamInviteDialog({ children, roles }: TeamInviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !selectedRole) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/team/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          role: selectedRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar convite");
      }

      const deliveryOk = data?.emailDelivery?.ok !== false;
      const deliveryWarning = data?.emailDelivery?.warning as string | undefined;
      const inviteLink =
        (data?.emailDelivery?.inviteLink as string | undefined) ??
        (data?.invite?.token && typeof window !== "undefined"
          ? `${window.location.origin}/invite/${data.invite.token}`
          : undefined);

      let copiedInviteLink = false;
      if (inviteLink && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(inviteLink);
          copiedInviteLink = true;
        } catch (copyError) {
          console.warn("Falha ao copiar link de convite:", copyError);
        }
      }

      if (!deliveryOk) {
        toast({
          title: "Convite criado, mas email nao foi enviado",
          description: copiedInviteLink
            ? `${deliveryWarning || "Falha de envio no Supabase."} Link de convite copiado para a area de transferencia.`
            : inviteLink
              ? `${deliveryWarning || "Falha de envio no Supabase."} Link manual: ${inviteLink}`
              : (deliveryWarning || "Falha de envio no Supabase."),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: copiedInviteLink
            ? "Convite processado. Link de convite copiado para backup."
            : inviteLink
              ? `Convite processado. Link manual: ${inviteLink}`
              : "Convite enviado com sucesso!",
        });
      }

      setEmail("");
      setSelectedRole("");
      setOpen(false);
    } catch (error) {
      console.error("Erro ao enviar convite:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar convite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Convidar membro</DialogTitle>
            <DialogDescription>
              Envie um convite para adicionar um novo membro a sua equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Funcao</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma funcao" />
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter((role) => role.name !== "super_admin")
                    .map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        <div>
                          <div className="font-medium capitalize">{role.name}</div>
                          <div className="text-sm text-muted-foreground">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
