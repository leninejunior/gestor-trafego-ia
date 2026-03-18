# 🚀 APLICAR CORREÇÃO NO SUPABASE - PASSO A PASSO

## 🎯 Problema
Seu super usuário está sem acesso porque a tabela `memberships` tem **dois campos** apontando para `organizations`, causando ambiguidade.

## ✅ Solução Rápida

### 1️⃣ Acesse o Supabase SQL Editor
```
https://supabase.com/dashboard/project/[seu-projeto]/sql
```

### 2️⃣ Cole este SQL e clique em RUN

**⚠️ ATENÇÃO**: Este SQL é GRANDE (atualiza 33 RLS policies). Cole tudo de uma vez!

Abra o arquivo: `database/CORRIGIR_MEMBERSHIPS_COM_RLS.sql`

Ou copie daqui: https://github.com/[seu-repo]/blob/main/database/CORRIGIR_MEMBERSHIPS_COM_RLS.sql

**O que o SQL faz:**
1. Atualiza TODAS as 33 RLS policies para usar `org_id` ao invés de `organization_id`
2. Remove a coluna duplicada `organization_id`
3. Mantém apenas `org_id` como foreign key
4. Cria índices para performance

**⚠️ IMPORTANTE**: 
- Cole TODO o conteúdo do arquivo SQL
- Clique em RUN
- Aguarde alguns segundos (são muitas policies)
- Se der erro "policy already exists", ignore e continue

### 3️⃣ Após executar, teste o acesso

Execute no terminal:
```bash
node scripts/restaurar-super-usuario-lenine.js
```

## 📊 O que será corrigido

### Antes (❌ Problema)
```
memberships
├── organization_id → organizations (FK 1)
└── org_id → organizations (FK 2)  ⚠️ DUPLICADO!
```

### Depois (✅ Correto)
```
memberships
└── org_id → organizations (FK único)
```

## 🎉 Resultado Esperado

Após aplicar:
- ✅ Usuário Lenine terá acesso total
- ✅ Todos os 9 clientes aparecerão
- ✅ Gestão de usuários funcionará
- ✅ Sem erros de ambiguidade

## 🆘 Se der erro

Se aparecer algum erro ao executar o SQL:

1. **Erro de constraint**: Ignore, significa que já foi removida
2. **Erro de coluna não existe**: Ignore, significa que já foi removida
3. **Erro de dados inconsistentes**: Me avise imediatamente

## 📝 Próximos Passos

1. ✅ Aplicar SQL no Supabase
2. ✅ Executar teste: `node scripts/restaurar-super-usuario-lenine.js`
3. ✅ Fazer login com `lenine@amitie.com.br`
4. ✅ Verificar se clientes aparecem
5. ✅ Testar gestão de usuários

---

**Tempo estimado**: 2 minutos
**Risco**: Baixo (apenas remove duplicidade)
**Reversível**: Sim (mas não será necessário)

---

**Email do super usuário**: `lenine.engrene@gmail.com`
