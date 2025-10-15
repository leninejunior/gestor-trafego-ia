"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addClient(formData: FormData) {
  const supabase = await createClient();

  console.log("addClient: Iniciando...");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("addClient: Erro de autenticação do usuário:", userError);
    return { error: "Usuário não autenticado." };
  }
  console.log("addClient: Usuário autenticado:", user.id);

  // Tenta obter a organização do usuário
  let { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (membershipError && membershipError.code !== 'PGRST116') { // PGRST116 é "No rows found"
    console.error("addClient: Erro ao buscar associação existente:", membershipError);
    return { error: "Erro ao buscar associação do usuário." };
  }

  let orgId: string | null = membership?.org_id || null;
  console.log("addClient: orgId inicial:", orgId);

  // Se nenhuma associação for encontrada, retornar erro
  if (!orgId) {
    console.log("addClient: Usuário não possui organização.");
    return { error: "Você não possui uma organização. Entre em contato com um administrador para ser adicionado a uma organização." };
  }

  const clientName = formData.get("name") as string;

  if (!clientName) {
    console.error("addClient: Nome do cliente é obrigatório.");
    return { error: "O nome do cliente é obrigatório." };
  }
  console.log("addClient: Nome do cliente:", clientName);

  const { error: insertError } = await supabase.from("clients").insert({
    name: clientName,
    org_id: orgId,
  });

  if (insertError) {
    console.error("addClient: Erro ao inserir cliente:", insertError);
    return { error: "Não foi possível adicionar o cliente." };
  }

  console.log("addClient: Cliente adicionado com sucesso!");
  revalidatePath("/dashboard/clients");
  return { success: true };
}