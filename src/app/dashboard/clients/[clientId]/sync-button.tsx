"use client";

import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { syncFacebookAdAccount } from "./actions";

export function SyncButton({
  adAccountId,
  clientId,
}: {
  adAccountId: string;
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await syncFacebookAdAccount(adAccountId, clientId);
      if (result?.error) {
        alert(`Error: ${result.error}`);
      } else {
        alert("Sincronização concluída com sucesso!");
      }
    });
  };

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? "Sincronizando..." : "Sincronizar Agora"}
    </Button>
  );
}