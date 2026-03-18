# Processo de Criação de Super Admin

## Visão Geral

Super Admins têm acesso total ao sistema, podendo gerenciar todas as organizações sem restrições de plano. Este guia descreve o processo seguro de criação e gerenciamento de Super Admins.

## ⚠️ Considerações de Segurança

**IMPORTANTE**: Super Admins têm poder total sobre o sistema. Siga estas diretrizes:

- ✅ Apenas pessoas de extrema confiança
- ✅ Máximo de 3-5 Super Admins
- ✅ Documentar todas as criações
- ✅ Revisar acessos regularmente
- ✅ Usar autenticação forte (MFA)

## Pré-requisitos

### 1. Acesso ao Banco de Dados
- Acesso ao Supabase SQL Editor
- Permissões de `service_role`
- Backup recente do banco

### 2. Informações Necessárias
- Email do futuro Super Admin
- Justificativa para a criação
- Aprovação da liderança técnica

### 3. Usuário Já Cadastrado
O usuário deve estar registrado no sistema (tabela `auth.users`) antes de ser promovido a Super Admin.

## Processo de Criação

### Método 1: Script Automatizado (Recomendado)

1. **Execute o script de criação**:
```bash
node create-test-super-admin.js
```

2. **Siga as instruções interativas**:
```
? Email do usuário: admin@empresa.com
? Nome completo: João Silva
? Justificativa: Administrador técnico principal
? Confirmar criação? (y/N): y
```

3. **Verifique a criação**:
```bash
node scripts/verificar-super-admin.js admin@empresa.com
```

### Método 2: SQL Manual

1. **Conecte ao Supabase SQL Editor**:
   - URL: https://supabase.com/dashboard/project/[PROJECT_ID]/sql
   - Use credenciais de service_role

2. **Verifique se o usuário existe**:
```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'admin@empresa.com';
```

3. **Crie o registro de Super Admin**:
```sql
-- Substitua USER_ID pelo ID retornado na query anterior
INSERT INTO super_admins (
  user_id,
  created_by,
  notes,
  is_active
) VALUES (
  'USER_ID_AQUI',
  auth.uid(), -- Seu ID como criador
  'Super Admin criado em [DATA] - [JUSTIFICATIVA]',
  true
);
```

4. **Verifique a criação**:
```sql
SELECT 
  sa.id,
  sa.user_id,
  u.email,
  sa.created_at,
  sa.notes,
  sa.is_active
FROM super_admins sa
JOIN auth.users u ON u.id = sa.user_id
WHERE u.email = 'admin@empresa.com';
```

## Verificação Pós-Criação

### 1. Teste de Login
1. Peça para o novo Super Admin fazer login
2. Verifique se aparece a interface de Super Admin
3. Teste acesso a múltiplas organizações

### 2. Teste de Funcionalidades
```bash
# Execute testes automatizados
node test-user-access-system-complete.js

# Teste específico de Super Admin
node scripts/test-super-admin-permissions.js
```

### 3. Verificação Manual
- [ ] Dashboard de Super Admin visível
- [ ] Pode listar todas as organizações
- [ ] Pode criar usuários em qualquer org
- [ ] Pode alterar tipos de usuário
- [ ] Pode acessar logs de auditoria
- [ ] Bypass de limites de plano funciona

## Gerenciamento de Super Admins

### Listar Super Admins Ativos

```sql
SELECT 
  sa.id,
  u.email,
  u.created_at as user_created,
  sa.created_at as super_admin_since,
  sa.notes,
  creator.email as created_by_email
FROM super_admins sa
JOIN auth.users u ON u.id = sa.user_id
LEFT JOIN auth.users creator ON creator.id = sa.created_by
WHERE sa.is_active = true
ORDER BY sa.created_at;
```

### Desativar Super Admin

```sql
-- CUIDADO: Ação irreversível sem novo processo de criação
UPDATE super_admins 
SET 
  is_active = false,
  updated_at = NOW(),
  notes = COALESCE(notes, '') || ' | Desativado em ' || NOW()::text
WHERE user_id = 'USER_ID_AQUI';
```

### Reativar Super Admin

```sql
UPDATE super_admins 
SET 
  is_active = true,
  updated_at = NOW(),
  notes = COALESCE(notes, '') || ' | Reativado em ' || NOW()::text
WHERE user_id = 'USER_ID_AQUI';
```

## Auditoria e Monitoramento

### Log de Criação

Toda criação de Super Admin deve ser documentada:

```markdown
## Super Admin Criado

**Data**: 2024-12-22 10:30:00 UTC
**Email**: admin@empresa.com
**Nome**: João Silva
**Criado por**: tech-lead@empresa.com
**Justificativa**: Administrador técnico principal para suporte L3
**Aprovado por**: CTO
**Ticket**: #SA-2024-001
```

### Monitoramento Contínuo

1. **Alertas Automáticos**:
   - Criação de novo Super Admin
   - Login de Super Admin fora do horário
   - Operações cross-org por Super Admin

2. **Revisão Mensal**:
   - Lista de Super Admins ativos
   - Últimos logins
   - Operações realizadas
   - Necessidade de manter acesso

3. **Auditoria Trimestral**:
   - Revisão completa de acessos
   - Validação de justificativas
   - Atualização de documentação

## Scripts de Manutenção

### Verificar Status de Super Admin

```bash
# Verificar usuário específico
node scripts/check-super-admin-status.js admin@empresa.com

# Listar todos os Super Admins
node scripts/list-all-super-admins.js

# Verificar últimas atividades
node scripts/super-admin-activity-report.js
```

### Backup de Configurações

```bash
# Backup da tabela super_admins
node scripts/backup-super-admin-config.js

# Restaurar backup
node scripts/restore-super-admin-config.js backup-2024-12-22.json
```

## Troubleshooting

### Usuário não vê interface de Super Admin

**Possíveis causas**:
1. Cache do navegador desatualizado
2. Registro não foi criado corretamente
3. Usuário não está ativo

**Soluções**:
```sql
-- Verificar registro
SELECT * FROM super_admins WHERE user_id = 'USER_ID';

-- Verificar se está ativo
SELECT is_active FROM super_admins WHERE user_id = 'USER_ID';

-- Forçar logout/login
-- Limpar cache do navegador
```

### Erro "Permission Denied" para Super Admin

**Possíveis causas**:
1. RLS policies incorretas
2. Service role não configurado
3. Cache de permissões desatualizado

**Soluções**:
```sql
-- Verificar policies RLS
SELECT * FROM pg_policies WHERE tablename = 'super_admins';

-- Testar com service role
SET ROLE service_role;
SELECT * FROM super_admins;
```

### Super Admin não consegue acessar organização

**Diagnóstico**:
```bash
node scripts/diagnose-super-admin-access.js USER_ID ORG_ID
```

**Soluções**:
1. Verificar se organização existe e está ativa
2. Limpar cache de permissões
3. Verificar logs de auditoria

## Processo de Remoção

### Quando Remover Super Admin

- ✅ Funcionário deixou a empresa
- ✅ Mudança de função/responsabilidade
- ✅ Violação de políticas de segurança
- ✅ Solicitação do próprio usuário

### Processo de Remoção

1. **Documentar Justificativa**:
```markdown
## Remoção de Super Admin

**Data**: 2024-12-22
**Email**: ex-admin@empresa.com
**Removido por**: security@empresa.com
**Motivo**: Funcionário deixou a empresa
**Aprovado por**: CTO
```

2. **Desativar Acesso**:
```sql
UPDATE super_admins 
SET 
  is_active = false,
  updated_at = NOW(),
  notes = COALESCE(notes, '') || ' | REMOVIDO: [MOTIVO] em ' || NOW()::text
WHERE user_id = 'USER_ID_AQUI';
```

3. **Verificar Remoção**:
```bash
node scripts/verify-super-admin-removal.js ex-admin@empresa.com
```

4. **Auditoria Pós-Remoção**:
   - Verificar se não há sessões ativas
   - Confirmar que interface não é mais acessível
   - Documentar no log de auditoria

## Boas Práticas

### Segurança

1. **Princípio do Menor Privilégio**:
   - Apenas quando absolutamente necessário
   - Revisar necessidade regularmente
   - Documentar todas as operações

2. **Autenticação Forte**:
   - MFA obrigatório para Super Admins
   - Senhas complexas
   - Rotação regular de credenciais

3. **Monitoramento**:
   - Log de todas as operações
   - Alertas para atividades suspeitas
   - Revisão regular de acessos

### Operacional

1. **Documentação**:
   - Manter registro atualizado
   - Justificar todas as criações
   - Documentar processos

2. **Comunicação**:
   - Informar equipe sobre mudanças
   - Treinar novos Super Admins
   - Estabelecer canais de suporte

3. **Backup**:
   - Backup regular das configurações
   - Plano de recuperação
   - Testes de restore

## Contatos de Emergência

### Suporte Técnico
- **Email**: tech-support@empresa.com
- **Slack**: #tech-emergency
- **Telefone**: +55 11 9999-9999

### Segurança
- **Email**: security@empresa.com
- **Incident Response**: security-incident@empresa.com

### Liderança
- **CTO**: cto@empresa.com
- **Tech Lead**: tech-lead@empresa.com

---

**IMPORTANTE**: Este documento contém informações sensíveis. Mantenha acesso restrito e atualize regularmente.