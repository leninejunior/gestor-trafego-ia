# Plan Configuration Service

Serviço para gerenciar limites configuráveis por plano de assinatura.

## Visão Geral

O `PlanConfigurationService` permite que administradores configurem limites personalizados para cada plano de assinatura, incluindo:

- Número máximo de clientes
- Número máximo de campanhas por cliente
- Período de retenção de dados históricos
- Intervalo de sincronização
- Permissões de exportação (CSV/JSON)

## Tipos e Validações

### PlanLimits Interface

```typescript
interface PlanLimits {
  id: string;
  plan_id: string;
  max_clients: number;              // -1 = ilimitado
  max_campaigns_per_client: number; // -1 = ilimitado
  data_retention_days: number;      // 30-3650 dias
  sync_interval_hours: number;      // 1-168 horas
  allow_csv_export: boolean;
  allow_json_export: boolean;
  created_at: string;
  updated_at: string;
}
```

### Validações Zod

Todos os dados são validados usando schemas Zod:

- `max_clients`: >= -1 (onde -1 = ilimitado)
- `max_campaigns_per_client`: >= -1 (onde -1 = ilimitado)
- `data_retention_days`: 30-3650 dias
- `sync_interval_hours`: 1-168 horas

### Valores Padrão

```typescript
{
  max_clients: 5,
  max_campaigns_per_client: 25,
  data_retention_days: 90,
  sync_interval_hours: 24,
  allow_csv_export: false,
  allow_json_export: false,
}
```

## Uso do Serviço

### Importar o Serviço

```typescript
import { planConfigurationService } from '@/lib/services/plan-configuration-service';
```

### Métodos Principais

#### getPlanLimits(planId: string)

Obtém os limites de um plano específico.

```typescript
const limits = await planConfigurationService.getPlanLimits('plan-uuid');
```

#### createPlanLimits(planId: string, limits?: Partial<CreatePlanLimits>)

Cria limites para um plano. Se não fornecidos, usa valores padrão.

```typescript
const limits = await planConfigurationService.createPlanLimits('plan-uuid', {
  max_clients: 10,
  data_retention_days: 180,
});
```

#### updatePlanLimits(planId: string, limits: UpdatePlanLimits)

Atualiza os limites de um plano existente.

```typescript
const limits = await planConfigurationService.updatePlanLimits('plan-uuid', {
  max_clients: 15,
  allow_csv_export: true,
});
```

#### getUserPlanLimits(userId: string)

Obtém os limites do plano ativo de um usuário.

```typescript
const limits = await planConfigurationService.getUserPlanLimits('user-uuid');
```

#### validateLimits(limits: Partial<CreatePlanLimits>)

Valida limites antes de aplicar.

```typescript
const result = await planConfigurationService.validateLimits({
  max_clients: 10,
  data_retention_days: 90,
});

if (!result.valid) {
  console.error('Erros:', result.errors);
}
```

### Métodos de Verificação

#### canAddClient(userId: string)

Verifica se um usuário pode adicionar mais clientes.

```typescript
const { allowed, current, limit } = await planConfigurationService.canAddClient('user-uuid');

if (!allowed) {
  console.log(`Limite atingido: ${current}/${limit} clientes`);
}
```

#### canAddCampaign(clientId: string)

Verifica se um cliente pode adicionar mais campanhas.

```typescript
const { allowed, current, limit } = await planConfigurationService.canAddCampaign('client-uuid');
```

#### canAccessDataRange(userId: string, requestedDays: number)

Verifica se um usuário pode acessar dados em um período específico.

```typescript
const canAccess = await planConfigurationService.canAccessDataRange('user-uuid', 180);
```

#### canExport(userId: string, format: 'csv' | 'json')

Verifica se um usuário pode exportar dados em um formato específico.

```typescript
const canExportCSV = await planConfigurationService.canExport('user-uuid', 'csv');
```

## API Endpoints

### GET /api/admin/plans/:id/limits

Obtém os limites de um plano.

**Resposta:**
```json
{
  "id": "uuid",
  "plan_id": "uuid",
  "max_clients": 10,
  "max_campaigns_per_client": 50,
  "data_retention_days": 180,
  "sync_interval_hours": 12,
  "allow_csv_export": true,
  "allow_json_export": false,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### POST /api/admin/plans/:id/limits

Cria limites para um plano.

**Body:**
```json
{
  "max_clients": 10,
  "max_campaigns_per_client": 50,
  "data_retention_days": 180,
  "sync_interval_hours": 12,
  "allow_csv_export": true,
  "allow_json_export": false
}
```

### PUT /api/admin/plans/:id/limits

Atualiza os limites de um plano.

**Body:**
```json
{
  "max_clients": 15,
  "allow_csv_export": true
}
```

### DELETE /api/admin/plans/:id/limits

Remove os limites de um plano (volta para valores padrão na próxima criação).

## Exemplos de Uso

### Exemplo 1: Criar Plano com Limites Personalizados

```typescript
// 1. Criar o plano
const plan = await createSubscriptionPlan({
  name: 'Premium',
  price: 99.99,
});

// 2. Configurar limites
const limits = await planConfigurationService.createPlanLimits(plan.id, {
  max_clients: 20,
  max_campaigns_per_client: 100,
  data_retention_days: 365,
  sync_interval_hours: 6,
  allow_csv_export: true,
  allow_json_export: true,
});
```

### Exemplo 2: Verificar Limites Antes de Adicionar Cliente

```typescript
async function addClient(userId: string, clientData: any) {
  // Verificar se pode adicionar
  const { allowed, current, limit } = await planConfigurationService.canAddClient(userId);
  
  if (!allowed) {
    throw new Error(`Limite de clientes atingido (${current}/${limit}). Faça upgrade do seu plano.`);
  }
  
  // Adicionar cliente
  return await createClient(clientData);
}
```

### Exemplo 3: Validar Período de Dados Solicitado

```typescript
async function getHistoricalData(userId: string, days: number) {
  // Verificar se pode acessar o período
  const canAccess = await planConfigurationService.canAccessDataRange(userId, days);
  
  if (!canAccess) {
    const limits = await planConfigurationService.getUserPlanLimits(userId);
    throw new Error(
      `Seu plano permite acesso a apenas ${limits?.data_retention_days} dias de histórico. ` +
      `Faça upgrade para acessar mais dados.`
    );
  }
  
  // Buscar dados
  return await fetchHistoricalData(userId, days);
}
```

## Requisitos Implementados

- ✅ 1.1: Administrador pode definir período de retenção
- ✅ 1.2: Administrador pode alterar período de retenção
- ✅ 1.3: Alterações aplicadas apenas para novos dados
- ✅ 1.4: Validação de campos antes de aplicar
- ✅ 1.5: Valores padrão quando não definidos
- ✅ 11.1: Interface para gerenciar configurações
- ✅ 11.2: Formulário com todos os limites configuráveis

## Próximos Passos

1. Implementar Feature Gate Integration (Task 3)
2. Criar componentes UI para Admin Panel (Task 10)
3. Adicionar testes unitários
4. Implementar cache Redis para configurações
