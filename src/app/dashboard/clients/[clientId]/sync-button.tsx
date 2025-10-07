"use client";

import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { syncFacebookAdAccount } from "./actions";
import { toast } from "sonner"; // Import toast from sonner

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
        toast.error(`Error: ${result.error}`); // Use toast for error
      } else {
        toast.success("Sincronização concluída com sucesso!"); // Use toast for success
      }
    });
  };

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? "Sincronizando..." : "Sincronizar Agora"}
    </Button>
  );
}