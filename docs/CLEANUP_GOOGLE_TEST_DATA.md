# Limpeza de Dados Fictícios do Google Ads

## Visão Geral

Este documento descreve como remover todos os dados de teste/mock do Google Ads e manter apenas as contas reais.

## Opções de Limpeza

### Opção 1: Via API (Recomendado)

Execute uma requisição POST para o endpoint de limpeza:

```bash
curl -X POST http://localhost:3000/api/admin/cleanup-google-test-data \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "All test/mock Google Ads data has been cleaned up",
  "summary": {
    "remaining_connections": 5,
    "remaining_campaigns": 23,
    "remaining_metrics": 1250
  },
  "remaining_data": {
    "connections": [...],
    "campaigns": [...]
  }
}
```

### Opção 2: Via SQL Direto (Supabase)

1. Abra o Supabase SQL Editor
2. Execute o script: `database/cleanup-google-test-data.sql`

**O script irá:**
- Deletar todas as conexões com customer_id contendo: test, mock, fake, demo, sandbox, ficticio, simulado
- Deletar todas as campanhas associadas
- Deletar todas as métricas associadas
- Deletar todos os logs de sincronização

## Dados Removidos

O script identifica e remove contas fictícias por padrões no `customer_id`:

- `%test%` - Contas de teste
- `%mock%` - Contas mock
- `%fake%` - Contas falsas
- `%demo%` - Contas de demonstração
- `%sandbox%` - Contas sandbox
- `%ficticio%` - Contas fictícias (português)
- `%simulado%` - Contas simuladas (português)

## Verificação Pós-Limpeza

Após executar a limpeza, verifique os dados restantes:

```sql
-- Verificar conexões restantes
SELECT 
  id,
  customer_id,
  status,
  created_at
FROM google_ads_connections
ORDER BY created_at DESC;

-- Verificar campanhas restantes
SELECT 
  id,
  campaign_id,
  campaign_name,
  status,
  created_at
FROM google_ads_campaigns
ORDER BY created_at DESC;

-- Contar métricas
SELECT COUNT(*) as total_metrics
FROM google_ads_metrics;
```

## Segurança

- ✅ Requer autenticação de admin
- ✅ Usa soft-delete patterns onde aplicável
- ✅ Mantém integridade referencial
- ✅ Não afeta dados de clientes reais

## Rollback

Se precisar restaurar dados deletados:

1. Verifique backups do Supabase
2. Use o histórico de versões do banco de dados
3. Contacte o suporte do Supabase se necessário

## Próximos Passos

Após a limpeza:

1. ✅ Sincronize apenas contas reais do MCC
2. ✅ Valide que todas as campanhas reais estão presentes
3. ✅ Monitore os logs de sincronização
4. ✅ Configure alertas para novas sincronizações
