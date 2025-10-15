# Como Aplicar o Schema de Gerenciamento de Usuários

## 🚨 IMPORTANTE: Execute no Supabase SQL Editor

Devido a problemas com as chaves de API, você precisa aplicar o schema manualmente no Supabase.

## 📋 Passos para Aplicar

### 1. Acesse o Supabase Dashboard
- Vá para: https://supabase.com/dashboard
- Faça login na sua conta
- Selecione o projeto: `doiogabdzybqxnyhktbv`

### 2. Abra o SQL Editor
- No menu lateral, clique em **"SQL Editor"**
- Clique em **"New query"**

### 3. Execute o Schema
- Copie todo o conteúdo do arquivo `database/user-management-simple.sql`
- Cole no SQL Editor
- Clique em **"Run"** para executar

## 📄 Conteúdo do Schema

O schema irá criar/modificar:

### Tabelas Modificadas
- **user_profiles**: Adiciona colunas para suspensão e controle
- **memberships**: Adiciona colunas para remoção
- **organization_invites**: Adiciona metadados

### Tabelas Criadas
- **user_activities**: Histórico de atividades dos usuários

### Funções Criadas
- **sync_user_profiles_with_auth()**: Sincroniza dados entre auth.users e user_profiles

### Políticas RLS
- Controle de acesso para super admins
- Usuários podem ver suas próprias atividades

## ✅ Verificação

Após executar o schema, verifique se:

1. **Tabela user_activities foi criada**:
```sql
SELECT * FROM user_activities LIMIT 5;
```

2. **Colunas foram adicionadas ao user_profiles**:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('is_suspended', 'suspended_at', 'email');
```

3. **Dados foram sincronizados**:
```sql
SELECT COUNT(*) FROM user_profiles WHERE email IS NOT NULL;
```

## 🔧 Após Aplicar o Schema

1. **Teste o sistema de usuários**:
   - Acesse `/admin/users`
   - Verifique se a lista carrega
   - Teste os filtros e busca

2. **Teste convites**:
   - Clique em "Convidar Usuário"
   - Preencha o formulário
   - Verifique se o convite é criado

3. **Teste detalhes do usuário**:
   - Clique em "Ver" em qualquer usuário
   - Verifique se as abas carregam
   - Teste suspensão/reativação

## 🚨 Problemas Comuns

### Erro: "relation does not exist"
- Certifique-se de que executou o schema completo
- Verifique se todas as tabelas foram criadas

### Erro: "permission denied"
- Verifique se está logado como super admin
- Execute as políticas RLS novamente

### Dados não aparecem
- Execute a função de sincronização:
```sql
SELECT sync_user_profiles_with_auth();
```

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Supabase
2. Execute as queries de verificação
3. Reexecute partes específicas do schema se necessário

**O sistema estará totalmente funcional após aplicar este schema!**