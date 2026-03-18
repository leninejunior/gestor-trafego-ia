"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { 
  MoreHorizontal, 
  Mail, 
  Clock, 
  X,
  RefreshCw
} from "lucide-react";

interface Invite {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
  user_roles: {
    name: string;
    description: string;
  } | null;
}

interface TeamInvitesListProps {
  invites: Invite[];
}

export function TeamInvitesList({ invites }: TeamInvitesListProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const handleCancelInvite = async (inviteId: string) => {
    setLoading(inviteId);
    
    try {
      const response = await fetch(`/api/team/invites/${inviteId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao cancelar convite");
      }

      toast({
        title: "Sucesso",
        description: "Convite cancelado com sucesso!",
      });

      window.location.reload();

    } catch (error) {
      console.error("Erro ao cancelar convite:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao cancelar convite",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    setLoading(inviteId);
    
    try {
      const response = await fetch(`/api/team/invites/${inviteId}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao reenviar convite");
      }

      toast({
        title: "Sucesso",
        description: "Convite reenviado com sucesso!",
      });

      window.location.reload();

    } catch (error) {
      console.error("Erro ao reenviar convite:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao reenviar convite",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  if (!invites || invites.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum convite pendente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {invites.map((invite) => {
        const expired = isExpired(invite.expires_at);
        const isLoading = loading === invite.id;

        return (
          <div
            key={invite.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{invite.email}</h3>
                  <Badge variant={expired ? 'destructive' : 'secondary'}>
                    {expired ? 'Expirado' : 'Pendente'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {invite.user_roles?.name || 'Função não definida'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>Enviado em {formatDate(invite.created_at)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Expira em {formatDate(invite.expires_at)}
                  </span>
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!expired && (
                  <DropdownMenuItem
                    onClick={() => handleResendInvite(invite.id)}
                    disabled={isLoading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reenviar
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem
                  onClick={() => handleCancelInvite(invite.id)}
                  className="text-red-600"
                  disabled={isLoading}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}