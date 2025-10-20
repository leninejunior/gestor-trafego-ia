# Plano de Melhorias - Analytics e Filtros

## 📋 Resumo das Mudanças Solicitadas

### 1. Filtro de Campanhas
- ✅ Seleção múltipla de campanhas
- ✅ Filtro de data com range personalizado (de X até Y)

### 2. Análise Semanal e Outros
- ✅ Corrigir formato de data nas análises

### 3. Analytics Multi-Nível
- ✅ Comparação de Campanhas (já existe)
- ✅ Comparação de Conjuntos de Anúncios (novo)
- ✅ Comparação de Anúncios (novo)
- ✅ Thumbnail dos criativos

### 4. Alerta de Saldo
- ✅ Menu Sidebar com alertas
- ✅ Disparo por WhatsApp (Evolution API)

### 5. Métricas Personalizadas
- ✅ Corrigir erro na API em produção
- ✅ Corrigir erro no Dashboard Personalizado

---

## 🏗️ Arquitetura da Solução

### Estrutura de Componentes

```
src/
├── components/
│   ├── analytics/
│   │   ├── level-selector.tsx          # Novo: Seletor de nível (Campanha/Conjunto/Anúncio)
│   │   ├── campaign-comparison.tsx     # Existente: Atualizar
│   │   ├── adset-comparison.tsx        # Novo: Comparação de conjuntos
│   │   ├── ad-comparison.tsx           # Novo: Comparação de anúncios
│   │   └── creative-thumbnail.tsx      # Novo: Thumbnail de criativos
│   ├── campaigns/
│   │   ├── campaign-multi-select.tsx   # Novo: Seleção múltipla
│   │   ├── date-range-picker.tsx       # Atualizar: Adicionar custom range
│   │   └── custom-date-dialog.tsx      # Novo: Dialog para range customizado
│   ├── alerts/
│   │   ├── balance-alerts-sidebar.tsx  # Novo: Sidebar de alertas
│   │   ├── balance-alert-item.tsx      # Novo: Item de alerta
│   │   └── whatsapp-config.tsx         # Novo: Configuração WhatsApp
│   └── dashboard/
│       └── sidebar.tsx                 # Atualizar: Adicionar alertas
├── app/
│   ├── api/
│   │   ├── analytics/
│   │   │   ├── campaigns/route.ts      # Existente
│   │   │   ├── adsets/route.ts         # Novo
│   │   │   └── ads/route.ts            # Novo
│   │   ├── alerts/
│   │   │   ├── balance/route.ts        # Novo
│   │   │   └── whatsapp/route.ts       # Novo
│   │   └── dashboard/
│   │       └── views/route.ts          # Corrigir
│   └── dashboard/
│       └── analytics/page.tsx          # Atualizar
└── lib/
    ├── meta/
    │   ├── adsets-client.ts            # Novo: Cliente para conjuntos
    │   └── ads-client.ts               # Novo: Cliente para anúncios
    ├── whatsapp/
    │   └── evolution-api.ts            # Novo: Integração Evolution API
    └── utils/
        └── date-formatter.ts           # Novo: Formatação de datas
```

---

## 📝 Detalhamento das Implementações

### 1. Filtro de Campanhas - Seleção Múltipla

**Componente:** `campaign-multi-select.tsx`

```typescript
interface CampaignMultiSelectProps {
  campaigns: Campaign[]
  selectedCampaigns: string[]
  onSelectionChange: (campaignIds: string[]) => void
  maxSelection?: number
}
```

**Funcionalidades:**
- Checkbox para cada campanha
- "Selecionar todas" / "Limpar seleção"
- Busca/filtro de campanhas
- Badge mostrando quantidade selecionada
- Limite máximo de seleção (opcional)

**Integração:**
- Atualizar `analytics/page.tsx` para usar array de IDs
- Modificar APIs para aceitar múltiplos IDs

---

### 2. Filtro de Data - Range Personalizado

**Componente:** `custom-date-dialog.tsx`

```typescript
interface CustomDateDialogProps {
  onConfirm: (startDate: Date, endDate: Date) => void
  onCancel: () => void
}
```

**Atualização em `date-range-picker.tsx`:**
- Adicionar opção "Personalizado" no select
- Abrir dialog ao selecionar "Personalizado"
- Usar componente Calendar do shadcn/ui
- Validar range (data inicial < data final)
- Máximo de 1 ano de diferença

**Formato de envio para API:**
```typescript
// Antes: days=30
// Depois: custom:2025-01-01:2025-01-31
```

---

### 3. Análise Multi-Nível

#### 3.1 Seletor de Nível

**Componente:** `level-selector.tsx`

```typescript
type AnalysisLevel = 'campaign' | 'adset' | 'ad'

interface LevelSelectorProps {
  value: AnalysisLevel
  onChange: (level: AnalysisLevel) => void
}
```

**UI:**
```
┌─────────────────────────────────────────┐
│ Escolha o nível de análise:             │
│ ○ Campanhas  ○ Conjuntos  ○ Anúncios   │
└─────────────────────────────────────────┘
```

#### 3.2 Fluxo de Seleção

**Nível: Campanha**
- Selecionar cliente
- Selecionar campanhas (múltiplas)
- Mostrar comparação

**Nível: Conjunto de Anúncios**
- Selecionar cliente
- Selecionar campanha (única)
- Selecionar conjuntos (múltiplos)
- Mostrar comparação

**Nível: Anúncios**
- Selecionar cliente
- Selecionar campanha (única)
- Selecionar conjunto (único)
- Selecionar anúncios (múltiplos)
- Mostrar comparação + thumbnails

#### 3.3 APIs Necessárias

**GET /api/analytics/adsets**
```typescript
Query params:
- client_id: string
- campaign_id: string
- date_range: string
- adset_ids?: string[] (opcional, para filtrar)

Response:
{
  adsets: AdSet[]
  total: number
  campaign: { id, name }
}
```

**GET /api/analytics/ads**
```typescript
Query params:
- client_id: string
- campaign_id: string
- adset_id: string
- date_range: string
- ad_ids?: string[] (opcional)

Response:
{
  ads: Ad[]
  total: number
  campaign: { id, name }
  adset: { id, name }
}
```

#### 3.4 Thumbnail de Criativos

**Componente:** `creative-thumbnail.tsx`

```typescript
interface CreativeThumbnailProps {
  adId: string
  accessToken: string
  size?: 'sm' | 'md' | 'lg'
}
```

**Meta API:**
```
GET /{ad-id}?fields=creative{image_url,video_id,thumbnail_url}
```

**Fallback:**
- Ícone de imagem se não carregar
- Skeleton durante loading
- Cache de thumbnails

---

### 4. Alerta de Saldo

#### 4.1 Schema do Banco de Dados

```sql
-- Tabela de alertas de saldo
CREATE TABLE balance_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  threshold_amount DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2),
  alert_type TEXT CHECK (alert_type IN ('low_balance', 'no_balance', 'daily_limit')),
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_alert_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de configuração WhatsApp
CREATE TABLE whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  evolution_api_url TEXT NOT NULL,
  evolution_api_key TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de histórico de alertas
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID REFERENCES balance_alerts(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_via TEXT CHECK (sent_via IN ('whatsapp', 'email', 'push')),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT
);
```

#### 4.2 Sidebar de Alertas

**Componente:** `balance-alerts-sidebar.tsx`

**Posição:** Dentro do sidebar principal, seção "Alertas"

**Funcionalidades:**
- Badge com número de alertas ativos
- Lista de alertas recentes
- Indicador visual (vermelho/amarelo/verde)
- Link para página de configuração
- Botão "Marcar como lido"

**UI:**
```
┌─────────────────────────┐
│ 🔔 Alertas (3)          │
├─────────────────────────┤
│ 🔴 Cliente A            │
│    Saldo baixo: R$ 50   │
│    Há 2 horas           │
├─────────────────────────┤
│ 🟡 Cliente B            │
│    Limite diário: 80%   │
│    Há 5 horas           │
└─────────────────────────┘
```

#### 4.3 Integração Evolution API

**Biblioteca:** `evolution-api.ts`

```typescript
interface EvolutionAPIConfig {
  baseUrl: string
  apiKey: string
  instanceName: string
}

class EvolutionAPIClient {
  async sendMessage(to: string, message: string): Promise<void>
  async getInstanceStatus(): Promise<InstanceStatus>
  async testConnection(): Promise<boolean>
}
```

**Mensagem de Alerta:**
```
🚨 *Alerta de Saldo - Gestor Engrene*

Cliente: {client_name}
Conta: {ad_account_name}
Saldo Atual: R$ {current_balance}
Limite: R$ {threshold}

⚠️ O saldo está abaixo do limite configurado.
Recarregue a conta para evitar interrupção das campanhas.

---
Gestor Engrene
```

#### 4.4 Cron Job de Verificação

**Arquivo:** `src/app/api/cron/check-balances/route.ts`

```typescript
// Executar a cada 30 minutos
export async function GET(request: NextRequest) {
  // 1. Buscar todas as contas com alertas ativos
  // 2. Para cada conta, consultar saldo na Meta API
  // 3. Comparar com threshold
  // 4. Se abaixo, enviar alerta (se não enviou nas últimas 4h)
  // 5. Registrar no histórico
}
```

**Configuração Vercel:**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/check-balances",
    "schedule": "*/30 * * * *"
  }]
}
```

---

### 5. Correção de Métricas Personalizadas

#### 5.1 Problemas Identificados

**Erro na API `/api/dashboard/views`:**
- Falta validação de organização
- Erro ao buscar métricas customizadas
- Timeout em produção

**Correções:**

1. **Adicionar índices no banco:**
```sql
CREATE INDEX idx_custom_dashboard_views_user_org 
  ON custom_dashboard_views(user_id, organization_id);

CREATE INDEX idx_custom_dashboard_views_shared 
  ON custom_dashboard_views(is_shared) 
  WHERE is_shared = true;
```

2. **Otimizar query:**
```typescript
// Antes: OR complexo
.or(`user_id.eq.${user.id},is_shared.eq.true`)

// Depois: Duas queries separadas e merge
const [userViews, sharedViews] = await Promise.all([
  supabase.from('custom_dashboard_views')
    .select('*')
    .eq('user_id', user.id),
  supabase.from('custom_dashboard_views')
    .select('*')
    .eq('is_shared', true)
])
```

3. **Adicionar cache:**
```typescript
// Cache de 5 minutos para views compartilhadas
const cacheKey = `shared-views-${orgId}`
const cached = await redis.get(cacheKey)
if (cached) return cached
```

4. **Timeout handling:**
```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 10000)

try {
  const response = await fetch(url, { 
    signal: controller.signal 
  })
} finally {
  clearTimeout(timeout)
}
```

---

## 🔄 Formato de Data Padronizado

### Problema Atual
Datas aparecem em formatos inconsistentes:
- `2025-01-20T10:30:00Z` (ISO)
- `20/01/2025` (BR)
- `Jan 20, 2025` (US)

### Solução

**Arquivo:** `lib/utils/date-formatter.ts`

```typescript
export const formatters = {
  // Para exibição em tabelas
  short: (date: Date) => format(date, 'dd/MM/yyyy'),
  
  // Para gráficos semanais
  week: (date: Date) => format(date, "dd 'de' MMM", { locale: ptBR }),
  
  // Para tooltips e detalhes
  full: (date: Date) => format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
  
  // Para APIs (sempre ISO)
  api: (date: Date) => format(date, 'yyyy-MM-dd'),
  
  // Para timestamps
  timestamp: (date: Date) => format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}
```

**Uso:**
```typescript
import { formatters } from '@/lib/utils/date-formatter'

// Em componentes
<span>{formatters.short(campaign.created_at)}</span>

// Em gráficos
data.map(d => ({
  date: formatters.week(d.date),
  value: d.value
}))
```

---

## 📊 Ordem de Implementação

### Fase 1: Fundação (Não quebra nada)
1. ✅ Criar schemas do banco (alertas, whatsapp)
2. ✅ Criar formatador de datas
3. ✅ Adicionar índices de performance
4. ✅ Criar tipos TypeScript

### Fase 2: Filtros (Melhoria incremental)
5. ✅ Implementar seleção múltipla de campanhas
6. ✅ Implementar range de data customizado
7. ✅ Atualizar APIs para aceitar múltiplos IDs
8. ✅ Aplicar formatação de datas

### Fase 3: Analytics Multi-Nível (Nova feature)
9. ✅ Criar API de conjuntos de anúncios
10. ✅ Criar API de anúncios
11. ✅ Implementar seletor de nível
12. ✅ Criar componentes de comparação
13. ✅ Implementar thumbnails

### Fase 4: Alertas (Nova feature)
14. ✅ Implementar cliente Evolution API
15. ✅ Criar APIs de alertas
16. ✅ Criar sidebar de alertas
17. ✅ Implementar cron job
18. ✅ Criar página de configuração

### Fase 5: Correções (Bugfix)
19. ✅ Corrigir API de views
20. ✅ Corrigir métricas personalizadas
21. ✅ Testes em produção

---

## 🧪 Testes Necessários

### Testes Unitários
- [ ] Formatação de datas
- [ ] Validação de ranges
- [ ] Seleção múltipla

### Testes de Integração
- [ ] APIs de analytics multi-nível
- [ ] Evolution API
- [ ] Cron job de alertas

### Testes E2E
- [ ] Fluxo completo de análise
- [ ] Configuração de alertas
- [ ] Recebimento de WhatsApp

---

## 🚀 Deploy

### Variáveis de Ambiente
```env
# Evolution API
EVOLUTION_API_URL=https://api.evolution.com
EVOLUTION_API_KEY=your-key-here

# Redis (para cache)
REDIS_URL=redis://...
```

### Migrations
```bash
# Aplicar schemas
psql $DATABASE_URL -f database/balance-alerts-schema.sql

# Criar índices
psql $DATABASE_URL -f database/performance-indexes.sql
```

### Vercel
```bash
# Deploy com cron jobs
vercel --prod

# Verificar cron
vercel cron ls
```

---

## 📈 Métricas de Sucesso

- ✅ Tempo de resposta da API < 2s
- ✅ Taxa de entrega de alertas > 95%
- ✅ Zero quebras no sistema atual
- ✅ Feedback positivo dos usuários

---

## 🔒 Segurança

### RLS Policies
```sql
-- Alertas só visíveis para membros da organização
CREATE POLICY "Users can view org balance alerts"
  ON balance_alerts FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE om.user_id = auth.uid()
    )
  );
```

### Validações
- Validar permissões antes de enviar alertas
- Criptografar chaves da Evolution API
- Rate limiting nas APIs
- Sanitizar mensagens de WhatsApp

---

## 📚 Documentação

Criar documentos:
- [ ] `docs/ANALYTICS_MULTI_NIVEL.md`
- [ ] `docs/ALERTAS_WHATSAPP.md`
- [ ] `docs/EVOLUTION_API_SETUP.md`
- [ ] Atualizar `README.md`

---

## ✅ Checklist Final

- [ ] Todas as features implementadas
- [ ] Testes passando
- [ ] Documentação atualizada
- [ ] Deploy em staging
- [ ] Testes com usuários
- [ ] Deploy em produção
- [ ] Monitoramento ativo
