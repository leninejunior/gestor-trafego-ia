/**
 * Página de Saldo das Contas - Tabela Completa
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BalanceAccountsTable } from "@/components/balance/balance-accounts-table";
import { SyncBalanceButton } from "@/components/balance/sync-balance-button";

export const dynamic = 'force-dynamic';

export default async function BalancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Saldo das Contas
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitore o saldo, limite de gastos e meio de pagamento das suas contas
          </p>
        </div>
        
        <SyncBalanceButton />
      </div>

      {/* Tabela de Contas */}
      <BalanceAccountsTable />
    </div>
  );
}
