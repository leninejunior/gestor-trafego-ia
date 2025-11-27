# 🔧 Correção: Conexões Google Ads não aparecem no cliente

## 📋 Problemas Identificados

### 1. Dashboard mostra todas as conexões (não filtra por cliente)
**Causa:** Dashboard está acessando `google_connection` (singular) mas API retorna `googleConnections` (plural)

### 2. Conexão não aparece após seleção
**Causas possíveis:**
- `client_id` não está sendo salvo corretamente
- `is_active` não está sendo setado para `true`
- RLS policies bloqueando acesso
- Conexões órfãs sem `client_id`

## 🔍 Diagnóstico

### Passo 1: Verificar estado do banco
```sql
-- Execute o script de diagnóstico
\i database/diagnose-google-connections-issue.sql
```

### Passo 2: Verificar logs do servidor
Procure por:
```
[Google Account Select] 💾 Salvando seleção de contas
[OAuth Flow] Contas salvas
```

### Passo 3: Verificar no navegador
1. Abra DevTools (F12)
2. Vá para Network
3. Conecte uma conta
4. Verifique a resposta de `/api/google/accounts/select`

## ✅ Soluções

### Solução 1: Corrigir Dashboard (Interface)

O dashboard precisa usar `googleConnections` (plural) ao invés de `google_connection` (singular).

**Arquivo:** `src/app/dashboard/google/page.tsx`

**Problema:**
```typescript
// ❌ ERRADO
client.google_connection?.customer_id
client.google_connection?.status
```

**Solução:**
```typescript
// ✅ CORRETO
client.googleConnections?.[0]?.customer_id
client.googleConnections?.[0]?.status
client.googleConnections?.length > 0
```

### Solução 2: Garantir client_id no salvamento

**Arquivo:** `src/lib/google/oauth-flow-manager.ts`

Verificar se o `client_id` está sendo passado corretamente ao criar conexões adicionais:

```typescript
// Linha ~295
const { data: newConnection, error: createError } = await supabase
  .from('google_ads_connections')
  .insert({
    client_id: clientId,  // ✅ DEVE estar presente
    user_id: connection.user_id,  // ✅ DEVE estar presente
    customer_id: customerId,
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    token_expires_at: connection.token_expires_at,
    status: 'active',  // ✅ DEVE ser 'active'
  })
```

### Solução 3: Limpar conexões órfãs

Execute no banco de dados:

```sql
-- Ver conexões órfãs
SELECT * FROM google_ads_connections WHERE client_id IS NULL;

-- Deletar conexões órfãs antigas
DELETE FROM google_ads_connections
WHERE client_id IS NULL
AND created_at < NOW() - INTERVAL '1 day';

-- Deletar estados OAuth expirados
DELETE FROM oauth_states WHERE expires_at < NOW();
```

### Solução 4: Verificar RLS Policies

```sql
-- Ver policies da tabela
SELECT * FROM pg_policies WHERE tablename = 'google_ads_connections';

-- Policy deve permitir SELECT baseado em client_id
CREATE POLICY "Users can view their client connections"
  ON google_ads_connections FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );
```

## 🚀 Implementação das Correções

### 1. Corrigir Dashboard

Atualizar `src/app/dashboard/google/page.tsx`:

```typescript
// Mudar interface
interface Client {
  id: string;
  name: string;
  googleConnections?: GoogleConnection[];  // ✅ Plural
}

// Mudar filtro de clientes conectados
const connectedClients = clients.filter(c => 
  c.googleConnections && c.googleConnections.length > 0 && 
  c.googleConnections.some(conn => conn.status === 'active')
);

// Mudar renderização
{connectedClients.map((client) => (
  <div key={client.id}>
    <div>{client.name}</div>
    <div>ID: {client.googleConnections?.[0]?.customer_id}</div>
    <Badge variant={
      client.googleConnections?.[0]?.status === 'active' 
        ? 'default' 
        : 'destructive'
    }>
      {client.googleConnections?.[0]?.status === 'active' 
        ? 'Conectado' 
        : 'Desconectado'}
    </Badge>
  </div>
))}
```

### 2. Adicionar Logs de Debug

Adicionar no `oauth-flow-manager.ts`:

```typescript
async saveSelectedAccounts(...) {
  console.log('[OAuth Flow] 💾 Salvando contas:', {
    connectionId,
    clientId,
    selectedCustomerIds,
    totalAccounts: selectedCustomerIds.length
  });
  
  // ... código existente ...
  
  console.log('[OAuth Flow] ✅ Conexão principal atualizada:', {
    connectionId,
    primaryCustomerId,
    isActive: true
  });
  
  // ... ao criar conexões adicionais ...
  console.log('[OAuth Flow] ➕ Criando conexão adicional:', {
    clientId,
    customerId,
    userId: connection.user_id
  });
}
```

### 3. Endpoint de Debug

Criar endpoint para verificar conexões:

```typescript
// src/app/api/debug/google-connections/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  
  const supabase = await createClient();
  
  const { data: connections } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  
  return NextResponse.json({
    clientId,
    totalConnections: connections?.length || 0,
    connections: connections || [],
    activeConnections: connections?.filter(c => c.is_active) || []
  });
}
```

## 📊 Checklist de Verificação

Após aplicar as correções:

- [ ] Dashboard mostra apenas conexões do cliente selecionado
- [ ] Conexão aparece imediatamente após seleção
- [ ] `status = 'active'` após seleção
- [ ] `client_id` está presente em todas as conexões
- [ ] `user_id` está presente em todas as conexões
- [ ] Não há conexões órfãs no banco
- [ ] RLS policies funcionando corretamente
- [ ] Logs mostram salvamento bem-sucedido

## 🧪 Teste Manual

1. **Limpar dados antigos:**
   ```sql
   DELETE FROM google_ads_connections WHERE client_id IS NULL;
   DELETE FROM oauth_states WHERE expires_at < NOW();
   ```

2. **Conectar nova conta:**
   - Ir para `/dashboard/clients`
   - Selecionar um cliente
   - Clicar em "Conectar Google Ads"
   - Autorizar no Google
   - Selecionar conta
   - Clicar em "Conectar Contas Selecionadas"

3. **Verificar no banco:**
   ```sql
   SELECT 
     id,
     client_id,
     customer_id,
     status,
     user_id,
     created_at
   FROM google_ads_connections 
   WHERE client_id = 'uuid-do-cliente'
   ORDER BY created_at DESC;
   ```

4. **Verificar no dashboard:**
   - Ir para `/dashboard/google`
   - Verificar se a conexão aparece
   - Verificar se está marcada como "Conectado" (status = 'active')

## 📝 Próximos Passos

Após corrigir as conexões:

1. ✅ Implementar sincronização de campanhas
2. ✅ Buscar métricas da API Google Ads
3. ✅ Exibir dados no dashboard
4. ✅ Configurar renovação automática de tokens

---

**Data:** 21 de Novembro de 2024  
**Status:** Diagnóstico completo - Aguardando implementação
