# Correção: Conexões Google Ads Duplicadas - Cliente COAN

## 🔍 Problema Identificado

O cliente COAN apresentava informações inconsistentes sobre conexões Google Ads em diferentes páginas:

1. **Dashboard principal**: Mostrava "2 contas conectadas"
2. **Página /dashboard/google**: Mostrava "4 contas conectadas"
3. **Página do cliente**: Mostrava Google como "desconectado"
4. **Sem dados de campanhas**: Apesar das conexões, nenhuma campanha era exibida

## 📊 Diagnóstico

### Conexões Encontradas (Antes da Correção)

```
Cliente: coan (ID: e3ab33da-79f9-45e9-a43f-6ce76ceb9751)

Conexão 1: c2644ddc... | Customer: 8938635478 | Status: active   | Criado: 2025-11-21 16:13
Conexão 2: ff12430a... | Customer: 8938635478 | Status: active   | Criado: 2025-11-21 16:05
Conexão 3: 48785de9... | Customer: 8938635478 | Status: revoked  | Criado: 2025-11-21 13:59
Conexão 4: a538135d... | Customer: 3186237743 | Status: revoked  | Criado: 2025-11-20 22:28
```

### Problemas Detectados

1. **Duplicatas**: Customer ID `8938635478` aparecia 3 vezes
2. **Conexões Revogadas**: 2 conexões com status `revoked` ainda no banco
3. **Contagem Inconsistente**: 
   - 4 registros totais na tabela
   - 2 Customer IDs únicos (por isso "2 contas" em alguns lugares)
   - 2 conexões ativas (mas duplicadas)
4. **Sem Campanhas**: 0 campanhas sincronizadas apesar das conexões

## ✅ Solução Aplicada

### 1. Limpeza de Duplicatas

Executado script `scripts/corrigir-google-coan.js`:

- ✅ Mantida apenas a conexão mais recente: `c2644ddc-b4c9-4e1f-9f3c-7c0d5ae3fc8d`
- ❌ Removidas 3 conexões duplicadas/revogadas

### 2. Resultado Final

```
Conexões após correção: 1
- Customer ID: 8938635478
- Status: active
- Refresh Token: Presente
```

## 🔧 Scripts Criados

### 1. `scripts/diagnosticar-google-coan.js`
Diagnóstico completo das conexões:
- Lista todas as conexões do cliente
- Identifica duplicatas
- Verifica campanhas sincronizadas
- Analisa estados OAuth pendentes

### 2. `scripts/corrigir-google-coan.js`
Correção automática:
- Remove conexões duplicadas (mantém a mais recente)
- Remove conexões revogadas
- Limpa estados OAuth não utilizados

### 3. `scripts/sincronizar-google-coan.js`
Sincronização de campanhas:
- Força sincronização completa via API
- Útil após correção das conexões

## 📝 Próximos Passos

### Para o Cliente COAN

1. **Sincronizar Campanhas**:
   ```bash
   node scripts/sincronizar-google-coan.js
   ```
   
   Ou via dashboard: Acessar `/dashboard/google` e clicar em "Sincronizar"

2. **Verificar Dados**:
   - Dashboard deve mostrar "1 conta conectada"
   - Campanhas devem aparecer após sincronização
   - Status deve ser consistente em todas as páginas

### Prevenção Futura

Para evitar duplicatas no futuro, considerar:

1. **Validação na API de Callback**:
   ```typescript
   // Antes de criar nova conexão, verificar se já existe
   const { data: existing } = await supabase
     .from('google_ads_connections')
     .select('id')
     .eq('client_id', clientId)
     .eq('customer_id', customerId)
     .eq('status', 'active')
     .single();
   
   if (existing) {
     // Atualizar existente ao invés de criar nova
   }
   ```

2. **Constraint Único no Banco**:
   ```sql
   -- Prevenir duplicatas de customer_id ativo por cliente
   CREATE UNIQUE INDEX idx_unique_active_customer 
   ON google_ads_connections(client_id, customer_id) 
   WHERE status = 'active';
   ```

3. **Limpeza Automática**:
   - Cron job para remover conexões revogadas antigas
   - Limpeza de estados OAuth expirados

## 🎯 Causa Raiz

O problema ocorreu porque:

1. Múltiplas tentativas de conexão criaram registros duplicados
2. Conexões antigas não foram removidas ao criar novas
3. Sistema não validava duplicatas antes de inserir
4. Conexões revogadas permaneciam no banco

## 📚 Referências

- Tabela: `google_ads_connections`
- Schema: `database/google-ads-schema.sql`
- API Callback: `src/app/api/google/callback/route.ts`
- Dashboard: `src/app/dashboard/google/page.tsx`

---

**Data da Correção**: 2025-11-21  
**Cliente Afetado**: COAN (e3ab33da-79f9-45e9-a43f-6ce76ceb9751)  
**Status**: ✅ Resolvido
