-- EXECUTE ESTE SQL NO SUPABASE SQL EDITOR
-- URL: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql

-- 1. Adicionar coluna slug
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON organizations(slug);

-- 3. Função para gerar slug
CREATE OR REPLACE FUNCTION generate_slug(name TEXT) 
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
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
  
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger para gerar slug automaticamente
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

-- 5. Atualizar organizações existentes
UPDATE organizations 
SET slug = generate_slug(name)
WHERE slug IS NULL OR slug = '';