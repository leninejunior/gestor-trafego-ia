'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Users, Save, Download } from 'lucide-react';
import { PlanLimits, UpdatePlanLimits, formatLimit } from '@/lib/types/plan-limits';

interface PlanLimitsFormProps {
  limits: Partial<PlanLimits>;
  onChange: (limits: Partial<PlanLimits>) => void;
  errors?: Record<string, string>;
}

/**
 * Componente de formulário para configuração de limites de plano
 * Implementa requisitos 11.1, 11.2, 11.3, 11.4
 */
export function PlanLimitsForm({ limits, onChange, errors = {} }: PlanLimitsFormProps) {
  const updateField = <K extends keyof PlanLimits>(field: K, value: PlanLimits[K]) => {
    onChange({
      ...limits,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Configure os limites de recursos, cache e exportação para este plano. 
          Use -1 para recursos ilimitados.
        </AlertDescription>
      </Alert>

      {/* Seção: Limites de Recursos */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <CardTitle>Limites de Recursos</CardTitle>
          </div>
          <CardDescription>
            Defina quantos clientes e campanhas os usuários podem gerenciar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Max Clients */}
          <div className="space-y-2">
            <Label htmlFor="max_clients">
              Máximo de Clientes
              <span className="text-sm text-gray-500 ml-2">(-1 = ilimitado)</span>
            </Label>
            <Input
              id="max_clients"
              type="number"
              value={limits.max_clients ?? 5}
              onChange={(e) => updateField('max_clients', parseInt(e.target.value) || 0)}
              min={-1}
              className={errors.max_clients ? 'border-red-500' : ''}
            />
            {errors.max_clients && (
              <p className="text-sm text-red-600">{errors.max_clients}</p>
            )}
            <p className="text-sm text-gray-500">
              Atual: {formatLimit(limits.max_clients ?? 5, 'clientes')}
            </p>
          </div>

          {/* Max Campaigns Per Client */}
          <div className="space-y-2">
            <Label htmlFor="max_campaigns_per_client">
              Máximo de Campanhas por Cliente
              <span className="text-sm text-gray-500 ml-2">(-1 = ilimitado)</span>
            </Label>
            <Input
              id="max_campaigns_per_client"
              type="number"
              value={limits.max_campaigns_per_client ?? 25}
              onChange={(e) => updateField('max_campaigns_per_client', parseInt(e.target.value) || 0)}
              min={-1}
              className={errors.max_campaigns_per_client ? 'border-red-500' : ''}
            />
            {errors.max_campaigns_per_client && (
              <p className="text-sm text-red-600">{errors.max_campaigns_per_client}</p>
            )}
            <p className="text-sm text-gray-500">
              Atual: {formatLimit(limits.max_campaigns_per_client ?? 25, 'campanhas')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Seção: Cache e Sincronização */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Save className="h-5 w-5 text-green-600" />
            <CardTitle>Cache e Sincronização</CardTitle>
          </div>
          <CardDescription>
            Configure retenção de dados históricos e frequência de sincronização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Retention Days */}
          <div className="space-y-2">
            <Label htmlFor="data_retention_days">
              Período de Retenção de Dados (dias)
              <span className="text-sm text-gray-500 ml-2">(30-3650 dias)</span>
            </Label>
            <Input
              id="data_retention_days"
              type="number"
              value={limits.data_retention_days ?? 90}
              onChange={(e) => updateField('data_retention_days', parseInt(e.target.value) || 90)}
              min={30}
              max={3650}
              className={errors.data_retention_days ? 'border-red-500' : ''}
            />
            {errors.data_retention_days && (
              <p className="text-sm text-red-600">{errors.data_retention_days}</p>
            )}
            <p className="text-sm text-gray-500">
              Dados históricos serão mantidos por {limits.data_retention_days ?? 90} dias
            </p>
          </div>

          {/* Sync Interval Hours */}
          <div className="space-y-2">
            <Label htmlFor="sync_interval_hours">
              Intervalo de Sincronização (horas)
              <span className="text-sm text-gray-500 ml-2">(1-168 horas)</span>
            </Label>
            <Input
              id="sync_interval_hours"
              type="number"
              value={limits.sync_interval_hours ?? 24}
              onChange={(e) => updateField('sync_interval_hours', parseInt(e.target.value) || 24)}
              min={1}
              max={168}
              className={errors.sync_interval_hours ? 'border-red-500' : ''}
            />
            {errors.sync_interval_hours && (
              <p className="text-sm text-red-600">{errors.sync_interval_hours}</p>
            )}
            <p className="text-sm text-gray-500">
              Dados serão sincronizados a cada {limits.sync_interval_hours ?? 24} horas
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Seção: Exportação */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Download className="h-5 w-5 text-purple-600" />
            <CardTitle>Exportação</CardTitle>
          </div>
          <CardDescription>
            Habilite ou desabilite recursos de exportação de dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Allow CSV Export */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow_csv_export">Permitir Exportação CSV</Label>
              <p className="text-sm text-gray-500">
                Usuários podem exportar dados em formato CSV
              </p>
            </div>
            <Switch
              id="allow_csv_export"
              checked={limits.allow_csv_export ?? false}
              onCheckedChange={(checked) => updateField('allow_csv_export', checked)}
            />
          </div>

          {/* Allow JSON Export */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow_json_export">Permitir Exportação JSON</Label>
              <p className="text-sm text-gray-500">
                Usuários podem exportar dados em formato JSON
              </p>
            </div>
            <Switch
              id="allow_json_export"
              checked={limits.allow_json_export ?? false}
              onCheckedChange={(checked) => updateField('allow_json_export', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
