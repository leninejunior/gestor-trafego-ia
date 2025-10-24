#!/usr/bin/env node

/**
 * Apply Subscription Migration Script
 * 
 * This script applies the subscription schema migration to update
 * existing tables and create missing ones.
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnvFile() {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim();
                if (value && !process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    }
}

loadEnvFile();

async function applySubscriptionMigration() {
    try {
        console.log('🚀 Starting subscription schema migration...\n');
        
        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'database', 'migrate-subscription-schema.sql');
        
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found: ${migrationPath}`);
        }
        
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📄 Migration file loaded successfully');
        console.log('📝 Migration contains:');
        console.log('   - Update existing subscription_plans table structure');
        console.log('   - Migrate subscriptions table with new columns');
        console.log('   - Create subscription_invoices table');
        console.log('   - Create feature_usage table');
        console.log('   - Add RLS policies for multi-tenant security');
        console.log('   - Create helper functions for feature gating');
        console.log('   - Insert/update default subscription plans');
        
        console.log('\n📋 Manual Execution Required:');
        console.log('='.repeat(50));
        console.log('Due to the complexity of this migration and the need for');
        console.log('precise control, please execute this migration manually:');
        console.log('');
        console.log('1. Open your Supabase dashboard');
        console.log('2. Navigate to the SQL Editor');
        console.log('3. Copy the contents of: database/migrate-subscription-schema.sql');
        console.log('4. Paste and execute the SQL in the editor');
        console.log('5. Run the validation script: node scripts/validate-subscription-schema.js');
        console.log('');
        console.log('📁 Migration file location:');
        console.log(`   ${migrationPath}`);
        console.log('');
        console.log('⚠️  Important Notes:');
        console.log('   - This migration is designed to be safe and non-destructive');
        console.log('   - Existing data will be preserved during column renames');
        console.log('   - New tables will be created if they don\'t exist');
        console.log('   - RLS policies will be updated for proper security');
        console.log('');
        console.log('🔍 After migration, verify with:');
        console.log('   node scripts/validate-subscription-schema.js');
        
    } catch (error) {
        console.error('❌ Error preparing migration:', error.message);
        console.error('\n🔧 Troubleshooting tips:');
        console.error('   1. Ensure the migration file exists');
        console.error('   2. Check file permissions');
        console.error('   3. Verify the database connection');
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    applySubscriptionMigration();
}

module.exports = { applySubscriptionMigration };