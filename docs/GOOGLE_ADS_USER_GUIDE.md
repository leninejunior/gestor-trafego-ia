# Guia do Usuário - Google Ads Integration

## Introdução

Bem-vindo ao guia completo para usar a integração Google Ads no sistema de gerenciamento de campanhas. Este guia irá te ajudar a conectar suas contas Google Ads, visualizar campanhas e aproveitar todas as funcionalidades disponíveis.

## Primeiros Passos

### 1. Acessando o Sistema

1. Faça login no sistema com suas credenciais
2. No menu lateral, você verá as opções:
   - **Dashboard** - Visão geral de todas as plataformas
   - **Campanhas** - Meta Ads (Facebook/Instagram)
   - **Google Ads** - Campanhas do Google Ads
   - **Insights** - Analytics da Meta
   - **Insights Google** - Analytics do Google Ads

### 2. Verificando Permissões

Certifique-se de que você tem:
- Acesso à conta Google Ads que deseja conectar
- Permissões de administrador ou editor na conta
- Uma conta Google Ads ativa com campanhas

## Conectando sua Conta Google Ads

### Passo 1: Iniciar Conexão

1. Clique em **"Google Ads"** no menu lateral
2. Se ainda não conectou uma conta, você verá um botão **"Conectar Google Ads"**
3. Clique no botão para iniciar o processo de conexão

![Botão Conectar Google Ads](screenshots/connect-google-button.png)

### Passo 2: Autorização Google

1. Você será redirecionado para a página de autorização do Google
2. Faça login com a conta Google que tem acesso ao Google Ads
3. Revise as permissões solicitadas:
   - Visualizar e gerenciar suas campanhas Google Ads
   - Acessar dados de performance das campanhas
4. Clique em **"Permitir"** para autorizar o acesso

![Tela de Autorização Google](screenshots/google-oauth-screen.png)

### Passo 3: Seleção de Contas

1. Após a autorização, você verá uma lista das contas Google Ads disponíveis
2. Selecione as contas que deseja conectar ao sistema
3. Você pode conectar múltiplas contas se necessário
4. Clique em **"Conectar Contas Selecionadas"**

![Seleção de Contas](screenshots/account-selection.png)

### Passo 4: Sincronização Inicial

1. O sistema iniciará automaticamente a sincronização das suas campanhas
2. Este processo pode levar alguns minutos dependendo do número de campanhas
3. Você verá uma barra de progresso indicando o status da sincronização
4. Quando concluído, você será redirecionado para o dashboard Google Ads

![Sincronização em Progresso](screenshots/sync-progress.png)

## Navegando pelo Dashboard Google Ads

### Visão Geral

O dashboard Google Ads oferece uma visão completa das suas campanhas:

![Dashboard Google Ads](screenshots/google-dashboard.png)

#### Seção Superior - KPIs Principais
- **Gasto Total**: Valor total investido no período selecionado
- **Conversões**: Número total de conversões obtidas
- **ROAS**: Retorno sobre investimento em anúncios
- **CPA**: Custo por aquisição médio

#### Filtros e Controles
- **Período**: Selecione o intervalo de datas para análise
- **Status**: Filtre campanhas por status (Ativa, Pausada, Removida)
- **Sincronizar**: Force uma nova sincronização dos dados
- **Exportar**: Exporte os dados para CSV ou Excel

### Lista de Campanhas

A tabela de campanhas mostra:

| Coluna | Descrição |
|--------|-----------|
| Nome | Nome da campanha no Google Ads |
| Status | Status atual (🟢 Ativa, 🟡 Pausada, 🔴 Removida) |
| Orçamento | Orçamento diário configurado |
| Impressões | Número de vezes que os anúncios foram exibidos |
| Cliques | Número de cliques recebidos |
| CTR | Taxa de cliques (%) |
| Conversões | Número de conversões obtidas |
| Custo | Valor gasto no período |
| CPA | Custo por aquisição |
| ROAS | Retorno sobre investimento |

![Lista de Campanhas](screenshots/campaigns-list.png)

### Ações Disponíveis

Para cada campanha, você pode:
- **👁️ Visualizar**: Ver detalhes completos da campanha
- **📊 Analisar**: Acessar analytics detalhados
- **🔄 Atualizar**: Forçar atualização dos dados

## Funcionalidades Detalhadas

### 1. Análise de Campanhas

#### Acessando Detalhes da Campanha

1. Na lista de campanhas, clique no ícone **👁️** ou no nome da campanha
2. Você será direcionado para a página de detalhes da campanha

![Detalhes da Campanha](screenshots/campaign-details.png)

#### Informações Disponíveis

**Métricas Principais:**
- Performance diária, semanal e mensal
- Gráficos de tendência de impressões, cliques e conversões
- Comparação com períodos anteriores

**Dados Demográficos:**
- Distribuição por idade e gênero (quando disponível)
- Performance por localização geográfica
- Dispositivos mais utilizados

**Histórico de Performance:**
- Evolução das métricas ao longo do tempo
- Identificação de picos e quedas de performance
- Correlação entre investimento e resultados

### 2. Analytics Avançados

#### Acessando Insights Google

1. No menu lateral, clique em **"Insights Google"**
2. Selecione o período de análise desejado
3. Escolha as métricas que deseja visualizar

![Analytics Google Ads](screenshots/google-analytics.png)

#### Tipos de Análise Disponíveis

**Análise Temporal:**
- Gráficos de linha mostrando evolução das métricas
- Comparação entre diferentes períodos
- Identificação de sazonalidades

**Análise Comparativa:**
- Comparação entre campanhas
- Benchmark de performance
- Identificação de melhores práticas

**Análise de ROI:**
- Cálculo detalhado do retorno sobre investimento
- Análise de custo-benefício por campanha
- Projeções de performance

### 3. Dashboard Unificado

#### Visão Consolidada

O dashboard principal combina dados do Google Ads e Meta Ads:

![Dashboard Unificado](screenshots/unified-dashboard.png)

**Métricas Consolidadas:**
- Gasto total em todas as plataformas
- Conversões agregadas
- ROAS médio ponderado
- Performance comparativa entre plataformas

**Gráficos Comparativos:**
- Distribuição de investimento por plataforma
- Performance relativa Meta vs Google
- Tendências de crescimento

### 4. Exportação de Dados

#### Como Exportar Relatórios

1. Em qualquer dashboard, clique no botão **"Exportar"**
2. Selecione o formato desejado (CSV ou Excel)
3. Escolha o período e métricas para incluir
4. Clique em **"Gerar Relatório"**

![Exportação de Dados](screenshots/export-dialog.png)

#### Tipos de Relatório Disponíveis

**Relatório de Campanhas:**
- Lista completa de campanhas com métricas
- Dados de performance por período
- Comparação entre campanhas

**Relatório Consolidado:**
- Dados de Meta Ads e Google Ads combinados
- Análise comparativa entre plataformas
- Métricas agregadas

**Relatório Personalizado:**
- Selecione métricas específicas
- Defina filtros customizados
- Agende relatórios automáticos

## Gerenciamento de Conexões

### Verificando Status da Conexão

1. Vá para **"Google Ads"** no menu lateral
2. No canto superior direito, você verá o status da conexão:
   - 🟢 **Conectado**: Tudo funcionando normalmente
   - 🟡 **Atenção**: Token expirando em breve
   - 🔴 **Desconectado**: Necessário reconectar

![Status da Conexão](screenshots/connection-status.png)

### Reconectando uma Conta

Se sua conexão expirar ou apresentar problemas:

1. Clique no botão **"Reconectar"** no dashboard Google Ads
2. Siga o mesmo processo de autorização inicial
3. Suas campanhas e dados históricos serão preservados

### Desconectando uma Conta

Para remover uma conexão Google Ads:

1. Vá para **Configurações** > **Integrações**
2. Encontre a conexão Google Ads que deseja remover
3. Clique em **"Desconectar"**
4. Confirme a ação

⚠️ **Atenção**: Desconectar uma conta não remove os dados históricos, mas impede novas sincronizações.

## Sincronização de Dados

### Sincronização Automática

O sistema sincroniza automaticamente seus dados Google Ads:
- **Frequência**: A cada 6 horas
- **Horários**: 00:00, 06:00, 12:00, 18:00 (UTC)
- **Dados**: Campanhas, métricas e performance

### Sincronização Manual

Para forçar uma atualização imediata:

1. No dashboard Google Ads, clique no botão **"Sincronizar"**
2. Aguarde a conclusão do processo (1-5 minutos)
3. Os dados serão atualizados automaticamente na tela

![Sincronização Manual](screenshots/manual-sync.png)

### Status da Sincronização

Você pode verificar o status da última sincronização:
- **Data/Hora**: Quando foi a última atualização
- **Status**: Sucesso, Em andamento, ou Erro
- **Próxima**: Quando será a próxima sincronização automática

## Filtros e Pesquisa

### Filtros Disponíveis

**Por Período:**
- Hoje
- Últimos 7 dias
- Últimos 30 dias
- Último mês
- Período personalizado

**Por Status:**
- Todas as campanhas
- Apenas ativas
- Apenas pausadas
- Apenas removidas

**Por Performance:**
- Maior gasto
- Maior número de conversões
- Melhor ROAS
- Menor CPA

![Filtros](screenshots/filters.png)

### Pesquisa de Campanhas

Use a barra de pesquisa para encontrar campanhas específicas:
- Digite o nome da campanha
- Use palavras-chave parciais
- Pesquise por ID da campanha

## Notificações e Alertas

### Tipos de Notificação

O sistema pode enviar notificações sobre:
- **Conexão expirada**: Quando precisa reconectar
- **Erro de sincronização**: Quando há problemas na atualização
- **Performance**: Alertas sobre mudanças significativas
- **Orçamento**: Quando campanhas atingem limites

### Configurando Alertas

1. Vá para **Configurações** > **Notificações**
2. Ative os tipos de alerta desejados
3. Configure os critérios (ex: queda de 20% nas conversões)
4. Escolha como receber (email, no sistema, ou ambos)

![Configuração de Alertas](screenshots/alert-settings.png)

## Dicas e Melhores Práticas

### 1. Monitoramento Regular

- Verifique o dashboard pelo menos uma vez por dia
- Configure alertas para mudanças significativas
- Mantenha a conexão sempre ativa

### 2. Análise de Performance

- Compare períodos similares (semana vs semana)
- Analise tendências de longo prazo
- Identifique padrões sazonais

### 3. Otimização de Campanhas

- Use os insights para identificar campanhas com melhor performance
- Analise quais estratégias funcionam melhor
- Monitore o ROAS de cada campanha

### 4. Relatórios Regulares

- Exporte relatórios mensais para análise
- Compartilhe insights com sua equipe
- Mantenha histórico de performance

## Limites e Restrições

### Por Plano de Assinatura

**Plano Básico:**
- Até 5 contas Google Ads
- 30 dias de histórico
- Sincronização a cada 12 horas
- Exportação limitada

**Plano Pro:**
- Até 20 contas Google Ads
- 90 dias de histórico
- Sincronização a cada 6 horas
- Exportação ilimitada

**Plano Enterprise:**
- Contas ilimitadas
- 365 dias de histórico
- Sincronização a cada 2 horas
- Recursos avançados de API

### Limites Técnicos

- **Campanhas por conta**: Sem limite
- **Sincronização manual**: 1 por minuto
- **Exportação**: 5 relatórios por hora
- **Retenção de dados**: Conforme plano contratado

## Suporte e Ajuda

### Recursos de Autoajuda

1. **Central de Ajuda**: Acesse via menu "?" no sistema
2. **Tutoriais em Vídeo**: Disponíveis na seção de ajuda
3. **FAQ**: Perguntas frequentes com respostas rápidas

### Contato com Suporte

**Chat Online:**
- Disponível 24/7 para planos Pro e Enterprise
- Horário comercial para plano Básico

**Email:**
- suporte@seudominio.com
- Resposta em até 24 horas

**Telefone:**
- (11) 1234-5678
- Horário: Segunda a Sexta, 9h às 18h

### Informações para Suporte

Ao entrar em contato, tenha em mãos:
- ID do seu cliente no sistema
- Descrição detalhada do problema
- Screenshots se aplicável
- Horário aproximado quando o problema ocorreu

## Atualizações e Novidades

### Como Ficar Informado

- **Notificações no Sistema**: Avisos sobre novas funcionalidades
- **Newsletter**: Atualizações mensais por email
- **Blog**: Artigos sobre melhores práticas e novidades

### Histórico de Atualizações

**Versão 2.1 (Atual):**
- Integração completa Google Ads
- Dashboard unificado
- Exportação avançada
- Alertas personalizáveis

**Próximas Funcionalidades:**
- Automação de campanhas
- IA para otimização
- Relatórios preditivos
- Integração com mais plataformas

---

## Conclusão

A integração Google Ads oferece uma visão completa e unificada das suas campanhas publicitárias. Com as ferramentas e funcionalidades disponíveis, você pode:

- Monitorar performance em tempo real
- Comparar resultados entre plataformas
- Tomar decisões baseadas em dados
- Otimizar seus investimentos em publicidade

Para aproveitar ao máximo o sistema, explore todas as funcionalidades, configure alertas relevantes e mantenha um monitoramento regular das suas campanhas.

**Precisa de ajuda?** Nossa equipe de suporte está sempre disponível para auxiliar você a alcançar os melhores resultados com suas campanhas Google Ads.