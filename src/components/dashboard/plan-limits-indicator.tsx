'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Users, 
  Target, 
  Database, 
  Crown, 
  AlertCircle,
  TrendingUp,
  Calendar
} from "lucide-react";
import Link from "next/link";

interface PlanLimits {
  max_clients: number;
  max_campaigns_per_client: number;
  data_retention_days: number;
  sync_interval_hours: number;
  allow_csv_export: boolean;
  allow_json_export: boolean;
}

interface UsageStats {
  current_clients: number;
  current_campaigns: number;
  oldest_data_days: number;
}

interface PlanLimitsIndicatorProps {
  compact?: boolean;
  showUpgradePrompt?: boolean;
}

export function PlanLimitsIndicator({ 
  compact = false, 
  showUpgradePrompt = true 
}: PlanLimitsIndicatorProps) {
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLimitsAndUsage();
  }, []);

  const fetchLimitsAndUsage = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch plan limits and usage in parallel
      const [limitsRes, usageRes] = await Promise.all([
        fetch('/api/feature-gate/limits-summary'),
        fetch('/api/feature-gate/statistics')
      ]);

      if (!limitsRes.ok || !usageRes.ok) {
        throw new Error('Failed to fetch plan limits');
      }

      const limitsData = await limitsRes.json();
      const usageData = await usageRes.json();

      setLimits(limitsData.limits);
      setUsage({
        current_clients: usageData.clients_count || 0,
        current_campaigns: usageData.campaigns_count || 0,
        oldest_data_days: usageData.oldest_data_days || 0
      });
    } catch (err) {
      console.error('Error fetching plan limits:', err);
      setError('Não foi possível carregar os limites do plano');
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (current: number, max: number): number => {
    if (max === -1) return 0; // Unlimited
    return Math.min((current / max) * 100, 100);
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    return 'text-green-600';
  };

  const getProgressColorClass = (percentage: number): string => {
    if (percentage >= 90) return '[&>div]:bg-red-600';
    if (percentage >= 75) return '[&>div]:bg-orange-600';
    return '[&>div]:bg-green-600';
  };

  const formatLimit = (limit: number): string => {
    return limit === -1 ? 'Ilimitado' : limit.toString();
  };

  const isNearLimit = (current: number, max: number): boolean => {
    if (max === -1) return false;
    return (current / max) >= 0.75;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Limites do Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Carregando limites...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !limits || !usage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Limites do Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-red-600">
            {error || 'Erro ao carregar limites'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const clientsPercentage = getUsagePercentage(usage.current_clients, limits.max_clients);
  const campaignsPercentage = getUsagePercentage(usage.current_campaigns, limits.max_campaigns_per_client);
  const clientsNearLimit = isNearLimit(usage.current_clients, limits.max_clients);
  const campaignsNearLimit = isNearLimit(usage.current_campaigns, limits.max_campaigns_per_client);

  // Compact version for sidebar or small spaces
  if (compact) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Clientes
              </span>
              <span className={getUsageColor(clientsPercentage)}>
                {usage.current_clients} / {formatLimit(limits.max_clients)}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Campanhas
              </span>
              <span className={getUsageColor(campaignsPercentage)}>
                {usage.current_campaigns} / {formatLimit(limits.max_campaigns_per_client)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Retenção
              </span>
              <span className="text-muted-foreground">
                {limits.data_retention_days} dias
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full version for dashboard
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-blue-600" />
          Limites do Plano
        </CardTitle>
        <CardDescription>
          Acompanhe o uso dos recursos do seu plano atual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Clients Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Clientes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${getUsageColor(clientsPercentage)}`}>
                {usage.current_clients} / {formatLimit(limits.max_clients)}
              </span>
              {clientsNearLimit && (
                <AlertCircle className="w-4 h-4 text-orange-600" />
              )}
            </div>
          </div>
          {limits.max_clients !== -1 && (
            <Progress 
              value={clientsPercentage} 
              className={cn("h-2", getProgressColorClass(clientsPercentage))}
            />
          )}
          {limits.max_clients === -1 && (
            <Badge variant="secondary" className="w-full justify-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              Ilimitado
            </Badge>
          )}
        </div>

        {/* Campaigns Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Campanhas por Cliente</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${getUsageColor(campaignsPercentage)}`}>
                {usage.current_campaigns} / {formatLimit(limits.max_campaigns_per_client)}
              </span>
              {campaignsNearLimit && (
                <AlertCircle className="w-4 h-4 text-orange-600" />
              )}
            </div>
          </div>
          {limits.max_campaigns_per_client !== -1 && (
            <Progress 
              value={campaignsPercentage} 
              className={cn("h-2", getProgressColorClass(campaignsPercentage))}
            />
          )}
          {limits.max_campaigns_per_client === -1 && (
            <Badge variant="secondary" className="w-full justify-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              Ilimitado
            </Badge>
          )}
        </div>

        {/* Data Retention */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Retenção de Dados</span>
            </div>
            <span className="text-sm font-semibold text-blue-600">
              {limits.data_retention_days} dias
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Dados históricos disponíveis por até {limits.data_retention_days} dias
          </div>
        </div>

        {/* Sync Interval */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sincronização</span>
            </div>
            <span className="text-sm font-semibold text-blue-600">
              A cada {limits.sync_interval_hours}h
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Dados sincronizados automaticamente
          </div>
        </div>

        {/* Export Permissions */}
        <div className="space-y-2">
          <div className="text-sm font-medium mb-2">Exportação de Dados</div>
          <div className="flex gap-2">
            <Badge variant={limits.allow_csv_export ? "default" : "secondary"}>
              CSV {limits.allow_csv_export ? '✓' : '✗'}
            </Badge>
            <Badge variant={limits.allow_json_export ? "default" : "secondary"}>
              JSON {limits.allow_json_export ? '✓' : '✗'}
            </Badge>
          </div>
        </div>

        {/* Upgrade Prompt */}
        {showUpgradePrompt && (clientsNearLimit || campaignsNearLimit) && (
          <div className="pt-4 border-t">
            <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">
                    Você está próximo do limite
                  </h4>
                  <p className="text-xs text-gray-600 mb-3">
                    Faça upgrade para aumentar seus limites e desbloquear mais recursos
                  </p>
                  <Button asChild size="sm" className="w-full">
                    <Link href="/dashboard/billing">
                      <Crown className="w-4 h-4 mr-2" />
                      Ver Planos
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
