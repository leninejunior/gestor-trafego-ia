# Sistema de Controle de Acesso Hierárquico

## Visão Geral

O Sistema de Controle de Acesso Hierárquico implementa três níveis distintos de usuários para a plataforma Ads Manager:

- **Super Admin**: Acesso total sem limites a todas as organizações
- **Admin de Organização**: Gerencia usuários e clientes dentro do plano contratado
- **Usuário Comum**: Acesso restrito aos clientes autorizados pelo admin

## Arquitetura do Sistema

### Hierarquia de Permissões

```
Super Admin
    ├── Acesso a todas as organizações
    ├── Bypass de todos os limites de plano
    ├── Gerenciamento cross-org de usuários
    └── Logs de auditoria completos

Organization Admin
    ├── Gerenciamento de usuários da própria org
    ├── Atribuição de acesso a clientes
    ├── Limitado pelo plano contratado
    └── Criação de clientes e conexões

Common User
    ├── Acesso apenas a clientes autorizados
    ├── Visualização de campanhas e relatórios
    ├── Sem permissão para criar recursos
    └── Interface simplificada
```

### Componentes Principais

1. **UserAccessControlService**: Serviço central de controle de acesso
2. **UserManagementService**: Gerenciamento CRUD de usuários
3. **Access Control Middleware**: Middleware para APIs
4. **React Hooks**: Hooks para componentes React
5. **Database Schema**: Tabelas e RLS policies

## Guias de Uso

- [Guia para Admins de Organização](./guides/organization-admin-guide.md)
- [Documentação de APIs](./api/user-access-apis.md)
- [Processo de Criação de Super Admin](./guides/super-admin-setup.md)
- [Troubleshooting](./troubleshooting/user-access-troubleshooting.md)

## Segurança

### Row Level Security (RLS)

Todas as tabelas implementam RLS para isolamento de dados:

- `super_admins`: Apenas super admins podem ver/modificar
- `user_client_access`: Usuários veem apenas seus próprios acessos
- `memberships`: Isolamento por organização

### Validações

- Usuário e cliente devem pertencer à mesma organização
- Unicidade de memberships por usuário/organização
- Validação de limites de plano antes de criar recursos
- Sanitização de inputs para prevenir SQL injection

## Performance

### Caching

- Cache de tipo de usuário (TTL: 5 minutos)
- Cache de limites de plano (TTL: 10 minutos)
- Cache de lista de clientes autorizados (TTL: 2 minutos)
- Invalidação automática em mudanças de permissão

### Índices de Banco

```sql
-- Índices para performance
CREATE INDEX idx_super_admins_user_id ON super_admins(user_id) WHERE is_active = true;
CREATE INDEX idx_user_client_access_user_id ON user_client_access(user_id) WHERE is_active = true;
CREATE INDEX idx_memberships_user_org ON memberships(user_id, organization_id);
```

## Monitoramento

### Métricas Importantes

- Taxa de acesso negado por tipo de usuário
- Latência de verificação de permissões
- Uso de limites de plano por organização
- Tentativas de acesso não autorizado

### Logs de Auditoria

Todas as operações sensíveis são logadas:

- Mudanças de tipo de usuário
- Concessões e revogações de acesso
- Tentativas de acesso negado
- Operações de super admin

## Próximos Passos

1. **Permissões Granulares**: Permissões por tipo de campanha
2. **Audit Log Avançado**: Relatórios de acesso por usuário
3. **Self-Service**: Workflow de aprovação para acessos
4. **API Keys**: Suporte a API keys para integrações

## Suporte

Para problemas ou dúvidas:

1. Consulte o [Troubleshooting Guide](./troubleshooting/user-access-troubleshooting.md)
2. Verifique os logs de auditoria no dashboard de super admin
3. Execute os scripts de diagnóstico disponíveis
4. Entre em contato com a equipe de desenvolvimento

---

**Última atualização**: Dezembro 2024
**Versão**: 1.0.0