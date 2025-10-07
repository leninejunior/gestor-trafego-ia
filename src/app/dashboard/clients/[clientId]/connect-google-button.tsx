"use client";

import { Button } from "@/components/ui/button";

export function ConnectGoogleButton({ clientId }: { clientId: string }) {
  const handleConnect = () => {
    if (typeof window !== 'undefined') {
      // Redireciona o usuário para a nossa rota de iniciação da API
      window.location.href = `/api/google/oauth/initiate?clientId=${clientId}`;
    }
  };

  return <Button onClick={handleConnect}>Conectar Conta do Google</Button>;
}