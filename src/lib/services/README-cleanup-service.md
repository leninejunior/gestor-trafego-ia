# Cleanup Service

Serviço responsável pela limpeza automática de dados históricos e gerenciamento de partições do banco de dados.

## Visão Geral

O CleanupService implementa os requisitos 2.3, 10.1 e 10.2 do sistema de cache de dados históricos:

- **Requisito 2.3**: Remoção automática de dados além do período de retenção configurado
- **Requisito 10.1**: Agregação de métricas por dia
- **Requisito 10.2**: Particionamento mensal para otimizar queries

## Funcionalidades

### 1. Limpeza de Dados Expirados

Remove automaticamente dados históricos que excedem o período de retenção configurado no plano do cliente.

```typescript
import { cleanupService } from '@/lib/services/cleanup-service';

// Limpar dados de um cliente específico
const result = await cleanupService.deleteExpiredData(clientId);
console.log(`Removidos ${result.records_deleted} registros`);

// Limpar dados de todos os clientes
const results = await cleanupService.deleteExpiredDataForAllClients();
```

### 2. Gerenciamento de Partições

Cria partições mensais automaticamente para otimizar o armazenamento e performance de queries.

```typescript
// Criar partições para os próximos 3 meses
const partitions = await cleanupService.createMonthlyPartitions(3);

// Verificar partições criadas
partitions.forEach(p => {
  console.log(`${p.partition_name}: ${p.created ? 'criada' : 'já existe'}`);
});
```

### 3. Arquivamento de Partições Antigas

Desanexa partições antigas da tabela principal, mantendo os dados mas tornando-os inacessíveis para queries normais.

```typescript
// Arquivar partições com mais de 12 meses
const archived = await cleanupService.archiveOldPartitions(12);

archived.forEach(a => {
  if (a.archived) {
    console.log(`Partição ${a.partition_name} arquivada`);
  } else {
    console.error(`Erro ao arquivar ${a.partition_name}: ${a.error}`);
  }
});
```

### 4. Estatísticas de Limpeza

Obtém estatísticas sobre o estado atual do sistema de limpeza.

```typescript
const stats = await cleanupService.getCleanupStats();
console.log(`Total de clientes: ${stats.total_clients}`);
console.log(`Total de partições: ${stats.total_partitions}`);
```

## Integração com Planos

O CleanupService integra-se com o PlanConfigurationService para determinar o período de retenção de cada cliente:

- Consulta o plano ativo do usuário
- Aplica o `data_retention_days` configurado no plano
- Remove dados anteriores ao período de retenção

## Funções do Banco de Dados

O serviço utiliza funções SQL customizadas para operações avançadas:

### `check_partition_exists(table_name, partition_name)`
Verifica se uma partição existe.

### `list_partitions(parent_table)`
Lista todas as partições de uma tabela.

### `execute_sql(sql_query)`
Executa SQL dinâmico (apenas super admins).

### `get_partition_sizes(parent_table)`
Retorna informações de tamanho das partições.

### `get_client_cleanup_stats(client_id)`
Estatísticas de limpeza para um cliente específico.

### `get_overall_cleanup_stats()`
Estatísticas gerais de limpeza do sistema.

### `create_next_month_partition()`
Cria automaticamente a partição do próximo mês.

## Uso em Cron Jobs

O CleanupService é projetado para ser executado em cron jobs:

```typescript
// Em /api/cron/cleanup/route.ts
import { cleanupService } from '@/lib/services/cleanup-service';

export async function GET() {
  try {
    // Limpar dados expirados
    const cleanupResults = await cleanupService.deleteExpiredDataForAllClients();
    
    // Criar partições futuras
    const partitions = await cleanupService.createMonthlyPartitions(3);
    
    // Arquivar partições antigas (opcional)
    const archived = await cleanupService.archiveOldPartitions(12);
    
    return Response.json({
      success: true,
      cleanup: cleanupResults,
      partitions,
      archived
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

## Considerações de Performance

1. **Limpeza em Lote**: A limpeza processa todos os clientes em sequência, mas continua mesmo se um falhar
2. **Particionamento**: Partições mensais otimizam queries por período
3. **Arquivamento**: Partições antigas podem ser arquivadas para reduzir overhead de queries
4. **Índices**: Mantém índices otimizados em `client_id` e `date`

## Segurança

- Apenas super admins podem executar SQL dinâmico
- RLS policies garantem isolamento de dados por cliente
- Logs de limpeza são mantidos para auditoria

## Monitoramento

Recomenda-se monitorar:

- Número de registros removidos por execução
- Tempo de execução da limpeza
- Tamanho das partições
- Falhas na criação de partições

## Exemplo Completo

```typescript
import { cleanupService } from '@/lib/services/cleanup-service';

async function runDailyCleanup() {
  console.log('Iniciando limpeza diária...');
  
  // 1. Criar partições futuras
  const partitions = await cleanupService.createMonthlyPartitions(3);
  console.log(`Partições verificadas: ${partitions.length}`);
  
  // 2. Limpar dados expirados
  const cleanupResults = await cleanupService.deleteExpiredDataForAllClients();
  const totalDeleted = cleanupResults.reduce((sum, r) => sum + r.records_deleted, 0);
  console.log(`Total de registros removidos: ${totalDeleted}`);
  
  // 3. Obter estatísticas
  const stats = await cleanupService.getCleanupStats();
  console.log('Estatísticas:', stats);
  
  // 4. Arquivar partições antigas (mensal)
  if (new Date().getDate() === 1) {
    const archived = await cleanupService.archiveOldPartitions(12);
    console.log(`Partições arquivadas: ${archived.filter(a => a.archived).length}`);
  }
  
  console.log('Limpeza concluída!');
}
```

## Troubleshooting

### Erro: "Only super admins can execute SQL"
- Certifique-se de que o usuário tem permissões de super admin
- Verifique a tabela `admin_users`

### Partições não sendo criadas
- Verifique se a função `execute_sql` está disponível
- Confirme que o formato de data está correto
- Verifique logs do PostgreSQL

### Limpeza muito lenta
- Considere adicionar índices em `date` e `client_id`
- Execute limpeza em horários de baixo tráfego
- Processe clientes em lotes menores

