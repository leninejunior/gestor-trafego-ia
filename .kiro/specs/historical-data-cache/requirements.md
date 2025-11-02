# Requirements Document

## Introduction

Este documento define os requisitos para implementar um sistema de cache de dados históricos de campanhas Meta Ads, com limites diferenciados por plano de assinatura. O sistema visa melhorar performance, reduzir custos de API e garantir disponibilidade de dados históricos mesmo quando campanhas são deletadas.

## Glossary

- **System**: O sistema de gerenciamento de campanhas Meta Ads
- **Cache Service**: Serviço responsável por sincronizar e armazenar dados históricos
- **Sync Job**: Processo automatizado de sincronização de dados
- **Historical Data**: Dados de métricas de campanhas agregados por dia
- **Retention Period**: Período de tempo que os dados históricos são mantidos
- **Subscription Plan**: Plano de assinatura configurável pelo administrador
- **Plan Limits**: Limites configuráveis de recursos por plano (clientes, campanhas, retenção, sync)
- **Meta API**: API de Marketing do Facebook/Meta
- **Dashboard**: Interface de visualização de métricas e relatórios
- **Admin Panel**: Interface administrativa para configuração de planos e limites

## Requirements

### Requirement 1

**User Story:** Como administrador, quero configurar limites de retenção de dados históricos por plano, para que eu possa criar ofertas personalizadas e ajustar recursos conforme necessário.

#### Acceptance Criteria

1. WHEN o administrador cria um plano, THE Admin Panel SHALL permitir definir período de retenção em dias
2. WHEN o administrador edita um plano, THE Admin Panel SHALL permitir alterar período de retenção
3. WHEN o período de retenção é alterado, THE System SHALL aplicar novo limite apenas para novos dados
4. THE Admin Panel SHALL validar que período de retenção seja entre 30 e 3650 dias
5. WHEN um plano é criado sem período de retenção definido, THE System SHALL usar valor padrão de 90 dias

### Requirement 2

**User Story:** Como usuário, quero visualizar dados históricos dentro do limite do meu plano, para que eu possa analisar o desempenho das minhas campanhas no período disponível.

#### Acceptance Criteria

1. WHEN o usuário solicita dados históricos, THE System SHALL consultar limite de retenção do plano ativo
2. WHEN o usuário solicita dados além do limite do plano, THE System SHALL retornar erro com mensagem indicando limite
3. WHERE o usuário possui plano ativo, THE Dashboard SHALL exibir apenas opções de período dentro do limite
4. WHEN o período de retenção expira, THE System SHALL remover automaticamente dados além do limite configurado

### Requirement 3

**User Story:** Como administrador, quero configurar limites de clientes e campanhas por plano, para que eu possa criar diferentes níveis de serviço.

#### Acceptance Criteria

1. WHEN o administrador cria um plano, THE Admin Panel SHALL permitir definir limite de clientes
2. WHEN o administrador cria um plano, THE Admin Panel SHALL permitir definir limite de campanhas por cliente
3. WHERE limite de clientes é definido como -1, THE System SHALL permitir clientes ilimitados
4. WHERE limite de campanhas é definido como -1, THE System SHALL permitir campanhas ilimitadas
5. THE Admin Panel SHALL validar que limites sejam números inteiros maiores ou iguais a -1

### Requirement 4

**User Story:** Como administrador, quero configurar frequência de sincronização por plano, para que eu possa balancear custos de API com atualização de dados.

#### Acceptance Criteria

1. WHEN o administrador cria um plano, THE Admin Panel SHALL permitir definir intervalo de sincronização em horas
2. THE Admin Panel SHALL validar que intervalo de sincronização seja entre 1 e 168 horas
3. WHEN o intervalo é alterado, THE System SHALL aplicar nova frequência na próxima execução do Sync Job
4. WHEN um plano é criado sem intervalo definido, THE System SHALL usar valor padrão de 24 horas
5. WHERE múltiplos clientes têm mesma frequência, THE Sync Job SHALL agrupar sincronizações para otimizar chamadas à API

### Requirement 5

**User Story:** Como desenvolvedor, quero que o sistema use cache para dados históricos e API para dados recentes, para que possamos otimizar performance e custos.

#### Acceptance Criteria

1. WHEN o Dashboard solicita dados dos últimos 7 dias, THE System SHALL buscar da Meta API em tempo real
2. WHEN o Dashboard solicita dados com mais de 7 dias, THE System SHALL buscar do cache histórico
3. WHEN dados não existem no cache, THE System SHALL buscar da Meta API e armazenar no cache
4. WHEN a Meta API está indisponível, THE System SHALL retornar apenas dados do cache com indicador de status

### Requirement 6

**User Story:** Como usuário, quero que o sistema armazene dados mesmo de campanhas deletadas, para que eu possa manter histórico completo para relatórios e auditorias.

#### Acceptance Criteria

1. WHEN uma campanha é deletada na Meta, THE Cache Service SHALL manter dados históricos no cache
2. WHEN o usuário visualiza dados históricos, THE System SHALL incluir campanhas deletadas com indicador visual
3. WHEN o período de retenção expira, THE System SHALL remover dados de campanhas deletadas seguindo mesmas regras de retenção
4. WHERE uma campanha foi deletada, THE Dashboard SHALL exibir badge "Campanha Deletada"

### Requirement 7

**User Story:** Como usuário, quero visualizar meus limites de uso atuais, para que eu possa planejar meu uso e considerar upgrades quando necessário.

#### Acceptance Criteria

1. WHEN o usuário acessa o Dashboard, THE System SHALL exibir limites do plano atual
2. WHEN o usuário tenta adicionar cliente além do limite, THE System SHALL exibir mensagem com limite do plano
3. WHEN o usuário tenta adicionar campanha além do limite, THE System SHALL exibir mensagem com limite do plano
4. THE Dashboard SHALL exibir progresso de uso (ex: "3 de 5 clientes", "15 de 25 campanhas")
5. WHERE o plano permite recursos ilimitados, THE Dashboard SHALL exibir "Ilimitado"

### Requirement 8

**User Story:** Como administrador, quero configurar recursos de exportação por plano, para que eu possa diferenciar ofertas e agregar valor aos planos superiores.

#### Acceptance Criteria

1. WHEN o administrador cria um plano, THE Admin Panel SHALL permitir habilitar/desabilitar exportação CSV
2. WHEN o administrador cria um plano, THE Admin Panel SHALL permitir habilitar/desabilitar exportação JSON
3. WHERE exportação está desabilitada no plano, THE Dashboard SHALL ocultar opções de exportação
4. WHEN o usuário com exportação habilitada solicita exportação, THE System SHALL incluir dados dentro do período de retenção
5. WHEN a exportação é concluída, THE System SHALL enviar notificação com link de download válido por 24 horas

### Requirement 9

**User Story:** Como administrador, quero monitorar o uso de armazenamento e sincronização, para que eu possa otimizar custos e identificar problemas.

#### Acceptance Criteria

1. WHEN o Sync Job é executado, THE System SHALL registrar métricas de tempo de execução e volume de dados
2. WHEN o armazenamento atinge 80% da capacidade, THE System SHALL enviar alerta ao administrador
3. WHEN a sincronização falha 3 vezes consecutivas, THE System SHALL enviar alerta crítico
4. THE System SHALL fornecer dashboard administrativo com métricas de uso por cliente e plano

### Requirement 10

**User Story:** Como usuário, quero que o sistema otimize o armazenamento de dados, para que o serviço seja sustentável e performático.

#### Acceptance Criteria

1. WHEN o Cache Service armazena dados, THE System SHALL agregar métricas por dia
2. WHEN o Cache Service armazena dados, THE System SHALL usar particionamento por mês para otimizar queries
3. WHEN o Cache Service armazena dados, THE System SHALL criar índices em client_id, campaign_id e date
4. WHEN dados são consultados, THE System SHALL retornar resultados em menos de 2 segundos para períodos de até 90 dias

### Requirement 11

**User Story:** Como administrador, quero uma interface intuitiva para gerenciar configurações de planos, para que eu possa ajustar limites rapidamente conforme necessidade do negócio.

#### Acceptance Criteria

1. WHEN o administrador acessa configuração de planos, THE Admin Panel SHALL exibir todos os planos existentes
2. WHEN o administrador edita um plano, THE Admin Panel SHALL exibir formulário com todos os limites configuráveis
3. THE Admin Panel SHALL agrupar configurações em seções: Limites de Recursos, Cache e Sincronização, Exportação
4. WHEN o administrador salva alterações, THE System SHALL validar todos os campos antes de aplicar
5. WHEN alterações são salvas, THE System SHALL exibir mensagem de confirmação e aplicar mudanças imediatamente para novos usuários
