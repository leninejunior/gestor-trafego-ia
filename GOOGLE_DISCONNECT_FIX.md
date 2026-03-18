# Correção: Interface de Gerenciamento de Conexões Google Ads

## Problema Identificado

A interface de gerenciamento de conexões Google Ads estava apresentando:
1. Texto corrompido: "coan3 contas conectadas" (erro de digitação)
2. Status "Revogado" para conta ID: 3186237743
3. Arquivo do componente corrompido

## Solução Implementada

### 1. Reconstrução do Componente `ManageConnections`

**Arquivo:** `src/components/google/manage-connections.tsx`

#### Funcionalidades Implementadas:

- **Listagem de Conexões**: Exibe todas as conexões Google Ads do cliente
- **Status Visual**: Badges coloridos para cada status:
  - 🟢 **Ativo** (verde): Conexão funcionando normalmente
  - ⚪ **Expirado** (cinza): Token expirado, precisa reconectar
  - 🔴 **Revogado** (vermelho): Acesso revogado pelo usuário no Google

- **Ações Disponíveis**:
  - ✅ **Atualizar**: Recarrega a lista de conexões
  - 🔄 **Reconectar**: Para contas expiradas ou revogadas
  - 🗑️ **Desconectar**: Remove a conexão permanentemente

- **Informações Exibidas**:
  - Status da conexão
  - Customer ID (ID da conta Google Ads)
  - Data de conexão
  - Data da última sincronização

### 2. API de Gerenciamento

**Endpoint:** `/api/google/connections`

#### GET - Listar Conexões
```typescript
GET /api/google/connections?clientId=xxx
```

Retorna todas as conexões de um cliente específico.

#### DELETE - Remover Conexão
```typescript
DELETE /api/google/connections?connectionId=xxx
```

Remove uma conexão específica do banco de dados.

### 3. Schema da Tabela

```sql
CREATE TABLE google_ads_connections (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  customer_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'expired', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, customer_id)
);
```

## Status da Conexão

### Active (Ativo)
- Token válido e funcionando
- Sincronização automática habilitada
- Nenhuma ação necessária

### Expired (Expirado)
- Token de acesso expirou
- Refresh token ainda válido
- **Ação**: Clicar em "Reconectar" para renovar

### Revoked (Revogado)
- Usuário revogou acesso no Google
- Refresh token inválido
- **Ação**: Clicar em "Reconectar" para autorizar novamente

## Como Usar

### Para Reconectar uma Conta Revogada:

1. Acesse a página de gerenciamento de conexões
2. Localize a conta com status "Revogado"
3. Clique no botão "Reconectar"
4. Será redirecionado para o fluxo OAuth do Google
5. Autorize o acesso novamente
6. Será redirecionado de volta com a conexão restaurada

### Para Desconectar uma Conta:

1. Localize a conta que deseja remover
2. Clique no botão "Desconectar"
3. Confirme a ação no diálogo
4. A conta será removida permanentemente

## Tratamento de Erros

O componente inclui tratamento robusto de erros:

- **Erro de Carregamento**: Exibe mensagem de erro com detalhes
- **Erro de Desconexão**: Mantém a lista e exibe alerta
- **Erro de Rede**: Mensagem amigável ao usuário
- **Estados de Loading**: Indicadores visuais durante operações

## Melhorias Implementadas

1. ✅ Interface limpa e intuitiva
2. ✅ Feedback visual claro para cada status
3. ✅ Confirmação antes de desconectar
4. ✅ Atualização automática após ações
5. ✅ Tratamento de erros robusto
6. ✅ Responsivo e acessível
7. ✅ Texto correto em português

## Próximos Passos

Para resolver a conta com status "Revogado" (ID: 3186237743):

1. **Opção 1 - Reconectar**:
   - Clique em "Reconectar" na interface
   - Complete o fluxo OAuth novamente

2. **Opção 2 - Remover**:
   - Clique em "Desconectar"
   - Conecte uma nova conta se necessário

## Verificação

Para verificar se a correção funcionou:

```bash
# Acesse a página do cliente
http://localhost:3000/dashboard/clients/[clientId]

# Ou acesse diretamente a página Google
http://localhost:3000/dashboard/google
```

A interface agora deve exibir:
- Contagem correta de contas
- Status claro para cada conexão
- Botões funcionais para reconectar/desconectar

## Arquivos Modificados

- ✅ `src/components/google/manage-connections.tsx` - Reconstruído
- ✅ `src/app/api/google/connections/route.ts` - Já existente e funcional
- ✅ `database/google-ads-schema.sql` - Schema documentado

## Documentação Relacionada

- `docs/GOOGLE_ADS_README.md` - Guia completo Google Ads
- `GOOGLE_ADS_QUICK_REFERENCE.md` - Referência rápida
- `database/GOOGLE_ADS_SCHEMA_REFERENCE.md` - Referência do schema
