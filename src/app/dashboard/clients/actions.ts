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

  // Verificar se as tabelas existem
  const { data: tablesCheck, error: tablesError } = await supabase
    .from("organizations")
    .select("count")
    .limit(1);
  
  if (tablesError) {
    console.error("addClient: Tabela organizations não existe ou sem permissão:", tablesError);
    return { error: "Erro de configuração do banco de dados. Verifique se as tabelas foram criadas." };
  }

  // Tenta obter a organização do usuário
  let { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (membershipError && membershipError.code !== 'PGRST116') { // PGRST116 é "No rows found"
    console.error("addClient: Erro ao buscar associação existente:", {
      error: membershipError,
      code: membershipError.code,
      message: membershipError.message,
      details: membershipError.details,
      hint: membershipError.hint
    });
    return { error: `Erro ao buscar associação do usuário: ${membershipError.message}` };
  }

  let orgId: string | null = membership?.org_id || null;
  console.log("addClient: orgId inicial:", orgId);

  // Se nenhuma associação for encontrada, criar uma organização padrão
  if (!orgId) {
    console.log("addClient: Usuário não possui organização. Criando organização padrão...");
    
    // Primeiro, verificar se já existe uma organização padrão
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", "Organização Padrão")
      .single();

    if (existingOrg) {
      orgId = existingOrg.id;
      console.log("addClient: Usando organização padrão existente:", orgId);
    } else {
      // Criar nova organização padrão
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: "Organização Padrão" })
        .select("id")
        .single();

      if (orgError) {
        console.error("addClient: Erro ao criar organização:", orgError);
        return { error: "Erro ao criar organização padrão." };
      }

      orgId = newOrg.id;
      console.log("addClient: Nova organização criada:", orgId);
    }

    // Criar membership para o usuário
    const { error: membershipInsertError } = await supabase
      .from("memberships")
      .insert({
        user_id: user.id,
        org_id: orgId,
        role: "admin"
      });

    if (membershipInsertError) {
      console.error("addClient: Erro ao criar membership:", membershipInsertError);
      return { error: "Erro ao associar usuário à organização." };
    }

    console.log("addClient: Membership criada com sucesso para usuário:", user.id);
  }

  const clientName = formData.get("name") as string;

  if (!clientName) {
    console.error("addClient: Nome do cliente é obrigatório.");
    return { error: "O nome do cliente é obrigatório." };
  }
  console.log("addClient: Nome do cliente:", clientName);

  console.log("addClient: Tentando inserir cliente com dados:", {
    name: clientName,
    org_id: orgId,
  });

  const { data: insertData, error: insertError } = await supabase.from("clients").insert({
    name: clientName,
    org_id: orgId,
  }).select();

  if (insertError) {
    console.error("addClient: Erro detalhado ao inserir cliente:", {
      error: insertError,
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint
    });
    return { error: `Erro ao inserir cliente: ${insertError.message}` };
  }

  console.log("addClient: Dados inseridos:", insertData);

  console.log("addClient: Cliente adicionado com sucesso!");
  revalidatePath("/dashboard/clients");
  return { success: true };
}