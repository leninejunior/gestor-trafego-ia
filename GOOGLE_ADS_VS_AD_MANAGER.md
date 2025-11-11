# 🔍 Google Ads API vs Google Ad Manager API

## ⚠️ Importante: São APIs Diferentes!

Muitas pessoas confundem essas duas APIs do Google. Vamos esclarecer:

## 📊 Comparação

| Aspecto | Google Ads API | Google Ad Manager API |
|---------|----------------|----------------------|
| **Uso** | Anunciantes | Publishers (editores) |
| **Finalidade** | Gerenciar campanhas de anúncios | Gerenciar inventário de anúncios |
| **Escopo OAuth** | `https://www.googleapis.com/auth/adwords` | `https://www.googleapis.com/auth/dfp` |
| **Antigo nome** | Google AdWords API | DoubleClick for Publishers (DFP) |
| **Seu caso** | ✅ **É ESTE!** | ❌ Não precisa |

## 🎯 Google Ads API (O que você usa)

### Para quem é:
- **Anunciantes** que querem promover produtos/serviços
- **Agências** que gerenciam campanhas para clientes
- **Empresas** que investem em publicidade online

### O que faz:
- Criar e gerenciar campanhas publicitárias
- Definir orçamentos e lances
- Segmentar audiências
- Analisar performance de anúncios
- Gerenciar palavras-chave
- Otimizar ROI de campanhas

### Escopo OAuth:
```
https://www.googleapis.com/auth/adwords
```

### Exemplo de uso:
"Quero criar uma campanha no Google Ads para promover meu produto e ver quantos cliques recebi."

## 📰 Google Ad Manager API (O que você NÃO usa)

### Para quem é:
- **Publishers** (sites, blogs, apps)
- **Editores** que vendem espaço publicitário
- **Redes de anúncios**

### O que faz:
- Gerenciar inventário de espaços publicitários
- Vender impressões de anúncios
- Controlar quais anúncios aparecem onde
- Gerenciar relacionamento com anunciantes
- Otimizar preenchimento de inventário

### Escopo OAuth:
```
https://www.googleapis.com/auth/dfp
```

### Exemplo de uso:
"Tenho um site com 1 milhão de visitantes/mês e quero vender espaços publicitários para anunciantes."

## ✅ Seu Sistema Está Correto!

### Configuração Atual:
```typescript
// src/lib/google/oauth.ts
private readonly DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/adwords',  // ✅ CORRETO!
];
```

### Por que o erro então?

O erro **NÃO é o escopo OAuth**, mas sim o **nível de acesso do Developer Token**:

1. ✅ **Escopo OAuth**: Correto (`adwords`)
2. ❌ **Developer Token**: Acesso Básico (limitado)
3. ✅ **Solução**: Solicitar Acesso Standard

## 🔧 O Que Você Precisa Fazer

**Não precisa mudar o escopo OAuth!** Ele já está correto.

Você precisa apenas:
1. Solicitar **Acesso Standard** do Developer Token
2. Aguardar aprovação do Google
3. Reconectar quando aprovado

## 📋 Checklist de Verificação

- [x] Escopo OAuth correto (`adwords`)
- [x] Credenciais OAuth configuradas
- [x] Redirect URI configurado
- [x] Developer Token criado
- [ ] **Developer Token com Acesso Standard** ← Falta isso!

## 🎯 Resumo

| Item | Status |
|------|--------|
| API escolhida | ✅ Google Ads API (correto) |
| Escopo OAuth | ✅ `adwords` (correto) |
| Developer Token | ⏳ Acesso Básico (precisa upgrade) |
| Próxima ação | Solicitar Acesso Standard |

## 💡 Dica

Se alguém mencionar "Google Ad Manager" ou "DFP", eles estão falando de uma **API diferente** para publishers, não para anunciantes.

Seu sistema usa **Google Ads API** para gerenciar campanhas publicitárias, que é o correto para o seu caso de uso! ✅

---

**Conclusão**: Seu sistema está configurado corretamente. O problema é apenas o nível de acesso do Developer Token, não o escopo OAuth.
