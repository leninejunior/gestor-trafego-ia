"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  RECURRENCE_OPTIONS,
  WEEKDAY_OPTIONS,
  formatIsoDateToBr,
} from "@/lib/meta/campaign-budget-scheduler";

interface BudgetEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  itemType: "campaign" | "adset";
  currentDailyBudget?: string;
  currentLifetimeBudget?: string;
  clientId?: string;
  adAccountId?: string;
  onSuccess?: () => void;
}

interface CampaignBudgetSchedule {
  id: string;
  scheduled_date?: string | null;
  day_of_week?: number | null;
  hour: number;
  minute: number;
  timezone: string;
  daily_budget: number;
  recurrence_type?: "none" | "daily" | "weekly" | "monthly" | null;
  recurrence_interval?: number | null;
  is_active: boolean;
  next_run_at?: string | null;
  last_error?: string | null;
}

interface CampaignStatusSchedule {
  id: string;
  target_status: "ACTIVE" | "PAUSED";
  scheduled_date?: string | null;
  hour: number;
  minute: number;
  timezone: string;
  recurrence_type?: "none" | "daily" | "weekly" | "monthly" | null;
  recurrence_interval?: number | null;
  is_active: boolean;
  next_run_at?: string | null;
  last_error?: string | null;
}

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const getTodayBrDate = () => {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
};

const maskBrDate = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const sortByNextRun = <T extends { next_run_at?: string | null }>(items: T[]) =>
  [...items].sort((a, b) => {
    const aTime = a.next_run_at ? new Date(a.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.next_run_at ? new Date(b.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

export function BudgetEditDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  itemType,
  currentDailyBudget,
  currentLifetimeBudget,
  clientId,
  adAccountId,
  onSuccess,
}: BudgetEditDialogProps) {
  const [dailyBudget, setDailyBudget] = useState("");
  const [lifetimeBudget, setLifetimeBudget] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [budgetSchedules, setBudgetSchedules] = useState<CampaignBudgetSchedule[]>([]);
  const [loadingBudgetSchedules, setLoadingBudgetSchedules] = useState(false);
  const [addingBudgetSchedule, setAddingBudgetSchedule] = useState(false);
  const [updatingBudgetScheduleId, setUpdatingBudgetScheduleId] = useState<string | null>(null);
  const [newBudgetScheduleDate, setNewBudgetScheduleDate] = useState(getTodayBrDate());
  const [newBudgetScheduleTime, setNewBudgetScheduleTime] = useState("00:00");
  const [newBudgetScheduleBudget, setNewBudgetScheduleBudget] = useState("");
  const [newBudgetScheduleTimezone, setNewBudgetScheduleTimezone] = useState(DEFAULT_TIMEZONE);
  const [budgetRecurrenceEnabled, setBudgetRecurrenceEnabled] = useState(false);
  const [budgetRecurrenceType, setBudgetRecurrenceType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [budgetRecurrenceInterval, setBudgetRecurrenceInterval] = useState("1");

  const [statusSchedules, setStatusSchedules] = useState<CampaignStatusSchedule[]>([]);
  const [loadingStatusSchedules, setLoadingStatusSchedules] = useState(false);
  const [addingStatusSchedule, setAddingStatusSchedule] = useState(false);
  const [updatingStatusScheduleId, setUpdatingStatusScheduleId] = useState<string | null>(null);
  const [newStatusScheduleDate, setNewStatusScheduleDate] = useState(getTodayBrDate());
  const [newStatusScheduleTime, setNewStatusScheduleTime] = useState("00:00");
  const [newStatusScheduleTimezone, setNewStatusScheduleTimezone] = useState(DEFAULT_TIMEZONE);
  const [newStatusTarget, setNewStatusTarget] = useState<"ACTIVE" | "PAUSED">("PAUSED");
  const [statusRecurrenceEnabled, setStatusRecurrenceEnabled] = useState(false);
  const [statusRecurrenceType, setStatusRecurrenceType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [statusRecurrenceInterval, setStatusRecurrenceInterval] = useState("1");

  const isCampaign = itemType === "campaign";
  const canManageSchedules = isCampaign && Boolean(clientId) && Boolean(adAccountId);

  const formatBudget = (value: string | number | undefined) => {
    if (value === undefined || value === null || value === "") return "-";
    const numericValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numericValue)) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numericValue);
  };

  const formatScheduleTime = (hour: number, minute: number) =>
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const getWeekdayLabel = (dayOfWeek: number) =>
    WEEKDAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label || `Dia ${dayOfWeek}`;

  const getScheduleDateLabel = (scheduleDate?: string | null, fallbackDay?: number | null) => {
    if (scheduleDate) return formatIsoDateToBr(scheduleDate);
    if (typeof fallbackDay === "number") return getWeekdayLabel(fallbackDay);
    return "-";
  };

  const getRecurrenceLabel = (recurrenceType?: string | null, recurrenceInterval?: number | null) => {
    if (!recurrenceType || recurrenceType === "none") return "Nao repetir";
    const baseLabel = RECURRENCE_OPTIONS.find((option) => option.value === recurrenceType)?.label || recurrenceType;
    const interval = recurrenceInterval && recurrenceInterval > 0 ? recurrenceInterval : 1;
    return interval > 1 ? `A cada ${interval} ${baseLabel.toLowerCase()}` : baseLabel;
  };

  const loadBudgetSchedules = useCallback(async () => {
    if (!canManageSchedules || !clientId) {
      setBudgetSchedules([]);
      return;
    }

    setLoadingBudgetSchedules(true);
    try {
      const query = new URLSearchParams({ clientId, campaignId: itemId }).toString();
      const response = await fetch(`/api/meta/campaign-budget-schedules?${query}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao carregar agendamentos de orcamento");
        setBudgetSchedules([]);
        return;
      }

      const schedules = Array.isArray(data.schedules) ? (data.schedules as CampaignBudgetSchedule[]) : [];
      setBudgetSchedules(sortByNextRun(schedules));
    } catch (error) {
      console.error("Erro ao carregar agendamentos de orcamento:", error);
      toast.error("Erro ao carregar agendamentos de orcamento");
      setBudgetSchedules([]);
    } finally {
      setLoadingBudgetSchedules(false);
    }
  }, [canManageSchedules, clientId, itemId]);

  const loadStatusSchedules = useCallback(async () => {
    if (!canManageSchedules || !clientId) {
      setStatusSchedules([]);
      return;
    }

    setLoadingStatusSchedules(true);
    try {
      const query = new URLSearchParams({ clientId, campaignId: itemId }).toString();
      const response = await fetch(`/api/meta/campaign-status-schedules?${query}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao carregar agendamentos de status");
        setStatusSchedules([]);
        return;
      }

      const schedules = Array.isArray(data.schedules) ? (data.schedules as CampaignStatusSchedule[]) : [];
      setStatusSchedules(sortByNextRun(schedules));
    } catch (error) {
      console.error("Erro ao carregar agendamentos de status:", error);
      toast.error("Erro ao carregar agendamentos de status");
      setStatusSchedules([]);
    } finally {
      setLoadingStatusSchedules(false);
    }
  }, [canManageSchedules, clientId, itemId]);

  const loadSchedules = useCallback(async () => {
    await Promise.all([loadBudgetSchedules(), loadStatusSchedules()]);
  }, [loadBudgetSchedules, loadStatusSchedules]);

  useEffect(() => {
    if (!open) return;

    const dailyValue = currentDailyBudget ? parseFloat(currentDailyBudget) : NaN;
    const lifetimeValue = currentLifetimeBudget ? parseFloat(currentLifetimeBudget) : NaN;

    setDailyBudget(!isNaN(dailyValue) ? (dailyValue / 100).toFixed(2) : "");
    setLifetimeBudget(!isNaN(lifetimeValue) ? (lifetimeValue / 100).toFixed(2) : "");

    setNewBudgetScheduleBudget(!isNaN(dailyValue) ? (dailyValue / 100).toFixed(2) : "");
    setNewBudgetScheduleDate(getTodayBrDate());
    setNewBudgetScheduleTime("00:00");
    setNewBudgetScheduleTimezone(DEFAULT_TIMEZONE);
    setBudgetRecurrenceEnabled(false);
    setBudgetRecurrenceType("weekly");
    setBudgetRecurrenceInterval("1");

    setNewStatusScheduleDate(getTodayBrDate());
    setNewStatusScheduleTime("00:00");
    setNewStatusScheduleTimezone(DEFAULT_TIMEZONE);
    setNewStatusTarget("PAUSED");
    setStatusRecurrenceEnabled(false);
    setStatusRecurrenceType("weekly");
    setStatusRecurrenceInterval("1");

    if (isCampaign) {
      void loadSchedules();
    } else {
      setBudgetSchedules([]);
      setStatusSchedules([]);
    }
  }, [open, currentDailyBudget, currentLifetimeBudget, isCampaign, itemId, clientId, adAccountId, loadSchedules]);

  const handleSubmit = async () => {
    if (!dailyBudget && !lifetimeBudget) {
      toast.error("Informe pelo menos um tipo de orcamento");
      return;
    }

    setIsLoading(true);
    try {
      let endpoint: string;
      if (itemType === "campaign") endpoint = `/api/campaigns/${itemId}/budget`;
      else if (clientId && adAccountId) endpoint = `/api/meta/adsets/budget?adsetId=${itemId}&clientId=${clientId}&adAccountId=${adAccountId}`;
      else endpoint = `/api/adsets/${itemId}/budget`;

      const body: Record<string, unknown> = {};
      if (dailyBudget) body.daily_budget = dailyBudget;
      if (lifetimeBudget) body.lifetime_budget = lifetimeBudget;
      if (!clientId || !adAccountId) {
        if (clientId) body.clientId = clientId;
        if (adAccountId) body.adAccountId = adAccountId;
      }

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Orcamento atualizado com sucesso!");
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.error || "Erro ao atualizar orcamento");
      }
    } catch (error) {
      console.error("Erro ao atualizar orcamento:", error);
      toast.error("Erro ao atualizar orcamento");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBudgetSchedule = async () => {
    if (!canManageSchedules || !clientId || !adAccountId) {
      toast.error("Cliente e conta de anuncio sao obrigatorios para agendar");
      return;
    }

    const [hourText, minuteText] = newBudgetScheduleTime.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const budget = Number(newBudgetScheduleBudget);
    const recurrenceInterval = Number(budgetRecurrenceInterval);

    if (!newBudgetScheduleDate || newBudgetScheduleDate.length !== 10) {
      toast.error("Informe a data no formato DD/MM/AAAA");
      return;
    }
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      toast.error("Horario invalido");
      return;
    }
    if (!Number.isFinite(budget) || budget <= 0) {
      toast.error("Informe um orcamento diario valido");
      return;
    }
    if (!newBudgetScheduleTimezone.trim()) {
      toast.error("Informe uma timezone valida");
      return;
    }
    if (budgetRecurrenceEnabled && (!Number.isInteger(recurrenceInterval) || recurrenceInterval <= 0)) {
      toast.error("Informe um intervalo de recorrencia valido");
      return;
    }

    setAddingBudgetSchedule(true);
    try {
      const response = await fetch("/api/meta/campaign-budget-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: itemId,
          clientId,
          adAccountId,
          scheduledDate: newBudgetScheduleDate,
          hour,
          minute,
          timeZone: newBudgetScheduleTimezone.trim(),
          recurrenceType: budgetRecurrenceEnabled ? budgetRecurrenceType : "none",
          recurrenceInterval: budgetRecurrenceEnabled ? recurrenceInterval : 1,
          dailyBudget: budget,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Falha ao criar agendamento");
        return;
      }

      toast.success("Agendamento de orcamento criado");
      setBudgetSchedules((prev) => sortByNextRun([data.schedule as CampaignBudgetSchedule, ...prev]));
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setAddingBudgetSchedule(false);
    }
  };

  const handleToggleBudgetSchedule = async (schedule: CampaignBudgetSchedule) => {
    setUpdatingBudgetScheduleId(schedule.id);
    try {
      const response = await fetch(`/api/meta/campaign-budget-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !schedule.is_active }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Falha ao atualizar agendamento");
        return;
      }

      setBudgetSchedules((prev) =>
        sortByNextRun(prev.map((item) => (item.id === schedule.id ? data.schedule : item)))
      );
      toast.success(data.schedule?.is_active ? "Agendamento ativado" : "Agendamento desativado");
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      toast.error("Erro ao atualizar agendamento");
    } finally {
      setUpdatingBudgetScheduleId(null);
    }
  };

  const handleDeleteBudgetSchedule = async (scheduleId: string) => {
    setUpdatingBudgetScheduleId(scheduleId);
    try {
      const response = await fetch(`/api/meta/campaign-budget-schedules/${scheduleId}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Falha ao remover agendamento");
        return;
      }

      setBudgetSchedules((prev) => prev.filter((item) => item.id !== scheduleId));
      toast.success("Agendamento removido");
    } catch (error) {
      console.error("Erro ao remover agendamento:", error);
      toast.error("Erro ao remover agendamento");
    } finally {
      setUpdatingBudgetScheduleId(null);
    }
  };

  const handleCreateStatusSchedule = async () => {
    if (!canManageSchedules || !clientId || !adAccountId) {
      toast.error("Cliente e conta de anuncio sao obrigatorios para agendar");
      return;
    }

    const [hourText, minuteText] = newStatusScheduleTime.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const recurrenceInterval = Number(statusRecurrenceInterval);

    if (!newStatusScheduleDate || newStatusScheduleDate.length !== 10) {
      toast.error("Informe a data no formato DD/MM/AAAA");
      return;
    }
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      toast.error("Horario invalido");
      return;
    }
    if (!newStatusScheduleTimezone.trim()) {
      toast.error("Informe uma timezone valida");
      return;
    }
    if (statusRecurrenceEnabled && (!Number.isInteger(recurrenceInterval) || recurrenceInterval <= 0)) {
      toast.error("Informe um intervalo de recorrencia valido");
      return;
    }

    setAddingStatusSchedule(true);
    try {
      const response = await fetch("/api/meta/campaign-status-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: itemId,
          clientId,
          adAccountId,
          targetStatus: newStatusTarget,
          scheduledDate: newStatusScheduleDate,
          hour,
          minute,
          timeZone: newStatusScheduleTimezone.trim(),
          recurrenceType: statusRecurrenceEnabled ? statusRecurrenceType : "none",
          recurrenceInterval: statusRecurrenceEnabled ? recurrenceInterval : 1,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Falha ao criar agendamento");
        return;
      }

      toast.success("Agendamento de status criado");
      setStatusSchedules((prev) => sortByNextRun([data.schedule as CampaignStatusSchedule, ...prev]));
    } catch (error) {
      console.error("Erro ao criar agendamento de status:", error);
      toast.error("Erro ao criar agendamento de status");
    } finally {
      setAddingStatusSchedule(false);
    }
  };

  const handleToggleStatusSchedule = async (schedule: CampaignStatusSchedule) => {
    setUpdatingStatusScheduleId(schedule.id);
    try {
      const response = await fetch(`/api/meta/campaign-status-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !schedule.is_active }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Falha ao atualizar agendamento");
        return;
      }

      setStatusSchedules((prev) =>
        sortByNextRun(prev.map((item) => (item.id === schedule.id ? data.schedule : item)))
      );
      toast.success(data.schedule?.is_active ? "Agendamento ativado" : "Agendamento desativado");
    } catch (error) {
      console.error("Erro ao atualizar agendamento de status:", error);
      toast.error("Erro ao atualizar agendamento de status");
    } finally {
      setUpdatingStatusScheduleId(null);
    }
  };

  const handleDeleteStatusSchedule = async (scheduleId: string) => {
    setUpdatingStatusScheduleId(scheduleId);
    try {
      const response = await fetch(`/api/meta/campaign-status-schedules/${scheduleId}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Falha ao remover agendamento");
        return;
      }

      setStatusSchedules((prev) => prev.filter((item) => item.id !== scheduleId));
      toast.success("Agendamento removido");
    } catch (error) {
      console.error("Erro ao remover agendamento de status:", error);
      toast.error("Erro ao remover agendamento de status");
    } finally {
      setUpdatingStatusScheduleId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Editar Orcamento {itemType === "campaign" ? "da Campanha" : "do Conjunto"}
          </DialogTitle>
          <DialogDescription>{itemName}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="daily_budget">Orcamento Diario (R$)</Label>
            <Input id="daily_budget" type="number" step="0.01" min="0" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} disabled={isLoading} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lifetime_budget">Orcamento Total (R$)</Label>
            <Input id="lifetime_budget" type="number" step="0.01" min="0" value={lifetimeBudget} onChange={(e) => setLifetimeBudget(e.target.value)} disabled={isLoading} />
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <p className="font-medium">Agendamento de mudanca de orcamento</p>
              <p className="text-sm text-muted-foreground">Data no formato DD/MM/AAAA com recorrencia opcional.</p>
            </div>

            {!isCampaign || !canManageSchedules ? (
              <p className="text-sm text-amber-700">Para agendar, e necessario estar em campanha com clientId e adAccountId.</p>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Data (DD/MM/AAAA)</Label>
                    <Input value={newBudgetScheduleDate} onChange={(event) => setNewBudgetScheduleDate(maskBrDate(event.target.value))} placeholder="11/02/2026" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Horario</Label>
                    <Input type="time" value={newBudgetScheduleTime} onChange={(event) => setNewBudgetScheduleTime(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Orcamento diario (R$)</Label>
                    <Input type="number" min="0.01" step="0.01" value={newBudgetScheduleBudget} onChange={(event) => setNewBudgetScheduleBudget(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Timezone</Label>
                    <Input value={newBudgetScheduleTimezone} onChange={(event) => setNewBudgetScheduleTimezone(event.target.value)} placeholder="America/Sao_Paulo" />
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="budget-recurrence-switch">Ativar recorrencia</Label>
                    <Switch id="budget-recurrence-switch" checked={budgetRecurrenceEnabled} onCheckedChange={setBudgetRecurrenceEnabled} />
                  </div>
                  {budgetRecurrenceEnabled ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Repeticao</Label>
                        <Select value={budgetRecurrenceType} onValueChange={(value) => setBudgetRecurrenceType(value as "daily" | "weekly" | "monthly")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RECURRENCE_OPTIONS.filter((option) => option.value !== "none").map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Intervalo</Label>
                        <Input type="number" min="1" step="1" value={budgetRecurrenceInterval} onChange={(event) => setBudgetRecurrenceInterval(event.target.value)} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <Button type="button" variant="secondary" onClick={handleCreateBudgetSchedule} disabled={addingBudgetSchedule}>
                    {addingBudgetSchedule ? "Adicionando..." : "Adicionar agendamento de orcamento"}
                  </Button>
                </div>
              </>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Agendamentos de orcamento</p>
              {loadingBudgetSchedules ? (
                <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>
              ) : budgetSchedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum agendamento criado.</p>
              ) : (
                <div className="space-y-2">
                  {budgetSchedules.map((schedule) => (
                    <div key={schedule.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{getScheduleDateLabel(schedule.scheduled_date, schedule.day_of_week)}</Badge>
                        <Badge variant="outline">{formatScheduleTime(schedule.hour, schedule.minute)}</Badge>
                        <Badge>{formatBudget(schedule.daily_budget)}</Badge>
                        <Badge variant="outline">{getRecurrenceLabel(schedule.recurrence_type, schedule.recurrence_interval)}</Badge>
                        <Badge variant={schedule.is_active ? "default" : "secondary"}>{schedule.is_active ? "Ativo" : "Inativo"}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Timezone: {schedule.timezone} | Proximo disparo: {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString("pt-BR") : "-"}</p>
                      {schedule.last_error ? <p className="text-xs text-red-600 mt-1">Ultimo erro: {schedule.last_error}</p> : null}
                      <div className="mt-2 flex gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={updatingBudgetScheduleId === schedule.id} onClick={() => handleToggleBudgetSchedule(schedule)}>
                          {updatingBudgetScheduleId === schedule.id ? "Atualizando..." : schedule.is_active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button type="button" size="sm" variant="destructive" disabled={updatingBudgetScheduleId === schedule.id} onClick={() => handleDeleteBudgetSchedule(schedule.id)}>
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isCampaign ? (
            <div className="rounded-lg border p-4 space-y-4">
              <div>
                <p className="font-medium">Liga/desliga campanha agendado</p>
                <p className="text-sm text-muted-foreground">Com data/hora e recorrencia opcional.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Acao</Label>
                  <Select value={newStatusTarget} onValueChange={(value) => setNewStatusTarget(value as "ACTIVE" | "PAUSED")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Ativar campanha</SelectItem>
                      <SelectItem value="PAUSED">Pausar campanha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Data (DD/MM/AAAA)</Label>
                  <Input value={newStatusScheduleDate} onChange={(event) => setNewStatusScheduleDate(maskBrDate(event.target.value))} placeholder="11/02/2026" />
                </div>
                <div className="grid gap-2">
                  <Label>Horario</Label>
                  <Input type="time" value={newStatusScheduleTime} onChange={(event) => setNewStatusScheduleTime(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Timezone</Label>
                  <Input value={newStatusScheduleTimezone} onChange={(event) => setNewStatusScheduleTimezone(event.target.value)} placeholder="America/Sao_Paulo" />
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="status-recurrence-switch">Ativar recorrencia</Label>
                  <Switch id="status-recurrence-switch" checked={statusRecurrenceEnabled} onCheckedChange={setStatusRecurrenceEnabled} />
                </div>
                {statusRecurrenceEnabled ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Repeticao</Label>
                      <Select value={statusRecurrenceType} onValueChange={(value) => setStatusRecurrenceType(value as "daily" | "weekly" | "monthly")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RECURRENCE_OPTIONS.filter((option) => option.value !== "none").map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Intervalo</Label>
                      <Input type="number" min="1" step="1" value={statusRecurrenceInterval} onChange={(event) => setStatusRecurrenceInterval(event.target.value)} />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={handleCreateStatusSchedule} disabled={addingStatusSchedule}>
                  {addingStatusSchedule ? "Adicionando..." : "Adicionar agendamento de status"}
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Agendamentos de status</p>
                {loadingStatusSchedules ? (
                  <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>
                ) : statusSchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum agendamento criado.</p>
                ) : (
                  <div className="space-y-2">
                    {statusSchedules.map((schedule) => (
                      <div key={schedule.id} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={schedule.target_status === "ACTIVE" ? "default" : "secondary"}>{schedule.target_status === "ACTIVE" ? "Ativar" : "Pausar"}</Badge>
                          <Badge variant="outline">{getScheduleDateLabel(schedule.scheduled_date, null)}</Badge>
                          <Badge variant="outline">{formatScheduleTime(schedule.hour, schedule.minute)}</Badge>
                          <Badge variant="outline">{getRecurrenceLabel(schedule.recurrence_type, schedule.recurrence_interval)}</Badge>
                          <Badge variant={schedule.is_active ? "default" : "secondary"}>{schedule.is_active ? "Ativo" : "Inativo"}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Timezone: {schedule.timezone} | Proximo disparo: {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString("pt-BR") : "-"}</p>
                        {schedule.last_error ? <p className="text-xs text-red-600 mt-1">Ultimo erro: {schedule.last_error}</p> : null}
                        <div className="mt-2 flex gap-2">
                          <Button type="button" size="sm" variant="outline" disabled={updatingStatusScheduleId === schedule.id} onClick={() => handleToggleStatusSchedule(schedule)}>
                            {updatingStatusScheduleId === schedule.id ? "Atualizando..." : schedule.is_active ? "Desativar" : "Ativar"}
                          </Button>
                          <Button type="button" size="sm" variant="destructive" disabled={updatingStatusScheduleId === schedule.id} onClick={() => handleDeleteStatusSchedule(schedule.id)}>
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar Alteracoes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
