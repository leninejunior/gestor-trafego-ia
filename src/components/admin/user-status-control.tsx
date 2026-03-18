"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  User,
  XCircle,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface UserStatusControlProps {
  userId: string;
  isActive: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  onStatusChanged: () => void;
  disabled?: boolean;
}

export function UserStatusControl({ 
  userId, 
  isActive, 
  suspensionReason,
  suspendedAt,
  onStatusChanged,
  disabled = false
}: UserStatusControlProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleActivate = async () => {
    if (!confirm('Tem certeza que deseja ativar este usuário?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/unsuspend`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "✅ Usuário Ativado",
          description: data.message || "Usuário ativado com sucesso",
          variant: "default"
        });
        onStatusChanged();
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro",
          description: errorData?.error || "Erro ao ativar usuário",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao ativar usuário:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    const reason = prompt('Digite o motivo da suspensão:');
    if (!reason || !reason.trim()) {
      toast({
        title: "Erro",
        description: "Motivo da suspensão é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "⛔ Usuário Suspenso",
          description: data.message || "Usuário suspenso com sucesso",
          variant: "default"
        });
        onStatusChanged();
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro",
          description: errorData?.error || "Erro ao suspender usuário",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao suspender usuário:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Status Atual */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-3">
          {isActive ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {isActive ? 'Usuário Ativo' : 'Usuário Suspenso'}
              </span>
              <Badge variant={isActive ? 'default' : 'destructive'} className="text-xs">
                {isActive ? 'Ativo' : 'Suspenso'}
              </Badge>
            </div>
            <p className="text-xs text-gray-600">
              {isActive 
                ? 'Acesso liberado ao sistema'
                : suspendedAt 
                  ? `Suspenso em ${new Date(suspendedAt).toLocaleDateString('pt-BR')}`
                  : 'Acesso bloqueado'
              }
            </p>
          </div>
        </div>
        
        {/* Botão de Ação */}
        <div>
          {isActive ? (
            <Button
              onClick={handleSuspend}
              disabled={loading || disabled}
              size="sm"
              variant="destructive"
            >
              {loading ? 'Suspendendo...' : '⛔ Suspender'}
            </Button>
          ) : (
            <Button
              onClick={handleActivate}
              disabled={loading || disabled}
              size="sm"
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Ativando...' : '✅ Ativar'}
            </Button>
          )}
        </div>
      </div>
      
      {/* Motivo da Suspensão */}
      {!isActive && suspensionReason && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Motivo da Suspensão:</p>
              <p className="text-sm text-red-700">{suspensionReason}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}