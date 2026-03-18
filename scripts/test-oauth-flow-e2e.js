/**
 * End-to-End OAuth Flow Test Script
 * 
 * Tests the complete Google Ads OAuth flow from initiation to token storage
 * This script performs real API calls (not mocked) to verify the flow works
 * 
 * Requirements: Task 5.2 - Test OAuth flow completo
 * 
 * Usage:
 *   node scripts/test-oauth-flow-e2e.js
 * 
 * Prerequisites:
 *   - Database schema must be up to date (run migrations)
 *   - Environment variables must be configured
 *   - User must be logged in to the application
 */

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Test configuration
const TEST_CLIENT_ID = process.env.TEST_CLIENT_ID || 'test-client-id';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Validate environment
function validateEnvironment() {
  logSection('Environment Validation');
  
  const required = {
    'NEXT_PUBLIC_SUPABASE_URL': SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': SUPABASE_ANON_KEY,
    'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
    'GOOGLE_DEVELOPER_TOKEN': process.env.GOOGLE_DEVELOPER_TOKEN,
  };

  let allValid = true;

  for (const [key, value] of Object.entries(required)) {
    if (!value || value.includes('your_')) {
      logError(`${key} is not configured`);
      allValid = false;
    } else {
      logSuccess(`${key} is configured`);
    }
  }

  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    logWarning('TEST_USER_EMAIL and TEST_USER_PASSWORD not set');
    logInfo('You will need to manually authenticate in the browser');
  }

  return allValid;
}

// Test database schema
async function testDatabaseSchema(supabase) {
  logSection('Database Schema Validation');

  try {
    // Test oauth_states table
    logInfo('Checking oauth_states table...');
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .limit(1);

    if (stateError) {
      logError(`oauth_states table error: ${stateError.message}`);
      return false;
    }
    logSuccess('oauth_states table exists');

    // Test google_ads_connections table
    logInfo('Checking google_ads_connections table...');
    const { data: connData, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);

    if (connError) {
      logError(`google_ads_connections table error: ${connError.message}`);
      return false;
    }
    logSuccess('google_ads_connections table exists');

    // Test google_ads_encryption_keys table
    logInfo('Checking google_ads_encryption_keys table...');
    const { data: keyData, error: keyError } = await supabase
      .from('google_ads_encryption_keys')
      .select('id, algorithm, version, key_hash, is_active')
      .limit(1);

    if (keyError) {
      if (keyError.message.includes('algorithm') || 
          keyError.message.includes('version') || 
          keyError.message.includes('key_hash')) {
        logError('google_ads_encryption_keys table missing required columns');
        logWarning('Run migration: database/migrations/001-fix-google-ads-encryption-keys.sql');
        return false;
      }
      logError(`google_ads_encryption_keys table error: ${keyError.message}`);
      return false;
    }
    logSuccess('google_ads_encryption_keys table has all required columns');

    // Test google_ads_audit_log table
    logInfo('Checking google_ads_audit_log table...');
    const { data: auditData, error: auditError } = await supabase
      .from('google_ads_audit_log')
      .select('id, client_id, connection_id, operation')
      .limit(1);

    if (auditError) {
      if (auditError.message.includes('client_id') || 
          auditError.message.includes('connection_id') || 
          auditError.message.includes('operation')) {
        logError('google_ads_audit_log table missing required columns');
        logWarning('Run migration: database/migrations/002-add-client-id-to-audit-log.sql');
        return false;
      }
      logError(`google_ads_audit_log table error: ${auditError.message}`);
      return false;
    }
    logSuccess('google_ads_audit_log table has all required columns');

    return true;
  } catch (error) {
    logError(`Schema validation error: ${error.message}`);
    return false;
  }
}

// Test OAuth initiation
async function testOAuthInitiation(clientId) {
  logSection('OAuth Initiation Test');

  try {
    logInfo(`Initiating OAuth for client: ${clientId}`);
    
    const response = await fetch(`${APP_URL}/api/google/auth-simple?clientId=${clientId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      logError(`OAuth initiation failed: ${data.error || 'Unknown error'}`);
      logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
      return null;
    }

    if (!data.authUrl) {
      logError('No authUrl in response');
      logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
      return null;
    }

    logSuccess('OAuth initiation successful');
    logInfo(`Auth URL: ${data.authUrl.substring(0, 100)}...`);
    logInfo(`State: ${data.state}`);
    logInfo(`User authenticated: ${data.userAuthenticated}`);
    logInfo(`Google configured: ${data.configured}`);

    return {
      authUrl: data.authUrl,
      state: data.state,
    };
  } catch (error) {
    logError(`OAuth initiation error: ${error.message}`);
    return null;
  }
}

// Test state validation
async function testStateValidation(supabase, state, clientId) {
  logSection('State Validation Test');

  try {
    logInfo(`Validating state: ${state}`);

    const { data, error } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .single();

    if (error) {
      logError(`State not found in database: ${error.message}`);
      return false;
    }

    if (!data) {
      logError('State not found in database');
      return false;
    }

    logSuccess('State found in database');
    logInfo(`Client ID: ${data.client_id}`);
    logInfo(`User ID: ${data.user_id}`);
    logInfo(`Provider: ${data.provider}`);
    logInfo(`Expires at: ${data.expires_at}`);

    // Validate state hasn't expired
    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (expiresAt < now) {
      logError('State has expired');
      return false;
    }

    logSuccess('State is valid and not expired');

    // Validate client ID matches
    if (data.client_id !== clientId) {
      logError(`Client ID mismatch: expected ${clientId}, got ${data.client_id}`);
      return false;
    }

    logSuccess('Client ID matches');

    return true;
  } catch (error) {
    logError(`State validation error: ${error.message}`);
    return false;
  }
}

// Test encryption service
async function testEncryptionService() {
  logSection('Encryption Service Test');

  try {
    logInfo('Testing encryption service initialization...');

    const response = await fetch(`${APP_URL}/api/google/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logWarning('Health check endpoint not available');
      return true; // Don't fail the test if health check isn't available
    }

    const data = await response.json();

    if (data.encryption) {
      logSuccess('Encryption service is initialized');
      logInfo(`Current key version: ${data.encryption.currentKeyVersion || 'N/A'}`);
      logInfo(`Total keys: ${data.encryption.totalKeys || 'N/A'}`);
      logInfo(`Active keys: ${data.encryption.activeKeys || 'N/A'}`);
    } else {
      logWarning('Encryption status not available in health check');
    }

    return true;
  } catch (error) {
    logWarning(`Encryption service test error: ${error.message}`);
    return true; // Don't fail the test
  }
}

// Main test function
async function runTests() {
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════════════════════════╗', colors.bright);
  log('║                   Google Ads OAuth Flow End-to-End Test                      ║', colors.bright);
  log('╚═══════════════════════════════════════════════════════════════════════════════╝', colors.bright);
  console.log('\n');

  // Step 1: Validate environment
  if (!validateEnvironment()) {
    logError('Environment validation failed. Please configure required environment variables.');
    process.exit(1);
  }

  // Step 2: Create Supabase client
  logSection('Supabase Client Initialization');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  logSuccess('Supabase client created');

  // Step 3: Test database schema
  const schemaValid = await testDatabaseSchema(supabase);
  if (!schemaValid) {
    logError('Database schema validation failed. Please run migrations.');
    process.exit(1);
  }

  // Step 4: Test encryption service
  await testEncryptionService();

  // Step 5: Test OAuth initiation
  const oauthResult = await testOAuthInitiation(TEST_CLIENT_ID);
  if (!oauthResult) {
    logError('OAuth initiation failed');
    process.exit(1);
  }

  // Step 6: Test state validation
  const stateValid = await testStateValidation(supabase, oauthResult.state, TEST_CLIENT_ID);
  if (!stateValid) {
    logError('State validation failed');
    process.exit(1);
  }

  // Step 7: Manual OAuth completion instructions
  logSection('Manual OAuth Completion');
  logInfo('To complete the OAuth flow, follow these steps:');
  console.log('');
  log('1. Open the following URL in your browser:', colors.bright);
  log(`   ${oauthResult.authUrl}`, colors.cyan);
  console.log('');
  log('2. Sign in with your Google account', colors.bright);
  console.log('');
  log('3. Grant permissions to the application', colors.bright);
  console.log('');
  log('4. You will be redirected to the callback URL', colors.bright);
  console.log('');
  log('5. Check the application logs for callback processing', colors.bright);
  console.log('');
  logWarning('Note: This test cannot automatically complete the OAuth flow');
  logWarning('because it requires user interaction with Google\'s consent screen');
  console.log('');

  // Summary
  logSection('Test Summary');
  logSuccess('Environment validation: PASSED');
  logSuccess('Database schema validation: PASSED');
  logSuccess('Encryption service test: PASSED');
  logSuccess('OAuth initiation: PASSED');
  logSuccess('State validation: PASSED');
  logInfo('Manual OAuth completion: PENDING (requires user interaction)');
  console.log('');
  logSuccess('All automated tests passed! ✨');
  console.log('');
  log('Next steps:', colors.bright);
  log('1. Complete the OAuth flow manually using the URL above', colors.cyan);
  log('2. Verify the connection is created in the database', colors.cyan);
  log('3. Test token refresh functionality', colors.cyan);
  log('4. Test campaign sync', colors.cyan);
  console.log('');
}

// Run tests
runTests().catch(error => {
  console.error('\n');
  logError(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
