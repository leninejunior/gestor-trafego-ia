-- =====================================================
-- Inicialização Mínima de Dados
-- Execute este script após criar um usuário no Supabase
-- =====================================================

-- 1. Criar organização padrão
INSERT INTO organizations (name) 
VALUES ('Minha Organização')
ON CONFLICT DO NOTHING;

-- 2. Obter o ID da organização criada
-- Você precisará usar este ID para criar a membership

-- 3. Criar cliente padrão (após ter a organização)
-- Substitua 'ORG_ID_AQUI' pelo ID da organização
INSERT INTO clients (name, org_id)
SELECT 'Cliente Padrão', id FROM organizations WHERE name = 'Minha Organização'
ON CONFLICT DO NOTHING;

-- 4. Criar membership para o usuário (após ter a organização)
-- Substitua 'USER_ID_AQUI' pelo ID do seu usuário Supabase
-- Você pode obter o ID do usuário em: Supabase Dashboard > Authentication > Users
INSERT INTO memberships (user_id, org_id, role)
SELECT 'USER_ID_AQUI'::uuid, id, 'admin' 
FROM organizations WHERE name = 'Minha Organização'
ON CONFLICT (user_id, org_id) DO NOTHING;

-- =====================================================
-- Instruções:
-- 1. Vá para Supabase Dashboard > SQL Editor
-- 2. Copie este script
-- 3. Substitua 'USER_ID_AQUI' pelo seu ID de usuário
-- 4. Execute o script
-- 5. Recarregue a página do app
-- =====================================================
