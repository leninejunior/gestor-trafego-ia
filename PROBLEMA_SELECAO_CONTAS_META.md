# Problema: Página de Seleção de Contas Vazia

## 🔴 Problema Identificado

Quando você tenta conectar uma conta Meta, a página de seleção não mostra as contas/páginas.

## 🔍 Causa Raiz

**Tokens de acesso inválidos ou expirados** nas conexões existentes.

```
Erro do Meta: "Invalid OAuth access token - Cannot parse access token"
```

## 📊 Situação Atual

- ✅ 8 conexões Meta no banco
- ❌ Todos os tokens estão inválidos/expirados
- ❌ API não consegue buscar contas/páginas
- ❌ Página de seleção fica vazia

## 🔧 Solução

### Opção 1: Reconectar Tudo (Recomendado)

1. **Limpar conexões antigas**:
```bash
node scripts/limpar-conexoes-meta-antigas.js
```

2. **Conectar novamente**:
   - Vá em `/dashboard/clients`
   - Clique em um cliente
   - Clique em "Conectar Meta Ads"
   - Autorize no Facebook
   - Selecione as contas

### Opção 2: Atualizar Tokens Manualmente

Se você tem um token válido, pode atualizar no banco:

```sql
UPDATE client_meta_connections
SET access_token = 'SEU_TOKEN_VALIDO'
WHERE id = 'id_da_conexao';
```

## 🎯 Por Que os Tokens Expiram?

Tokens do Meta Ads têm validade limitada:
- **Short-lived tokens**: 1-2 horas
- **Long-lived tokens**: 60 dias
- **Tokens de sistema**: Não expiram (requer app aprovado)

## ✅ Como Evitar no Futuro

1. **Implementar refresh automático de tokens**
2. **Usar tokens de longa duração**
3. **Monitorar expiração e renovar antes**

## 🚀 Próxima Ação

Execute este script para limpar e reconectar:

```bash
node scripts/limpar-e-reconectar-meta.js
```

Depois vá em `/dashboard/clients` e conecte novamente.
