import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Building2, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { AcceptInviteButton } from "@/components/invite/accept-invite-button";

export const dynamic = 'force-dynamic';

interface InvitePageProps {
  params: {
    token: string;
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = params;
  const supabase = await createClient();

  // Verificar se usuário está logado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirecionar para login com redirect para esta página
    return redirect(`/login?redirect=/invite/${token}`);
  }

  // Buscar informações do convite
  const { data: invite, error } = await supabase
    .from("organization_invites")
    .select(`
      *,
      organizations (
        id,
        name
      ),
      user_roles (
        name,
        description
      ),
      invited_by_user:auth.users!organization_invites_invited_by_fkey (
        email
      )
    `)
    .eq("token", token)
    .single();

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>
              Este convite não foi encontrado ou é inválido.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.href = '/dashboard'}>
              Ir para Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verificar se convite expirou
  const isExpired = new Date(invite.expires_at) < new Date();
  
  // Verificar se convite já foi aceito
  const isAccepted = invite.status === 'accepted';

  // Verificar se usuário já é membro da organização
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", invite.org_id)
    .single();

  // Verificar se email do usuário confere
  const emailMatches = user.email === invite.email;

  const canAccept = !isExpired && !isAccepted && !existingMembership && emailMatches;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {canAccept ? (
              <Users className="h-12 w-12 text-blue-500" />
            ) : isAccepted || existingMembership ? (
              <CheckCircle className="h-12 w-12 text-green-500" />
            ) : (
              <XCircle className="h-12 w-12 text-red-500" />
            )}
          </div>
          
          <CardTitle className="text-2xl">
            {canAccept ? "Convite para Equipe" : 
             isAccepted || existingMembership ? "Convite Aceito" : 
             "Convite Inválido"}
          </CardTitle>
          
          <CardDescription>
            {canAccept ? "Você foi convidado para participar de uma organização" :
             isAccepted ? "Este convite já foi aceito" :
             existingMembership ? "Você já é membro desta organização" :
             isExpired ? "Este convite expirou" :
             !emailMatches ? "Este convite foi enviado para outro email" :
             "Este convite não pode ser aceito"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Informações do convite */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Organização</span>
              </div>
              <span className="text-sm">{invite.organizations?.name}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Função</span>
              </div>
              <Badge variant="outline">
                {invite.user_roles?.name || 'Não definida'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Expira em</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-gray-500" />
                <span className="text-sm">
                  {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            {invite.user_roles?.description && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Sobre esta função:</strong> {invite.user_roles.description}
                </p>
              </div>
            )}
          </div>

          {/* Status e ações */}
          <div className="space-y-4">
            {canAccept && (
              <AcceptInviteButton token={token} />
            )}

            {isExpired && (
              <div className="text-center">
                <p className="text-sm text-red-600 mb-4">
                  Este convite expirou. Entre em contato com o administrador da organização para solicitar um novo convite.
                </p>
                <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                  Ir para Dashboard
                </Button>
              </div>
            )}

            {(isAccepted || existingMembership) && (
              <div className="text-center">
                <Button onClick={() => window.location.href = '/dashboard'}>
                  Ir para Dashboard
                </Button>
              </div>
            )}

            {!emailMatches && (
              <div className="text-center">
                <p className="text-sm text-red-600 mb-4">
                  Este convite foi enviado para {invite.email}, mas você está logado como {user.email}.
                </p>
                <div className="space-y-2">
                  <Button variant="outline" onClick={() => window.location.href = '/logout'}>
                    Fazer Login com Outra Conta
                  </Button>
                  <Button variant="ghost" onClick={() => window.location.href = '/dashboard'}>
                    Ir para Dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Informações adicionais */}
          <div className="text-center text-xs text-gray-500 pt-4 border-t">
            Convidado por: {invite.invited_by_user?.email || 'Administrador'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}