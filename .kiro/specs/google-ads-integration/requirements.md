# Requirements Document

## Introduction

Este documento especifica os requisitos para a integração completa do Google Ads ao sistema de gerenciamento de campanhas, mantendo a arquitetura existente da Meta Ads e criando uma separação clara entre as plataformas. O sistema deve permitir que agências gerenciem campanhas do Google Ads com o mesmo nível de funcionalidade e isolamento de dados por cliente que existe atualmente para Meta Ads.

## Glossary

- **System**: O sistema de gerenciamento de campanhas multi-plataforma
- **Google_Ads_Platform**: A plataforma de anúncios do Google acessada via Google Ads API
- **Meta_Ads_Platform**: A plataforma de anúncios da Meta (Facebook/Instagram) já integrada
- **Client**: Uma conta de cliente gerenciada pela agência
- **Campaign**: Uma campanha publicitária no Google Ads ou Meta Ads
- **OAuth_Flow**: Processo de autenticação OAuth 2.0 para conectar contas
- **Dashboard**: Interface de visualização de métricas e KPIs
- **RLS**: Row Level Security - segurança em nível de linha no banco de dados
- **KPI**: Key Performance Indicator - indicador chave de desempenho
- **Unified_Dashboard**: Dashboard principal que consolida métricas de ambas as plataformas
- **Platform_Specific_Dashboard**: Dashboard dedicado a uma única plataforma (Meta ou Google)

## Requirements

### Requirement 1: Autenticação e Conexão Google Ads

**User Story:** Como usuário do sistema, quero conectar minhas contas do Google Ads via OAuth 2.0, para que eu possa gerenciar campanhas do Google Ads dentro do sistema.

#### Acceptance Criteria

1. WHEN THE User_Account selects "Conectar Google Ads" for a Client, THE System SHALL initiate the Google_OAuth_Flow with appropriate scopes for Google Ads API access
2. WHEN THE Google_OAuth_Flow completes successfully, THE System SHALL store the access_token and refresh_token encrypted in the database associated with the Client
3. WHEN THE access_token expires, THE System SHALL automatically refresh the token using the refresh_token without user intervention
4. WHERE a Client has multiple Google Ads accounts, THE System SHALL allow the User_Account to select which accounts to connect
5. WHEN THE connection fails, THE System SHALL display a clear error message and allow retry without data loss

### Requirement 2: Isolamento de Dados por Cliente

**User Story:** Como administrador de agência, quero que os dados do Google Ads de cada cliente sejam completamente isolados, para que não haja vazamento de informações entre clientes diferentes.

#### Acceptance Criteria

1. THE System SHALL implement RLS policies on all Google Ads related tables filtering by client_id
2. WHEN THE System queries Google_Ads_Data, THE System SHALL enforce client_id validation at the database level
3. THE System SHALL prevent access to Google_Ads_Data WHERE the authenticated user does not have permission for the associated Client
4. WHEN THE System stores Google_Ads_Campaigns, THE System SHALL associate each record with exactly one client_id
5. THE System SHALL maintain data isolation even when the same Google Ads account_id is connected to different Clients

### Requirement 3: Sincronização de Campanhas Google Ads

**User Story:** Como gestor de campanhas, quero que o sistema sincronize automaticamente minhas campanhas do Google Ads, para que eu tenha dados atualizados sem intervenção manual.

#### Acceptance Criteria

1. WHEN THE Client connects a Google_Ads_Account, THE System SHALL perform an initial sync of all campaigns within 5 minutes
2. THE System SHALL sync Google_Ads_Campaign data automatically every 6 hours
3. WHEN THE sync process encounters an API error, THE System SHALL retry up to 3 times with exponential backoff
4. THE System SHALL store campaign metrics including impressions, clicks, conversions, cost, and CTR
5. WHEN THE sync completes, THE System SHALL update the last_sync_timestamp for the Client connection

### Requirement 4: Dashboard Específico Google Ads

**User Story:** Como usuário, quero um dashboard dedicado ao Google Ads com todas as funcionalidades que existem no dashboard da Meta, para que eu possa gerenciar campanhas do Google com a mesma eficiência.

#### Acceptance Criteria

1. THE System SHALL provide a dedicated route "/dashboard/google" for the Google_Ads_Platform dashboard
2. THE Platform_Specific_Dashboard SHALL display campaign list, metrics, and insights specific to Google_Ads_Platform
3. THE Platform_Specific_Dashboard SHALL include filters by date range, campaign status, and performance metrics
4. THE Platform_Specific_Dashboard SHALL display real-time KPIs including spend, conversions, ROAS, and CPA
5. WHERE a Client has no Google_Ads_Connection, THE Platform_Specific_Dashboard SHALL display a connection prompt

### Requirement 5: Dashboard Unificado Multi-Plataforma

**User Story:** Como gestor de múltiplas plataformas, quero ver KPIs consolidados de Meta e Google Ads no dashboard principal, para que eu tenha uma visão geral do desempenho sem entrar em dashboards específicos.

#### Acceptance Criteria

1. THE Unified_Dashboard SHALL display aggregated KPIs from both Meta_Ads_Platform and Google_Ads_Platform
2. THE Unified_Dashboard SHALL show total spend, total conversions, average ROAS, and total impressions across platforms
3. THE Unified_Dashboard SHALL include a breakdown chart showing performance by platform
4. THE Unified_Dashboard SHALL allow filtering by date range affecting both platforms simultaneously
5. WHERE a Client has only one platform connected, THE Unified_Dashboard SHALL display data from the available platform with a prompt to connect the other

### Requirement 6: Menu de Navegação Separado

**User Story:** Como usuário, quero menus de navegação separados para Meta Ads e Google Ads, para que eu possa acessar rapidamente as funcionalidades específicas de cada plataforma.

#### Acceptance Criteria

1. THE System SHALL maintain the existing "Campanhas" menu item for Meta_Ads_Platform functionality
2. THE System SHALL add a new "Google Ads" menu item in the sidebar navigation
3. THE System SHALL add a new "Insights Google" menu item for Google_Ads_Platform analytics
4. THE System SHALL preserve all existing Meta_Ads_Platform menu items and functionality without modification
5. THE System SHALL visually distinguish platform-specific menu items with appropriate icons

### Requirement 7: Gestão de Campanhas Google Ads

**User Story:** Como gestor de campanhas, quero visualizar e gerenciar minhas campanhas do Google Ads, para que eu possa monitorar performance e fazer ajustes quando necessário.

#### Acceptance Criteria

1. THE System SHALL display a list of all Google_Ads_Campaigns for the selected Client
2. THE System SHALL show campaign status (active, paused, ended) with visual indicators
3. THE System SHALL display key metrics for each campaign including spend, clicks, conversions, and CTR
4. THE System SHALL allow filtering campaigns by status, date range, and performance thresholds
5. THE System SHALL provide a search functionality to find campaigns by name or ID

### Requirement 8: Analytics e Insights Google Ads

**User Story:** Como analista de marketing, quero visualizar insights detalhados das campanhas do Google Ads, para que eu possa tomar decisões baseadas em dados.

#### Acceptance Criteria

1. THE System SHALL provide a dedicated analytics page at "/dashboard/analytics/google"
2. THE System SHALL display performance trends over time with interactive charts
3. THE System SHALL show demographic breakdowns WHERE available from Google_Ads_API
4. THE System SHALL calculate and display custom metrics like ROAS, CPA, and conversion rate
5. THE System SHALL allow comparison between different time periods

### Requirement 9: Histórico e Cache de Dados

**User Story:** Como usuário, quero que o sistema mantenha histórico de dados do Google Ads, para que eu possa analisar tendências mesmo quando a API do Google tiver limitações de período.

#### Acceptance Criteria

1. THE System SHALL store historical Google_Ads_Data in the database for at least 90 days
2. THE System SHALL serve cached data WHEN real-time API calls fail or timeout
3. THE System SHALL indicate to the user WHEN displaying cached data versus live data
4. THE System SHALL implement data retention policies based on the Client subscription plan
5. THE System SHALL automatically clean up data older than the retention period

### Requirement 10: Tratamento de Erros e Limites de API

**User Story:** Como desenvolvedor, quero que o sistema trate adequadamente erros e limites da Google Ads API, para que o sistema permaneça estável e confiável.

#### Acceptance Criteria

1. WHEN THE Google_Ads_API returns a rate limit error, THE System SHALL implement exponential backoff with a maximum wait of 60 seconds
2. WHEN THE Google_Ads_API returns an authentication error, THE System SHALL attempt token refresh before failing
3. THE System SHALL log all API errors with sufficient context for debugging
4. THE System SHALL display user-friendly error messages without exposing technical details
5. WHEN THE System encounters persistent API errors, THE System SHALL notify administrators via the notification system

### Requirement 11: Compatibilidade com Sistema Existente

**User Story:** Como usuário existente, quero que a integração do Google Ads não afete minhas funcionalidades atuais da Meta, para que eu possa continuar trabalhando sem interrupções.

#### Acceptance Criteria

1. THE System SHALL preserve all existing Meta_Ads_Platform routes and functionality
2. THE System SHALL maintain backward compatibility with existing database schemas
3. THE System SHALL not modify existing RLS policies for Meta_Ads_Platform tables
4. THE System SHALL keep the existing "Campanhas" menu and all Meta-specific features unchanged
5. THE System SHALL ensure that Clients with only Meta connections continue to function identically

### Requirement 12: Exportação de Dados Multi-Plataforma

**User Story:** Como gestor, quero exportar relatórios consolidados incluindo dados de Meta e Google Ads, para que eu possa compartilhar análises com stakeholders.

#### Acceptance Criteria

1. THE System SHALL provide export functionality for Google_Ads_Data in CSV and JSON formats
2. THE System SHALL allow exporting consolidated reports including both Meta_Ads_Platform and Google_Ads_Platform data
3. THE System SHALL include all relevant metrics and dimensions in exported files
4. THE System SHALL respect data retention limits based on the Client subscription plan during export
5. THE System SHALL generate exports asynchronously for large datasets with email notification upon completion
