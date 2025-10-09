"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ConnectMetaButtonProps {
  clientId: string;
  isConnected?: boolean;
}

export function ConnectMetaButton({ clientId, isConnected = false }: ConnectMetaButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
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
    <Button 
      onClick={handleConnect} 
      disabled={isLoading}
      className="bg-blue-600 hover:bg-blue-700"
    >
      {isLoading ? "Conectando..." : "Conectar Meta Ads"}
    </Button>
  );
}