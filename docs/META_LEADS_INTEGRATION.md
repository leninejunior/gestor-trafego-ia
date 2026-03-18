# Meta Lead Ads - Sistema de Captura de Leads

## Visão Geral

Sistema completo para captura e gerenciamento de leads do Facebook Lead Ads, permitindo sincronização automática de formulários e leads, com rastreamento de status e atribuição.

## Estrutura do Banco de Dados

### Tabelas Principais

#### meta_lead_forms
Armazena os formulários de lead ads configurados no Meta.

**Campos:**
- `id` - UUID único
- `connection_id` - Referência à conexão Meta
- `external_id` - ID do formulário no Meta
- `name` - Nome do formulário
- `status` - Status (ACTIVE, PAUSED, DELETED)
- `locale` - Idioma (default: pt_BR)
- `questions` - JSONB com perguntas do formulário
- `privacy_policy_url` - URL da política de privacidade

#### meta_leads
Armazena os leads capturados.

**Campos:**
- `id` - UUID único
- `connection_id` - Referência à conexão Meta
- `form_id` - Referência ao formulário
- `external_id` - ID do lead no Meta
- `ad_id`, `ad_name` - Anúncio que gerou o lead
- `adset_id`, `adset_name` - Conjunto de anúncios
- `campaign_id`, `campaign_name` - Campanha
- `created_time` - Data de criação no Meta
- `field_data` - JSONB com dados do formulário (nome, email, telefone, etc)
- `is_organic` - Se é lead orgânico
- `platform` - Plataforma (FACEBOOK, INSTAGRAM, MESSENGER)
- `status` - Status do lead (new, contacted, qualified, converted, lost)
- `notes` - Notas sobre o lead
- `assigned_to` - Usuário responsável

#### meta_lead_sync_logs
Histórico de sincronizações.

**Campos:**
- `connection_id` - Conexão sincronizada
- `form_id` - Formulário específico (opcional)
- `leads_synced` - Total de leads sincronizados
- `leads_new` - Novos leads
- `leads_updated` - Leads atualizados
- `success` - Se sincronização foi bem-sucedida
- `error_message` - Mensagem de erro (se houver)

## APIs Disponíveis

### 1. Sincronizar Leads

**Endpoint:** `POST /api/meta/leads/sync`

**Body:**
```json
{
  "clientId": "uuid-do-cliente",
  "formId": "id-do-formulario" // Opcional - se omitido, sincroniza todos
}
```

**Resposta:**
```json
{
  "success": true,
  "leads_synced": 45,
  "leads_new": 30,
  "leads_updated": 15
}
```

**Funcionalidade:**
- Busca formulários de lead ads da conta Meta
- Sincroniza leads de cada formulário
- Atualiza leads existentes
- Registra log de sincronização

### 2. Listar Leads

**Endpoint:** `GET /api/meta/leads?clientId=xxx&status=new&limit=50&offset=0`

**Query Params:**
- `clientId` (obrigatório) - ID do cliente
- `status` (opcional) - Filtrar por status
- `campaignId` (opcional) - Filtrar por campanha
- `limit` (opcional) - Limite de resultados (default: 50)
- `offset` (opcional) - Offset para paginação (default: 0)

**Resposta:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "external_id": "123456",
      "campaign_name": "Campanha Teste",
      "ad_name": "Anúncio 1",
      "field_data": {
        "full_name": "João Silva",
        "email": "joao@example.com",
        "phone_number": "+5511999999999"
      },
      "status": "new",
      "created_time": "2025-01-15T10:30:00Z",
      "platform": "FACEBOOK"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### 3. Detalhes do Lead

**Endpoint:** `GET /api/meta/leads/[leadId]`

**Resposta:**
```json
{
  "lead": {
    "id": "uuid",
    "external_id": "123456",
    "campaign_name": "Campanha Teste",
    "field_data": {
      "full_name": "João Silva",
      "email": "joao@example.com"
    },
    "status": "contacted",
    "notes": "Cliente interessado em produto X",
    "assigned_to": "user-uuid",
    "meta_lead_forms": {
      "name": "Formulário de Contato",
      "questions": [...]
    }
  }
}
```

### 4. Atualizar Lead

**Endpoint:** `PATCH /api/meta/leads/[leadId]`

**Body:**
```json
{
  "status": "contacted",
  "notes": "Cliente ligou, agendar reunião",
  "assigned_to": "user-uuid"
}
```

**Resposta:**
```json
{
  "lead": {
    "id": "uuid",
    "status": "contacted",
    "notes": "Cliente ligou, agendar reunião",
    "updated_at": "2025-01-15T14:30:00Z"
  }
}
```

### 5. Deletar Lead

**Endpoint:** `DELETE /api/meta/leads/[leadId]`

**Resposta:**
```json
{
  "success": true
}
```

### 6. Estatísticas de Leads

**Endpoint:** `GET /api/meta/leads/stats?clientId=xxx`

**Resposta:**
```json
{
  "overview": {
    "total": 150,
    "new": 45,
    "contacted": 60,
    "qualified": 25,
    "converted": 15,
    "lost": 5
  },
  "by_campaign": [
    {
      "campaign_id": "123",
      "campaign_name": "Campanha A",
      "total_leads": 80,
      "new_leads": 20,
      "converted_leads": 10
    }
  ],
  "recent_leads_7d": 30
}
```

### 7. Listar Formulários

**Endpoint:** `GET /api/meta/leads/forms?clientId=xxx`

**Resposta:**
```json
{
  "forms": [
    {
      "id": "uuid",
      "external_id": "form-123",
      "name": "Formulário de Contato",
      "status": "ACTIVE",
      "questions": [...],
      "leads_count": 45
    }
  ]
}
```

## Fluxo de Trabalho

### 1. Configuração Inicial

1. Cliente conecta conta Meta via OAuth
2. Sistema busca formulários de lead ads disponíveis
3. Formulários são salvos na tabela `meta_lead_forms`

### 2. Sincronização de Leads

**Manual:**
```bash
POST /api/meta/leads/sync
{
  "clientId": "uuid-do-cliente"
}
```

**Automática (recomendado):**
- Configurar webhook do Meta para receber leads em tempo real
- Ou configurar cron job para sincronizar periodicamente

### 3. Gerenciamento de Leads

1. **Visualizar leads:** `GET /api/meta/leads`
2. **Ver detalhes:** `GET /api/meta/leads/[id]`
3. **Atualizar status:** `PATCH /api/meta/leads/[id]`
4. **Atribuir responsável:** `PATCH /api/meta/leads/[id]`
5. **Adicionar notas:** `PATCH /api/meta/leads/[id]`

### 4. Análise e Relatórios

- Estatísticas por status
- Performance por campanha
- Leads recentes
- Taxa de conversão

## Status de Leads

- `new` - Lead novo, não contactado
- `contacted` - Lead contactado
- `qualified` - Lead qualificado
- `converted` - Lead convertido em cliente
- `lost` - Lead perdido

## Segurança (RLS)

Todas as tabelas têm Row Level Security habilitado:

- Usuários veem apenas leads de seus clientes
- Isolamento por `connection_id` via `memberships`
- Service role tem acesso total para sincronização

## Exemplo de Uso

### Sincronizar e Processar Leads

```typescript
// 1. Sincronizar leads
const syncResponse = await fetch('/api/meta/leads/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: 'xxx' })
});

// 2. Buscar leads novos
const leadsResponse = await fetch(
  '/api/meta/leads?clientId=xxx&status=new&limit=20'
);
const { leads } = await leadsResponse.json();

// 3. Atualizar status de um lead
await fetch(`/api/meta/leads/${leadId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'contacted',
    notes: 'Cliente interessado',
    assigned_to: userId
  })
});

// 4. Ver estatísticas
const statsResponse = await fetch('/api/meta/leads/stats?clientId=xxx');
const stats = await statsResponse.json();
```

## Próximos Passos

1. **Webhook do Meta:** Configurar para receber leads em tempo real
2. **Interface UI:** Criar dashboard para gerenciar leads
3. **Notificações:** Alertar quando novos leads chegarem
4. **Integração CRM:** Exportar leads para sistemas externos
5. **Automação:** Resposta automática para novos leads

## Troubleshooting

### Leads não sincronizam

1. Verificar se conexão Meta está ativa
2. Verificar permissões do token de acesso
3. Verificar logs em `meta_lead_sync_logs`

### Erro de permissão

1. Verificar RLS policies
2. Verificar membership do usuário
3. Verificar se `connection_id` está correto

### Dados incompletos

1. Verificar se formulário tem todas as perguntas
2. Verificar se API do Meta retorna todos os campos
3. Verificar estrutura do `field_data`

## Referências

- [Meta Lead Ads API](https://developers.facebook.com/docs/marketing-api/guides/lead-ads)
- [Webhooks para Lead Ads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/webhooks)
