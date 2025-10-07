"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addClient(formData: FormData) {
  const supabase = createClient();

  // First, get the current user to find their org_id
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Usuário não autenticado." };
  }

  // Get the user's primary organization (assuming one for simplicity, or you can add a selector)
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return { error: "Organização não encontrada para este usuário." };
  }

  const clientName = formData.get("name") as string;

  if (!clientName) {
    return { error: "O nome do cliente é obrigatório." };
  }

  const { error: insertError } = await supabase.from("clients").insert({
    name: clientName,
    org_id: membership.org_id, // Usando org_id
  });

  if (insertError) {
    console.error("Error inserting client:", insertError);
    return { error: "Não foi possível adicionar o cliente." };
  }

  revalidatePath("/dashboard/clients");
  return { success: true };
}