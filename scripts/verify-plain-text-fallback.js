/**
 * Verify Plain Text Token Fallback Implementation
 * 
 * This script verifies that the code changes for plain text token fallback
 * have been properly implemented by checking the source files.
 */

const fs = require('fs');
const path = require('path');

function verifyImplementation() {
  console.log('========================================');
  console.log('Verifying Plain Text Token Fallback Implementation');
  console.log('========================================\n');

  let allChecksPass = true;

  // Check 1: Verify crypto-service.ts has plain text detection
  console.log('Check 1: Verifying crypto-service.ts...');
  const cryptoServicePath = path.join(__dirname, '../src/lib/google/crypto-service.ts');
  const cryptoServiceContent = fs.readFileSync(cryptoServicePath, 'utf8');

  const cryptoChecks = [
    {
      name: 'Plain text token detection in decryptToken',
      pattern: /encryptedData\.startsWith\('ya29\.'\)/,
      found: cryptoServiceContent.includes("encryptedData.startsWith('ya29.')"),
    },
    {
      name: 'Refresh token prefix check',
      pattern: /encryptedData\.startsWith\('1\/\/'\)/,
      found: cryptoServiceContent.includes("encryptedData.startsWith('1//')"),
    },
    {
      name: 'Length check for plain text',
      pattern: /encryptedData\.length < 100/,
      found: cryptoServiceContent.includes('encryptedData.length < 100'),
    },
    {
      name: 'Plain text fallback logging',
      pattern: /Token appears to be plain text/,
      found: cryptoServiceContent.includes('Token appears to be plain text'),
    },
    {
      name: 'Migration fallback in decryption',
      pattern: /migration fallback/i,
      found: /migration fallback/i.test(cryptoServiceContent),
    },
  ];

  cryptoChecks.forEach(check => {
    if (check.found) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}`);
      allChecksPass = false;
    }
  });
  console.log();

  // Check 2: Verify token-manager.ts has enhanced fallback
  console.log('Check 2: Verifying token-manager.ts...');
  const tokenManagerPath = path.join(__dirname, '../src/lib/google/token-manager.ts');
  const tokenManagerContent = fs.readFileSync(tokenManagerPath, 'utf8');

  const tokenManagerChecks = [
    {
      name: 'isPlainTextToken helper method',
      pattern: /private isPlainTextToken\(/,
      found: tokenManagerContent.includes('private isPlainTextToken('),
    },
    {
      name: 'migratePlainTextTokens method',
      pattern: /private async migratePlainTextTokens\(/,
      found: tokenManagerContent.includes('private async migratePlainTextTokens('),
    },
    {
      name: 'Plain text detection in decryptToken',
      pattern: /Token is in plain text \(migration fallback\)/,
      found: tokenManagerContent.includes('Token is in plain text (migration fallback)'),
    },
    {
      name: 'Audit logging for plain text tokens',
      pattern: /plainText: true/,
      found: tokenManagerContent.includes('plainText: true'),
    },
    {
      name: 'Migration audit logging',
      pattern: /token_migration/,
      found: tokenManagerContent.includes('token_migration'),
    },
    {
      name: 'Background migration trigger',
      pattern: /migratePlainTextTokens.*catch/,
      found: /migratePlainTextTokens.*catch/s.test(tokenManagerContent),
    },
    {
      name: 'Enhanced logging for plain text detection',
      pattern: /tokenPrefix.*tokenLength/,
      found: tokenManagerContent.includes('tokenPrefix') && tokenManagerContent.includes('tokenLength'),
    },
  ];

  tokenManagerChecks.forEach(check => {
    if (check.found) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}`);
      allChecksPass = false;
    }
  });
  console.log();

  // Check 3: Verify migration logic
  console.log('Check 3: Verifying migration logic...');
  
  const migrationChecks = [
    {
      name: 'Encryption of plain text access tokens',
      found: tokenManagerContent.includes('needsAccessTokenEncryption') &&
             tokenManagerContent.includes('Encrypting plain text access token'),
    },
    {
      name: 'Encryption of plain text refresh tokens',
      found: tokenManagerContent.includes('needsRefreshTokenEncryption') &&
             tokenManagerContent.includes('Encrypting plain text refresh token'),
    },
    {
      name: 'Database update with encrypted tokens',
      found: tokenManagerContent.includes('Updating database with encrypted tokens'),
    },
    {
      name: 'Migration success logging',
      found: tokenManagerContent.includes('Plain text tokens migrated successfully'),
    },
    {
      name: 'Migration error handling',
      found: tokenManagerContent.includes('Token migration failed') &&
             tokenManagerContent.includes('Continuing with plain text tokens despite migration failure'),
    },
  ];

  migrationChecks.forEach(check => {
    if (check.found) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}`);
      allChecksPass = false;
    }
  });
  console.log();

  // Check 4: Verify getTokens integration
  console.log('Check 4: Verifying getTokens integration...');
  
  const getTokensChecks = [
    {
      name: 'Plain text token detection in getTokens',
      found: tokenManagerContent.includes('hasPlainTextTokens') &&
             tokenManagerContent.includes('isPlainTextToken(data.access_token)'),
    },
    {
      name: 'Migration trigger on plain text detection',
      found: tokenManagerContent.includes('Plain text tokens detected, initiating migration'),
    },
    {
      name: 'Background migration execution',
      found: tokenManagerContent.includes('this.migratePlainTextTokens(connectionId, accessToken, refreshToken)'),
    },
  ];

  getTokensChecks.forEach(check => {
    if (check.found) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}`);
      allChecksPass = false;
    }
  });
  console.log();

  // Summary
  console.log('========================================');
  if (allChecksPass) {
    console.log('✅ All implementation checks passed!');
    console.log('========================================');
    console.log('\nImplementation Summary:');
    console.log('1. ✅ Plain text token detection in crypto service');
    console.log('2. ✅ Enhanced logging for plain text tokens');
    console.log('3. ✅ Automatic migration of plain text tokens');
    console.log('4. ✅ Background migration on token access');
    console.log('5. ✅ Audit logging for migration operations');
    console.log('6. ✅ Error handling for migration failures');
    console.log('\nThe fallback mechanism will:');
    console.log('- Detect plain text tokens (ya29.*, 1//*, or length < 100)');
    console.log('- Allow plain text tokens to be used immediately');
    console.log('- Automatically encrypt them in the background');
    console.log('- Log all migration operations for audit');
    console.log('- Continue working even if migration fails');
    return true;
  } else {
    console.log('❌ Some implementation checks failed!');
    console.log('========================================');
    console.log('\nPlease review the failed checks above.');
    return false;
  }
}

// Run verification
const success = verifyImplementation();
process.exit(success ? 0 : 1);
