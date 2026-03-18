'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface SubscriptionAnalytics {
  mrr: number;
  arr: number;
  active_subscriptions: number;
  total_subscriptions: number;
  churn_rate: number;
  conversion_rate: number;
  period_revenue: number;
  customer_lifetime_value: number;
  status_breakdown: Record<string, number>;
  plan_distribution: Record<string, number>;
  billing_cycle_distribution: Record<string, number>;
  recent_subscriptions: Array<{
    id: string;
    organization_name: string;
    plan_name: string;
    status: string;
    billing_cycle: string;
    created_at: string;
  }>;
  period_days: number;
  period_start: string;
  period_end: string;
  generated_at: string;
}

export default function AdminSubscriptionsPage() {
  const [analytics, setAnalytics] = useState<SubscriptionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/subscriptions/analytics?period=${period}`);
      
      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }
      
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500',
      past_due: 'bg-yellow-500',
      canceled: 'bg-red-500',
      trialing: 'bg-blue-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Erro ao carregar analytics</p>
          <Button onClick={loadAnalytics} className="mt-4">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions Analytics</h1>
          <p className="text-muted-foreground">
            Visão geral das assinaturas e receita
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={period === '7' ? 'default' : 'outline'}
            onClick={() => setPeriod('7')}
          >
            7 dias
          </Button>
          <Button
            variant={period === '30' ? 'default' : 'outline'}
            onClick={() => setPeriod('30')}
          >
            30 dias
          </Button>
          <Button
            variant={period === '90' ? 'default' : 'outline'}
            onClick={() => setPeriod('90')}
          >
            90 dias
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.mrr)}</div>
            <p className="text-xs text-muted-foreground">
              Receita Recorrente Mensal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.arr)}</div>
            <p className="text-xs text-muted-foreground">
              Receita Recorrente Anual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.active_subscriptions}</div>
            <p className="text-xs text-muted-foreground">
              de {analytics.total_subscriptions} totais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Churn</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.churn_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Cancelamentos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="recent">Recentes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Status das Assinaturas</CardTitle>
                <CardDescription>Distribuição por status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(analytics.status_breakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                        <span className="capitalize">{status}</span>
                      </div>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ciclo de Cobrança</CardTitle>
                <CardDescription>Distribuição mensal vs anual</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(analytics.billing_cycle_distribution).map(([cycle, count]) => (
                    <div key={cycle} className="flex items-center justify-between">
                      <span className="capitalize">{cycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Métricas Adicionais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Receita no Período</p>
                  <p className="text-2xl font-bold">{formatCurrency(analytics.period_revenue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  <p className="text-2xl font-bold">{analytics.conversion_rate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CLV Médio</p>
                  <p className="text-2xl font-bold">{formatCurrency(analytics.customer_lifetime_value)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Plano</CardTitle>
              <CardDescription>Assinaturas ativas por plano</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analytics.plan_distribution).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-semibold">{plan}</p>
                      <p className="text-sm text-muted-foreground">{count} assinaturas</p>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assinaturas Recentes</CardTitle>
              <CardDescription>Últimas 10 assinaturas criadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.recent_subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-semibold">{sub.organization_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{sub.plan_name}</span>
                        <span>•</span>
                        <span className="capitalize">{sub.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                        <span>•</span>
                        <Calendar className="h-3 w-3 inline" />
                        <span>{formatDate(sub.created_at)}</span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(sub.status)}>
                      {sub.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
