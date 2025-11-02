#!/usr/bin/env node

/**
 * Script to validate Google Ads environment variables
 * 
 * Checks that all required environment variables are set
 * and provides guidance if any are missing.
 */

require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvVar(name, description, required = true) {
  const value = process.env[name];
  const isSet = value && value !== `your_${name.toLowerCase()}` && value !== '';
  
  if (isSet) {
    log(`✓ ${name}`, 'green');
    return true;
  } else {
    if (required) {
      log(`✗ ${name} - ${description}`, 'red');
    } else {
      log(`⚠ ${name} - ${description} (optional)`, 'yellow');
    }
    return false;
  }
}

function main() {
  log('\n🔍 Checking Google Ads Environment Variables\n', 'cyan');

  const checks = [
    {
      name: 'GOOGLE_CLIENT_ID',
      description: 'OAuth 2.0 Client ID from Google Cloud Console',
      required: true
    },
    {
      name: 'GOOGLE_CLIENT_SECRET',
      description: 'OAuth 2.0 Client Secret from Google Cloud Console',
      required: true
    },
    {
      name: 'GOOGLE_DEVELOPER_TOKEN',
      description: 'Developer Token from Google Ads API Center',
      required: true
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      description: 'Supabase project URL',
      required: true
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      description: 'Supabase anonymous key',
      required: true
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      description: 'Supabase service role key (for server-side operations)',
      required: true
    },
    {
      name: 'NEXT_PUBLIC_APP_URL',
      description: 'Application URL for OAuth callbacks',
      required: true
    }
  ];

  let allPassed = true;
  let googleAdsPassed = true;

  checks.forEach(check => {
    const passed = checkEnvVar(check.name, check.description, check.required);
    if (!passed && check.required) {
      allPassed = false;
      if (check.name.startsWith('GOOGLE_')) {
        googleAdsPassed = false;
      }
    }
  });

  log('\n' + '='.repeat(60), 'blue');

  if (allPassed) {
    log('\n✅ All environment variables are configured!', 'green');
    log('\nYou can now:', 'cyan');
    log('1. Apply the database schema: node scripts/apply-google-ads-schema.js', 'yellow');
    log('2. Start the development server: pnpm dev', 'yellow');
    log('3. Test the Google Ads OAuth flow', 'yellow');
  } else {
    log('\n❌ Some environment variables are missing', 'red');
    
    if (!googleAdsPassed) {
      log('\n📝 To set up Google Ads API:', 'cyan');
      log('1. Go to https://console.cloud.google.com/', 'yellow');
      log('2. Create a new project or select existing', 'yellow');
      log('3. Enable Google Ads API', 'yellow');
      log('4. Create OAuth 2.0 credentials', 'yellow');
      log('5. Get Developer Token from https://ads.google.com/ > Tools > API Center', 'yellow');
      log('6. Add credentials to .env file', 'yellow');
      log('\nSee docs/SETUP_GOOGLE_ADS.md for detailed instructions', 'cyan');
    }
  }

  log('\n' + '='.repeat(60) + '\n', 'blue');

  process.exit(allPassed ? 0 : 1);
}

// Run the script
main();
