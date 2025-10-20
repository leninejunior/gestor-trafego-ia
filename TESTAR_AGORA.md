# 🚀 Testar Analytics Multi-Nível - Guia Rápido

## ✅ O que foi implementado

1. **Seleção múltipla de campanhas** com busca
2. **Range de data customizado** (escolher período específico)
3. **3 níveis de análise**: Campanhas, Conjuntos de Anúncios, Anúncios
4. **Thumbnails de criativos** nos anúncios
5. **Formatação de datas** em português

---

## 🧪 Como Testar

### 1. Iniciar o servidor

```bash
pnpm dev
```

### 2. Acessar Analytics

Navegue para: `http://localhost:3000/dashboard/analytics`

### 3. Testar Nível: Campanhas

**Passo a passo:**
1. Selecione um cliente no dropdown
2. Escolha um período (ex: "Últimos 30 dias")
3. Clique no card "Campanhas" (deve estar selecionado por padrão)
4. Veja a lista de campanhas carregar
5. Clique no campo "Selecionar campanhas..."
6. Marque 2 ou 3 campanhas
7. Veja os badges aparecerem
8. Veja a comparação de campanhas

**Teste a busca:**
- Digite no campo de busca dentro do dropdown
- Veja as campanhas filtrarem em tempo real

**Teste seleção múltipla:**
- Clique em "Selecionar todas"
- Clique em "Limpar"
- Remova campanhas individuais clicando no X dos badges

### 4. Testar Range de Data Customizado

**Passo a passo:**
1. No campo de período, selecione "Personalizado..."
2. Um dialog abrirá com 2 calendários
3. Selecione uma data inicial (ex: 01/01/2025)
4. Selecione uma data final (ex: 31/01/2025)
5. Clique em "Aplicar Período"
6. Veja o período customizado aparecer no campo
7. Os dados devem recarregar com o novo período

**Validações automáticas:**
- Não pode selecionar data final antes da inicial
- Não pode selecionar mais de 1 ano de diferença
- Não pode selecionar datas futuras

### 5. Testar Nível: Conjuntos de Anúncios

**Passo a passo:**
1. Clique no card "Conjuntos de Anúncios"
2. Selecione UMA campanha no dropdown
3. Aguarde carregar os conjuntos
4. Veja a tabela com todos os conjuntos
5. Veja o gráfico comparativo
6. Veja os indicadores de tendência (setas verde/vermelho)
7. Veja o resumo no final

**O que observar:**
- Gráfico de barras com Gasto e Conversões
- Setas indicando se está acima/abaixo da média
- Badges de status (ACTIVE, PAUSED, etc)
- Métricas: CTR, CPC, CPM, etc

### 6. Testar Nível: Anúncios

**Passo a passo:**
1. Clique no card "Anúncios"
2. Selecione UMA campanha
3. Aguarde carregar os conjuntos
4. Selecione UM conjunto de anúncios
5. Aguarde carregar os anúncios
6. Veja a tabela com thumbnails dos criativos
7. Clique em um thumbnail para ver em tamanho grande

**O que observar:**
- Coluna "Criativo" com miniaturas das imagens
- Título e corpo do anúncio (se disponível)
- Lightbox ao clicar no thumbnail
- Todas as métricas de performance

### 7. Testar Formatação de Datas

**Onde verificar:**
- Tabelas: datas no formato 20/01/2025
- Gráficos: labels como "20 de Jan"
- Tooltips: "Segunda, 20 de Janeiro"
- Range customizado: "01/01/2025 a 31/01/2025"

---

## 🎯 Cenários de Teste

### Cenário 1: Comparar Top 3 Campanhas
1. Selecione cliente
2. Período: "Últimos 30 dias"
3. Nível: Campanhas
4. Selecione as 3 campanhas com maior gasto
5. Compare métricas

### Cenário 2: Analisar Conjuntos de uma Campanha
1. Selecione cliente
2. Período: "Este mês"
3. Nível: Conjuntos de Anúncios
4. Selecione a campanha principal
5. Identifique conjuntos com melhor CTR

### Cenário 3: Avaliar Criativos
1. Selecione cliente
2. Período: "Últimos 7 dias"
3. Nível: Anúncios
4. Selecione campanha e conjunto
5. Veja thumbnails dos criativos
6. Clique para ver em tamanho grande
7. Compare performance por criativo

### Cenário 4: Análise de Período Específico
1. Selecione cliente
2. Período: "Personalizado"
3. Escolha: 01/12/2024 a 31/12/2024
4. Analise performance de dezembro
5. Compare com outro período

---

## ⚠️ Possíveis Problemas e Soluções

### Problema: "Cliente não possui conexão ativa com Meta Ads"
**Solução:** O cliente precisa conectar sua conta Meta primeiro
- Vá em `/dashboard/clients`
- Clique no cliente
- Clique em "Conectar Meta Ads"

### Problema: "Nenhuma campanha encontrada"
**Solução:** 
- Verifique se o cliente tem campanhas ativas no Meta
- Tente outro período de data
- Verifique se o token de acesso está válido

### Problema: Thumbnails não aparecem
**Solução:**
- Normal para alguns anúncios sem criativo
- Aparecerá um ícone de imagem como fallback

### Problema: Loading infinito
**Solução:**
- Abra o console do navegador (F12)
- Veja se há erros de API
- Verifique se o token do Meta está válido

---

## 🔍 O que Verificar

### Performance
- [ ] Dados carregam em menos de 3 segundos
- [ ] Loading states aparecem durante carregamento
- [ ] Não há travamentos na interface

### Funcionalidade
- [ ] Seleção múltipla funciona
- [ ] Range customizado valida corretamente
- [ ] 3 níveis funcionam independentemente
- [ ] Thumbnails carregam e abrem em lightbox
- [ ] Gráficos renderizam corretamente

### UX
- [ ] Mensagens de erro são claras
- [ ] Empty states são informativos
- [ ] Transições são suaves
- [ ] Interface é responsiva

### Dados
- [ ] Métricas batem com o Meta Ads Manager
- [ ] Datas estão formatadas corretamente
- [ ] Valores monetários em R$
- [ ] Números formatados (1.234 em vez de 1234)

---

## 📸 Screenshots Esperados

### Nível: Campanhas
```
┌─────────────────────────────────────┐
│ Escolha o nível de análise:         │
│ ● Campanhas  ○ Conjuntos  ○ Anúncios│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Selecionar Campanhas                │
│ [Buscar campanhas...]               │
│ ☑ Campanha A                        │
│ ☑ Campanha B                        │
│ ☐ Campanha C                        │
└─────────────────────────────────────┘

[Badge: Campanha A ×] [Badge: Campanha B ×]

[Gráfico comparativo]
[Tabela de métricas]
```

### Nível: Conjuntos
```
┌─────────────────────────────────────┐
│ Selecionar Campanha                 │
│ [Campanha Principal ▼]              │
└─────────────────────────────────────┘

[Gráfico de barras]

┌─────────────────────────────────────┐
│ Nome          │ Status │ Gasto │ CTR│
│ Conjunto A    │ ACTIVE │ R$500 │ 2.5│
│ Conjunto B    │ ACTIVE │ R$300 │ 3.1│
└─────────────────────────────────────┘
```

### Nível: Anúncios
```
┌─────────────────────────────────────┐
│ Campanha: [Selecione ▼]             │
│ Conjunto: [Selecione ▼]             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ [IMG] │ Nome      │ Status │ Gasto  │
│ [IMG] │ Anúncio A │ ACTIVE │ R$ 200 │
│ [IMG] │ Anúncio B │ ACTIVE │ R$ 150 │
└─────────────────────────────────────┘
```

---

## ✅ Checklist de Teste

### Filtros
- [ ] Seleção de cliente funciona
- [ ] Seleção de período funciona
- [ ] Range customizado abre dialog
- [ ] Validação de datas funciona
- [ ] Botão refresh funciona

### Nível: Campanhas
- [ ] Seleção múltipla funciona
- [ ] Busca filtra campanhas
- [ ] Badges aparecem
- [ ] Comparação carrega
- [ ] Gráficos renderizam

### Nível: Conjuntos
- [ ] Dropdown de campanha funciona
- [ ] Conjuntos carregam
- [ ] Tabela exibe dados
- [ ] Gráfico renderiza
- [ ] Indicadores de tendência aparecem

### Nível: Anúncios
- [ ] Dropdowns em cascata funcionam
- [ ] Anúncios carregam
- [ ] Thumbnails aparecem
- [ ] Lightbox abre ao clicar
- [ ] Métricas estão corretas

---

## 🎉 Sucesso!

Se todos os testes passarem, você tem:
- ✅ Sistema de analytics multi-nível completo
- ✅ Filtros avançados funcionando
- ✅ Visualização de criativos
- ✅ Formatação padronizada
- ✅ UX intuitiva e responsiva

**Próximo passo:** Usar em produção! 🚀

---

**Dúvidas?** Verifique `IMPLEMENTACAO_COMPLETA_ANALYTICS.md` para documentação completa.
