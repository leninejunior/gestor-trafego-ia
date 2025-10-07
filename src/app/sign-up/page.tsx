"use client";

import { createClient } from "@/lib/supabase/client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Session } from "@supabase/supabase-js"; // Import Session type

// Re-using the AuthForm logic directly here for simplicity, but targeting the 'sign_up' view.
const SignUpAuthForm = () => {
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        const {
        data: { subscription },
        } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => { // Explicitly type event and session
        if (session) {
            router.push("/dashboard");
        }
        });

        return () => subscription.unsubscribe();
    }, [supabase, router]);

    return (
        <div className="w-full max-w-md">
        <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            view="sign_up"
            localization={{
                variables: {
                    sign_in: {
                        email_label: 'Endereço de e-mail',
                        password_label: 'Sua senha',
                        email_input_placeholder: 'Seu endereço de e-mail',
                        password_input_placeholder: 'Sua senha',
                        button_label: 'Entrar',
                        social_provider_text: 'Entrar com {{provider}}',
                        link_text: 'Já tem uma conta? Entre',
                        confirmation_text: 'Verifique seu e-mail para o link de confirmação'
                    },
                    sign_up: {
                        email_label: 'Endereço de e-mail',
                        password_label: 'Crie uma senha',
                        email_input_placeholder: 'Seu endereço de e-mail',
                        password_input_placeholder: 'Crie uma senha',
                        button_label: 'Cadastrar',
                        social_provider_text: 'Cadastre-se com {{provider}}',
                        link_text: 'Não tem uma conta? Cadastre-se',
                        confirmation_text: 'Verifique seu e-email para o link de confirmação'
                    },
                    forgotten_password: {
                        email_label: 'Endereço de e-mail',
                        password_label: 'Sua senha',
                        email_input_placeholder: 'Seu endereço de e-mail',
                        button_label: 'Enviar instruções de redefinição',
                        link_text: 'Esqueceu sua senha?',
                        confirmation_text: 'Verifique seu e-mail para o link de redefinição de senha'
                    }
                }
            }}
        />
        </div>
    )
}


export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Crie sua conta
          </h2>
        </div>
        <SignUpAuthForm />
      </div>
    </div>
  );
}