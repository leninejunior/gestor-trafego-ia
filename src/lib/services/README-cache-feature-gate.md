# Cache Feature Gate Service

Sistema de validação de limites relacionados ao cache de dados históricos multi-plataforma.

## Visão Geral

O `CacheFeatureGate` é um serviço especializado que valida limites de planos relacionados a:
- Retenção de dados históricos
- Limites de clientes e campanhas
- Permissões de exportação (CSV/JSON)
- Intervalos de sincronização

## Componentes

### 1. CacheFeatureGate Service
**Localização**: `src/lib/services/cache-feature-gate.ts`

Serviço principal que implementa todas as validações de limites de cache.

#### Métodos Principais

##### `checkDataRetention(userId, requestedDays)`
Valida se o usuário pode acessar dados históricos no período solicitado.

```typescript
const result = await cacheGate.checkDataRetention(userId, 180);
// {
//   allowed: false,
//   requestedDays: 180,
//   allowedDays: 90,
//   reason: "Data retention limit exceeded..."
// }
```

##### `checkClientLimit(userId)`
Verifica se o usuário pode adicionar mais clientes.

```typescript
const result = await cacheGate.checkClientLimit(userId);
// {
//   allowed: true,
//   current: 3,
//   limit: 5,
//   remaining: 2,
//   isUnlimited: false
// }
```

##### `checkCampaignLimit(clientId)`
Verifica se um cliente pode adicionar mais campanhas.

```typescript
const result = await cacheGate.checkCampaignLimit(clientId);
// {
//   allowed: false,
//   current: 25,
//   limit: 25,
//   remaining: 0,
//   isUnlimited: false,
//   reason: "Campaign limit reached..."
// }
```

##### `checkExportPermission(userId, format)`
Valida permissão de exportação para CSV ou JSON.

```typescript
const result = await cacheGate.checkExportPermission(userId, 'csv');
// {
//   allowed: true,
//   format: 'csv'
// }
```

##### `getLimitsSummary(userId)`
Retorna resumo completo de todos os limites e uso atual.

```typescript
const summary = await cacheGate.getLimitsSummary(userId);
// {
//   dataRetention: { days: 90, isUnlimited: false },
//   clients: { current: 3, limit: 5, remaining: 2, isUnlimited: false },
//   syncInterval: { hours: 24 },
//   export: { csv: true, json: false }
// }
```

### 2. Cache Feature Gate Middleware
**Localização**: `src/lib/middleware/cache-feature-gate-middleware.ts`

Middleware para proteger rotas de API baseado em limites de cache.

#### Uso Básico

```typescript
import { createCacheFeatureGate } from '@/lib/middleware/cache-feature-gate-middleware';

// Validar retenção de dados
export const GET = createCacheFeatureGate.dataRetention(90)(
  async (request, context) => {
    // Handler protegido
  }
);

// Validar limite de clientes
export const POST = createCacheFeatureGate.clientLimit()(
  async (request, context) => {
    // Handler protegido
  }
);

// Validar exportação CSV
export const GET = createCacheFeatureGate.csvExport()(
  async (request, context) => {
    // Handler protegido
  }
);
```

#### Validações Múltiplas

```typescript
import { withCacheFeatureGate } from '@/lib/middleware/cache-feature-gate-middleware';

export const GET = withCacheFeatureGate({
  checkDataRetention: 180,
  checkClientLimit: true,
  checkExportPermission: 'csv'
})(async (request, context) => {
  // Handler com múltiplas validações
});
```

### 3. API Endpoints

#### GET `/api/feature-gate/data-retention?days=180`
Valida acesso a dados históricos.

**Response:**
```json
{
  "allowed": false,
  "requestedDays": 180,
  "allowedDays": 90,
  "reason": "Data retention limit exceeded...",
  "upgradeRequired": true
}
```

#### GET `/api/feature-gate/client-limit`
Valida limite de clientes.

**Response:**
```json
{
  "allowed": true,
  "current": 3,
  "limit": 5,
  "remaining": 2,
  "isUnlimited": false,
  "upgradeRequired": false
}
```

#### GET `/api/feature-gate/campaign-limit?clientId=xxx`
Valida limite de campanhas para um cliente.

**Response:**
```json
{
  "allowed": false,
  "current": 25,
  "limit": 25,
  "remaining": 0,
  "isUnlimited": false,
  "reason": "Campaign limit reached...",
  "upgradeRequired": true
}
```

#### GET `/api/feature-gate/export-permission?format=csv`
Valida permissão de exportação.

**Response:**
```json
{
  "allowed": true,
  "format": "csv",
  "upgradeRequired": false
}
```

#### GET `/api/feature-gate/limits-summary`
Retorna resumo completo de limites.

**Response:**
```json
{
  "success": true,
  "data": {
    "dataRetention": {
      "days": 90,
      "isUnlimited": false
    },
    "clients": {
      "current": 3,
      "limit": 5,
      "remaining": 2,
      "isUnlimited": false
    },
    "syncInterval": {
      "hours": 24
    },
    "export": {
      "csv": true,
      "json": false
    }
  }
}
```

## Integração com Feature Gate Existente

O sistema se integra com o feature gate existente através de:

1. **Novos Feature Keys** adicionados ao `FeatureKey` type:
   - `dataRetention`
   - `csvExport`
   - `jsonExport`
   - `historicalDataCache`

2. **Novos helpers** no `createFeatureGate`:
   - `dataRetention()`
   - `csvExport()`
   - `jsonExport()`
   - `historicalDataCache()`

## Requisitos Implementados

- ✅ **2.1, 2.2**: Validação de retenção de dados históricos
- ✅ **3.1, 3.2, 3.3**: Validação de limites de clientes e campanhas
- ✅ **7.1, 7.2, 7.3, 7.4**: Endpoints de validação e exibição de limites
- ✅ **8.3**: Validação de permissões de exportação

## Exemplos de Uso

### Em um componente React

```typescript
'use client';

import { useEffect, useState } from 'react';

export function DataRetentionCheck() {
  const [canAccess, setCanAccess] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const response = await fetch('/api/feature-gate/data-retention?days=180');
      const data = await response.json();
      setCanAccess(data.allowed);
    }
    checkAccess();
  }, []);

  return (
    <div>
      {canAccess ? 'Access granted' : 'Upgrade required'}
    </div>
  );
}
```

### Em uma API route

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cacheFeatureGate } from '@/lib/services/cache-feature-gate';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validar retenção de dados
  const retentionCheck = await cacheFeatureGate.checkDataRetention(user.id, 180);
  
  if (!retentionCheck.allowed) {
    return NextResponse.json(
      { error: retentionCheck.reason },
      { status: 403 }
    );
  }

  // Continuar com a lógica...
}
```

## Notas de Implementação

1. **Valores Ilimitados**: O valor `-1` indica recursos ilimitados
2. **Cache**: Considere implementar cache para limites de plano (Redis)
3. **Performance**: Validações são otimizadas para minimizar queries ao banco
4. **Segurança**: Todas as validações verificam ownership antes de retornar dados

## Próximos Passos

1. Implementar cache Redis para configurações de plano
2. Adicionar métricas de uso em tempo real
3. Criar componentes React para exibição de limites
4. Implementar notificações quando limites são atingidos
