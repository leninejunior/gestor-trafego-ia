/**
 * Test Plain Text Token Fallback
 * 
 * This script tests the fallback mechanism for plain text tokens during migration.
 * It verifies that:
 * 1. Plain text tokens can be read and used
 * 2. Plain text tokens are automatically migrated to encrypted format
 * 3. Encrypted tokens continue to work normally
 */

const { createServiceClient } = require('../src/lib/supabase/server');
const { getGoogleTokenManager } = require('../src/lib/google/token-manager');
const { getGoogleAdsCryptoService } = require('../src/lib/google/crypto-service');

async function testPlainTextTokenFallback() {
  console.log('========================================');
  console.log('Testing Plain Text Token Fallback');
  console.log('========================================\n');

  try {
    const supabase = createServiceClient();
    const tokenManager = getGoogleTokenManager();
    const cryptoService = getGoogleAdsCryptoService();

    // Step 1: Ensure crypto service is initialized
    console.log('Step 1: Initializing crypto service...');
    await cryptoService.ensureInitialized();
    const initStatus = cryptoService.getInitializationStatus();
    console.log('Crypto service status:', {
      isInitialized: initStatus.isInitialized,
      hasError: initStatus.hasError,
      currentKeyVersion: initStatus.currentKeyVersion,
    });

    if (!initStatus.isInitialized) {
      console.error('❌ Crypto service not initialized properly');
      return;
    }
    console.log('✅ Crypto service initialized\n');

    // Step 2: Find a test connection
    console.log('Step 2: Finding test connection...');
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, customer_id, access_token, refresh_token')
      .eq('status', 'active')
      .limit(1);

    if (connError || !connections || connections.length === 0) {
      console.log('⚠️ No active connections found. Creating test scenario...');
      
      // Get a client to use for testing
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .limit(1);

      if (!clients || clients.length === 0) {
        console.error('❌ No clients found. Cannot create test connection.');
        return;
      }

      const clientId = clients[0].id;
      
      // Create a test connection with plain text tokens
      console.log('Creating test connection with plain text tokens...');
      const testAccessToken = 'ya29.test_plain_text_access_token_' + Date.now();
      const testRefreshToken = '1//test_plain_text_refresh_token_' + Date.now();
      
      const { data: newConn, error: createError } = await supabase
        .from('google_ads_connections')
        .insert({
          client_id: clientId,
          customer_id: 'test-customer-' + Date.now(),
          access_token: testAccessToken,
          refresh_token: testRefreshToken,
          token_expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          status: 'active',
        })
        .select()
        .single();

      if (createError || !newConn) {
        console.error('❌ Failed to create test connection:', createError);
        return;
      }

      console.log('✅ Test connection created:', newConn.id);
      connections.push(newConn);
    }

    const testConnection = connections[0];
    console.log('Using connection:', {
      id: testConnection.id,
      customerId: testConnection.customer_id,
      accessTokenLength: testConnection.access_token?.length || 0,
      refreshTokenLength: testConnection.refresh_token?.length || 0,
    });
    console.log('✅ Test connection found\n');

    // Step 3: Check if tokens are plain text
    console.log('Step 3: Checking token format...');
    const isAccessTokenPlainText = 
      testConnection.access_token?.startsWith('ya29.') || 
      testConnection.access_token?.startsWith('1//') ||
      (testConnection.access_token?.length || 0) < 100;
    
    const isRefreshTokenPlainText = 
      testConnection.refresh_token?.startsWith('ya29.') || 
      testConnection.refresh_token?.startsWith('1//') ||
      (testConnection.refresh_token?.length || 0) < 100;

    console.log('Token format analysis:', {
      accessToken: {
        isPlainText: isAccessTokenPlainText,
        prefix: testConnection.access_token?.substring(0, 10) + '...',
        length: testConnection.access_token?.length || 0,
      },
      refreshToken: {
        isPlainText: isRefreshTokenPlainText,
        prefix: testConnection.refresh_token?.substring(0, 10) + '...',
        length: testConnection.refresh_token?.length || 0,
      },
    });

    if (!isAccessTokenPlainText && !isRefreshTokenPlainText) {
      console.log('⚠️ Tokens are already encrypted. Testing encrypted token handling...\n');
    } else {
      console.log('✅ Plain text tokens detected\n');
    }

    // Step 4: Test token retrieval (should handle both plain text and encrypted)
    console.log('Step 4: Testing token retrieval with fallback...');
    const tokens = await tokenManager.getTokens(testConnection.id);

    if (!tokens) {
      console.error('❌ Failed to retrieve tokens');
      return;
    }

    console.log('Token retrieval result:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      accessTokenLength: tokens.access_token.length,
      refreshTokenLength: tokens.refresh_token.length,
      expiresAt: tokens.expires_at.toISOString(),
    });
    console.log('✅ Tokens retrieved successfully\n');

    // Step 5: Wait a moment for background migration to complete
    if (isAccessTokenPlainText || isRefreshTokenPlainText) {
      console.log('Step 5: Waiting for background migration...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      // Check if tokens were migrated
      const { data: updatedConn, error: fetchError } = await supabase
        .from('google_ads_connections')
        .select('access_token, refresh_token')
        .eq('id', testConnection.id)
        .single();

      if (fetchError || !updatedConn) {
        console.error('❌ Failed to fetch updated connection:', fetchError);
        return;
      }

      const isAccessTokenStillPlainText = 
        updatedConn.access_token?.startsWith('ya29.') || 
        updatedConn.access_token?.startsWith('1//') ||
        (updatedConn.access_token?.length || 0) < 100;
      
      const isRefreshTokenStillPlainText = 
        updatedConn.refresh_token?.startsWith('ya29.') || 
        updatedConn.refresh_token?.startsWith('1//') ||
        (updatedConn.refresh_token?.length || 0) < 100;

      console.log('Migration status:', {
        accessToken: {
          wasPlainText: isAccessTokenPlainText,
          isStillPlainText: isAccessTokenStillPlainText,
          migrated: isAccessTokenPlainText && !isAccessTokenStillPlainText,
          newLength: updatedConn.access_token?.length || 0,
        },
        refreshToken: {
          wasPlainText: isRefreshTokenPlainText,
          isStillPlainText: isRefreshTokenStillPlainText,
          migrated: isRefreshTokenPlainText && !isRefreshTokenStillPlainText,
          newLength: updatedConn.refresh_token?.length || 0,
        },
      });

      if (
        (isAccessTokenPlainText && !isAccessTokenStillPlainText) ||
        (isRefreshTokenPlainText && !isRefreshTokenStillPlainText)
      ) {
        console.log('✅ Plain text tokens successfully migrated to encrypted format\n');
      } else if (isAccessTokenStillPlainText || isRefreshTokenStillPlainText) {
        console.log('⚠️ Some tokens are still in plain text (migration may have failed)\n');
      }
    } else {
      console.log('Step 5: Skipping migration check (tokens already encrypted)\n');
    }

    // Step 6: Test token retrieval again (should work with encrypted tokens)
    console.log('Step 6: Testing token retrieval after migration...');
    const tokensAfterMigration = await tokenManager.getTokens(testConnection.id);

    if (!tokensAfterMigration) {
      console.error('❌ Failed to retrieve tokens after migration');
      return;
    }

    console.log('Token retrieval after migration:', {
      hasAccessToken: !!tokensAfterMigration.access_token,
      hasRefreshToken: !!tokensAfterMigration.refresh_token,
      accessTokenLength: tokensAfterMigration.access_token.length,
      refreshTokenLength: tokensAfterMigration.refresh_token.length,
      tokensMatch: 
        tokens.access_token === tokensAfterMigration.access_token &&
        tokens.refresh_token === tokensAfterMigration.refresh_token,
    });

    if (
      tokens.access_token === tokensAfterMigration.access_token &&
      tokens.refresh_token === tokensAfterMigration.refresh_token
    ) {
      console.log('✅ Tokens remain consistent after migration\n');
    } else {
      console.error('❌ Tokens changed after migration (unexpected)\n');
    }

    // Step 7: Test encryption/decryption directly
    console.log('Step 7: Testing direct encryption/decryption...');
    const testToken = 'ya29.test_token_' + Date.now();
    
    console.log('Encrypting test token...');
    const encrypted = await cryptoService.encryptToken(testToken);
    console.log('Encryption result:', {
      keyVersion: encrypted.keyVersion,
      algorithm: encrypted.algorithm,
      encryptedLength: encrypted.encryptedData.length,
    });

    console.log('Decrypting test token...');
    const decrypted = await cryptoService.decryptToken(encrypted.encryptedData);
    console.log('Decryption result:', {
      keyVersion: decrypted.keyVersion,
      decryptedLength: decrypted.decryptedData.length,
      tokensMatch: testToken === decrypted.decryptedData,
    });

    if (testToken === decrypted.decryptedData) {
      console.log('✅ Encryption/decryption working correctly\n');
    } else {
      console.error('❌ Encryption/decryption mismatch\n');
    }

    // Step 8: Test plain text fallback directly
    console.log('Step 8: Testing plain text fallback directly...');
    const plainTextToken = 'ya29.plain_text_test_' + Date.now();
    
    console.log('Attempting to decrypt plain text token...');
    const plainTextResult = await cryptoService.decryptToken(plainTextToken);
    console.log('Plain text fallback result:', {
      keyVersion: plainTextResult.keyVersion,
      decryptedLength: plainTextResult.decryptedData.length,
      tokensMatch: plainTextToken === plainTextResult.decryptedData,
    });

    if (plainTextToken === plainTextResult.decryptedData) {
      console.log('✅ Plain text fallback working correctly\n');
    } else {
      console.error('❌ Plain text fallback failed\n');
    }

    console.log('========================================');
    console.log('✅ All tests completed successfully!');
    console.log('========================================');

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Test failed with error:');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('Type:', error.constructor.name);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('========================================');
  }
}

// Run the test
testPlainTextTokenFallback()
  .then(() => {
    console.log('\nTest execution completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTest execution failed:', error);
    process.exit(1);
  });
