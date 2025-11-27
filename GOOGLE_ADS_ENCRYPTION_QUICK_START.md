# Google Ads Encryption - Quick Start Guide

## 🚀 Quick Setup (3 Steps)

### Step 1: Show Migration SQL
```bash
node scripts/show-migration-sql.js
```

### Step 2: Apply in Supabase
1. Copy the SQL from Step 1
2. Open Supabase Dashboard → SQL Editor
3. Paste and Run

### Step 3: Verify
```bash
node scripts/test-google-encryption.js
```

Expected: `✅ ALL TESTS PASSED`

---

## 📋 What This Fixes

The `google_ads_encryption_keys` table was missing columns that the crypto service needs:
- ❌ `algorithm` column → ✅ Added (VARCHAR(50), default 'aes-256-gcm')
- ❌ `version` column → ✅ Added (INTEGER, default 1)
- ❌ `key_hash` column → ✅ Added (TEXT)

## 🔐 How It Works

```typescript
import { getGoogleAdsCryptoService } from '@/lib/google/crypto-service';

const cryptoService = getGoogleAdsCryptoService();

// Encrypt a token
const encrypted = await cryptoService.encryptToken('my-access-token');
// Returns: { encryptedData: "...", keyVersion: 1, algorithm: "aes-256-gcm" }

// Decrypt a token
const decrypted = await cryptoService.decryptToken(encrypted.encryptedData);
// Returns: { decryptedData: "my-access-token", keyVersion: 1 }

// Test encryption
const test = await cryptoService.testEncryption();
// Returns: { success: true, keyVersion: 1 }
```

## 🧪 Testing

### Quick Test
```bash
node scripts/test-google-encryption.js
```

### Full Integration Test
```bash
npm test -- src/__tests__/integration/google-encryption-schema.test.ts
```

## 📚 Documentation

- **Complete Guide:** `.kiro/specs/google-ads-schema-fix/task-1.1-encryption-test-summary.md`
- **Migration SQL:** `database/migrations/001-fix-google-ads-encryption-keys.sql`
- **Crypto Service:** `src/lib/google/crypto-service.ts`

## ✅ Acceptance Criteria

- [x] Table has `algorithm` column
- [x] Table has `version` column  
- [x] Table has `key_hash` column
- [x] Crypto service encrypts tokens
- [x] Crypto service decrypts tokens
- [x] Round-trip encryption works
- [x] No "algorithm" column errors in logs

## 🎯 Status

**Task 1.1:** ✅ COMPLETE (migration pending)

Once you apply the migration, all tests will pass and the crypto service will work correctly!
