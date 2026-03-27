# Google Ads API v22 - Exemplos PrÃ¡ticos

## ðŸŽ¯ Exemplos de Uso

Este documento contÃ©m exemplos prÃ¡ticos de como usar a integraÃ§Ã£o Google Ads API v22.

## 1. Conectar Conta Google Ads

### Frontend (React)

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ConnectGoogleButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/google/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      const { authUrl } = await response.json();
      
      // Redirecionar para Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Erro ao conectar:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} disabled={loading}>
      {loading ? 'Conectando...' : 'Conectar Google Ads'}
    </Button>
  );
}
```

## 2. Listar e Selecionar Contas

### Frontend (React)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

interface GoogleAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
}

export function SelectGoogleAccounts({ clientId }: { clientId: string }) {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, [clientId]);

  const loadAccounts = async () => {
    try {
      const response = await fetch(`/api/google/accounts?clientId=${clientId}`);
      const data = await response.json();
      setAccounts(data);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await fetch('/api/google/accounts/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          selectedAccounts: selected,
        }),
      });
      
      alert('Contas salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <div key={account.customerId} className="flex items-center space-x-2">
          <Checkbox
            checked={selected.includes(account.customerId)}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelected([...selected, account.customerId]);
              } else {
                setSelected(selected.filter(id => id !== account.customerId));
              }
            }}
          />
          <div>
            <p className="font-medium">{account.descriptiveName}</p>
            <p className="text-sm text-gray-500">
              ID: {account.customerId} | {account.currencyCode}
            </p>
          </div>
        </div>
      ))}
      
      <Button onClick={handleSave} disabled={selected.length === 0}>
        Salvar SeleÃ§Ã£o
      </Button>
    </div>
  );
}
```

## 3. Sincronizar Campanhas

### Frontend (React)

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function SyncButton({ clientId }: { clientId: string }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    try {
      setSyncing(true);
      
      const response = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      const result = await response.json();
      
      alert(`Sincronizado: ${result.campaignsSynced} campanhas`);
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button onClick={handleSync} disabled={syncing}>
      <RefreshCw className={syncing ? 'animate-spin' : ''} />
      {syncing ? 'Sincronizando...' : 'Sincronizar'}
    </Button>
  );
}
```

## 4. Exibir Campanhas

### Frontend (React)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
  };
}

export function CampaignsList({ clientId }: { clientId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, [clientId]);

  const loadCampaigns = async () => {
    try {
      const response = await fetch(
        `/api/google/campaigns?clientId=${clientId}&startDate=2024-01-01&endDate=2024-01-31`
      );
      const data = await response.json();
      setCampaigns(data);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Carregando campanhas...</div>;

  return (
    <div className="grid gap-4">
      {campaigns.map((campaign) => (
        <Card key={campaign.id} className="p-4">
          <h3 className="font-bold">{campaign.name}</h3>
          <p className="text-sm text-gray-500">Status: {campaign.status}</p>
          <p className="text-sm">OrÃ§amento: R$ {campaign.budget.toFixed(2)}</p>
          
          <div className="mt-4 grid grid-cols-4 gap-2">
            <div>
              <p className="text-xs text-gray-500">ImpressÃµes</p>
              <p className="font-bold">{campaign.metrics.impressions.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cliques</p>
              <p className="font-bold">{campaign.metrics.clicks.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Custo</p>
              <p className="font-bold">R$ {campaign.metrics.cost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ConversÃµes</p>
              <p className="font-bold">{campaign.metrics.conversions}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

## 5. Usar o Client Diretamente

### Backend (API Route)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAdsClient } from '@/lib/google/client';
import { getGoogleTokenManager } from '@/lib/google/token-manager';

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    
    // Obter token vÃ¡lido
    const tokenManager = getGoogleTokenManager();
    const { accessToken, customerId, connectionId } = 
      await tokenManager.ensureValidTokenForClient(clientId!);
    
    // Criar client
    const client = getGoogleAdsClient({
      accessToken,
      refreshToken: '', // NÃ£o necessÃ¡rio com connectionId
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      customerId,
      connectionId, // Importante: habilita refresh automÃ¡tico
    });
    
    // Buscar campanhas
    const campaigns = await client.getCampaigns({
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });
    
    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar campanhas' },
      { status: 500 }
    );
  }
}
```

## 6. Query GAQL Customizada

### Backend (API Route)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAdsClient } from '@/lib/google/client';

export async function POST(request: NextRequest) {
  try {
    const { clientId, query } = await request.json();
    
    // Setup client (mesmo processo anterior)
    const client = getGoogleAdsClient({...});
    
    // Query customizada
    const gaqlQuery = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM ad_group
      WHERE ad_group.status = 'ENABLED'
        AND segments.date BETWEEN '2024-01-01' AND '2024-01-31'
      ORDER BY metrics.impressions DESC
      LIMIT 100
    `;
    
    const response = await client.makeRequest(
      `customers/${client.config.customerId}/googleAds:search`,
      'POST',
      { query: gaqlQuery }
    );
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Falha na query' },
      { status: 500 }
    );
  }
}
```

## 7. Monitorar Status da ConexÃ£o

### Frontend (React)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

export function ConnectionStatus({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<'connected' | 'expired' | 'disconnected'>('disconnected');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [clientId]);

  const checkStatus = async () => {
    try {
      const response = await fetch(
        `/api/google/debug-oauth-status?clientId=${clientId}`
      );
      const data = await response.json();
      
      setStatus(data.status);
      setExpiresAt(data.expiresAt);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={status === 'connected' ? 'success' : 'destructive'}>
        {status === 'connected' ? 'Conectado' : 'Desconectado'}
      </Badge>
      {expiresAt && (
        <span className="text-sm text-gray-500">
          Expira em: {new Date(expiresAt).toLocaleString()}
        </span>
      )}
    </div>
  );
}
```

## 8. Tratamento de Erros

### Backend (API Route)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsErrorHandler } from '@/lib/google/error-handler';

export async function GET(request: NextRequest) {
  const errorHandler = new GoogleAdsErrorHandler();
  
  try {
    // Sua lÃ³gica aqui
    const result = await someGoogleAdsOperation();
    return NextResponse.json(result);
    
  } catch (error) {
    const handled = errorHandler.handleError(error);
    
    // Log do erro
    console.error('[Google Ads API]', {
      message: handled.message,
      code: handled.code,
      isRetryable: handled.isRetryable,
    });
    
    // Resposta apropriada
    if (handled.code === 401) {
      return NextResponse.json(
        { error: 'Token expirado. Por favor, reconecte sua conta.' },
        { status: 401 }
      );
    }
    
    if (handled.code === 403) {
      return NextResponse.json(
        { error: 'Sem permissÃ£o. Verifique suas credenciais.' },
        { status: 403 }
      );
    }
    
    if (handled.isRetryable) {
      return NextResponse.json(
        { error: 'Erro temporÃ¡rio. Tente novamente em alguns instantes.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: handled.message },
      { status: 500 }
    );
  }
}
```

## 9. Cron Job de SincronizaÃ§Ã£o

### API Route (Cron)

```typescript
// src/app/api/cron/google-sync/route.ts
import { NextResponse } from 'next/server';
import { getGoogleAdsSyncService } from '@/lib/google/sync-service';

export async function GET(request: Request) {
  // Verificar autorizaÃ§Ã£o (plataforma de deploy Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const syncService = getGoogleAdsSyncService();
    
    // Sincronizar todos os clientes ativos
    const result = await syncService.syncAllActiveClients();
    
    return NextResponse.json({
      success: true,
      clientsSynced: result.successful.length,
      clientsFailed: result.failed.length,
      details: result,
    });
  } catch (error) {
    console.error('[Cron] Erro na sincronizaÃ§Ã£o:', error);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}
```

### ConfiguraÃ§Ã£o plataforma de deploy (deploy.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/google-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## 10. Dashboard Completo

### Page Component

```typescript
// src/app/dashboard/google/page.tsx
'use client';

import { useState } from 'react';
import { ConnectGoogleButton } from '@/components/google/connect-button';
import { ConnectionStatus } from '@/components/google/connection-status';
import { CampaignsList } from '@/components/google/campaigns-list';
import { SyncButton } from '@/components/google/sync-button';

export default function GoogleAdsDashboard() {
  const [clientId] = useState('uuid-do-cliente'); // Obter do contexto

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Google Ads</h1>
        <div className="flex gap-2">
          <ConnectionStatus clientId={clientId} />
          <SyncButton clientId={clientId} />
          <ConnectGoogleButton clientId={clientId} />
        </div>
      </div>
      
      <CampaignsList clientId={clientId} />
    </div>
  );
}
```

---

**VersÃ£o:** v22  
**Ãšltima atualizaÃ§Ã£o:** 2024-01-20

