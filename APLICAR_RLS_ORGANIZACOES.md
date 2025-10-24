# Aplicar Políticas RLS para Organizações

Execute o seguinte SQL no Supabase Dashboard > SQL Editor:

```sql
-- Fix RLS policy for organizations to allow super_admin to update

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;
DROP POLICY IF EXISTS "Super admin can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Super admin can delete organizations" ON organizations;

-- Create new policy that allows both admin and super_admin to update
CREATE POLICY "Users can update their own organizations" ON organizations
    FOR UPDATE USING (
        id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- Allow users to view organizations they belong to
CREATE POLICY "Users can view their own organizations" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Allow super_admin to insert organizations
CREATE POLICY "Super admin can insert organizations" ON organizations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Allow super_admin to delete organizations
CREATE POLICY "Super admin can delete organizations" ON organizations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );
```

## Instruções

1. Abra o Supabase Dashboard
2. Vá para SQL Editor
3. Cole e execute o SQL acima
4. Teste a funcionalidade de edição de organizações

## Problema Identificado

O service role key no arquivo .env está truncado/inválido:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.Ej6Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8
```

A parte final "Ej8Ej8Ej8..." não é uma assinatura JWT válida. Isso precisa ser corrigido com a chave real do Supabase.