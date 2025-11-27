/**
 * Show Migration SQL for Google Ads Encryption Keys
 * Task 1.1: Display the SQL that needs to be run in Supabase
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔐 Google Ads Encryption Keys Migration');
console.log('================================================\n');

const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '001-fix-google-ads-encryption-keys.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('📋 INSTRUCTIONS:');
console.log('1. Open Supabase Dashboard');
console.log('2. Go to SQL Editor');
console.log('3. Copy and paste the SQL below');
console.log('4. Click "Run" to execute');
console.log('5. Run the test script again: node scripts/test-google-encryption.js\n');

console.log('================================================');
console.log('SQL TO RUN IN SUPABASE:');
console.log('================================================\n');

console.log(migrationSQL);

console.log('\n================================================');
console.log('END OF SQL');
console.log('================================================\n');

console.log('✅ Copy the SQL above and run it in Supabase SQL Editor\n');
