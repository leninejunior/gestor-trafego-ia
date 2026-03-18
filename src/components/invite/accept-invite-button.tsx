"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";

interface AcceptInviteButtonProps {
  token: string;
}

export function AcceptInviteButton({ token }: AcceptInviteButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAccept = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao aceitar convite");
      }

      toast({
        title: "Sucesso!",
        description: "Convite aceito com sucesso. Redirecionando...",
      });

      // Aguardar um pouco para mostrar o toast e redirecionar
      setTimeout(() => {
        window.location.href = data.redirect || "/dashboard";
      }, 1500);

    } catch (error) {
      console.error("Erro ao aceitar convite:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao aceitar convite",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleAccept} 
      disabled={loading}
      className="w-full"
      size="lg"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Aceitando convite...
        </>
      ) : (
        <>
          <Check className="mr-2 h-4 w-4" />
          Aceitar Convite
        </>
      )}
    </Button>
  );
}