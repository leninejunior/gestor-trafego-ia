import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserManagementClient } from "@/components/admin/user-management-client";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  
  // Verificar autenticação
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    redirect('/login');
  }

  // Verificar se é super admin
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!superAdmin) {
    redirect('/dashboard');
  }

  // Dados iniciais vazios - o componente carregará via API
  const initialUsers: any[] = [];
  const initialStats = {
    total: 0,
    active: 0,
    pending: 0,
    superAdmins: 0
  };

  return (
    <UserManagementClient 
      initialUsers={initialUsers}
      initialStats={initialStats}
    />
  );
}