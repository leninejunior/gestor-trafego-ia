# 🔧 Correção do Erro de Signup

## ❌ Problema Identificado

O erro "Database error saving new user" ocorre porque a **SUPABASE_SERVICE_ROLE_KEY** no arquivo `.env` está **INVÁLIDA**.

```
Error: Database error saving new user
```

## 🔍 Diagnóstico

Executei o script de verificação e confirmei:

```
✅ NEXT_PUBLIC_SUPABASE_URL: OK
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: OK
⚠️  SUPABASE_SERVICE_ROLE_KEY: INVÁLIDA
```

A chave atual tem um padrão repetitivo suspeito (`Ej8Ej8Ej8...`) que indica que é um placeholder ou foi corrompida.

## ✅ Solução (3 Passos Simples)

### Passo 1: Acessar o Supabase Dashboard

Abra no navegador:
```
https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/settings/api
```

### Passo 2: Copiar a Service Role Key

1. Na página de API Settings, procure por **"service_role"**
2. Clique no ícone de "olho" para revelar a chave
3. Clique no ícone de "copiar" para copiar a chave completa

**IMPORTANTE:** 
- Esta é uma chave SECRETA
- Ela começa com `eyJ...`
- Tem mais de 200 caracteres
- NUNCA deve ser exposta no frontend

### Passo 3: Atualizar o arquivo .env

Abra o arquivo `.env` e substitua a linha:

```env
# ❌ VALOR ATUAL (INVÁLIDO)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzd...Ej8Ej8Ej8

# ✅ NOVO VALOR (cole a chave copiada do Supabase)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.SUA_CHAVE_REAL_AQUI
```

## 🧪 Verificar a Correção

Após atualizar o `.env`, execute:

```bash
node scripts/check-supabase-keys.js
```

Você deve ver:
```
✅ NEXT_PUBLIC_SUPABASE_URL: OK
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: OK
✅ SUPABASE_SERVICE_ROLE_KEY: OK

✅ Todas as chaves do Supabase estão configuradas corretamente!
```

## 🚀 Testar o Signup

1. Reinicie o servidor de desenvolvimento:
```bash
npm run dev
```

2. Acesse a página de signup: `http://localhost:3000/checkout`

3. Preencha o formulário e tente criar uma conta

4. O signup deve funcionar corretamente agora!

## 📝 Por que isso aconteceu?

A `SUPABASE_SERVICE_ROLE_KEY` é necessária para:
- Criar organizações (bypassa RLS)
- Criar memberships (bypassa RLS)
- Operações administrativas que precisam de permissões elevadas

Sem uma chave válida, o sistema não consegue criar a organização e o membership do novo usuário, resultando no erro "Database error saving new user".

## 🔒 Segurança

**NUNCA:**
- Exponha a service_role key no frontend
- Commit a service_role key no Git
- Compartilhe a service_role key publicamente

**SEMPRE:**
- Mantenha no arquivo `.env` (que está no `.gitignore`)
- Use apenas em código server-side
- Rotacione a chave se houver suspeita de exposição

## 📞 Precisa de Ajuda?

Se após seguir estes passos o erro persistir:

1. Verifique os logs do console do navegador
2. Verifique os logs do servidor Next.js
3. Execute: `node scripts/check-supabase-keys.js`
4. Compartilhe os logs (sem expor as chaves!)
