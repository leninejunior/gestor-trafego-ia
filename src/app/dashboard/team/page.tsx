import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Calendar,
  MoreHorizontal,
  Shield,
  Clock
} from "lucide-react";
import { TeamInviteDialog } from "@/components/team/team-invite-dialog";
import { TeamMembersList } from "@/components/team/team-members-list";
import { TeamInvitesList } from "@/components/team/team-invites-list";

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // Buscar organização do usuário
  const { data: membership } = await supabase
    .from("memberships")
    .select(`
      org_id,
      role,
      organizations (
        id,
        name
      )
    `)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return redirect("/dashboard");
  }

  const canManageTeam = ['owner', 'admin'].includes(membership.role);

  // Buscar membros da organização
  const { data: members } = await supabase
    .from("memberships")
    .select(`
      id,
      role,
      status,
      created_at,
      accepted_at,
      user_profiles (
        first_name,
        last_name,
        avatar_url,
        last_login_at
      ),
      user_roles (
        name,
        description
      )
    `)
    .eq("org_id", membership.org_id)
    .order("created_at", { ascending: false });

  // Buscar convites pendentes (apenas se pode gerenciar)
  let invites = null;
  if (canManageTeam) {
    const { data: invitesData } = await supabase
      .from("organization_invites")
      .select(`
        id,
        email,
        status,
        created_at,
        expires_at,
        user_roles (
          name,
          description
        )
      `)
      .eq("org_id", membership.org_id)
      .in("status", ["pending"])
      .order("created_at", { ascending: false });
    
    invites = invitesData;
  }

  // Buscar roles disponíveis
  const { data: roles } = await supabase
    .from("user_roles")
    .select("*")
    .neq("name", "super_admin")
    .order("name");

  const stats = {
    totalMembers: members?.length || 0,
    pendingInvites: invites?.length || 0,
    activeMembers: members?.filter(m => m.status === 'active').length || 0
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipe</h1>
          <p className="text-gray-600 mt-2">
            Gerencie os membros da sua organização
          </p>
        </div>
        
        {canManageTeam && (
          <TeamInviteDialog roles={roles || []}>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar Membro
            </Button>
          </TeamInviteDialog>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeMembers} ativos
            </p>
          </CardContent>
        </Card>

        {canManageTeam && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Convites Pendentes</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingInvites}</div>
                <p className="text-xs text-muted-foreground">
                  Aguardando resposta
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Organização</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold truncate">
                  {membership.organizations?.name}
                </div>
                <p className="text-xs text-muted-foreground">
                  Seu papel: {membership.role}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Lista de Membros */}
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
          <CardDescription>
            Todos os membros ativos da organização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembersList 
            members={members || []} 
            currentUserId={user.id}
            canManage={canManageTeam}
            roles={roles || []}
          />
        </CardContent>
      </Card>

      {/* Lista de Convites (apenas para admins) */}
      {canManageTeam && invites && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convites Pendentes</CardTitle>
            <CardDescription>
              Convites enviados aguardando resposta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamInvitesList invites={invites} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}