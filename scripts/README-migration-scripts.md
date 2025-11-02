# Scripts de Migração - Sistema de Checkout e Pagamentos

## Visão Geral

Este diretório contém scripts para migração completa do sistema de checkout e pagamentos, incluindo validação de integridade e procedimentos de rollback.

## Scripts Disponíveis

### 1. migrate-checkout-system.js

Script principal de migração que executa todo o processo de migração de dados existentes para o novo sistema.

**Uso:**
```bash
# Migração completa
node scripts/migrate-checkout-system.js

# Migração com rollback automático em caso de falha
node scripts/migrate-checkout-system.js --auto-rollback
```

**Funcionalidades:**
- Backup automático de dados existentes
- Aplicação do novo schema
- Migração de dados de `subscriptions` para `subscription_intents`
- Validação de integridade pós-migração
- Rollback automático em caso de falha (opcional)

**Saídas:**
- `backups/checkout-migration-{timestamp}.json` - Backup dos dados
- `migration-state.json` - Estado da migração para rollback

### 2. validate-migration-integrity.js

Script de validação completa da integridade da migração.

**Uso:**
```bash
# Validação completa
node scripts/validate-migration-integrity.js
```

**Validações realizadas:**
- Estrutura das tabelas
- Integridade referencial
- Consistência de dados
- Funcionalidades do sistema

**Saídas:**
- `validation-report-{timestamp}.json` - Relatório detalhado
- Exit code 0 (sucesso) ou 1 (falha)

### 3. rollback-checkout-migration.js

Script de rollback completo da migração em caso de problemas.

**Uso:**
```bash
# Visualizar o que será feito (dry-run)
node scripts/rollback-checkout-migration.js

# Executar rollback
node scripts/rollback-checkout-migration.js --force

# Rollback com remoção completa do schema
node scripts/rollback-checkout-migration.js --force --force-schema-removal

# Manter arquivos de migração
node scripts/rollback-checkout-migration.js --force --keep-files
```

**Funcionalidades:**
- Remoção de dados migrados
- Restauração de dados originais (se necessário)
- Remoção opcional do novo schema
- Validação do rollback
- Limpeza de arquivos temporários

### 4. test-checkout-schema-migration.js

Script de teste para validar o schema após aplicação.

**Uso:**
```bash
# Teste completo do schema
node scripts/test-checkout-schema-migration.js
```

**Testes realizados:**
- Validação de tabelas
- Teste de funcionalidades
- Teste de performance básica
- Validação de constraints

## Fluxo de Migração Recomendado

### 1. Preparação

```bash
# 1. Verificar ambiente
node scripts/check-env.js

# 2. Verificar tabelas existentes
node scripts/check-existing-tables.js

# 3. Fazer backup manual adicional (opcional)
pg_dump -Fc sua_database > backup-pre-migration.dump
```

### 2. Execução da Migração

```bash
# Migração com rollback automático (recomendado)
node scripts/migrate-checkout-system.js --auto-rollback
```

### 3. Validação

```bash
# Validar integridade
node scripts/validate-migration-integrity.js

# Testar schema
node scripts/test-checkout-schema-migration.js
```

### 4. Em caso de problemas

```bash
# Rollback completo
node scripts/rollback-checkout-migration.js --force
```

## Estrutura de Arquivos Gerados

```
projeto/
├── backups/
│   └── checkout-migration-{timestamp}.json
├── migration-state.json
├── validation-report-{timestamp}.json
└── scripts/
    ├── migrate-checkout-system.js
    ├── validate-migration-integrity.js
    ├── rollback-checkout-migration.js
    └── test-checkout-schema-migration.js
```

## Variáveis de Ambiente Necessárias

```bash
# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Configurações opcionais
AUTO_ROLLBACK=true  # Rollback automático em falhas
```

## Logs e Monitoramento

### Logs de Migração

Os scripts geram logs detalhados no console com códigos de cores:
- ✅ Sucesso
- ❌ Erro
- ⚠️ Aviso
- ℹ️ Informação

### Arquivos de Estado

#### migration-state.json
```json
{
  "startTime": "2024-01-15T10:00:00.000Z",
  "endTime": "2024-01-15T10:05:30.000Z",
  "duration": 330000,
  "backupCreated": true,
  "backupPath": "backups/checkout-migration-1705320000000.json",
  "schemaApplied": true,
  "dataMigrated": true,
  "validationPassed": true,
  "rollbackData": {
    "subscriptionMapping": {
      "old-id-1": "new-id-1",
      "old-id-2": "new-id-2"
    }
  }
}
```

#### validation-report.json
```json
{
  "timestamp": "2024-01-15T10:05:30.000Z",
  "results": {
    "Estrutura das Tabelas": {
      "passed": 4,
      "failed": 0,
      "warnings": 0
    },
    "Integridade Referencial": {
      "passed": 3,
      "failed": 0,
      "warnings": 1
    }
  },
  "summary": {
    "totalResults": {
      "passed": 15,
      "failed": 0,
      "warnings": 2
    },
    "successRate": 88.2,
    "overallStatus": "✅ BOM - Migração bem-sucedida com avisos menores",
    "isHealthy": true
  }
}
```

## Troubleshooting

### Problemas Comuns

#### 1. Erro de Permissão
```
❌ Erro: permission denied for table subscription_intents
```

**Solução:**
- Verificar se `SUPABASE_SERVICE_ROLE_KEY` está configurada
- Confirmar permissões RLS no Supabase

#### 2. Tabela Não Existe
```
❌ Erro: relation "subscription_intents" does not exist
```

**Solução:**
- Aplicar schema manualmente antes da migração
- Verificar se arquivos SQL estão no local correto

#### 3. Dados Inconsistentes
```
⚠️ 5 intents com planos inválidos
```

**Solução:**
- Verificar integridade dos dados originais
- Corrigir referências quebradas antes da migração

#### 4. Falha de Validação
```
❌ Validação falhou - considere rollback
```

**Solução:**
- Executar rollback: `node scripts/rollback-checkout-migration.js --force`
- Investigar causa da falha
- Corrigir problemas e tentar novamente

### Comandos de Debug

```bash
# Verificar estado atual das tabelas
psql -c "SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE '%subscription%';"

# Contar registros migrados
psql -c "SELECT COUNT(*) FROM subscription_intents WHERE metadata->>'migrated_from' IS NOT NULL;"

# Verificar logs de erro
tail -f /var/log/postgresql/postgresql.log
```

## Segurança

### Backups
- Backups automáticos são criados antes da migração
- Backups incluem todas as tabelas relacionadas
- Arquivos de backup são salvos em `backups/`

### Rollback
- Rollback pode ser executado a qualquer momento
- Dados originais são preservados durante migração
- Estado da migração é salvo para rollback preciso

### Validação
- Múltiplas camadas de validação
- Verificação de integridade referencial
- Testes funcionais automatizados

## Suporte

Para problemas com os scripts de migração:

1. Verificar logs detalhados no console
2. Consultar arquivos de estado gerados
3. Executar validação independente
4. Em caso de dúvida, executar rollback

**Contato:** Equipe de DevOps / Engenharia