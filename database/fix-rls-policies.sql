-- Adicionar políticas RLS faltantes para operações DELETE e UPDATE

-- Política para UPDATE em client_meta_connections
CREATE POLICY "Users can update their own client meta connections" ON client_meta_connections
    FOR UPDATE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Política para DELETE em client_meta_connections
CREATE POLICY "Users can delete their own client meta connections" ON client_meta_connections
    FOR DELETE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN memberships m ON c.org_id = m.org_id
            WHERE m.user_id = auth.uid()
        )
    );

-- Política para DELETE em clients (caso necessário)
CREATE POLICY "Users can delete their own clients" ON clients
    FOR DELETE USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Política para DELETE em ad_accounts (caso necessário)
CREATE POLICY "Users can delete their own ad accounts" ON ad_accounts
    FOR DELETE USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Política para UPDATE em ad_accounts (caso necessário)
CREATE POLICY "Users can update their own ad accounts" ON ad_accounts
    FOR UPDATE USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Política para DELETE em oauth_tokens (caso necessário)
CREATE POLICY "Users can delete their own oauth tokens" ON oauth_tokens
    FOR DELETE USING (
        org_id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );