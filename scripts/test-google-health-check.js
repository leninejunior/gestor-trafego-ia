/**
 * Test Google Ads Health Check Endpoint
 * 
 * Tests the /api/google/health endpoint to verify:
 * - Database connectivity
 * - Encryption keys
 * - Active connections
 * - Token validation
 * - API quota status
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testHealthCheck() {
  console.log('========================================');
  console.log('Google Ads Health Check Test');
  console.log('========================================\n');

  try {
    console.log(`Testing endpoint: ${APP_URL}/api/google/health\n`);
    
    const startTime = Date.now();
    const response = await fetch(`${APP_URL}/api/google/health`);
    const duration = Date.now() - startTime;

    console.log('Response Status:', response.status, response.statusText);
    console.log('Response Time:', `${duration}ms`);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('');

    const data = await response.json();

    console.log('========================================');
    console.log('Health Check Results');
    console.log('========================================\n');

    console.log('Overall Status:', data.status);
    console.log('Timestamp:', data.timestamp);
    console.log('');

    console.log('Summary:');
    console.log('  Total Checks:', data.summary.totalChecks);
    console.log('  Passed:', data.summary.passedChecks);
    console.log('  Failed:', data.summary.failedChecks);
    console.log('');

    console.log('========================================');
    console.log('Individual Checks');
    console.log('========================================\n');

    // Database Check
    console.log('1. Database:');
    console.log('   Status:', data.checks.database.status);
    console.log('   Message:', data.checks.database.message);
    if (data.checks.database.error) {
      console.log('   Error:', data.checks.database.error);
    }
    if (data.checks.database.details) {
      console.log('   Details:', JSON.stringify(data.checks.database.details, null, 2));
    }
    console.log('');

    // Encryption Keys Check
    console.log('2. Encryption Keys:');
    console.log('   Status:', data.checks.encryptionKeys.status);
    console.log('   Message:', data.checks.encryptionKeys.message);
    if (data.checks.encryptionKeys.error) {
      console.log('   Error:', data.checks.encryptionKeys.error);
    }
    if (data.checks.encryptionKeys.details) {
      console.log('   Details:', JSON.stringify(data.checks.encryptionKeys.details, null, 2));
    }
    console.log('');

    // Active Connections Check
    console.log('3. Active Connections:');
    console.log('   Status:', data.checks.activeConnections.status);
    console.log('   Message:', data.checks.activeConnections.message);
    if (data.checks.activeConnections.error) {
      console.log('   Error:', data.checks.activeConnections.error);
    }
    if (data.checks.activeConnections.details) {
      console.log('   Details:', JSON.stringify(data.checks.activeConnections.details, null, 2));
    }
    console.log('');

    // Token Validation Check
    console.log('4. Token Validation:');
    console.log('   Status:', data.checks.tokenValidation.status);
    console.log('   Message:', data.checks.tokenValidation.message);
    if (data.checks.tokenValidation.error) {
      console.log('   Error:', data.checks.tokenValidation.error);
    }
    if (data.checks.tokenValidation.details) {
      console.log('   Details:', JSON.stringify(data.checks.tokenValidation.details, null, 2));
    }
    console.log('');

    // API Quota Check
    console.log('5. API Quota:');
    console.log('   Status:', data.checks.apiQuota.status);
    console.log('   Message:', data.checks.apiQuota.message);
    if (data.checks.apiQuota.error) {
      console.log('   Error:', data.checks.apiQuota.error);
    }
    if (data.checks.apiQuota.details) {
      console.log('   Details:', JSON.stringify(data.checks.apiQuota.details, null, 2));
    }
    console.log('');

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      console.log('========================================');
      console.log('Recommendations');
      console.log('========================================\n');
      data.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      console.log('');
    }

    console.log('========================================');
    console.log('Test Complete');
    console.log('========================================\n');

    // Exit with appropriate code
    if (data.status === 'healthy') {
      console.log('✅ All checks passed!');
      process.exit(0);
    } else if (data.status === 'degraded') {
      console.log('⚠️  System is degraded but operational');
      process.exit(0);
    } else {
      console.log('❌ System is unhealthy');
      process.exit(1);
    }

  } catch (error) {
    console.error('========================================');
    console.error('Test Failed');
    console.error('========================================\n');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('');
    process.exit(1);
  }
}

// Run test
testHealthCheck();
