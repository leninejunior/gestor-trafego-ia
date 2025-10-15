import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { 
  ArrowLeft,
  Users, 
  Search,
  Filter,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Calendar,
  Building2,
  Settings,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  Eye
} from "lucide-react";
import { UserManagementClient } from "@/components/admin/user-management-client";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Verificar se é super admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/login");
  }

  // Buscar todos os usuários com suas organizações e roles
  const { data: users } = await supabase
    .from("user_profiles")
    .select(`
      id,
      first_name,
      last_name,
      email,
      created_at,
      last_sign_in_at,
      memberships (
        id,
        role,
        status,
        created_at,
        accepted_at,
        organization_id,
        organizations (
          name
        ),
        user_roles!memberships_role_id_fkey (
          name,
          permissions
        )
      )
    `)
    .order("created_at", { ascending: false });

  // Estatísticas dos usuários
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter(u => 
    u.memberships?.some(m => m.status === 'active')
  ).length || 0;
  const pendingUsers = users?.filter(u => 
    u.memberships?.some(m => m.status === 'pending')
  ).length || 0;
  const superAdmins = users?.filter(u => 
    u.memberships?.some(m => m.user_roles?.[0]?.name === 'super_admin')
  ).length || 0;

  return (
    <UserManagementClient 
      initialUsers={users || []}
      initialStats={{
        total: totalUsers,
        active: activeUsers,
        pending: pendingUsers,
        superAdmins: superAdmins
      }}
    />
  );
}