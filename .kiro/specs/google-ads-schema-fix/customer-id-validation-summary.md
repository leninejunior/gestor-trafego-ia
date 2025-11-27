# Customer ID Validation - Implementation Summary

## Overview

Implemented comprehensive customer ID validation for Google Ads integration to ensure all customer IDs conform to the Google Ads API requirements.

## Requirements Addressed

- **Requirement 3.2**: Verify customer ID format

## Implementation Details

### 1. Customer ID Validator Module

**File**: `src/lib/google/customer-id-validator.ts`

**Features**:
- Validates customer ID format (must be exactly 10 digits)
- Removes dashes and special characters automatically
- Provides detailed error messages
- Supports batch validation
- Includes logging utilities

**Format Requirements**:
- Must be exactly 10 digits
- No letters or special characters (except dashes/spaces which are removed)
- Cannot be all zeros
- Examples of valid formats:
  - `1234567890` (preferred)
  - `123-456-7890` (formatted, will be converted to digits only)
  - `123 456 7890` (with spaces, will be converted to digits only)

### 2. Integration Points

#### GoogleAdsClient (`src/lib/google/client.ts`)
- Validates customer ID in constructor
- Throws error if customer ID is invalid
- Automatically formats customer ID (removes dashes)
- Logs validation results

#### GoogleSyncService (`src/lib/google/sync-service.ts`)
- Validates customer ID before starting sync
- Logs validation details with context
- Uses formatted customer ID for API calls
- Provides clear error messages on validation failure

#### Sync API Route (`src/app/api/google/sync/route.ts`)
- Validates all connection customer IDs before sync
- Returns detailed error response for invalid customer IDs
- Logs validation errors with request context
- Prevents sync from starting with invalid customer IDs

### 3. Test Coverage

**File**: `src/__tests__/google/customer-id-validator.test.ts`

**Test Results**: ✅ 27 tests passed

**Test Categories**:
- Valid customer ID formats (with/without dashes, spaces)
- Invalid customer IDs (empty, null, undefined, wrong length)
- Edge cases (all zeros, special characters, leading zeros)
- Batch validation
- Error handling

## Validation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Customer ID Input                                    │
│    - From database (google_ads_connections)            │
│    - From API request                                   │
│    - From OAuth flow                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Validation                                           │
│    - Check if provided (not null/empty)                │
│    - Remove non-digit characters                        │
│    - Check length (must be 10 digits)                  │
│    - Check for all zeros                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Result                                               │
│    ✅ Valid: Use formatted ID (digits only)            │
│    ❌ Invalid: Throw error with details                │
└─────────────────────────────────────────────────────────┘
```

## Error Messages

### Invalid Format
```
Invalid customer ID format: Customer ID must be exactly 10 digits (found 9). 
Example: "1234567890" or "123-456-7890"
```

### All Zeros
```
Invalid customer ID format: Customer ID cannot be all zeros
```

### Empty/Null
```
Invalid customer ID format: Customer ID is required
```

## Logging

All validation attempts are logged with context:

```typescript
{
  original: "123-456-7890",
  formatted: "1234567890",
  isValid: true,
  errors: [],
  context: {
    source: "GoogleAdsClient constructor",
    connectionId: "uuid-here",
    clientId: "uuid-here"
  },
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

## API Response Example

When invalid customer IDs are detected in the sync API:

```json
{
  "error": "Formato inválido de Customer ID",
  "message": "Uma ou mais conexões possuem Customer IDs em formato inválido",
  "details": [
    {
      "connectionId": "uuid-here",
      "customerId": "123",
      "errors": [
        "Customer ID must be exactly 10 digits (found 3). Example: \"1234567890\" or \"123-456-7890\""
      ]
    }
  ],
  "help": "Customer ID deve ter exatamente 10 dígitos (ex: \"1234567890\" ou \"123-456-7890\")"
}
```

## Benefits

1. **Early Error Detection**: Catches invalid customer IDs before making API calls
2. **Clear Error Messages**: Provides specific guidance on what's wrong and how to fix it
3. **Automatic Formatting**: Removes dashes and spaces automatically
4. **Comprehensive Logging**: All validation attempts are logged for debugging
5. **Type Safety**: TypeScript interfaces ensure correct usage
6. **Test Coverage**: 27 tests ensure reliability

## Usage Examples

### Validate Single Customer ID
```typescript
import { validateCustomerId } from '@/lib/google/customer-id-validator';

const result = validateCustomerId('123-456-7890');
if (result.isValid) {
  console.log('Formatted:', result.formatted); // "1234567890"
} else {
  console.error('Errors:', result.errors);
}
```

### Format Customer ID (throws on invalid)
```typescript
import { formatCustomerId } from '@/lib/google/customer-id-validator';

try {
  const formatted = formatCustomerId('123-456-7890');
  console.log(formatted); // "1234567890"
} catch (error) {
  console.error('Invalid customer ID:', error.message);
}
```

### Check if Valid
```typescript
import { isValidCustomerId } from '@/lib/google/customer-id-validator';

if (isValidCustomerId('1234567890')) {
  // Proceed with API call
}
```

## Next Steps

1. ✅ Customer ID validation implemented
2. ✅ Integration with GoogleAdsClient
3. ✅ Integration with GoogleSyncService
4. ✅ Integration with API routes
5. ✅ Comprehensive test coverage
6. ⏭️ Monitor logs for validation errors in production
7. ⏭️ Consider adding database constraint to enforce format

## Related Files

- `src/lib/google/customer-id-validator.ts` - Main validator
- `src/lib/google/client.ts` - GoogleAdsClient integration
- `src/lib/google/sync-service.ts` - Sync service integration
- `src/app/api/google/sync/route.ts` - API route integration
- `src/__tests__/google/customer-id-validator.test.ts` - Tests
- `.kiro/specs/google-ads-schema-fix/tasks.md` - Task list
- `.kiro/specs/google-ads-schema-fix/requirements.md` - Requirements
- `.kiro/specs/google-ads-schema-fix/design.md` - Design document
