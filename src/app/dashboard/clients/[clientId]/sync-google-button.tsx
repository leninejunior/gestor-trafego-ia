"use client";

import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { syncGoogleAdAccount } from "./actions";
import { toast } from "sonner";

export function SyncGoogleButton({
  adAccountId,
  clientId,
}: {
  adAccountId: string;
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await syncGoogleAdAccount(adAccountId, clientId);
      if (result?.error) {
        toast.error(`Erro: ${result.error}`);
      } else {
        toast.success("Sincronização com Google Ads concluída com sucesso!");
      }
    });
  };

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? "Sincronizando..." : "Sincronizar Agora"}
    </Button>
  );
}