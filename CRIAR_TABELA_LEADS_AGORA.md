# 🚨 CRIAR TABELA DE LEADS - URGENTE

## Problema Identificado

```
Could not find the table 'public.landing_leads' in the schema cache
```

A tabela não existe no banco de dados!

## ✅ Solução Rápida (2 minutos)

### Passo 1: Copiar o SQL

Execute este comando para ver o SQL:

```bash
npm run apply-landing-schema
```

Ou copie diretamente daqui:

```sql
-- Schema para captura de leads da landing page

-- Tabela de leads interessados
CREATE TABLE IF NOT EXISTS public.landing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('agency', 'company', 'traffic_manager', 'social_media', 'other')),
  message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  source TEXT DEFAULT 'landing_page',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_landing_leads_email ON public.landing_leads(email);
CREATE INDEX IF NOT EXISTS idx_landing_leads_status ON public.landing_leads(status);
CREATE INDEX IF NOT EXISTS idx_landing_leads_created_at ON public.landing_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_leads_lead_type ON public.landing_leads(lead_type);

-- RLS Policies
ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

-- Permitir inserção pública (para o formulário da landing page)
CREATE POLICY "Allow public insert leads"
  ON public.landing_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Apenas super admins podem visualizar leads
CREATE POLICY "Super admins can view all leads"
  ON public.landing_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Apenas super admins podem atualizar leads
CREATE POLICY "Super admins can update leads"
  ON public.landing_leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_landing_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_landing_leads_updated_at_trigger ON public.landing_leads;
CREATE TRIGGER update_landing_leads_updated_at_trigger
  BEFORE UPDATE ON public.landing_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_landing_leads_updated_at();

-- Comentários
COMMENT ON TABLE public.landing_leads IS 'Leads capturados através da landing page';
COMMENT ON COLUMN public.landing_leads.lead_type IS 'Tipo de lead: agency, company, traffic_manager, social_media, other';
COMMENT ON COLUMN public.landing_leads.status IS 'Status do lead: new, contacted, qualified, converted, lost';
```

### Passo 2: Executar no Supabase

1. **Acesse**: https://supabase.com/dashboard
2. **Selecione** seu projeto
3. **Clique** em "SQL Editor" no menu lateral
4. **Cole** o SQL acima
5. **Clique** em "Run" ou pressione `Ctrl+Enter`

### Passo 3: Verificar

Execute este SQL para confirmar:

```sql
SELECT * FROM public.landing_leads;
```

Deve retornar uma tabela vazia (sem erros).

### Passo 4: Testar o Formulário

1. Volte para `http://localhost:3000/`
2. Preencha o formulário
3. Clique em "Enviar Mensagem"
4. Deve aparecer: "Mensagem enviada com sucesso!"

### Passo 5: Ver os Leads

1. Acesse `http://localhost:3000/admin/leads`
2. Você verá o lead que acabou de enviar!

## 🎯 Verificação Rápida

No Supabase SQL Editor, execute:

```sql
-- Ver se a tabela existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'landing_leads';

-- Ver as policies
SELECT * FROM pg_policies 
WHERE tablename = 'landing_leads';

-- Inserir um teste
INSERT INTO public.landing_leads (name, email, lead_type)
VALUES ('Teste', 'teste@teste.com', 'agency');

-- Ver os dados
SELECT * FROM public.landing_leads;
```

## ✅ Checklist

- [ ] SQL copiado
- [ ] Executado no Supabase SQL Editor
- [ ] Sem erros na execução
- [ ] Tabela aparece no Table Editor
- [ ] Formulário testado
- [ ] Lead aparece em /admin/leads

## 🚨 Se Der Erro

### Erro: "permission denied"
Você precisa estar logado como owner do projeto no Supabase.

### Erro: "relation already exists"
A tabela já existe! Pule para o Passo 4.

### Erro: "function does not exist"
Execute o SQL completo novamente, incluindo a função.

---

**Depois de executar o SQL, o formulário funcionará imediatamente!** 🎉

Não precisa reiniciar o servidor Next.js.
