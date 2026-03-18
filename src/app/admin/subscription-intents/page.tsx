/**
 * Página principal do painel administrativo de subscription intents
 * Lista, filtra e permite ações administrativas
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriptionIntentsList } from '@/components/admin/subscription-intents-list';
import SubscriptionIntentAnalytics from '@/components/admin/subscription-intent-analytics';
import { RealTimeMetrics } from '@/components/admin/real-time-metrics';
import { AnalyticsFilters } from '@/components/admin/analytics-filters';
import { TroubleshootingTools } from '@/components/admin/troubleshooting-tools';
import { WebhookLogsViewer } from '@/components/admin/webhook-logs-viewer';
import { CriticalAlertsPanel } from '@/components/admin/critical-alerts-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SubscriptionIntentsAdminPage() {
  const [analyticsFilters, setAnalyticsFilters] = useState({});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Subscription Intents</h1>
          <p className="text-muted-foreground">
            Gerencie intenções de assinatura e resolva problemas de pagamento
          </p>
        </div>
      </div>

      {/* Critical Alerts */}
      <CriticalAlertsPanel />

      {/* Real-time Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Métricas em Tempo Real</h2>
        <RealTimeMetrics />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="intents" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="intents">Subscription Intents</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="intents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Intents</CardTitle>
            </CardHeader>
            <CardContent>
              <SubscriptionIntentsList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsFilters 
            onFiltersChange={setAnalyticsFilters}
            initialFilters={analyticsFilters}
          />
          <SubscriptionIntentAnalytics filters={analyticsFilters} />
        </TabsContent>

        <TabsContent value="troubleshooting" className="space-y-4">
          <TroubleshootingTools />
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <WebhookLogsViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}