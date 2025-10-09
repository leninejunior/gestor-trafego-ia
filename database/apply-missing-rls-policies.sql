-- Script para aplicar apenas as políticas RLS que estão faltando
-- Execute este SQL no Supabase Dashboard

-- Verificar e criar política de DELETE se não existir
DO $$
BEGIN
    -- Tentar criar a política de DELETE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'client_meta_connections' 
        AND policyname = 'Users can delete their own client meta connections'
    ) THEN
        CREATE POLICY "Users can delete their own client meta connections" ON client_meta_connections
            FOR DELETE USING (
                client_id IN (
                    SELECT c.id FROM clients c
                    JOIN memberships m ON c.org_id = m.org_id
                    WHERE m.user_id = auth.uid()
                )
            );
        RAISE NOTICE 'Política de DELETE criada com sucesso';
    ELSE
        RAISE NOTICE 'Política de DELETE já existe';
    END IF;
END $$;

-- Verificar se a política de UPDATE existe (só para confirmar)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'client_meta_connections' 
        AND policyname = 'Users can update their own client meta connections'
    ) THEN
        RAISE NOTICE 'Política de UPDATE já existe - OK';
    ELSE
        RAISE NOTICE 'ATENÇÃO: Política de UPDATE não encontrada';
    END IF;
END $$;

-- Listar todas as políticas da tabela client_meta_connections para verificação
SELECT 
    policyname as "Nome da Política",
    cmd as "Comando",
    CASE 
        WHEN roles = '{}'::name[] THEN 'Todos os usuários'
        ELSE array_to_string(roles, ', ')
    END as "Aplicável a"
FROM pg_policies 
WHERE tablename = 'client_meta_connections'
ORDER BY policyname;