# Design Document - Google Ads Schema Fix

## Overview

Este documento detalha a solução para corrigir os erros de schema do banco de dados que estão impedindo a sincronização do Google Ads. Os problemas identificados nos logs incluem:

1. Tabela `google_ads_encryption_keys` sem coluna `algorithm`
2. Tabela `google_ads_audit_log` sem coluna `client_id`
3. Queries usando `org_id` em vez de `organization_id` na tabela `memberships`
4. Sincronização retornando 0 campanhas mesmo com conexão ativa

A solução envolve migrations seguras do banco de dados, correções de código, validação de tokens e melhorias no logging para facilitar debugging futuro.

## Architecture

### Current State vs Desired State

```
CURRENT STATE (Broken):
┌─────────────────────────────────────────────────┐
│ google_ads_encryption_keys                      │
│ - id                                            │
│ - key_data                                      │
│ - is_active                                     │
│ - created_at                                    │
│ - expires_at                                    │
│ ❌ MISSING: algorithm                           │
│ ❌ MISSING: version                             │
│ ❌ MISSING: key_hash                            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ google_ads_audit_log                            │
│ - id                                            │
│ - user_id                                       │
│ - action                                        │
│ - details                                       │
│ - ip_address                                    │
│ - user_agent                                    │
│ - created_at                                    │
│ ❌ MISSING: client_id                           │
│ ❌ MISSING: connection_id                       │
│ ❌ MISSING: operation                           │
│ ❌ MISSING: metadata                            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Code Issues:                                    │
│ ❌ Queries using org_id instead of              │
│    organization_id                              │
│ ❌ Token validation not checking expiration     │
│ ❌ Insufficient logging in sync process         │
│ ❌ No error details from Google Ads API         │
└─────────────────────────────────────────────────┘

DESIRED STATE (Fixed):
┌─────────────────────────────────────────────────┐
│ google_ads_encryption_keys                      │
│ - id                                            │
│ - key_data                                      │
│ - algorithm (NEW)                               │
│ - version (NEW)                                 │
│ - key_hash (NEW)                                │
│ - is_active                                     │
│ - created_at                                    │
│ - expires_at                                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ google_ads_audit_log                            │
│ - id                                            │
│ - client_id (NEW)                               │
│ - connection_id (NEW)                           │
│ - user_id                                       │
│ - operation (NEW)                               │
│ - action                                        │
│ - metadata (NEW)                                │
│ - details                                       │
│ - ip_address                                    │
│ - user_agent                                    │
│ - created_at                                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Code Fixes:                                     │
│ ✅ All queries use organization_id              │
│ ✅ Token validation before API calls            │
│ ✅ Detailed logging with context                │
│ ✅ Google Ads API errors captured               │
└─────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Database Migration Service

**Location**: `database/migrations/fix-google-ads-schema.sql`

```sql
-- Migration to fix Google Ads schema issues
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Fix 1: Add missing columns to google_ads_encryption_keys
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS algorithm TEXT DEFAULT 'aes-256-gcm';

ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS key_hash TEXT;

-- Fix 2: Add missing columns to google_ads_audit_log
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES google_ads_connections(id) ON DELETE CASCADE;

ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS operation TEXT;

ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Fix 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_audit_client 
ON google_ads_audit_log(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_audit_connection 
ON google_ads_audit_log(connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_encryption_version 
ON google_ads_encryption_keys(version DESC);
```

### 2. Code Fix Service

**Location**: `src/lib/google/schema-validator.ts`

```typescript
interface SchemaValidationResult {
  isValid: boolean;
  missingColumns: string[];
  errors: string[];
}

interface TableSchema {
  tableName: string;
  requiredColumns: string[];
}

class GoogleAdsSchemaValidator {
  private readonly requiredSchemas: TableSchema[] = [
    {
      tableName: 'google_ads_encryption_keys',
      requiredColumns: ['id', 'key_data', 'algorithm', 'version', 'key_hash', 'is_active', 'created_at', 'expires_at']
    },
    {
      tableName: 'google_ads_audit_log',
      requiredColumns: ['id', 'client_id', 'connection_id', 'user_id', 'operation', 'metadata', 'created_at']
    },
    {
      tableName: 'google_ads_connections',
      requiredColumns: ['id', 'client_id', 'customer_id', 'refresh_token', 'access_token', 'token_expires_at']
    }
  ];

  async validateSchema(): Promise<SchemaValidationResult>
  async checkTableExists(tableName: string): Promise<boolean>
  async getTableColumns(tableName: string): Promise<string[]>
  async validateAllTables(): Promise<Map<string, SchemaValidationResult>>
}
```

### 3. Enhanced Sync Service

**Location**: `src/lib/google/enhanced-sync-service.ts`

```typescript
interface SyncContext {
  clientId: string;
  connectionId: string;
  customerId: string;
  requestId: string;
  startTime: number;
}

interface SyncResult {
  success: boolean;
  campaignsFetched: number;
  campaignsSaved: number;
  errors: SyncError[];
  apiResponse?: any;
  duration: number;
}

interface SyncError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

class EnhancedGoogleSyncService {
  async syncWithDetailedLogging(context: SyncContext): Promise<SyncResult>
  async validateTokenBeforeSync(connectionId: string): Promise<boolean>
  async fetchCampaignsWithRetry(customerId: string, maxRetries: number): Promise<Campaign[]>
  async logSyncStep(context: SyncContext, step: string, data: any): Promise<void>
  async handleSyncError(context: SyncContext, error: Error): Promise<void>
}
```

### 4. Token Validation Service

**Location**: `src/lib/google/token-validator.ts`

```typescript
interface TokenValidationResul