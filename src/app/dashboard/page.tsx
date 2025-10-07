import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic'; // Garante que a página seja sempre renderizada dinamicamente

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Bem-vindo ao seu Dashboard</h1>
      <p className="mt-2 text-gray-600">Olá, {user.email}</p>
    </div>
  );
}