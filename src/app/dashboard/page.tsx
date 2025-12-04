import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardPageClient from "./page-client";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // Buscar organizações do usuário primeiro
  const { data: userMemberships } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id);

  const orgIds = userMemberships?.map(m => m.organization_id) || [];

  // Buscar clientes das organizações do usuário
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .in("org_id", orgIds.length > 0 ? orgIds : ['']);

  // Buscar conexões apenas para clientes acessíveis pelo usuário
  const clientIds = clients?.map(client => client.id) || [];
  
  const { data: metaConnections } = await supabase
    .from("client_meta_connections")
    .select("*")
    .eq("is_active", true)
    .in("client_id", clientIds.length > 0 ? clientIds : ['']);

  const { data: googleConnections } = await supabase
    .from("google_ads_connections")
    .select("*")
    .eq("status", "active")
    .in("client_id", clientIds.length > 0 ? clientIds : ['']);

  const totalClients = clients?.length || 0;
  const totalMetaConnections = metaConnections?.length || 0;
  const totalGoogleConnections = googleConnections?.length || 0;
  const totalConnections = totalMetaConnections + totalGoogleConnections;

  // Verificar status das conexões
  const hasMetaConnections = totalMetaConnections > 0;
  const hasGoogleConnections = totalGoogleConnections > 0;
  const hasBothPlatforms = hasMetaConnections && hasGoogleConnections;

  // Verificar se precisa mostrar onboarding
  const needsOnboarding = totalClients === 0 || totalConnections === 0;

  // Get first client for metrics
  const firstClient = clients?.[0]?.id;

  return (
    <DashboardPageClient
      user={user}
      clients={clients || []}
      totalMetaConnections={totalMetaConnections}
      totalGoogleConnections={totalGoogleConnections}
      totalClients={totalClients}
      totalConnections={totalConnections}
      hasMetaConnections={hasMetaConnections}
      hasGoogleConnections={hasGoogleConnections}
      hasBothPlatforms={hasBothPlatforms}
      needsOnboarding={needsOnboarding}
      firstClient={firstClient || ''}
    />
  );
}