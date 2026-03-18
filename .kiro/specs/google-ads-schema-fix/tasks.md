
# Tasks - Google Ads Schema Fix

## Phase 1: Database Schema Fixes

### Task 1.1: Fix google_ads_encryption_keys table
- [x] Add `algorithm` column (VARCHAR(50), default 'aes-256-gcm')







- [x] Add `key_version` column if missing

- [x] Verify existing data integrity

- [x] Test encryption/decryption with new schema








**Files to modify:**
- `database/google-ads-schema.sql`
- `src/lib/google/crypto-service.ts`

**Acceptance Criteria:**
- Tabela possui coluna `algorithm`
- Crypto service funciona sem erros
- Logs não mostram erro "Could not find the 'algorithm' column"

---

### Task 1.2: Fix google_ads_audit_log table
- [x] Add `client_id` column (UUID, NOT NULL)


-

- [x] Add foreign key constraint to `clients` table





- [x] Migrate existing audit logs (if any)



- [x] Update RLS policies for client isolation

**Files to modify:**
- `database/google-ads-schema.sql`
- `src/lib/google/audit-service.ts`

**Acceptance Criteria:**
- Tabela possui coluna `client_id`
- Audit service salva logs corretamente
- Logs não mostram erro "Could not find the 'client_id' column"

---

### Task 1.3: Fix memberships table references
- [x] Identify all queries using `org_id` instead of `organization_id`
- [x] Update queries to use correct column name



- [x] Test authentication flow
















-




- [x] Verify super admin detection








**Files to modify:**
- `src/app/api/google/auth-simple/route.ts`
- `src/app/api/google/sync/status/route.ts`
- Any other files with membership queries

**Acceptance Criteria:**
- Queries usam `organization_id` corretamente
- Logs não mostram erro "column memberships.org_id does not exist"
- Autenticação funciona sem erros

---

## Phase 2: Token Management & Validation

### Task 2.1: Enhance token validation
-

- [x] Add detailed token expiration logging





- [x] Implement token health check endpoint





- [x] Add retry logic for token refresh failures





- [x] Log token refresh attempts and results

**Files to modify:**
- `src/lib/google/token-manager.ts`
- `src/app/api/google/health/route.ts` (new)

**Acceptance Criteria:**
- Tokens expirados são detectados e renovados
- Logs mostram claramente o status dos tokens
- Health check retorna status correto

---


### Task 2.2: Fix OAuth token encryption



- [x] Ensure crypto service initializes correctly







- [x] Handle key rotation errors gracefully






- [x] Add fallback for plain text tokens during migration


- [x] Log encryption/decryption operations






**Files to modify:**
- `src/lib/google/crypto-service.ts`
- `src/lib/google/token-manager.ts`

**Acceptance Criteria:**
- Crypto service inicializa sem erros
- Tokens são criptografados corretamente
- Migração de tokens em plain text funciona

---

## Phase 3: Sync Debugging & Logging

### Task 3.1: Add detailed sync logging
- [x] Log API request parameters





-

- [x] Log API response structure



- [x] Log campaign count before/after processing






- [x] Add error context to all catch blocks




**Files to modify:**
- `src/app/api/google/sync/route.ts`
- `src/lib/google/sync-service.ts`

**Acceptance Criteria:**
- Logs mostram exatamente o que a API do Google retorna
- Possível identificar por que retorna 0 campanhas
- Erros incluem contexto completo

---

### Task 3.2: Validate Google Ads API queries
- [x] Log GAQL queries being executed





- [x] Verify customer ID format




- [x] Check campaign status filters




-

- [x] Test with different date ranges



**Files to modify:**
- `src/lib/google/sync-service.ts`
- `src/lib/google/api-client.ts`

**Acceptance Criteria:**
- Queries GAQL são logadas
- Customer ID está correto
- Filtros de status estão adequados

---

## Phase 4: Health Checks & Monitoring

### Task 4.1: Create health check endpoint
- [x] Check database connectivity
- [x] Verify encryption keys exist
- [x] Test token validity
- [x] Check API quota status

**Files to create:**
- `src/app/api/google/health/route.ts`


**Acceptance Criteria:**
- Endpoint retorna status de todos os componentes
- Identifica problemas antes da sincronização
- Fornece ações recomendadas

---

### Task 4.2: Add connection diagnostics
- [x] Verify OAuth scopes








- [x] Check customer ID access


- [x] Test API permissions

- [x] Validate refresh token


**Files to modify:**
- `src/app/api/google/sync/status/route.ts`

**Acceptance Criteria:**
- Diagnostics identificam problemas de permissão
- Logs mostram scopes disponíveis
- Erros de acesso são claros

---

## Phase 5: Testing & Validation

### Task 5.1: Create migration script
- [x] Script SQL para aplicar todas as alterações

- [x] Backup de dados existentes
- [x] Rollback plan
- [x] Validation queries

**Files to create:**
- `database/migrations/fix-google-ads-schema.sql`
- `database/migrations/rollback-google-ads-schema.sql`
- `database/migrations/verify-google-ads-schema.sql`
- `database/migrations/README.md`

**Acceptance Criteria:**
- Script executa sem erros
- Dados existentes preservados
- Rollback testado

---

### Task 5.2: End-to-end testing
- [x] Test OAuth flow completo









- [x] Test token refresh


- [x] Test campaign sync




- [x] Verify metrics collection




**Acceptance Criteria:**
- OAuth conecta sem erros
- Tokens renovam automaticamente
- Campanhas sincronizam corretamente
- Métricas são coletadas

---

## Phase 6: Documentation

### Task 6.1: Update documentation
- [x] Document schema changes

- [x] Update API documentation



- [x] Add troubleshooting guide

- [x] Update CHANGELOG.md




**Files to modify:**
- `GOOGLE_ADS_INDEX.md`
- `CHANGELOG.md`
- `docs/GOOGLE_ADS_TROUBLESHOOTING.md` (new)

**Acceptance Criteria:**
- Documentação reflete mudanças
- Troubleshooting guide completo
- CHANGELOG atualizado

---

## Summary

**Total Tasks:** 12
**Estimated Time:** 8-12 hours
**Priority:** HIGH (blocking Google Ads sync)

**Critical Path:**
1. Phase 1 (Schema Fixes) - MUST be done first
2. Phase 2 (Token Management) - Required for sync
3. Phase 3 (Sync Debugging) - Identifies root cause
4. Phase 4 (Health Checks) - Prevents future issues
5. Phase 5 (Testing) - Validates fixes
6. Phase 6 (Documentation) - Knowledge transfer
