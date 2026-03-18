# Implementation Plan - Sistema de Controle de Acesso Hierárquico

## Overview

Este plano implementa um sistema de controle de acesso com três níveis de usuários (Super Admin, Admin de Organização, Usuário Comum) através de uma abordagem incremental, construindo a base de dados, serviços, APIs e interface de usuário.

## Tasks

- [x] 1. Setup do schema de banco de dados e migrações
  - Criar tabelas `super_admins` e `user_client_access`
  - Adicionar coluna `role` em `memberships`
  - Implementar RLS policies para isolamento de dados
  - Criar índices para performance
  - _Requirements: 1.4, 10.5_

- [x] 1.1 Write property test for database constraints
  - **Property 13: Membership Uniqueness**
  - **Validates: Requirements 10.3**

- [x] 2. Implementar serviço de controle de acesso (UserAccessControlService)
  - Criar função `getUserType()` para identificar tipo de usuário
  - Implementar `checkPermission()` para validar acesso a recursos
  - Criar `getUserAccessibleClients()` para listar clientes autorizados
  - Implementar `getOrganizationLimits()` para obter limites do plano
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 4.1, 4.2, 4.3_

- [x] 2.1 Write property test for super admin access
  - **Property 1: Super Admin Universal Access**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.5**

- [x] 2.2 Write property test for client access authorization
  - **Property 5: Client Access Authorization**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 6.5**

- [x] 2.3 Write property test for plan limit enforcement
  - **Property 10: Plan Limit Enforcement**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 3. Implementar serviço de gerenciamento de usuários (UserManagementService)
  - Criar `createUser()` com validação de organização e limites
  - Implementar `updateUser()` com verificação de permissões
  - Criar `deleteUser()` com cascade de registros relacionados
  - Implementar `listOrganizationUsers()` com filtro por organização
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 10.1_

- [x] 3.1 Write property test for organization boundary enforcement
  - **Property 2: Organization Boundary Enforcement**
  - **Validates: Requirements 2.1, 2.3, 2.5**

- [x] 3.2 Write property test for user creation consistency
  - **Property 3: User Creation Membership Consistency**
  - **Validates: Requirements 2.2**

- [x] 3.3 Write property test for user deletion cascade
  - **Property 4: User Deletion Cascade Cleanup**
  - **Validates: Requirements 2.4, 3.5**

- [x] 3.4 Write property test for organization validation
  - **Property 14: Organization Validation on User Creation**
  - **Validates: Requirements 10.1**

- [x] 4. Implementar gerenciamento de acesso a clientes
  - Criar `grantClientAccess()` com validação de mesma organização
  - Implementar `revokeClientAccess()` com efeito imediato
  - Criar `listUserClientAccess()` para visualizar acessos
  - Implementar validação de múltiplos acessos por usuário
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.2_

- [x] 4.1 Write property test for same-organization constraint
  - **Property 7: Access Grant Same-Organization Constraint**
  - **Validates: Requirements 10.2**

- [x] 4.2 Write property test for access revocation immediacy
  - **Property 8: Access Revocation Immediacy**
  - **Validates: Requirements 3.3, 5.5**

- [x] 4.3 Write property test for multiple client access
  - **Property 9: Multiple Client Access Assignment**
  - **Validates: Requirements 3.4**

- [x] 5. Criar middleware de controle de acesso para APIs
  - Implementar `withUserAccessControl()` middleware base
  - Criar helpers específicos: `requireSuperAdmin()`, `requireOrgAdmin()`
  - Implementar `requireClientAccess()` para validar acesso a clientes
  - Adicionar `validatePlanLimit()` para verificar limites antes de criação
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 5.1 Write property test for common user creation restriction
  - **Property 6: Common User Creation Restriction**
  - **Validates: Requirements 6.2, 6.4**

- [x] 5.2 Write property test for permission checks
  - **Property 15: Permission Check on All API Requests**
  - **Validates: Requirements 8.2**

- [x] 6. Implementar APIs de gerenciamento de usuários
  - Criar `POST /api/admin/users` para criação de usuários
  - Implementar `PUT /api/admin/users/[userId]` para atualização
  - Criar `DELETE /api/admin/users/[userId]` para exclusão
  - Implementar `GET /api/admin/users` para listagem com filtros
  - Adicionar validação de permissões em cada endpoint
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7. Implementar APIs de gerenciamento de acesso a clientes
  - Criar `POST /api/admin/user-client-access` para conceder acesso
  - Implementar `DELETE /api/admin/user-client-access` para revogar
  - Criar `GET /api/admin/user-client-access/[userId]` para listar acessos
  - Adicionar validação de mesma organização
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 7.1 Write property test for subscription expiration
  - **Property 11: Subscription Expiration Restriction**
  - **Validates: Requirements 4.4**

- [x] 8. Implementar APIs de super admin
  - Criar `POST /api/super-admin/users` para criar usuários em qualquer org
  - Implementar `PUT /api/super-admin/users/[userId]/type` para mudar tipo
  - Criar `POST /api/super-admin/access` para conceder acesso cross-org
  - Implementar `GET /api/super-admin/organizations` para listar todas orgs
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 8.1 Write property test for super admin cross-org management
  - **Property 12: Super Admin Cross-Organization Management**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 9. Atualizar APIs existentes com controle de acesso
  - Adicionar middleware de acesso em `/api/campaigns`
  - Atualizar `/api/clients` para filtrar por acesso do usuário
  - Modificar `/api/connections` para bloquear criação por usuários comuns
  - Adicionar validação de limites em endpoints de criação
  - _Requirements: 5.3, 5.4, 6.2, 6.4, 4.1, 4.2, 4.3_

- [x] 10. Criar componente de gerenciamento de usuários (admin)
  - Implementar `UserManagementPanel` com lista de usuários
  - Criar `UserCreateDialog` para adicionar novos usuários
  - Implementar `UserEditDialog` para editar informações
  - Adicionar confirmação de exclusão com aviso de cascade
  - Mostrar indicadores de tipo de usuário e role
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 11. Criar componente de gerenciamento de acesso a clientes
  - Implementar `ClientAccessManager` para visualizar acessos
  - Criar `GrantAccessDialog` para conceder acesso a clientes
  - Adicionar validação visual de mesma organização
  - Implementar lista de clientes autorizados por usuário
  - Adicionar botão de revogação com confirmação
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 12. Criar dashboard de super admin
  - Implementar `SuperAdminDashboard` com visão geral do sistema
  - Criar seletor de organização para gerenciar qualquer org
  - Adicionar painel de gerenciamento de tipos de usuário
  - Implementar visualização de limites e uso por organização
  - Adicionar logs de auditoria de ações de super admin
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 13. Atualizar dashboards existentes com controle de acesso



  - Atualizar `ClientSearch` component para usar `filterByAccess` por padrão
  - Ocultar botões de criação para usuários comuns no dashboard
  - Adicionar indicadores visuais de tipo de usuário na sidebar
  - Implementar mensagens de limite de plano quando aplicável
  - Mostrar upgrade prompts para usuários sem plano ativo
  - _Requirements: 5.1, 6.1, 6.3, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 14. Implementar hook customizado de controle de acesso
  - Criar `useUserAccess()` hook para componentes React
  - Implementar `useUserType()` para obter tipo do usuário
  - Criar `useClientAccess()` para verificar acesso a clientes
  - Implementar `usePlanLimits()` para mostrar limites e uso
  - Adicionar cache e invalidação automática
  - _Requirements: 1.1, 5.1, 4.5_

- [x] 15. Adicionar tratamento de erros e feedback ao usuário
  - Implementar mensagens de erro específicas por tipo de restrição
  - Criar componentes de feedback para limites de plano
  - Adicionar tooltips explicativos em funcionalidades restritas
  - Implementar notificações de mudanças de permissão
  - Criar página de erro 403 customizada por contexto
  - _Requirements: 6.1, 9.4, 9.5_

- [x] 16. Checkpoint - Garantir que todos os testes passam





  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Implementar sistema de cache para performance
  - Adicionar cache de tipo de usuário (TTL: 5 minutos)
  - Implementar cache de limites de plano (TTL: 10 minutos)
  - Criar cache de lista de clientes autorizados (TTL: 2 minutos)
  - Adicionar invalidação de cache em mudanças de permissão
  - _Performance optimization_

- [x] 18. Adicionar logging e auditoria
  - Implementar log de todas as mudanças de tipo de usuário
  - Criar log de concessões e revogações de acesso
  - Adicionar log de tentativas de acesso negado
  - Implementar dashboard de auditoria para super admins
  - _Requirements: 7.5_

- [x] 19. Criar documentação e guias
  - Escrever guia de uso para admins de organização
  - Criar documentação de APIs para desenvolvedores
  - Documentar processo de criação de super admin
  - Adicionar troubleshooting guide para problemas comuns
  - _Documentation_

- [x] 20. Final checkpoint - Validação completa do sistema
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar todos os fluxos de usuário funcionando
  - Validar isolamento de dados entre organizações
  - Confirmar que limites de plano são respeitados
  - Testar cenários de super admin cross-org

## Notes

- Quase todas as tarefas foram implementadas com sucesso
- Cada tarefa de property test usa fast-check com mínimo 100 iterações
- Todas as APIs têm middleware de autenticação e autorização
- RLS policies foram testadas e aplicadas no Supabase
- Sistema de cache implementado com invalidação automática
- Logs de auditoria implementados para compliance e troubleshooting
- Documentação completa criada para todos os aspectos do sistema
- **Pendente**: Task 13 - Atualizar dashboards existentes com controle de acesso (ClientSearch e indicadores visuais)
