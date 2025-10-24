# 🔧 CRIAR TABELA PROFILES - URGENTE

## ❌ Problema

O signup está falhando porque a tabela `profiles` não existe no banco de dados.

```
❌ profiles: Could not find the table 'public.profiles' in the schema cache
```

## ✅ Solução (3 Passos Simples)

### Passo 1: Abrir o SQL Editor do Supabase

Clique no link abaixo para abrir o SQL Editor:

```
https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql/new
```

### Passo 2: Copiar e Colar o SQL

Abra o arquivo `database/create-profiles-table.sql` e copie TODO o conteúdo.

Ou copie diretamente daqui:

```sql
-- Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Política: Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Política: Service role pode inserir perfis (para signup)
CREATE POLICY "Service role can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- Criar função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Passo 3: Executar

1. Cole o SQL no editor
2. Clique no botão **"Run"** (ou pressione Ctrl+Enter)
3. Aguarde a mensagem de sucesso

## 🧪 Verificar se Funcionou

Após executar o SQL, rode este comando:

```bash
node scripts/check-signup-tables.js
```

Você deve ver:

```
✅ profiles: OK (Perfis de usuários)
✅ organizations: OK (Organizações)
✅ memberships: OK (Membros das organizações)
```

## 🚀 Testar o Signup

Depois de criar a tabela, teste o signup novamente:

```bash
node scripts/test-signup-api.js
```

Deve funcionar sem erros agora!

## 📝 O que Esta Tabela Faz?

A tabela `profiles` armazena informações adicionais dos usuários:
- Nome completo
- Email
- Avatar
- Datas de criação/atualização

O **trigger** `on_auth_user_created` cria automaticamente um perfil sempre que um novo usuário é registrado no Supabase Auth.

## 🔒 Segurança

As políticas RLS garantem que:
- Usuários só podem ver e editar seu próprio perfil
- O service role pode criar perfis (necessário para signup)

## ❓ Problemas?

Se após executar o SQL o erro persistir:

1. Verifique se o SQL foi executado sem erros
2. Verifique se a tabela foi criada: vá em "Table Editor" no Supabase
3. Execute: `node scripts/check-signup-tables.js`
4. Compartilhe os logs se o problema continuar
