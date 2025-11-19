# 🎯 Guia Completo para Resolver o Problema do Developer Token do Google Ads

## 📋 Situação Atual

Você está enfrentando o erro de que o Developer Token não está aprovado, o que é comum durante o desenvolvimento. Este guia vai te ajudar a resolver isso de forma prática.

## 🔧 Soluções Imediatas (Sem Esperar Aprovação)

### Opção 1: Criar uma Conta de Teste do Google Ads

1. **Acesse**: https://ads.google.com/
2. **Clique em**: "Comece agora" ou "Criar conta"
3. **Preencha os dados**:
   - Nome da conta: `Teste - [Seu Nome]`
   - País: Brasil
   - Fuso horário: (GMT-03:00) Brasília
4. **Não adicione cartão de crédito** (a menos que queira gastar dinheiro real)
5. **Conclua o processo de criação**

### Opção 2: Usar uma Conta Google Existente

Se você já tem uma conta do Google com acesso ao Google Ads:
1. **Acesse**: https://ads.google.com/
2. **Faça login** com essa conta
3. **Verifique se há campanhas** ou crie uma campanha de teste

## 🚀 Como Conectar com Conta de Teste

### Passo 1: Reconectar no Sistema

1. **Acesse**: http://localhost:3000/dashboard/google
2. **Clique em**: "Conectar Google Ads"
3. **Faça login** com a conta de teste que você criou
4. **Autorize o acesso** às contas do Google Ads

### Passo 2: Selecionar Contas

1. **Após a autorização**, você será redirecionado para a página de seleção
2. **Selecione a conta de teste** que você criou
3. **Clique em**: "Conectar [número] conta(s)"

## ⏰ Esperando Aprovação do Developer Token

Se você preferir esperar a aprovação oficial:

### Tempo de Aprovação
- **Conta de Teste**: Imediato
- **Acesso Básico**: 24-48 horas
- **Acesso Padrão**: Pode levar semanas

### Como Verificar Status

1. **Acesse**: https://ads.google.com/aw/apicenter
2. **Procure por**: "API Access Level"
3. **Status esperado**: "Approved" ou "Active"

## 🔍 Diagnóstico Avançado

### Teste a Conexão Manualmente

```bash
# Teste o endpoint de diagnóstico
curl http://localhost:3000/api/google/debug-connection

# Teste a chamada da API
curl http://localhost:3000/api/google/test-api-call?connectionId=SEU_CONNECTION_ID
```

### Verifique Logs do Sistema

Procure por estas mensagens nos logs:
- `[Google Accounts Direct]`
- `[Google Ads API]`
- `[Google Select Accounts]`

## 🛠️ Solução Técnica Implementada

Nosso sistema já está configurado para:

1. **Detectar automaticamente** quando o Developer Token não está aprovado
2. **Mostrar mensagens claras** sobre o que precisa ser feito
3. **Permitir reconexão** fácil após resolver o problema

## 📞 Suporte Adicional

Se mesmo após seguir todos os passos você continuar com problemas:

1. **Verifique as variáveis de ambiente** no arquivo `.env`
2. **Confirme que a Google Ads API está habilitada** no Google Cloud Console
3. **Teste com uma conta diferente** do Google
4. **Entre em contato com o suporte** do Google Ads API

---

**Última atualização**: 2025-11-17
**Status**: Solução pronta para implementação imediata