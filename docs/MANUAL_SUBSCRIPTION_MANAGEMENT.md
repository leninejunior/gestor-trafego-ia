# Gerenciamento Manual de Assinaturas

Este documento descreve como usar o sistema de gerenciamento manual de planos e assinaturas de clientes.

## Visão Geral

O sistema permite que administradores façam ajustes manuais em assinaturas de clientes, incluindo:

- **Mudança de Planos**: Alterar o plano de um cliente
- **Aprovação Manual**: Aprovar assinaturas pendentes
- **Ajustes de Cobrança**: Aplicar créditos ou débitos
- **Mudança de Status**: Alterar status da assinatura
- **Histórico Completo**: Rastrear todas as mudanças

## Como Acessar

1. Faça login como administrador
2. Acesse o painel admin
3. Vá para **Gerenciamento de Assinaturas** (`/admin/subscription-management`)

## Funcionalidades

### 1. Mudança de Plano

**Quando usar**: Cliente quer mudar para um plano diferente fora do fluxo normal.

**Como fazer**:
1. Encontre a organização na lista
2. Clique em "Ajustar"
3. Selecione "Mudança de Plano"
4. Escolha o novo plano
5. Selecione o ciclo de cobrança (mensal/anual)
6. Informe o motivo
7. Adicione notas se necessário
8. Clique em "Aplicar Ajuste"

**O que acontece**:
- A assinatura é atualizada imediatamente
- O histórico é registrado
- O cliente continua com o mesmo período de cobrança

### 2. Aprovação Manual

**Quando usar**: Assinatura está pendente e precisa ser ativada manualmente.

**Como fazer**:
1. Encontre a organização com status "pending" ou similar
2. Clique em "Ajustar"
3. Selecione "Aprovação Manual"
4. Informe o motivo (ex: "Pagamento confirmado via transferência")
5. Clique em "Aplicar Ajuste"

**O que acontece**:
- Status muda para "active"
- Cliente ganha acesso completo
- Histórico registra a aprovação manual

### 3. Ajuste de Cobrança

**Quando usar**: Precisa aplicar crédito ou cobrança adicional.

**Como fazer**:
1. Encontre a organização
2. Clique em "Ajustar"
3. Selecione "Ajuste de Cobrança"
4. Informe o valor:
   - **Positivo**: Cobrança adicional
   - **Negativo**: Crédito para o cliente
5. Informe o motivo
6. Clique em "Aplicar Ajuste"

**Exemplos**:
- `+50.00`: Cobrança adicional de R$ 50
- `-25.00`: Crédito de R$ 25 para o cliente

**O que acontece**:
- Uma fatura de ajuste é criada
- O valor é aplicado à conta do cliente
- Histórico registra o ajuste

### 4. Mudança de Status

**Quando usar**: Precisa pausar, reativar ou cancelar uma assinatura.

**Como fazer**:
1. Encontre a organização
2. Clique em "Ajustar"
3. Selecione "Mudança de Status"
4. Nas notas, informe o novo status (active, paused, canceled)
5. Informe o motivo
6. Clique em "Aplicar Ajuste"

**Status disponíveis**:
- `active`: Assinatura ativa
- `paused`: Assinatura pausada
- `canceled`: Assinatura cancelada
- `past_due`: Pagamento em atraso

## Histórico de Mudanças

### Visualizar Histórico

1. Acesse a aba "Histórico de Mudanças"
2. Veja todas as alterações recentes
3. Cada entrada mostra:
   - Tipo de ação
   - Organização afetada
   - Motivo da mudança
   - Admin responsável
   - Data e hora
   - Detalhes específicos da mudança

### Informações no Histórico

**Para Mudança de Plano**:
- Plano anterior e novo plano
- Preços antigos e novos

**Para Ajuste de Cobrança**:
- Valor do ajuste
- Tipo (crédito ou débito)

**Para Mudança de Status**:
- Status anterior e novo status

## Boas Práticas

### 1. Sempre Informar Motivo
- Seja específico sobre por que está fazendo a mudança
- Exemplos bons:
  - "Cliente solicitou upgrade via suporte"
  - "Pagamento confirmado via PIX"
  - "Erro na cobrança automática - aplicando crédito"

### 2. Usar Notas Adicionais
- Adicione contexto extra quando necessário
- Inclua números de ticket de suporte
- Mencione comunicação com o cliente

### 3. Verificar Antes de Aplicar
- Confirme que está alterando a organização correta
- Verifique os valores antes de aplicar ajustes
- Considere o impacto no próximo ciclo de cobrança

### 4. Comunicar com o Cliente
- Informe o cliente sobre mudanças importantes
- Explique ajustes de cobrança
- Confirme que a mudança atende às expectativas

## Segurança e Auditoria

### Controle de Acesso
- Apenas administradores podem fazer ajustes
- Todas as ações são registradas com ID do admin
- Políticas RLS protegem dados sensíveis

### Rastreabilidade
- Cada mudança é registrada permanentemente
- Histórico inclui dados antes e depois
- Timestamps precisos para auditoria

### Relatórios
- Estatísticas de ações por admin
- Relatórios por período
- Análise de tipos de ajustes mais comuns

## Troubleshooting

### Erro: "Organização não encontrada"
- Verifique se a organização existe
- Confirme permissões de admin
- Tente recarregar a página

### Erro: "Novo plano é obrigatório"
- Para mudança de plano, selecione um plano válido
- Certifique-se de que o plano está ativo

### Erro: "Valor é obrigatório"
- Para ajustes de cobrança, informe um valor
- Use números positivos para cobrança, negativos para crédito

### Histórico não aparece
- Verifique permissões de admin
- Confirme que há mudanças registradas
- Tente filtrar por período específico

## API Endpoints

Para integrações ou automações:

### Aplicar Ajuste Manual
```
POST /api/admin/subscriptions/manual-adjustment
```

### Buscar Histórico
```
GET /api/admin/subscriptions/audit-history
```

## Banco de Dados

### Tabela Principal
- `subscription_audit_log`: Registra todas as mudanças

### Funções Auxiliares
- `log_subscription_plan_change()`: Registra mudança de plano
- `log_billing_adjustment()`: Registra ajuste de cobrança
- `log_status_change()`: Registra mudança de status

### Views para Relatórios
- `subscription_plan_changes`: Relatório de mudanças de planos
- `billing_adjustments`: Relatório de ajustes de cobrança
- `audit_statistics`: Estatísticas mensais

## Próximos Passos

1. **Aplicar Schema**: Execute o script `scripts/apply-subscription-audit-schema.js`
2. **Testar Funcionalidade**: Faça alguns ajustes de teste
3. **Configurar Permissões**: Certifique-se de que apenas admins têm acesso
4. **Treinar Equipe**: Ensine a equipe a usar as funcionalidades
5. **Monitorar Uso**: Acompanhe o histórico de mudanças regularmente