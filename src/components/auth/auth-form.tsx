"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@supabase/supabase-js";

export default function AuthForm() {
  const supabase = createClient();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !isRedirecting) {
        setIsRedirecting(true);
        router.push("/dashboard");
        router.refresh();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      if (event === "SIGNED_IN" && session && !isRedirecting) {
        setIsRedirecting(true);
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 100);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, isRedirecting]);

  return (
    <div className="w-full max-w-md">
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={[]}
        view="sign_in"
        showLinks={false}
        localization={{
          variables: {
            sign_in: {
              email_label: "Endereco de e-mail",
              password_label: "Sua senha",
              email_input_placeholder: "Seu endereco de e-mail",
              password_input_placeholder: "Sua senha",
              button_label: "Entrar",
              social_provider_text: "Entrar com {{provider}}",
              link_text: "Ja tem uma conta? Entre",
              confirmation_text: "Verifique seu e-mail para o link de confirmacao",
            },
            sign_up: {
              email_label: "Endereco de e-mail",
              password_label: "Crie uma senha",
              email_input_placeholder: "Seu endereco de e-mail",
              password_input_placeholder: "Crie uma senha",
              button_label: "Cadastrar",
              social_provider_text: "Cadastre-se com {{provider}}",
              link_text: "Nao tem uma conta? Cadastre-se",
              confirmation_text: "Verifique seu e-mail para o link de confirmacao",
            },
            forgotten_password: {
              email_label: "Endereco de e-mail",
              password_label: "Sua senha",
              email_input_placeholder: "Seu endereco de e-mail",
              button_label: "Enviar instrucoes de redefinicao",
              link_text: "Esqueceu sua senha?",
              confirmation_text: "Verifique seu e-mail para redefinir a senha",
            },
          },
        }}
      />
    </div>
  );
}
