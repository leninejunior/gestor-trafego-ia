"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, RefreshCw, ShieldAlert, Unlink } from "lucide-react";

type UserIdentity = {
  id?: string;
  identity_id?: string;
  provider?: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

const PROVIDERS: Array<{ id: string; label: string }> = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "azure", label: "Azure AD" },
  { id: "facebook", label: "Facebook" },
  { id: "apple", label: "Apple" },
];

function formatProviderName(provider: string | undefined): string {
  if (!provider) return "desconhecido";
  const found = PROVIDERS.find((candidate) => candidate.id === provider);
  if (found) return found.label;
  return provider;
}

export function IdentityLinkingCard() {
  const supabase = createClient();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingIdentityId, setUnlinkingIdentityId] = useState<string | null>(null);
  const [identities, setIdentities] = useState<UserIdentity[]>([]);

  const linkedProviders = useMemo(
    () => new Set(identities.map((identity) => identity.provider).filter((provider): provider is string => Boolean(provider))),
    [identities]
  );

  const loadIdentities = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) {
        toast({
          title: "Erro ao carregar identidades",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setIdentities(data?.identities ?? []);
    } catch (error) {
      toast({
        title: "Erro ao carregar identidades",
        description: "Nao foi possivel consultar as identidades da conta.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    void loadIdentities();
  }, [loadIdentities]);

  const handleLinkIdentity = async (provider: string) => {
    try {
      setLinkingProvider(provider);

      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard/settings` : undefined;
      const { error } = await supabase.auth.linkIdentity({
        provider: provider as any,
        options: redirectTo ? { redirectTo } : undefined,
      });

      if (error) {
        const lowered = error.message.toLowerCase();
        const isManualLinkingDisabled =
          lowered.includes("manual linking") && (lowered.includes("disabled") || lowered.includes("not enabled"));

        toast({
          title: "Falha ao vincular identidade",
          description: isManualLinkingDisabled
            ? "Ative Manual Linking (beta) no Supabase Auth antes de usar este recurso."
            : error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Falha ao vincular identidade",
        description: "Nao foi possivel iniciar a vinculacao.",
        variant: "destructive",
      });
    } finally {
      setLinkingProvider(null);
    }
  };

  const handleUnlinkIdentity = async (identity: UserIdentity) => {
    const identityId = identity.id ?? identity.identity_id ?? null;
    if (!identityId) {
      return;
    }

    if (identities.length <= 1) {
      toast({
        title: "Operacao bloqueada",
        description: "Nao e possivel desvincular a unica identidade da conta.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUnlinkingIdentityId(identityId);

      const { error } = await supabase.auth.unlinkIdentity(identity as any);
      if (error) {
        toast({
          title: "Falha ao desvincular",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Identidade desvinculada",
        description: `${formatProviderName(identity.provider)} removido com sucesso.`,
      });

      await loadIdentities(true);
    } catch (error) {
      toast({
        title: "Falha ao desvincular",
        description: "Nao foi possivel remover a identidade.",
        variant: "destructive",
      });
    } finally {
      setUnlinkingIdentityId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Link2 className="w-5 h-5 mr-2" />
          Vinculacao manual de identidades
        </CardTitle>
        <CardDescription>
          Vincule provedores de login na mesma conta (Manual Linking beta do Supabase).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {loading ? "Carregando identidades..." : `${identities.length} identidade(s) vinculada(s)`}
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadIdentities(true)} disabled={loading || refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="space-y-2">
          {identities.length === 0 && !loading ? (
            <div className="text-sm text-muted-foreground">Nenhuma identidade retornada para o usuario atual.</div>
          ) : (
            identities.map((identity) => {
              const identityId = identity.id ?? identity.identity_id ?? "";
              const providerName = formatProviderName(identity.provider);
              const isUnlinking = unlinkingIdentityId === identityId;

              return (
                <div key={identityId || `${identity.provider}-${identity.created_at}`} className="flex items-center justify-between border rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{providerName}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {identity.last_sign_in_at ? `Ultimo acesso: ${new Date(identity.last_sign_in_at).toLocaleString("pt-BR")}` : "Sem ultimo acesso"}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleUnlinkIdentity(identity)}
                    disabled={isUnlinking || identities.length <= 1}
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    {isUnlinking ? "Desvinculando..." : "Desvincular"}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Vincular novo provedor</p>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((provider) => {
              const isLinked = linkedProviders.has(provider.id);
              const isLinking = linkingProvider === provider.id;
              return (
                <Button
                  key={provider.id}
                  type="button"
                  variant={isLinked ? "secondary" : "outline"}
                  onClick={() => void handleLinkIdentity(provider.id)}
                  disabled={isLinked || Boolean(linkingProvider)}
                >
                  {isLinking ? "Vinculando..." : isLinked ? `${provider.label} vinculado` : `Vincular ${provider.label}`}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            Se aparecer erro de recurso desabilitado, ative Manual Linking (beta) no painel de Auth do Supabase.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
