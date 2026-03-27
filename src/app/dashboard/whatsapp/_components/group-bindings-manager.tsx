"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

type ClientSummary = {
  id: string;
  name: string | null;
};

type GroupBinding = {
  id: string;
  group_id: string;
  group_name: string | null;
  client_id: string;
  is_active: boolean;
  can_read: boolean;
  can_manage_campaigns: boolean;
  allowed_sender_ids: string[];
  updated_at: string;
  clients?: ClientSummary | null;
};

type BindingsApiResponse = {
  success: boolean;
  data?: GroupBinding[];
  error?: string;
};

type ClientsApiResponse = {
  clients?: ClientSummary[];
  error?: string;
};

type FormState = {
  groupId: string;
  groupName: string;
  clientId: string;
  allowedSenderIds: string[];
  senderDraft: string;
  canRead: boolean;
  canManageCampaigns: boolean;
  isActive: boolean;
};

const INITIAL_FORM: FormState = {
  groupId: "",
  groupName: "",
  clientId: "",
  allowedSenderIds: [],
  senderDraft: "",
  canRead: true,
  canManageCampaigns: false,
  isActive: true,
};

function parseSenderCandidates(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function dedupeSenderIds(values: string[]): string[] {
  return Array.from(new Set(values));
}

function safeBindings(payload: unknown): GroupBinding[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const data = (payload as BindingsApiResponse).data;
  return Array.isArray(data) ? data : [];
}

function safeClients(payload: unknown): ClientSummary[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = (payload as ClientsApiResponse).clients;
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is ClientSummary => {
      return Boolean(item && typeof item.id === "string");
    })
    .map((item) => ({
      id: item.id,
      name: item.name ?? null,
    }));
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("pt-BR");
}

export function GroupBindingsManager() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [bindings, setBindings] = useState<GroupBinding[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [bindingToDelete, setBindingToDelete] = useState<GroupBinding | null>(null);
  const { toast } = useToast();

  const loadBindings = async (searchValue?: string) => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("limit", "200");
      if (searchValue && searchValue.trim().length > 0) {
        query.set("search", searchValue.trim());
      }

      const response = await fetch(`/api/admin/whatsapp/group-bindings?${query.toString()}`, {
        method: "GET",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => ({}))) as BindingsApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Nao foi possivel carregar os vinculos.");
      }

      setBindings(safeBindings(payload));
    } catch (error) {
      toast({
        title: "Erro ao carregar vinculos",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadClients = async () => {
    setIsClientsLoading(true);
    try {
      const response = await fetch("/api/clients", {
        method: "GET",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => ({}))) as ClientsApiResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel carregar os clientes.");
      }

      setClients(
        safeClients(payload).sort((a, b) => {
          const nameA = (a.name || "").toLowerCase();
          const nameB = (b.name || "").toLowerCase();
          return nameA.localeCompare(nameB);
        })
      );
    } catch (error) {
      toast({
        title: "Erro ao carregar clientes",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsClientsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadBindings(), loadClients()]);
  }, []);

  const sortedBindings = useMemo(() => {
    return [...bindings].sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [bindings]);

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
  };

  const addSenderToForm = () => {
    const candidates = parseSenderCandidates(form.senderDraft);
    if (candidates.length === 0) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      allowedSenderIds: dedupeSenderIds([...prev.allowedSenderIds, ...candidates]),
      senderDraft: "",
    }));
  };

  const removeSenderFromForm = (senderId: string) => {
    setForm((prev) => ({
      ...prev,
      allowedSenderIds: prev.allowedSenderIds.filter((item) => item !== senderId),
    }));
  };

  const saveBinding = async () => {
    if (!form.groupId.trim() || !form.clientId.trim()) {
      toast({
        title: "Campos obrigatorios",
        description: "Informe groupId e selecione um cliente.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedSenderIds = dedupeSenderIds([
        ...form.allowedSenderIds,
        ...parseSenderCandidates(form.senderDraft),
      ]);

      const response = await fetch("/api/admin/whatsapp/group-bindings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          group_id: form.groupId.trim(),
          group_name: form.groupName.trim() || null,
          client_id: form.clientId.trim(),
          can_read: form.canRead,
          can_manage_campaigns: form.canManageCampaigns,
          is_active: form.isActive,
          allowed_sender_ids: normalizedSenderIds,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Falha ao salvar vinculo.");
      }

      toast({
        title: "Vinculo salvo",
        description: "Grupo vinculado ao cliente com sucesso.",
      });
      await loadBindings(search);
      resetForm();
    } catch (error) {
      toast({
        title: "Falha ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const disableBinding = async (groupId: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/whatsapp/group-bindings", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ group_id: groupId }),
      });

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Falha ao desativar vinculo.");
      }

      toast({
        title: "Vinculo desativado",
      });
      await loadBindings(search);
    } catch (error) {
      toast({
        title: "Erro ao desativar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteBinding = async (groupId: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/whatsapp/group-bindings", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ group_id: groupId, hard_delete: true }),
      });

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Falha ao excluir vinculo.");
      }

      toast({
        title: "Vinculo excluido",
      });

      if (form.groupId.trim() === groupId) {
        resetForm();
      }
      await loadBindings(search);
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setBindingToDelete(null);
    }
  };

  const editBinding = (binding: GroupBinding) => {
    setForm({
      groupId: binding.group_id,
      groupName: binding.group_name ?? "",
      clientId: binding.client_id,
      allowedSenderIds: binding.allowed_sender_ids,
      senderDraft: "",
      canRead: binding.can_read,
      canManageCampaigns: binding.can_manage_campaigns,
      isActive: binding.is_active,
    });
  };

  const applySearch = async () => {
    await loadBindings(search);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vinculo Dinamico Grupo x Cliente</CardTitle>
          <CardDescription>
            Cadastre o group_id do WhatsApp e vincule ao client_id. A API passa a resolver o contexto automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="groupId">Group ID</Label>
              <Input
                id="groupId"
                placeholder="1203XXXXXXXX@g.us"
                value={form.groupId}
                onChange={(event) => onChange("groupId", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Cliente</Label>
              <Select value={form.clientId || undefined} onValueChange={(value) => onChange("clientId", value)}>
                <SelectTrigger id="clientId">
                  <SelectValue
                    placeholder={isClientsLoading ? "Carregando clientes..." : "Selecione o cliente"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <SelectItem value="__no_clients__" disabled>
                      Nenhum cliente disponivel
                    </SelectItem>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name?.trim() || client.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.clientId ? (
                <p className="text-xs text-muted-foreground">ID: {form.clientId}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupName">Nome do Grupo (opcional)</Label>
            <Input
              id="groupName"
              placeholder="Financeiro Cliente X"
              value={form.groupName}
              onChange={(event) => onChange("groupName", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowedSenderIds">Whitelist de senders (opcional)</Label>
            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                id="allowedSenderIds"
                placeholder="5511999999999@s.whatsapp.net"
                value={form.senderDraft}
                onChange={(event) => onChange("senderDraft", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addSenderToForm();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addSenderToForm}
                disabled={parseSenderCandidates(form.senderDraft).length === 0}
              >
                Adicionar sender
              </Button>
            </div>
            {form.allowedSenderIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {form.allowedSenderIds.map((senderId) => (
                  <Badge key={senderId} variant="secondary" className="flex items-center gap-1">
                    <span>{senderId}</span>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-sm hover:bg-muted/50"
                      onClick={() => removeSenderFromForm(senderId)}
                      aria-label={`Remover ${senderId}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Separe por virgula. Em branco = qualquer sender do grupo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="canRead">Permite leitura</Label>
              <Switch id="canRead" checked={form.canRead} onCheckedChange={(value) => onChange("canRead", value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="canManage">Permite pausar/ativar</Label>
              <Switch
                id="canManage"
                checked={form.canManageCampaigns}
                onCheckedChange={(value) => onChange("canManageCampaigns", value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="isActive">Vinculo ativo</Label>
              <Switch id="isActive" checked={form.isActive} onCheckedChange={(value) => onChange("isActive", value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveBinding()} disabled={isSubmitting}>
              Salvar Vinculo
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vinculos Cadastrados</CardTitle>
          <CardDescription>Use editar para reaproveitar os campos do formulario.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              placeholder="Buscar por group_id ou nome do grupo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button variant="outline" onClick={() => void applySearch()} disabled={isLoading || isSubmitting}>
              Buscar
            </Button>
            <Button variant="outline" onClick={() => void loadBindings()} disabled={isLoading || isSubmitting}>
              Recarregar
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando vinculos...</p>
          ) : sortedBindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vinculo encontrado.</p>
          ) : (
            <div className="space-y-3">
              {sortedBindings.map((binding) => (
                <div key={binding.id} className="rounded-md border p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{binding.group_id}</p>
                        <Badge variant={binding.is_active ? "default" : "secondary"}>
                          {binding.is_active ? "ativo" : "inativo"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {binding.group_name || "Sem nome de grupo"} | cliente:{" "}
                        {binding.clients?.name?.trim() || binding.client_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        whitelist:{" "}
                        {binding.allowed_sender_ids.length > 0
                          ? `${binding.allowed_sender_ids.length} sender(s)`
                          : "qualquer sender"}
                      </p>
                      <p className="text-xs text-muted-foreground">Atualizado em {formatDate(binding.updated_at)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => editBinding(binding)} disabled={isSubmitting}>
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void disableBinding(binding.group_id)}
                        disabled={isSubmitting || !binding.is_active}
                      >
                        Desativar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setBindingToDelete(binding)}
                        disabled={isSubmitting}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(bindingToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setBindingToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vinculo?</AlertDialogTitle>
            <AlertDialogDescription>
              {bindingToDelete
                ? `Essa acao remove permanentemente o vinculo do grupo ${bindingToDelete.group_id} com o cliente ${bindingToDelete.clients?.name?.trim() || bindingToDelete.client_id}.`
                : "Essa acao remove permanentemente o vinculo do grupo com o cliente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bindingToDelete) {
                  void deleteBinding(bindingToDelete.group_id);
                }
              }}
              disabled={isSubmitting || !bindingToDelete}
            >
              {isSubmitting ? "Excluindo..." : "Excluir vinculo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
