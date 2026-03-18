"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserAccessNew } from "@/hooks/use-user-access-new";
import { UserType } from "@/lib/services/user-access-control";
import { Lock, Crown } from "lucide-react";

interface ConnectMetaButtonProps {
  clientId: string;
  isConnected?: boolean;
}

export function ConnectMetaButton({ clientId, isConnected = false }: ConnectMetaButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { 
    userType, 
    canCreateConnections, 
    hasActiveSubscription 
  } = useUserAccessNew();

  // Common users cannot create connections
  if (userType === UserType.COMMON_USER) {
    return (
      <Button variant="outline" disabled>
        <Lock className="w-4 h-4 mr-2" />
        Sem Permissão
      </Button>
    );
  }

  const handleConnect = async () => {
    // Check permissions before connecting
    if (!canCreateConnections && userType !== UserType.SUPER_ADMIN) {
      if (!hasActiveSubscription) {
        toast.error('Assinatura expirada. Renove seu plano para conectar contas.');
      } else {
        toast.error('Limite de conexões atingido. Faça upgrade do seu plano.');
      }
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/meta/auth?clientId=${clientId}`);
      const data = await response.json();
      
      if (data.authUrl) {
        // Redirecionar para autorização do Meta
        window.location.href = data.authUrl;
      } else {
        toast.error('Erro ao gerar URL de autorização');
      }
    } catch (error) {
      console.error('Erro ao conectar com Meta:', error);
      toast.error('Erro ao conectar com Meta');
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnected) {
    return (
      <Button variant="outline" disabled>
        ✓ Meta Conectado
      </Button>
    );
  }

  // Show different button states based on permissions
  if (!canCreateConnections && userType !== UserType.SUPER_ADMIN) {
    if (!hasActiveSubscription) {
      return (
        <Button variant="secondary" disabled>
          <Lock className="w-4 h-4 mr-2" />
          Plano Expirado
        </Button>
      );
    }
    
    return (
      <Button variant="secondary" disabled>
        <Crown className="w-4 h-4 mr-2" />
        Limite Atingido
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleConnect} 
      disabled={isLoading}
      className="bg-blue-600 hover:bg-blue-700"
    >
      {isLoading ? "Conectando..." : "Conectar Meta Ads"}
    </Button>
  );
}