"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCampaignLimit } from "@/hooks/use-campaign-limit";
import { LimitErrorDialog } from "@/components/dashboard/limit-error-dialog";

interface ConnectMetaButtonProps {
  clientId: string;
  isConnected?: boolean;
}

export function ConnectMetaButton({ clientId, isConnected = false }: ConnectMetaButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const { allowed, current, limit, loading: limitLoading, checkLimit } = useCampaignLimit(clientId);

  const handleConnect = async () => {
    // Check campaign limit before connecting
    const canAdd = await checkLimit(clientId);
    
    if (!canAdd) {
      setLimitDialogOpen(true);
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

  return (
    <>
      <Button 
        onClick={handleConnect} 
        disabled={isLoading || limitLoading}
        className={allowed ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}
      >
        {isLoading ? "Conectando..." : limitLoading ? "Verificando..." : allowed ? "Conectar Meta Ads" : "Limite Atingido"}
      </Button>

      {/* Campaign Limit Dialog */}
      <LimitErrorDialog
        open={limitDialogOpen}
        onOpenChange={setLimitDialogOpen}
        limitType="campaigns"
        current={current}
        limit={limit}
      />
    </>
  );
}