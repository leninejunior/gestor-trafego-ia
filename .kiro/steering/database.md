# Database Structure

## Key Tables

### Organizations & Memberships
- `organizations` - Tabela de organizações
- `memberships` - Associação usuário-organização (NÃO `organization_members`)
  - Campos: `user_id`, `organization_id`, `role`, `org_id`

### Clients
- `clients` - Clientes das organizações
  - Campos: `id`, `name`, `org_id`
  - Relacionamento: `org_id` → `organizations(id)`

### Balance Alerts (Sistema de Alertas de Saldo)
- `ad_account_balances` - Cache de saldos das contas Meta Ads
  - Campos: `client_id`, `ad_account_id`, `balance`, `status`, `projected_days_remaining`
- `balance_alerts` - Configuração de alertas por conta
  - Campos: `client_id`, `ad_account_id`, `threshold_amount`, `alert_type`, `is_active`
- `alert_history` - Histórico de alertas enviados
  - Campos: `alert_id`, `sent_via`, `recipient`, `status`, `balance_at_send`

### Meta Ads
- `client_meta_connections` - Conexões Meta Ads por cliente
  - Campos: `id`, `client_id`, `ad_account_id`, `account_name` (NÃO `ad_account_name`!), `access_token`, `is_active`
  - ⚠️ IMPORTANTE: Use `account_name` e não `ad_account_name`
- `meta_campaigns` - Campanhas do Meta
- `meta_adsets` - Conjuntos de anúncios
- `meta_ads` - Anúncios individuais

### Google Ads
- `google_ads_connections` - Conexões Google Ads
- `google_campaigns` - Campanhas do Google
- `google_adgroups` - Grupos de anúncios
- `google_ads` - Anúncios individuais

### Subscriptions
- `subscription_plans` - Planos de assinatura
- `subscriptions` - Assinaturas ativas
- `subscription_intents` - Intenções de assinatura

## Important Notes

1. **Use `memberships` table** - NOT `organization_members`
2. **Organization ID field** - Use `org_id` OR `organization_id` (check table structure)
3. **Client isolation** - Always filter by `client_id` or `org_id`
4. **RLS Policies** - All client data must have RLS enabled

## Common Patterns

### Check user's organization
```sql
SELECT organization_id FROM memberships
WHERE user_id = auth.uid()
```

### Check user's clients
```sql
SELECT c.* FROM clients c
JOIN memberships m ON m.organization_id = c.org_id
WHERE m.user_id = auth.uid()
```

### RLS Policy Pattern
```sql
CREATE POLICY "policy_name"
  ON table_name FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );
```


## ⚠️ Padrões Críticos Next.js 15

### Supabase Client (SEMPRE use await!)
```typescript
// ❌ ERRADO - Causa erro "Cannot read properties of undefined"
const supabase = createClient();

// ✅ CORRETO - Next.js 15 requer await
const supabase = await createClient();
```

### Tabela client_meta_connections
```typescript
// ❌ ERRADO - Coluna não existe
{
  ad_account_name: 'Nome da conta',
  status: 'active'
}

// ✅ CORRETO - Nomes corretos das colunas
{
  account_name: 'Nome da conta',
  is_active: true
}
```
