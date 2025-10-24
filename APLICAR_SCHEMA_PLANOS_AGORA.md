# Aplicar Schema de Planos - EXECUTAR AGORA

## ⚠️ Problema Atual

A tabela `subscription_plans` não existe no banco de dados.

## ✅ Solução: Aplicar Schema

### Opção 1: Via Supabase Dashboard (RECOMENDADO)

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Clique em **New Query**
5. Cole o conteúdo do arquivo: `database/subscription-plans-schema.sql`
6. Clique em **Run** (ou pressione Ctrl+Enter)

### Opção 2: Via Script

```bash
node scripts/apply-subscription-schema.js
```

## 📋 Depois de Aplicar

Execute novamente para buscar os IDs:

```bash
node scripts/get-plan-ids.js
```

Isso vai mostrar algo como:

```
Basic:
  ID: abc-123-uuid-basic
  Mensal: R$ 29.00
  Anual: R$ 290.00

Pro:
  ID: def-456-uuid-pro
  Mensal: R$ 79.00
  Anual: R$ 790.00

Enterprise:
  ID: ghi-789-uuid-enterprise
  Mensal: R$ 199.00
  Anual: R$ 1990.00
```

## 🔧 Atualizar Links

Depois de obter os IDs, atualize em `src/components/landing/landing-page.tsx`:

```tsx
// Substitua os links atuais pelos IDs reais:

// Basic
<Link href="/checkout?plan=SEU_ID_BASIC_AQUI">Começar Agora</Link>

// Pro  
<Link href="/checkout?plan=SEU_ID_PRO_AQUI">Começar Agora</Link>

// Enterprise
<Link href="/checkout?plan=SEU_ID_ENTERPRISE_AQUI">Começar Agora</Link>
```

## 🎯 Resumo dos Passos

1. ✅ Aplicar `database/subscription-plans-schema.sql` no Supabase
2. ✅ Executar `node scripts/get-plan-ids.js`
3. ✅ Copiar os IDs dos planos
4. ✅ Atualizar os links na landing page
5. ✅ Testar clicando nos botões "Começar Agora"
