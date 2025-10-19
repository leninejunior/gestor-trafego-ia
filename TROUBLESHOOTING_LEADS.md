# 🔧 Troubleshooting - Formulário de Leads

## Problema: Formulário não está salvando

### Passo 1: Verificar se a Tabela Existe

A tabela `landing_leads` precisa ser criada no Supabase.

#### Opção A: Via Script (Recomendado)
```bash
npm run apply-landing-schema
```

Isso exibirá o SQL. Copie e execute no Supabase SQL Editor.

#### Opção B: Manualmente no Supabase

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Copie o conteúdo de `database/landing-leads-schema.sql`
5. Cole e execute

### Passo 2: Verificar Erros no Console

Abra o **DevTools** do navegador (F12) e vá na aba **Console**.

Preencha o formulário e clique em enviar. Procure por erros como:

#### Erro Comum 1: Tabela não existe
```
relation "public.landing_leads" does not exist
```

**Solução:** Execute o schema SQL (Passo 1)

#### Erro Comum 2: Permissão negada
```
permission denied for table landing_leads
```

**Solução:** Verifique as RLS policies no Supabase

#### Erro Comum 3: Variáveis de ambiente
```
Cannot read properties of undefined
```

**Solução:** Verifique o `.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave
```

### Passo 3: Testar a API Diretamente

Abra o DevTools (F12) e execute no Console:

```javascript
fetch('/api/landing/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Teste',
    email: 'teste@teste.com',
    lead_type: 'agency',
    phone: '11999999999',
    company: 'Teste Ltda',
    message: 'Teste de formulário'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-aqui",
    "name": "Teste",
    "email": "teste@teste.com",
    ...
  }
}
```

**Se der erro:**
```json
{
  "error": "Mensagem de erro aqui"
}
```

### Passo 4: Verificar no Supabase

1. Acesse o Supabase Dashboard
2. Vá em **Table Editor**
3. Procure a tabela `landing_leads`
4. Verifique se há registros

### Passo 5: Verificar RLS Policies

No Supabase SQL Editor, execute:

```sql
-- Verificar se a tabela existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'landing_leads';

-- Verificar policies
SELECT * FROM pg_policies 
WHERE tablename = 'landing_leads';

-- Testar inserção manual
INSERT INTO public.landing_leads (name, email, lead_type)
VALUES ('Teste Manual', 'teste@teste.com', 'agency');

-- Ver registros
SELECT * FROM public.landing_leads;
```

### Passo 6: Verificar Logs do Servidor

No terminal onde o Next.js está rodando, procure por erros:

```
npm run dev
```

Preencha o formulário e veja se aparecem erros no terminal.

## Checklist de Verificação

- [ ] Tabela `landing_leads` criada no Supabase
- [ ] RLS policies aplicadas
- [ ] Variáveis de ambiente configuradas
- [ ] Servidor Next.js rodando
- [ ] Console do navegador sem erros
- [ ] API responde corretamente
- [ ] Toast de sucesso aparece
- [ ] Lead aparece em `/admin/leads`

## Comandos Úteis

### Recriar a Tabela (se necessário)
```sql
-- CUIDADO: Isso apaga todos os dados!
DROP TABLE IF EXISTS public.landing_leads CASCADE;

-- Depois execute o schema completo de database/landing-leads-schema.sql
```

### Ver Últimos Leads
```sql
SELECT * FROM public.landing_leads 
ORDER BY created_at DESC 
LIMIT 10;
```

### Contar Leads por Status
```sql
SELECT status, COUNT(*) 
FROM public.landing_leads 
GROUP BY status;
```

### Contar Leads por Tipo
```sql
SELECT lead_type, COUNT(*) 
FROM public.landing_leads 
GROUP BY lead_type;
```

## Solução Rápida

Se nada funcionar, execute esta sequência:

```bash
# 1. Parar o servidor
Ctrl+C

# 2. Limpar cache
rm -rf .next

# 3. Reinstalar dependências (se necessário)
npm install

# 4. Aplicar schema
npm run apply-landing-schema
# Copie o SQL e execute no Supabase

# 5. Reiniciar servidor
npm run dev

# 6. Testar formulário
# Acesse http://localhost:3000
# Preencha e envie o formulário
```

## Verificar Permissões do Usuário Admin

Para ver os leads, você precisa ser super admin:

```sql
-- Verificar seu role
SELECT id, email, role FROM public.users 
WHERE email = 'seu@email.com';

-- Se não for super_admin, atualizar:
UPDATE public.users 
SET role = 'super_admin' 
WHERE email = 'seu@email.com';
```

## Contato de Suporte

Se o problema persistir:

1. Copie os erros do console
2. Copie os erros do terminal
3. Tire um print da aba Network (F12 > Network)
4. Verifique se a tabela existe no Supabase

---

**Na maioria dos casos, o problema é que a tabela não foi criada no banco de dados.**

Execute: `npm run apply-landing-schema` e copie o SQL para o Supabase!
