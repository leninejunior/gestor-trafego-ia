# Testes de Schema - Checkout Payment Flow

Este diretório contém testes para validar a integridade e performance do schema de checkout e pagamentos.

## Arquivos de Teste

### `subscription-intents-schema.test.ts`
Testa a tabela `subscription_intents` e suas funcionalidades:
- Estrutura da tabela e constraints
- Validação de dados e transições de estado
- Performance de queries
- Funções utilitárias
- Políticas RLS

### `webhook-analytics-schema.test.ts`
Testa as tabelas de auditoria e analytics:
- `webhook_logs` - Logs de eventos de webhook
- `payment_analytics` - Métricas de conversão e receita
- `webhook_retry_queue` - Fila de retry para webhooks
- Funções de processamento e limpeza

## Como Executar os Testes

### Pré-requisitos
1. Schema aplicado no Supabase (usar `database/checkout-payment-schema-migration.sql`)
2. Variáveis de ambiente configuradas:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Executar Testes
```bash
# Executar todos os testes de schema
npm test src/__tests__/database/

# Executar teste específico
npm test src/__tests__/database/subscription-intents-schema.test.ts
```

### Script de Validação
```bash
# Executar validação completa do schema
node scripts/test-checkout-schema-migration.js
```

## Cobertura dos Testes

### Requirements Cobertos
- **1.3**: Validação de integridade do schema
- **2.1**: Testes de subscription intents
- **4.1**: Testes de logs de webhook
- **6.1, 6.2**: Testes de analytics de pagamento

### Funcionalidades Testadas
- ✅ Criação e estrutura das tabelas
- ✅ Índices para performance
- ✅ Constraints e validações
- ✅ Triggers e funções
- ✅ Políticas RLS
- ✅ Performance de queries
- ✅ Funções utilitárias
- ✅ Transições de estado
- ✅ Limpeza automática

## Métricas de Performance

Os testes validam que:
- Queries por índice executam em < 1 segundo
- Queries simples executam em < 500ms
- Agregações executam em < 1.5 segundos

## Troubleshooting

### Erro: "Could not find the table"
- Aplicar o script de migração no Supabase
- Verificar se as tabelas foram criadas corretamente

### Erro: "foreign key constraint"
- Verificar se `subscription_plans` existe
- Aplicar schema completo na ordem correta

### Erro de permissões
- Verificar se `SUPABASE_SERVICE_ROLE_KEY` está configurada
- Verificar políticas RLS