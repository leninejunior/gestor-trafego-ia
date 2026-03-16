"use server";

import { redirect } from "next/navigation";

import { provisionLocalUser } from "@/lib/auth/provision-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function sanitizeRedirectTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/private";
  }

  return value;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = sanitizeRedirectTo(String(formData.get("redirectTo")));

  if (!email || !password) {
    redirect(
      `/login?error=${encodeURIComponent("Informe email e senha.")}&redirectTo=${encodeURIComponent(redirectTo)}`,
    );
  }

  const supabase = await (async () => {
    try {
      return await createSupabaseServerClient();
    } catch {
      redirect(
        `/login?error=${encodeURIComponent("Autenticacao indisponivel. Configure SUPABASE_URL e SUPABASE_ANON_KEY.")}&redirectTo=${encodeURIComponent(redirectTo)}`,
      );
    }
  })();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&redirectTo=${encodeURIComponent(redirectTo)}`,
    );
  }

  if (!data.user) {
    await supabase.auth.signOut();
    redirect(
      `/login?error=${encodeURIComponent("Nao foi possivel carregar o usuario autenticado.")}&redirectTo=${encodeURIComponent(redirectTo)}`,
    );
  }

  try {
    await provisionLocalUser(data.user);
  } catch (provisionError) {
    console.error("Erro ao provisionar usuario local:", provisionError);
    await supabase.auth.signOut();
    redirect(
      `/login?error=${encodeURIComponent("Falha ao provisionar usuario local. Tente novamente.")}&redirectTo=${encodeURIComponent(redirectTo)}`,
    );
  }

  redirect(redirectTo);
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
