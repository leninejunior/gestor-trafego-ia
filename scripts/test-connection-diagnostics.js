/**
 * Test Connection Diagnostics
 * 
 * Tests the new connection diagnostics functionality added in Task 4.2
 * Verifies OAuth scopes, customer ID access, API permissions, and refresh token validation
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnectionDiagnostics() {
  console.log('='.repeat(80));
  console.log('Testing Connection Diagnostics');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Find an active Google Ads connection
    console.log('Step 1: Finding active Google Ads connection...');
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status')
      .eq('status', 'active')
      .limit(1);

    if (connError) {
      console.error('❌ Error fetching connections:', connError.message);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('⚠️  No active Google Ads connections found');
      console.log('   Please connect a Google Ads account first');
      return;
    }

    const connection = connections[0];
    console.log('✅ Found active connection:', {
      connectionId: connection.id,
      clientId: connection.client_id,
      customerId: connection.customer_id,
    });
    console.log();

    // Step 2: Call the sync status endpoint with diagnostics
    console.log('Step 2: Calling sync status endpoint with diagnostics...');
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const statusUrl = new URL('/api/google/sync/status', apiUrl);
    statusUrl.searchParams.set('clientId', connection.client_id);
    statusUrl.searchParams.set('connectionId', connection.id);
    statusUrl.searchParams.set('includeDiagnostics', 'true');

    console.log('   URL:', statusUrl.toString());
    console.log();

    const response = await fetch(statusUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('   Response status:', response.status, response.statusText);
    console.log();

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', errorText);
      return;
    }

    const result = await response.json();

    // Step 3: Display diagnostics results
    console.log('Step 3: Diagnostics Results');
    console.log('='.repeat(80));
    console.log();

    if (!result.diagnostics || result.diagnostics.length === 0) {
      console.log('⚠️  No diagnostics data returned');
      console.log('   This might indicate an issue with the diagnostics implementation');
      return;
    }

    result.diagnostics.forEach((diagnostic, index) => {
      console.log(`Connection ${index + 1}:`);
      console.log('  Connection ID:', diagnostic.connectionId);
      console.log('  Customer ID:', diagnostic.customerId);
      console.log('  Overall Status:', getStatusEmoji(diagnostic.overallStatus), diagnostic.overallStatus.toUpperCase());
      console.log('  Timestamp:', diagnostic.timestamp);
      console.log();

      console.log('  Checks:');
      console.log('  -------');

      // OAuth Scopes
      console.log('  1. OAuth Scopes:', getStatusEmoji(diagnostic.checks.oauthScopes.status), diagnostic.checks.oauthScopes.status.toUpperCase());
      console.log('     Message:', diagnostic.checks.oauthScopes.message);
      if (diagnostic.checks.oauthScopes.details) {
        console.log('     Details:', JSON.stringify(diagnostic.checks.oauthScopes.details, null, 2).split('\n').join('\n     '));
      }
      if (diagnostic.checks.oauthScopes.error) {
        console.log('     Error:', diagnostic.checks.oauthScopes.error);
      }
      console.log();

      // Customer ID Access
      console.log('  2. Customer ID Access:', getStatusEmoji(diagnostic.checks.customerIdAccess.status), diagnostic.checks.customerIdAccess.status.toUpperCase());
      console.log('     Message:', diagnostic.checks.customerIdAccess.message);
      if (diagnostic.checks.customerIdAccess.details) {
        console.log('     Details:', JSON.stringify(diagnostic.checks.customerIdAccess.details, null, 2).split('\n').join('\n     '));
      }
      if (diagnostic.checks.customerIdAccess.error) {
        console.log('     Error:', diagnostic.checks.customerIdAccess.error);
      }
      console.log();

      // API Permissions
      console.log('  3. API Permissions:', getStatusEmoji(diagnostic.checks.apiPermissions.status), diagnostic.checks.apiPermissions.status.toUpperCase());
      console.log('     Message:', diagnostic.checks.apiPermissions.message);
      if (diagnostic.checks.apiPermissions.details) {
        console.log('     Details:', JSON.stringify(diagnostic.checks.apiPermissions.details, null, 2).split('\n').join('\n     '));
      }
      if (diagnostic.checks.apiPermissions.error) {
        console.log('     Error:', diagnostic.checks.apiPermissions.error);
      }
      console.log();

      // Refresh Token
      console.log('  4. Refresh Token:', getStatusEmoji(diagnostic.checks.refreshToken.status), diagnostic.checks.refreshToken.status.toUpperCase());
      console.log('     Message:', diagnostic.checks.refreshToken.message);
      if (diagnostic.checks.refreshToken.details) {
        console.log('     Details:', JSON.stringify(diagnostic.checks.refreshToken.details, null, 2).split('\n').join('\n     '));
      }
      if (diagnostic.checks.refreshToken.error) {
        console.log('     Error:', diagnostic.checks.refreshToken.error);
      }
      console.log();
    });

    // Step 4: Summary
    console.log('='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    console.log();

    const allDiagnostics = result.diagnostics;
    const healthyCount = allDiagnostics.filter(d => d.overallStatus === 'healthy').length;
    const degradedCount = allDiagnostics.filter(d => d.overallStatus === 'degraded').length;
    const unhealthyCount = allDiagnostics.filter(d => d.overallStatus === 'unhealthy').length;

    console.log('Total Connections:', allDiagnostics.length);
    console.log('Healthy:', healthyCount, getStatusEmoji('healthy'));
    console.log('Degraded:', degradedCount, getStatusEmoji('degraded'));
    console.log('Unhealthy:', unhealthyCount, getStatusEmoji('unhealthy'));
    console.log();

    // Collect all recommendations
    const recommendations = new Set();
    allDiagnostics.forEach(diagnostic => {
      Object.values(diagnostic.checks).forEach(check => {
        if (check.details?.recommendation) {
          recommendations.add(check.details.recommendation);
        }
      });
    });

    if (recommendations.size > 0) {
      console.log('Recommendations:');
      Array.from(recommendations).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
      console.log();
    }

    console.log('✅ Connection diagnostics test completed successfully');
    console.log();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

function getStatusEmoji(status) {
  switch (status) {
    case 'pass':
    case 'healthy':
      return '✅';
    case 'warning':
    case 'degraded':
      return '⚠️';
    case 'fail':
    case 'unhealthy':
      return '❌';
    default:
      return '❓';
  }
}

// Run the test
testConnectionDiagnostics().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
