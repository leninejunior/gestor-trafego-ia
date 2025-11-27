# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir os erros de schema do banco de dados que estão impedindo a sincronização do Google Ads. Os logs mostram três problemas críticos: colunas ausentes nas tabelas `google_ads_encryption_keys`, `google_ads_audit_log` e `memberships`, além de a sincronização retornar 0 campanhas mesmo com conexão ativa.

## Glossary

- **System**: O sistema de gerenciamento de campanhas com integração Google Ads
- **Database_Schema**: Estrutura de tabelas e colunas no PostgreSQL/Supabase
- **Encryption_Keys_Table**: Tabela `google_ads_encryption_keys` para armazenar chaves de criptografia
- **Audit_Log_Table**: Tabela `google_ads_audit_log` para registrar eventos de auditoria
- **Memberships_Table**: Tabela `memberships` que relaciona usuários e organizações
- **Sync_Process**: Processo de sincronização de campanhas do Google Ads
- **RLS**: Row Level Security - políticas de segurança em nível de linha

## Requirements

### Requirement 1: Corrigir Schema da Tabela de Chaves de Criptografia

**User Story:** Como desenvolvedor, quero que a tabela `google_ads_encryption_keys` tenha todas as colunas necessárias, para que o sistema de criptografia funcione corretamente.

#### Acceptance Criteria

1. WHEN THE System attempts to rotate encryption keys, THE Encryption_Keys_Table SHALL contain a column named `algorithm`
2. THE Encryption_Keys_Table SHALL contain columns for `key_id`, `key_value`, `algorithm`, `created_at`, `expires_at`, and `is_active`
3. WHEN THE System queries the Encryption_Keys_Table, THE Database_Schema SHALL return all required columns without errors
4. THE Encryption_Keys_Table SHALL have appropriate data types for each column (TEXT for algorithm, TIMESTAMPTZ for dates)
5. THE System SHALL be able to insert new encryption keys with all required fields

### Requirement 2: Corrigir Schema da Tabela de Audit Log

**User Story:** Como administrador, quero que a tabela `google_ads_audit_log` registre eventos com o ID do cliente, para que eu possa rastrear ações por cliente.

#### Acceptance Criteria

1. WHEN THE System logs an audit event, THE Audit_Log_Table SHALL contain a column named `client_id`
2. THE Audit_Log_Table SHALL have a foreign key relationship with the `clients` table via `client_id`
3. WHEN THE System queries audit logs, THE Database_Schema SHALL filter by `client_id` without errors
4. THE Audit_Log_Table SHALL contain columns for `id`, `client_id`, `connection_id`, `event_type`, `event_data`, `user_id`, and `created_at`
5. THE System SHALL be able to insert audit events with client context

### Requirement 3: Corrigir Schema da Tabela Memberships

**User Story:** Como usuário, quero que o sistema identifique corretamente minha organização, para que eu possa acessar os clientes corretos.

#### Acceptance Criteria

1. WHEN THE System queries user memberships, THE Memberships_Table SHALL use the column `organization_id` instead of `org_id`
2. THE Memberships_Table SHALL have a foreign key relationship with the `organizations` table via `organization_id`
3. WHEN THE System checks super admin status, THE Database_Schema SHALL query `organization_id` without errors
4. THE System SHALL maintain backward compatibility with existing queries that use `organization_id`
5. WHEN THE System validates user permissions, THE Memberships_Table SHALL correctly join with `clients` table

### Requirement 4: Diagnosticar e Corrigir Sincronização de Campanhas

**User Story:** Como gestor de campanhas, quero que o sistema sincronize minhas campanhas do Google Ads, para que eu possa visualizar dados atualizados.

#### Acceptance Criteria

1. WHEN THE Sync_Process fetches campaigns from Google Ads API, THE System SHALL return more than 0 campaigns if campaigns exist
2. WHEN THE Sync_Process encounters API errors, THE System SHALL log detailed error messages including API response
3. THE System SHALL validate that the access token is valid before attempting to fetch campaigns
4. WHEN THE Sync_Process completes, THE System SHALL store campaign data in the `google_ads_campaigns` table
5. THE System SHALL log the number of campaigns fetched and any API errors encountered

### Requirement 5: Validar Políticas RLS Após Correções

**User Story:** Como administrador de segurança, quero que as políticas RLS continuem funcionando após as correções de schema, para que o isolamento de dados seja mantido.

#### Acceptance Criteria

1. WHEN THE Database_Schema is updated, THE System SHALL preserve all existing RLS policies
2. THE System SHALL validate that RLS policies reference correct column names after schema changes
3. WHEN THE System queries Google Ads data, THE RLS policies SHALL filter by `client_id` correctly
4. THE System SHALL prevent users from accessing data of clients they don't have permission for
5. WHEN THE System tests RLS policies, THE Database_Schema SHALL enforce isolation between different clients

### Requirement 6: Adicionar Logging Detalhado para Debugging

**User Story:** Como desenvolvedor, quero logs detalhados do processo de sincronização, para que eu possa diagnosticar problemas rapidamente.

#### Acceptance Criteria

1. WHEN THE Sync_Process starts, THE System SHALL log the connection details (connection_id, customer_id)
2. WHEN THE System calls Google Ads API, THE System SHALL log the request parameters and response status
3. WHEN THE Sync_Process encounters errors, THE System SHALL log the full error object including stack trace
4. THE System SHALL log the number of campaigns fetched at each step of the sync process
5. WHEN THE Sync_Process completes, THE System SHALL log a summary including success/failure status and metrics

### Requirement 7: Criar Script de Migração Seguro

**User Story:** Como administrador de banco de dados, quero um script de migração que corrija os schemas sem perder dados, para que a atualização seja segura.

#### Acceptance Criteria

1. THE System SHALL provide a migration script that adds missing columns without dropping tables
2. WHEN THE migration script runs, THE System SHALL preserve all existing data in affected tables
3. THE migration script SHALL use `ALTER TABLE ADD COLUMN IF NOT EXISTS` to avoid errors on re-run
4. THE System SHALL provide a rollback script to revert changes if needed
5. WHEN THE migration completes, THE System SHALL validate that all required columns exist

### Requirement 8: Validar Tokens de Acesso

**User Story:** Como usuário, quero que o sistema valide e renove tokens automaticamente, para que minhas conexões permaneçam ativas.

#### Acceptance Criteria

1. WHEN THE System detects an expired token, THE System SHALL attempt to refresh it automatically
2. THE System SHALL log token refresh attempts including success or failure
3. WHEN THE token refresh fails, THE System SHALL mark the connection as `expired` in the database
4. THE System SHALL validate token expiration before making API calls
5. WHEN THE System refreshes a token, THE System SHALL update the `token_expires_at` field in the database

### Requirement 9: Implementar Health Check para Google Ads

**User Story:** Como administrador, quero um endpoint de health check para Google Ads, para que eu possa monitorar o status das conexões.

#### Acceptance Criteria

1. THE System SHALL provide an endpoint `/api/google/health` that checks connection status
2. WHEN THE health check runs, THE System SHALL validate database schema integrity
3. THE System SHALL check if encryption keys are properly configured
4. THE System SHALL verify that at least one active connection exists (if applicable)
5. WHEN THE health check completes, THE System SHALL return a detailed status report

### Requirement 10: Documentar Estrutura de Schema Correta

**User Story:** Como desenvolvedor, quero documentação clara do schema correto, para que futuras implementações sigam o padrão.

#### Acceptance Criteria

1. THE System SHALL provide documentation of all Google Ads related tables with column definitions
2. THE documentation SHALL include data types, constraints, and relationships for each column
3. THE System SHALL document RLS policies for each table
4. THE documentation SHALL include examples of correct queries for common operations
5. WHEN THE schema changes, THE System SHALL update the documentation accordingly
