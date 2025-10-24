# 🔧 Corrigir Erro de Edição de Organização

## Problema
Erro 500 ao tentar editar organização porque a coluna `slug` não existe no banco de dados.

## Solução - Execute este SQL no Supabase

1. Acesse o Supabase SQL Editor:
   - URL: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql

2. Cole e execute o SQL abaixo:

```sql
-- Adicionar coluna slug à tabela organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Criar índice único para slug
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON organizations(slug);

-- Função para gerar slug a partir do nome
CREATE OR REPLACE FUNCTION generate_slug(name TEXT) 
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Converter para minúsculas, remover acentos e substituir espaços por hífens
  base_slug := lower(trim(name));
  base_slug := regexp_replace(base_slug, '[áàâãä]', 'a', 'g');
  base_slug := regexp_replace(base_slug, '[éèêë]', 'e', 'g');
  base_slug := regexp_replace(base_slug, '[íìîï]', 'i', 'g');
  base_slug := regexp_replace(base_slug, '[óòôõö]', 'o', 'g');
  base_slug := regexp_replace(base_slug, '[úùûü]', 'u', 'g');
  base_slug := regexp_replace(base_slug, '[ç]', 'c', 'g');
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  
  final_slug := base_slug;
  
  -- Verificar se slug já existe e adicionar número se necessário
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar slug automaticamente antes de inserir
CREATE OR REPLACE FUNCTION set_organization_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_organization_slug ON organizations;
CREATE TRIGGER trigger_set_organization_slug
  BEFORE INSERT OR UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_slug();

-- Atualizar organizações existentes que não têm slug
UPDATE organizations 
SET slug = generate_slug(name)
WHERE slug IS NULL OR slug = '';

-- Comentários
COMMENT ON COLUMN organizations.slug IS 'URL-friendly identifier gerado automaticamente a partir do nome';
COMMENT ON FUNCTION generate_slug(TEXT) IS 'Gera um slug único a partir de um texto';
```

3. Clique em **RUN** ou pressione `Ctrl+Enter`

4. Aguarde a mensagem de sucesso

5. Teste novamente a edição de organização

## O que isso faz?

- ✅ Adiciona a coluna `slug` na tabela `organizations`
- ✅ Cria função para gerar slugs automaticamente (ex: "Minha Empresa" → "minha-empresa")
- ✅ Cria trigger para gerar slug ao criar/editar organizações
- ✅ Atualiza organizações existentes com slugs gerados automaticamente
- ✅ Garante que slugs sejam únicos (adiciona números se necessário)

## Após aplicar

A edição de organizações funcionará normalmente! 🎉
