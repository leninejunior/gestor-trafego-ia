'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, 
  Plus, 
  CheckCircle, 
  Clock,
  TrendingUp
} from 'lucide-react';
import { PaymentProvider } from '@/lib/types/payments';

export function PaymentProviders() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payments/providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers);
      }
    } catch (error) {
      console.error('Erro ao carregar provedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProvider = async (providerId: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/payments/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: providerId,
          is_active: isActive
        })
      });

      if (response.ok) {
        fetchProviders();
      }
    } catch (error) {
      console.error('Erro ao atualizar provedor:', error);
    }
  };

  const getProviderIcon = (name: string) => {
    const icons = {
      stripe: '💳',
      iugu: '🏦',
      pagseguro: '🛡️',
      mercadopago: '💰'
    };
    return icons[name as keyof typeof icons] || '💳';
  };

  const getHealthStatus = (provider: PaymentProvider) => {
    if (!provider.is_active) {
      return { status: 'inactive', color: 'text-muted-foreground', icon: Clock };
    }
    
    if (provider.success_rate >= 95) {
      return { status: 'healthy', color: 'text-green-500 dark:text-green-400', icon: CheckCircle };
    } else if (provider.success_rate >= 85) {
      return { status: 'warning', color: 'text-yellow-500 dark:text-yellow-400', icon: CheckCircle };
    } else {
      return { status: 'error', color: 'text-red-500 dark:text-red-400', icon: CheckCircle };
    }
  };

  const openConfigDialog = (provider?: PaymentProvider) => {
    setSelectedProvider(provider || null);
    setConfigDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded animate-pulse"></div>
                <div className="h-4 bg-muted rounded animate-pulse w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const availableProviders = [
    { name: 'stripe', display_name: 'Stripe', description: 'Pagamentos internacionais com cartão' },
    { name: 'iugu', display_name: 'Iugu', description: 'Cartões e boletos no Brasil' },
    { name: 'pagseguro', display_name: 'PagSeguro', description: 'PIX, cartões e boletos' },
    { name: 'mercadopago', display_name: 'Mercado Pago', description: 'Pagamentos na América Latina' }
  ];

  const configuredProviders = providers.map(p => p.name);
  const unconfiguredProviders = availableProviders.filter(p => !configuredProviders.includes(p.name as any));

  return (
    <div className="space-y-6">
      {/* Provedores Configurados */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Provedores Configurados</h3>
          <Button onClick={() => openConfigDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Provedor
          </Button>
        </div>

        {providers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground mb-4">
                <Settings className="mx-auto h-12 w-12 mb-2" />
                <p>Nenhum provedor configurado</p>
                <p className="text-sm">Configure um provedor para começar a processar pagamentos</p>
              </div>
              <Button onClick={() => openConfigDialog()}>
                Configurar Primeiro Provedor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => {
              const health = getHealthStatus(provider);
              const HealthIcon = health.icon;

              return (
                <Card key={provider.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">
                          {getProviderIcon(provider.name)}
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {provider.display_name}
                          </CardTitle>
                          <CardDescription>
                            Prioridade: {provider.priority}
                          </CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={provider.is_active}
                        onCheckedChange={(checked) => toggleProvider(provider.id, checked)}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Status de Saúde */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <HealthIcon className={`h-4 w-4 ${health.color}`} />
                        <span className="text-sm font-medium">
                          {health.status === 'healthy' ? 'Saudável' :
                           health.status === 'warning' ? 'Atenção' :
                           health.status === 'error' ? 'Problema' : 'Inativo'}
                        </span>
                      </div>
                      <Badge variant={provider.is_sandbox ? 'secondary' : 'default'}>
                        {provider.is_sandbox ? 'Sandbox' : 'Produção'}
                      </Badge>
                    </div>

                    {/* Métricas */}
                    {provider.is_active && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Taxa de Sucesso</div>
                          <div className="font-semibold">
                            {provider.success_rate.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Tempo Médio</div>
                          <div className="font-semibold">
                            {provider.avg_response_time > 0 
                              ? `${(provider.avg_response_time / 1000).toFixed(1)}s`
                              : '< 1s'
                            }
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Última Verificação */}
                    <div className="text-xs text-muted-foreground">
                      Última verificação: {new Date(provider.last_health_check).toLocaleString('pt-BR')}
                    </div>

                    {/* Ações */}
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openConfigDialog(provider)}
                      >
                        <Settings className="mr-2 h-3 w-3" />
                        Configurar
                      </Button>
                      <Button variant="outline" size="sm">
                        <TrendingUp className="mr-2 h-3 w-3" />
                        Métricas
                      </Button>
                    </div>
                  </CardContent>

                  {/* Indicador de Prioridade */}
                  {provider.priority === 1 && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="default" className="text-xs">
                        Principal
                      </Badge>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Provedores Disponíveis */}
      {unconfiguredProviders.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Provedores Disponíveis</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {unconfiguredProviders.map((provider) => (
              <Card key={provider.name} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl mb-2">
                    {getProviderIcon(provider.name)}
                  </div>
                  <h4 className="font-semibold mb-1">{provider.display_name}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{provider.description}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => openConfigDialog({
                      id: '',
                      org_id: '',
                      name: provider.name as any,
                      display_name: provider.display_name,
                      is_active: false,
                      is_sandbox: true,
                      priority: providers.length + 1,
                      config: {},
                      success_rate: 100,
                      avg_response_time: 0,
                      last_health_check: new Date().toISOString(),
                      created_at: '',
                      updated_at: ''
                    })}
                  >
                    Configurar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialog de Configuração - TODO: Implementar */}
    </div>
  );
}