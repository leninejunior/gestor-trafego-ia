# 🔧 Resolver Problema dos Clientes Sumidos

## 🎯 Problema Identificado

Após aplicar o schema SaaS, os clientes sumiram porque:
1. **Estrutura mudou**: Clientes agora pertencem a organizações (`org_id`)
2. **APIs desatualizadas**: Ainda buscavam por `user_id` direto
3. **Dados órfãos**: Clientes antigos sem `org_id`

## ✅ Correções Já Aplicadas

### 1. **API de Clientes Corrigida**
- ✅ `src/app/api/clients/route.ts` - Agora busca via organização
- ✅ `src/app/dashboard/clients/page.tsx` - Atualizada para nova estrutura
- ✅ Tratamento de erros melhorado

### 2. **Componentes Atualizados**
- ✅ Página de clientes com verificação de organização
- ✅ Tela de erro amigável se algo der errado
- ✅ Actions já estavam corretos (usam `org_id`)

## 🚀 Como Resolver

### Passo 1: Verificar Estado Atual
Execute no **Supabase SQL Editor**:
```sql
-- Copie e cole o conteúdo de: database/debug-data.sql
```

### Passo 2: Migrar Dados Existentes (se necessário)
Se você tinha clientes antes, execute:
```sql
-- Copie e cole o conteúdo de: database/migrate-existing-data.sql
```

### Passo 3: Verificar se Usuário Tem Organização
No Supabase, verifique se seu usuário tem uma organização:
```sql
SELECT 
  u.email,
  m.org_id,
  o.name as org_name,
  m.role
FROM auth.users u
LEFT JOIN memberships m ON u.id = m.user_id
LEFT JOIN organizations o ON m.org_id = o.id
WHERE u.email = 'SEU_EMAIL_AQUI';
```

### Passo 4: Criar Organização Manualmente (se necessário)
Se não tiver organização, execute:
```sql
-- Substitua 'SEU_EMAIL' pelo seu email real
DO $$
DECLARE
  user_id_var UUID;
  new_org_id UUID;
  owner_role_id UUID;
BEGIN
  -- Buscar seu usuário
  SELECT id INTO user_id_var
  FROM auth.users
  WHERE email = 'SEU_EMAIL_AQUI';
  
  -- Buscar role de owner
  SELECT id INTO owner_role_id
  FROM user_roles
  WHERE name = 'owner';
  
  -- Criar organização
  INSERT INTO organizations (name)
  VALUES ('Minha Empresa')
  RETURNING id INTO new_org_id;
  
  -- Criar membership
  INSERT INTO memberships (user_id, org_id, role, role_id, accepted_at, status)
  VALUES (user_id_var, new_org_id, 'owner', owner_role_id, NOW(), 'active');
  
  -- Criar assinatura trial
  INSERT INTO subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
  VALUES (
    new_org_id,
    (SELECT id FROM subscription_plans WHERE name = 'Free Trial' LIMIT 1),
    'active',
    NOW(),
    NOW() + INTERVAL '14 days'
  );
  
  RAISE NOTICE 'Organização criada com sucesso!';
END $$;
```

## 🧪 Testar Solução

### 1. **Verificar Dashboard**
- Acesse `/dashboard/clients`
- Deve carregar sem erros
- Botão "Adicionar Cliente" deve funcionar

### 2. **Adicionar Cliente Teste**
- Clique em "Adicionar Cliente"
- Digite um nome
- Deve salvar com sucesso

### 3. **Verificar Organização**
- Acesse `/dashboard/team`
- Deve mostrar você como owner
- Deve mostrar plano Free Trial

## 🔍 Diagnóstico de Problemas

### Erro: "Organização não encontrada"
**Causa**: Usuário não tem membership
**Solução**: Execute Passo 4 acima

### Erro: "Tabela não encontrada"
**Causa**: Schema não foi aplicado
**Solução**: Execute `database/complete-saas-setup.sql`

### Erro: "Sem permissão"
**Causa**: Políticas RLS bloqueando
**Solução**: Verificar se membership está ativo

## 📊 Verificações Finais

Execute para confirmar que tudo está funcionando:
```sql
-- 1. Verificar sua organização
SELECT 
  o.name as organizacao,
  m.role as sua_funcao,
  COUNT(c.id) as total_clientes
FROM organizations o
JOIN memberships m ON o.id = m.org_id
LEFT JOIN clients c ON o.id = c.org_id
JOIN auth.users u ON m.user_id = u.id
WHERE u.email = 'SEU_EMAIL_AQUI'
GROUP BY o.name, m.role;

-- 2. Verificar plano ativo
SELECT 
  sp.name as plano,
  s.status,
  s.current_period_end as expira_em
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
JOIN memberships m ON s.org_id = m.org_id
JOIN auth.users u ON m.user_id = u.id
WHERE u.email = 'SEU_EMAIL_AQUI';
```

## 🎉 Resultado Esperado

Após seguir os passos:
- ✅ **Página de clientes** carrega normalmente
- ✅ **Adicionar cliente** funciona
- ✅ **Página de equipe** mostra sua organização
- ✅ **Sistema de convites** disponível
- ✅ **Planos e cobrança** funcionando

## 🆘 Se Ainda Não Funcionar

1. **Verifique logs do navegador** (F12 > Console)
2. **Execute debug-data.sql** e me envie o resultado
3. **Verifique se aplicou o schema completo**
4. **Confirme que está logado com o usuário correto**

---

**O sistema agora está preparado para ser um SaaS completo!** 🚀