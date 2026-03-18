"use client";

import { useState, useEffect } from "react";
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
  const { allowed, current, limit, loading: limitLoading, error, checkLimit } = useCampaignLimit(clientId);

  // Debug logging
  useEffect(() => {
    console.log('🔍 ConnectMetaButton state:', {
      clientId,
      allowed,
      current,
      limit,
      limitLoading,
      error,
      isConnected
    });
  }, [clientId, allowed, current, limit, limitLoading, error, isConnected]);

  const handleConnect = async () => {
    console.log('🚀 Attempting to connect Meta Ads for client:', clientId);
    
    // Check campaign limit before connecting
    const canAdd = await checkLimit(clientId);
    console.log('✅ Campaign limit check result:', canAdd);
    
    if (!canAdd) {
      console.log('❌ Campaign limit exceeded, showing dialog');
      setLimitDialogOpen(true);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('📡 Calling Meta auth API...');
      // Obter nome do cliente do DOM ou usar padrão
      const clientNameElement = document.querySelector('[data-client-name]');
      const clientName = clientNameElement?.getAttribute('data-client-name') || 'Cliente';
      
      const response = await fetch(`/api/meta/auth?clientId=${clientId}&clientName=${encodeURIComponent(clientName)}`);
      const data = await response.json();
      
      if (data.authUrl) {
        console.log('✅ Got auth URL, redirecting...');
        // Redirecionar para autorização do Meta
        window.location.href = data.authUrl;
      } else {
        console.error('❌ No auth URL in response:', data);
        toast.error('Erro ao gerar URL de autorização');
      }
    } catch (error) {
      console.error('❌ Error connecting to Meta:', error);
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

  // Show error state if there's an error
  if (error) {
    return (
      <Button 
        onClick={handleConnect} 
        disabled={isLoading}
        variant="outline"
        className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
      >
        {isLoading ? "Conectando..." : "Conectar Meta Ads"}
      </Button>
    );
  }

  const buttonText = isLoading 
    ? "Conectando..." 
    : limitLoading 
      ? "Verificando..." 
      : allowed 
        ? "Conectar Meta Ads" 
        : `Limite Atingido (${current}/${limit === -1 ? '∞' : limit})`;

  return (
    <>
      <Button 
        onClick={handleConnect} 
        disabled={isLoading || limitLoading}
        className={allowed ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}
        title={allowed ? "Clique para conectar Meta Ads" : `Limite de campanhas atingido: ${current}/${limit === -1 ? 'Ilimitado' : limit}`}
      >
        {buttonText}
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