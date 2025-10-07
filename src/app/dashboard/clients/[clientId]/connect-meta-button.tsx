"use client";

import { Button } from "@/components/ui/button";

export function ConnectMetaButton({ clientId }: { clientId: string }) {
  const handleConnect = () => {
    if (typeof window !== 'undefined') { // Safely check for window
      // Redirect the user to our initiation API route
      window.location.href = `/api/meta/oauth/initiate?clientId=${clientId}`;
    }
  };

  return <Button onClick={handleConnect}>Conectar Conta do Meta</Button>;
}