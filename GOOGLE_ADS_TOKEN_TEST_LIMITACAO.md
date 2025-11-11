# 🔍 Google Ads API - Limitação do Token em Modo Test

## ✅ **SITUAÇÃO ATUAL:**

- ✅ Google Ads API **habilitada** no projeto
- ✅ OAuth funcionando corretamente
- ✅ Scope `adwords` presente
- ✅ Developer Token **ativo**
- ⚠️ Developer Token em modo **"Test" com "Acesso Básico"**

## ❌ **PROBLEMA:**

O erro **501 Not Implemented** ocorre porque o Developer Token está em **modo TEST**.

Tokens em modo TEST têm limitações severas:
- ❌ Não funcionam com a API de produção
- ❌ Não podem listar contas acessíveis
- ❌ Acesso limitado apenas para testes básicos

## 🎯 **SOLUÇÃO:**

### **Opção 1: Solicitar Acesso de Produção (Recomendado)**

1. **Acesse o API Center:**
   https://ads.google.com/aw/apicenter

2. **Solicite "Standard Access":**
   - Clique em "Request Standard Access" ou "Apply for Production Access"
   - Preencha o formulário com:
     - Nome da aplicação: "Flying Fox Bob - Ads Manager"
     - Descrição: "Sistema de gerenciamento de campanhas Google Ads para agências"
     - Uso previsto: "Gerenciar múltiplas contas de clientes via MCC"

3. **Aguarde aprovação:**
   - Tempo médio: 1-3 dias úteis
   - Você receberá email quando for aprovado

4. **Após aprovação:**
   - O token mudará de "Test" para "Standard"
   - Refaça o OAuth no dashboard
   - As contas reais aparecerão!

### **Opção 2: Usar Dados Mockados (Temporário)**

Enquanto aguarda a aprovação, o sistema já está configurado para usar **dados mockados** como fallback:

- ✅ OAuth funciona normalmente
- ✅ Conexão é salva no banco
- ✅ Dados mockados aparecem no dashboard
- ✅ Você pode continuar desenvolvendo

**Como funciona:**
```javascript
// O código detecta o erro 501 e retorna dados mockados
if (error.status === 501) {
  console.log('🧪 RETORNANDO CONTAS MOCKADAS COMO FALLBACK');
  return mockAccounts;
}
```

## 📊 **DIFERENÇAS ENTRE MODOS:**

| Recurso | Test (Acesso Básico) | Standard (Produção) |
|---------|---------------------|---------------------|
| listAccessibleCustomers | ❌ Erro 501 | ✅ Funciona |
| Listar campanhas | ⚠️ Limitado | ✅ Completo |
| Métricas reais | ❌ Não | ✅ Sim |
| Múltiplas contas | ❌ Não | ✅ Sim |
| Dados mockados | ✅ Sim | ❌ Não precisa |

## 🔧 **VERIFICAR STATUS DO TOKEN:**

Execute este script para verificar o status atual:

```bash
node scripts/diagnosticar-erro-501-completo.js
```

## 📝 **CHECKLIST:**

- [x] Google Ads API habilitada
- [x] OAuth configurado
- [x] Developer Token gerado
- [x] Scope correto
- [ ] **Developer Token aprovado para produção** ⬅️ FALTA ISSO!

## 🚀 **PRÓXIMOS PASSOS:**

1. **Solicite acesso de produção** no API Center
2. **Continue desenvolvendo** com dados mockados
3. **Aguarde aprovação** (1-3 dias)
4. **Refaça o OAuth** após aprovação
5. **Veja as contas reais** funcionando!

## 💡 **DICA:**

No formulário de solicitação, mencione:
- Você é uma agência gerenciando múltiplos clientes
- Precisa acessar contas via MCC (My Client Center)
- O sistema é para uso interno da agência
- Não vai revender acesso à API

Isso aumenta as chances de aprovação rápida!

## 📚 **DOCUMENTAÇÃO OFICIAL:**

- API Center: https://ads.google.com/aw/apicenter
- Guia de Acesso: https://developers.google.com/google-ads/api/docs/access-levels
- Processo de Aprovação: https://developers.google.com/google-ads/api/docs/get-started/dev-token

---

**Status:** ⏳ Aguardando aprovação do token para produção

**Sistema:** ✅ Funcionando com dados mockados como fallback
