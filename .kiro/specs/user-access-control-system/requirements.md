# Requirements Document

## Introduction

Este sistema implementa controle de acesso hierárquico com três níveis distintos de usuários para a plataforma Ads Manager: Super Admin (acesso total sem limites), Admin de Organização (gerencia usuários e clientes dentro do plano contratado) e Usuário Comum (acesso restrito aos clientes autorizados pelo admin).

## Glossary

- **User_Access_System**: Sistema completo de controle de acesso hierárquico baseado em tipos de usuário
- **Super_Admin**: Usuário administrador do sistema com acesso ilimitado, não vinculado a organizações ou planos
- **Organization_Admin**: Administrador de uma organização que gerencia usuários e clientes dentro dos limites do plano contratado
- **Common_User**: Usuário comum que acessa apenas os clientes autorizados pelo admin, sem permissão para criar clientes ou conexões
- **User_Management_System**: Sistema de CRUD de usuários gerenciado por admins
- **Client_Access_Control**: Controle granular de acesso de usuários comuns aos clientes do portfólio
- **Organization**: Entidade que representa uma empresa/agência que contratou o plano
- **Client**: Empresa cliente dentro do portfólio da organização
- **Membership**: Relacionamento entre usuário e organização com role específico

## Requirements

### Requirement 1

**User Story:** Como super admin do sistema, eu quero ter acesso completo e ilimitado a todas as funcionalidades e organizações, para que eu possa administrar o sistema sem restrições.

#### Acceptance Criteria

1. WHEN a super admin logs into the system, THE User_Access_System SHALL grant unlimited access to all organizations and features without checking subscription status
2. WHEN a super admin creates users, clients or connections, THE User_Access_System SHALL not apply any quantity restrictions or plan limitations
3. WHEN a super admin accesses any organization, THE User_Access_System SHALL allow full read and write access to all data
4. THE User_Access_System SHALL identify super admins through a dedicated flag in the user profile table
5. WHEN a super admin performs any action, THE User_Access_System SHALL bypass all subscription-based and organization-based limitations

### Requirement 2

**User Story:** Como admin de uma organização, eu quero gerenciar os usuários da minha organização através de CRUD completo, para que eu possa controlar quem tem acesso ao sistema.

#### Acceptance Criteria

1. WHEN an organization admin accesses user management, THE User_Management_System SHALL display all users of their organization
2. WHEN an organization admin creates a new user, THE User_Management_System SHALL add the user to their organization with appropriate membership
3. WHEN an organization admin updates user information, THE User_Management_System SHALL validate permissions and apply changes only to users within their organization
4. WHEN an organization admin deletes a user, THE User_Management_System SHALL remove the user's membership and revoke all access
5. THE User_Management_System SHALL prevent organization admins from managing users outside their organization

### Requirement 3

**User Story:** Como admin de uma organização, eu quero definir quais clientes cada usuário comum pode acessar, para que eu possa controlar o acesso granular ao portfólio.

#### Acceptance Criteria

1. WHEN an organization admin assigns client access, THE Client_Access_Control SHALL create specific permissions linking the user to authorized clients
2. WHEN an organization admin views user permissions, THE Client_Access_Control SHALL display all client access assignments for users in their organization
3. WHEN an organization admin revokes client access, THE Client_Access_Control SHALL immediately remove the user's ability to view that client's data
4. THE Client_Access_Control SHALL allow admins to assign multiple clients to a single user
5. WHEN a user is deleted, THE Client_Access_Control SHALL automatically remove all client access assignments

### Requirement 4

**User Story:** Como admin de uma organização, eu quero que minhas ações sejam limitadas pelo plano contratado, para que o sistema mantenha controle sobre o uso de recursos.

#### Acceptance Criteria

1. WHEN an organization admin creates clients, THE User_Access_System SHALL enforce limits based on the active subscription plan
2. WHEN an organization admin creates users, THE User_Access_System SHALL check if the organization has reached the user limit of their plan
3. WHEN an organization admin creates connections, THE User_Access_System SHALL validate against plan limits before allowing the action
4. WHEN the organization's subscription expires, THE User_Access_System SHALL restrict the admin's ability to create new resources
5. THE User_Access_System SHALL display current usage and plan limits to organization admins

### Requirement 5

**User Story:** Como usuário comum, eu quero acessar apenas os clientes que o admin autorizou para mim, para que eu possa trabalhar com os dados relevantes ao meu trabalho.

#### Acceptance Criteria

1. WHEN a common user logs in, THE Client_Access_Control SHALL display only the clients explicitly authorized by the organization admin
2. WHEN a common user attempts to access unauthorized clients, THE User_Access_System SHALL deny access and return appropriate error messages
3. WHEN a common user views campaigns, THE User_Access_System SHALL filter data to show only campaigns from authorized clients
4. WHEN a common user accesses reports, THE User_Access_System SHALL restrict data to authorized clients only
5. THE Client_Access_Control SHALL update user access immediately when admin changes permissions

### Requirement 6

**User Story:** Como usuário comum, eu não quero ter permissão para criar clientes ou conexões, para que a estrutura do portfólio seja controlada apenas por admins.

#### Acceptance Criteria

1. WHEN a common user accesses the client creation interface, THE User_Access_System SHALL hide or disable the creation functionality
2. WHEN a common user attempts to create a client via API, THE User_Access_System SHALL reject the request with appropriate error message
3. WHEN a common user accesses connection management, THE User_Access_System SHALL prevent creation of new connections
4. WHEN a common user attempts to create a connection via API, THE User_Access_System SHALL reject the request with permission denied error
5. THE User_Access_System SHALL allow common users to view client and connection information for authorized clients only

### Requirement 7

**User Story:** Como super admin, eu quero gerenciar usuários de qualquer organização, para que eu possa fornecer suporte e administração do sistema.

#### Acceptance Criteria

1. WHEN a super admin accesses user management, THE User_Management_System SHALL display users from all organizations
2. WHEN a super admin creates a user, THE User_Management_System SHALL allow assignment to any organization
3. WHEN a super admin assigns client access, THE Client_Access_Control SHALL allow access configuration for any user and any client
4. WHEN a super admin modifies user types, THE User_Access_System SHALL allow changing between common user and organization admin roles
5. THE User_Management_System SHALL log all super admin actions for audit purposes

### Requirement 8

**User Story:** Como desenvolvedor do sistema, eu quero um middleware centralizado de controle de acesso, para que todas as APIs respeitem consistentemente as permissões de usuário.

#### Acceptance Criteria

1. THE User_Access_System SHALL provide middleware functions that validate user type and permissions before processing API requests
2. WHEN any API endpoint is accessed, THE User_Access_System SHALL check if the user has permission to perform the requested action
3. WHEN a common user accesses client-specific endpoints, THE Client_Access_Control SHALL validate that the user has access to the requested client
4. WHEN an organization admin accesses endpoints, THE User_Access_System SHALL validate that resources belong to their organization
5. THE User_Access_System SHALL return consistent error responses for permission denied scenarios

### Requirement 9

**User Story:** Como usuário do sistema, eu quero ver apenas as funcionalidades que tenho permissão para usar, para que a interface seja clara e não confusa.

#### Acceptance Criteria

1. WHEN a common user views the dashboard, THE User_Access_System SHALL hide client creation and connection management buttons
2. WHEN an organization admin views the dashboard, THE User_Access_System SHALL display user management and client creation features
3. WHEN a super admin views the dashboard, THE User_Access_System SHALL display all administrative features
4. WHEN a user attempts to access restricted features, THE User_Access_System SHALL display clear messages explaining the limitation
5. THE User_Access_System SHALL provide visual indicators showing the user's current access level and permissions

### Requirement 10

**User Story:** Como admin de organização, eu quero que o sistema valide a estrutura de dados ao criar usuários, para que não haja inconsistências no banco de dados.

#### Acceptance Criteria

1. WHEN an admin creates a user, THE User_Management_System SHALL validate that the organization exists and is active
2. WHEN an admin assigns client access, THE Client_Access_Control SHALL validate that both user and client belong to the same organization
3. WHEN creating memberships, THE User_Management_System SHALL ensure no duplicate memberships exist for the same user-organization pair
4. WHEN assigning roles, THE User_Management_System SHALL validate that the role is appropriate for the user type
5. THE User_Access_System SHALL maintain referential integrity between users, organizations, clients, and access permissions
