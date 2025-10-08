"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addClient(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Usuário não autenticado." };
  }

  // Tenta obter a organização do usuário
  let { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  let orgId: string | null = membership?.org_id || null;

  // Se nenhuma associação for encontrada, cria uma organização e uma associação para o usuário
  if (!orgId) {
    console.log("Nenhuma associação encontrada, criando nova organização para o usuário:", user.id);

    const { data: newOrgId, error: rpcError } = await supabase.rpc('create_org_and_add_admin');

    if (rpcError || !newOrgId) {
        console.error("Erro ao chamar a RPC create_org_and_add_admin:", rpcError);
        return { error: "Não foi possível criar uma organização para o usuário." };
    }
    orgId = newOrgId;
  }

  const clientName = formData.get("name") as string;

  if (!clientName) {
    return { error: "O nome do cliente é obrigatório." };
  }

  const { error: insertError } = await supabase.from("clients").insert({
    name: clientName,
    org_id: orgId,
  });

  if (insertError) {
    console.error("Error inserting client:", insertError);
    return { error: "Não foi possível adicionar o cliente." };
  }

  revalidatePath("/dashboard/clients");
  return { success: true };
}