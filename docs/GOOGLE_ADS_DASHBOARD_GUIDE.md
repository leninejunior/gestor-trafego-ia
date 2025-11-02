# Guia do Dashboard Google Ads

## Visão Geral

O Dashboard Google Ads oferece uma interface completa para monitorar, analisar e gerenciar suas campanhas publicitárias do Google. Este guia detalha todas as funcionalidades disponíveis e como utilizá-las efetivamente.

## Acessando o Dashboard

### Navegação Principal

1. **Faça login** no sistema
2. No menu lateral, clique em **"Google Ads"**
3. Você será direcionado para o dashboard principal

![Navegação Menu](screenshots/navigation-menu.png)

### Estrutura do Dashboard

O dashboard está organizado em seções principais:
- **Header**: Controles globais e filtros
- **KPIs**: Métricas principais em cards
- **Gráficos**: Visualizações de performance
- **Tabela de Campanhas**: Lista detalhada das campanhas
- **Sidebar**: Informações da conta e ações rápidas

## Seção de KPIs (Métricas Principais)

### Cards de Performance

O topo do dashboard exibe 4 cards principais com as métricas mais importantes:

![KPI Cards](screenshots/kpi-cards.png)

#### 1. Gasto Total
- **Valor**: Investimento total no período selecionado
- **Comparação**: Percentual de variação vs período anterior
- **Indicador**: 🔴 Aumento | 🟢 Redução | ⚪ Estável

#### 2. Conversões
- **Valor**: Número total de conversões obtidas
- **Comparação**: Variação percentual
- **Meta**: Indicador se está acima/abaixo da meta

#### 3. ROAS (Return on Ad Spend)
- **Valor**: Retorno sobre investimento em anúncios
- **Fórmula**: Receita ÷ Gasto com anúncios
- **Benchmark**: Comparação com média do setor

#### 4. CPA (Cost Per Acquisition)
- **Valor**: Custo médio por aquisição/conversão
- **Fórmula**: Gasto total ÷ Número de conversões
- **Tendência**: Indicador de melhoria/piora

### Interpretando os Indicadores

| Cor | Significado | Ação Recomendada |
|-----|-------------|------------------|
| 🟢 Verde | Performance positiva | Manter estratégia atual |
| 🟡 Amarelo | Atenção necessária | Monitorar de perto |
| 🔴 Vermelho | Performance abaixo do esperado | Revisar e otimizar |

## Controles e Filtros

### Barra de Controles Superior

![Controles Dashboard](screenshots/dashboard-controls.png)

#### Seletor de Período
Permite escolher o intervalo de dados para análise:

**Períodos Pré-definidos:**
- Hoje
- Ontem
- Últimos 7 dias
- Últimos 30 dias
- Este mês
- Mês passado

**Período Personalizado:**
1. Clique em **"Personalizado"**
2. Selecione **data inicial** e **data final**
3. Clique em **"Aplicar"**

#### Filtro de Status
Filtra campanhas por status atual:
- **Todas**: Exibe todas as campanhas
- **Ativas**: Apenas campanhas em execução
- **Pausadas**: Campanhas temporariamente pausadas
- **Removidas**: Campanhas encerradas

#### Filtro de Performance
Ordena campanhas por critérios de performance:
- **Maior Gasto**: Campanhas com maior investimento
- **Mais Conversões**: Campanhas com mais resultados
- **Melhor ROAS**: Campanhas mais rentáveis
- **Menor CPA**: Campanhas mais eficientes

### Ações Rápidas

#### Botão Sincronizar
- **Função**: Força atualização imediata dos dados
- **Quando usar**: Quando precisa de dados mais recentes
- **Tempo**: Processo leva 1-3 minutos

#### Botão Exportar
- **Função**: Gera relatório dos dados atuais
- **Formatos**: CSV, Excel, PDF
- **Conteúdo**: Dados filtrados atualmente na tela

## Gráficos de Performance

### Gráfico Principal de Tendências

![Gráfico Tendências](screenshots/performance-chart.png)

#### Métricas Disponíveis
Você pode alternar entre diferentes métricas:
- **Impressões**: Número de vezes que anúncios foram exibidos
- **Cliques**: Número de cliques recebidos
- **Conversões**: Ações desejadas completadas
- **Gasto**: Valor investido
- **CTR**: Taxa de cliques (%)
- **ROAS**: Retorno sobre investimento

#### Controles do Gráfico
- **Zoom**: Clique e arraste para ampliar período específico
- **Hover**: Passe o mouse sobre pontos para ver valores exatos
- **Legenda**: Clique para mostrar/ocultar métricas

### Gráfico de Distribuição

Mostra a distribuição percentual de:
- **Gasto por campanha**
- **Conversões por campanha**
- **Impressões por dispositivo**
- **Performance por horário**

## Lista de Campanhas

### Tabela Principal

A tabela de campanhas é o coração do dashboard, mostrando informações detalhadas:

![Tabela Campanhas](screenshots/campaigns-table.png)

#### Colunas Disponíveis

| Coluna | Descrição | Ordenação |
|--------|-----------|-----------|
| **Nome** | Nome da campanha no Google Ads | Alfabética |
| **Status** | Estado atual da campanha | Por status |
| **Orçamento** | Orçamento diário configurado | Por valor |
| **Impressões** | Número de exibições | Por quantidade |
| **Cliques** | Número de cliques | Por quantidade |
| **CTR** | Taxa de cliques (%) | Por percentual |
| **Conversões** | Número de conversões | Por quantidade |
| **Custo** | Valor gasto no período | Por valor |
| **CPA** | Custo por aquisição | Por valor |
| **ROAS** | Retorno sobre investimento | Por valor |

#### Indicadores Visuais

**Status das Campanhas:**
- 🟢 **Verde**: Campanha ativa e funcionando
- 🟡 **Amarelo**: Campanha pausada
- 🔴 **Vermelho**: Campanha removida ou com erro
- 🔵 **Azul**: Campanha em aprovação

**Performance:**
- ⬆️ **Seta para cima**: Melhoria na métrica
- ⬇️ **Seta para baixo**: Piora na métrica
- ➡️ **Seta lateral**: Estável

### Ações por Campanha

Para cada campanha, você pode realizar ações específicas:

#### Menu de Ações
Clique no ícone **⋮** no final de cada linha para acessar:

![Menu Ações](screenshots/campaign-actions.png)

**Opções Disponíveis:**
- 👁️ **Ver Detalhes**: Abre página com informações completas
- 📊 **Analytics**: Acessa análise detalhada da campanha
- 🔄 **Atualizar**: Força sincronização desta campanha específica
- 📋 **Copiar ID**: Copia ID da campanha para área de transferência
- 🔗 **Abrir no Google Ads**: Link direto para a campanha no Google Ads

### Paginação e Navegação

#### Controles de Paginação
- **Itens por página**: 10, 25, 50, 100
- **Navegação**: Primeira, Anterior, Próxima, Última
- **Indicador**: "Mostrando X de Y campanhas"

#### Busca e Filtros Avançados

**Barra de Busca:**
1. Digite o nome da campanha ou palavras-chave
2. Resultados são filtrados em tempo real
3. Use aspas para busca exata: "nome exato"

**Filtros Avançados:**
- **Por orçamento**: Campanhas acima/abaixo de valor específico
- **Por performance**: CTR, ROAS, CPA dentro de faixas
- **Por data de criação**: Campanhas criadas em período específico

## Sidebar de Informações

### Informações da Conta

![Sidebar Info](screenshots/sidebar-info.png)

#### Status da Conexão
- **Conta conectada**: Nome e ID da conta Google Ads
- **Última sincronização**: Data e hora da última atualização
- **Próxima sincronização**: Quando será a próxima atualização automática
- **Status do token**: Validade da autorização

#### Resumo Rápido
- **Total de campanhas**: Número total de campanhas na conta
- **Campanhas ativas**: Quantas estão atualmente rodando
- **Orçamento total**: Soma de todos os orçamentos diários
- **Gasto do mês**: Investimento acumulado no mês atual

### Ações Rápidas da Sidebar

#### Gerenciar Conexão
- **Reconectar**: Se houver problemas de autorização
- **Adicionar conta**: Conectar contas Google Ads adicionais
- **Configurações**: Ajustar preferências de sincronização

#### Links Úteis
- **Google Ads**: Link direto para sua conta Google Ads
- **Suporte**: Acesso rápido à central de ajuda
- **Documentação**: Guias e tutoriais

## Funcionalidades Avançadas

### Comparação de Períodos

#### Como Ativar
1. No seletor de período, marque **"Comparar com período anterior"**
2. Escolha o período de comparação
3. Os dados serão exibidos lado a lado

![Comparação Períodos](screenshots/period-comparison.png)

#### Interpretação dos Resultados
- **Verde**: Melhoria em relação ao período anterior
- **Vermelho**: Piora em relação ao período anterior
- **Percentual**: Magnitude da mudança

### Alertas e Notificações

#### Tipos de Alerta
O dashboard pode exibir alertas sobre:
- **Performance**: Quedas significativas em métricas
- **Orçamento**: Campanhas próximas do limite
- **Sincronização**: Problemas na atualização de dados
- **Conexão**: Necessidade de reautorização

#### Configurando Alertas
1. Clique no ícone **🔔** no header
2. Escolha **"Configurar Alertas"**
3. Defina critérios e limites
4. Selecione método de notificação

### Exportação Avançada

#### Opções de Exportação
1. Clique em **"Exportar"** no header
2. Escolha o formato desejado
3. Configure opções avançadas

![Exportação](screenshots/export-options.png)

**Formatos Disponíveis:**
- **CSV**: Para análise em Excel/Sheets
- **Excel**: Com formatação e gráficos
- **PDF**: Relatório visual completo
- **JSON**: Para integração com outras ferramentas

**Opções de Personalização:**
- **Colunas**: Selecione quais métricas incluir
- **Filtros**: Aplique filtros específicos
- **Agrupamento**: Por campanha, data, ou status
- **Período**: Defina intervalo específico

## Dicas de Uso Eficiente

### Monitoramento Diário

**Rotina Recomendada:**
1. **Verificar KPIs principais** - 2 minutos
2. **Revisar campanhas com alertas** - 5 minutos
3. **Analisar top performers** - 3 minutos
4. **Verificar orçamentos** - 2 minutos

### Análise Semanal

**Checklist Semanal:**
- ✅ Comparar performance vs semana anterior
- ✅ Identificar campanhas com melhor ROAS
- ✅ Revisar campanhas com alto CPA
- ✅ Analisar tendências de CTR
- ✅ Verificar distribuição de orçamento

### Otimização Mensal

**Ações Mensais:**
- 📊 Gerar relatório completo do mês
- 🎯 Revisar metas e KPIs
- 💰 Analisar ROI por campanha
- 📈 Identificar oportunidades de crescimento
- 🔄 Ajustar estratégias baseadas em dados

## Solução de Problemas

### Problemas Comuns no Dashboard

#### 1. Dados Não Carregam
**Sintomas**: Tela em branco ou loading infinito
**Soluções**:
- Recarregue a página (F5)
- Limpe cache do navegador
- Verifique conexão com internet
- Tente em navegador diferente

#### 2. Métricas Inconsistentes
**Sintomas**: Valores diferentes do Google Ads
**Causas Possíveis**:
- Diferença de fuso horário
- Período de sincronização
- Filtros aplicados
**Soluções**:
- Force sincronização manual
- Verifique configurações de fuso horário
- Compare períodos exatos

#### 3. Campanhas Não Aparecem
**Sintomas**: Lista vazia ou incompleta
**Verificações**:
- Status da conexão Google Ads
- Permissões da conta
- Filtros aplicados
- Última sincronização

### Quando Entrar em Contato com Suporte

Entre em contato se:
- ❌ Problemas persistem após tentativas de solução
- ❌ Dados claramente incorretos
- ❌ Funcionalidades não respondem
- ❌ Erros de sistema aparecem

**Informações para Fornecer:**
- ID da sua conta no sistema
- Descrição detalhada do problema
- Screenshots se possível
- Horário aproximado do problema
- Navegador e versão utilizados

## Atalhos de Teclado

Para usuários avançados, o dashboard suporta atalhos:

| Atalho | Função |
|--------|--------|
| `Ctrl + R` | Atualizar dados |
| `Ctrl + E` | Exportar dados |
| `Ctrl + F` | Buscar campanhas |
| `Ctrl + D` | Alterar período |
| `Esc` | Fechar modais |

## Personalização do Dashboard

### Configurações de Exibição

Acesse **Configurações** > **Dashboard** para personalizar:

**Layout:**
- Ordem dos cards de KPI
- Colunas visíveis na tabela
- Gráficos padrão exibidos

**Preferências:**
- Formato de números (1,000 vs 1.000)
- Moeda padrão de exibição
- Fuso horário
- Idioma da interface

**Alertas:**
- Limites para alertas automáticos
- Frequência de notificações
- Canais de notificação (email, sistema)

---

## Conclusão

O Dashboard Google Ads é uma ferramenta poderosa para monitoramento e análise de campanhas. Com as funcionalidades descritas neste guia, você pode:

- 📊 Monitorar performance em tempo real
- 🎯 Identificar oportunidades de otimização
- 📈 Acompanhar tendências e padrões
- 💰 Maximizar retorno sobre investimento
- 🚀 Tomar decisões baseadas em dados

**Próximos Passos:**
1. Explore todas as funcionalidades descritas
2. Configure alertas relevantes para seu negócio
3. Estabeleça uma rotina de monitoramento
4. Use os insights para otimizar suas campanhas

**Precisa de mais ajuda?** Consulte nossos outros guias ou entre em contato com o suporte técnico.