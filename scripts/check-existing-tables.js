#!/usr/bin/env node

/**
 * Check Existing Tables Script
 * 
 * This script checks what subscription-related tables already exist
 * and their current structure.
 */

const { createClient } = require('@supabase/supabase-js');
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkExistingTables() {
    console.log('🔍 Checking existing subscription-related tables...\n');

    // List of potential table names to check
    const tablesToCheck = [
        'subscription_plans',
        'subscriptions', 
        'subscription_invoices',
        'feature_usage',
        // Also check for any existing similar tables
        'plans',
        'billing',
        'invoices',
        'usage'
    ];

    for (const tableName of tablesToCheck) {
        try {
            console.log(`Checking table: ${tableName}`);
            
            // Try to get table structure by selecting with limit 0
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);

            if (error) {
                if (error.message.includes('does not exist') || error.message.includes('not find')) {
                    console.log(`   ❌ Table does not exist\n`);
                } else {
                    console.log(`   ⚠️  Error: ${error.message}\n`);
                }
            } else {
                console.log(`   ✅ Table exists and is accessible`);
                
                // If data exists, show sample structure
                if (data && data.length > 0) {
                    console.log(`   📊 Sample columns: ${Object.keys(data[0]).join(', ')}`);
                } else {
                    console.log(`   📊 Table is empty`);
                }
                console.log('');
            }
        } catch (err) {
            console.log(`   ❌ Error checking table: ${err.message}\n`);
        }
    }

    // Check if organizations table exists (required dependency)
    console.log('🏢 Checking required dependency tables...');
    
    const dependencyTables = ['organizations', 'memberships'];
    
    for (const tableName of dependencyTables) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('id')
                .limit(1);

            if (error) {
                console.log(`❌ Required table ${tableName}: ${error.message}`);
            } else {
                console.log(`✅ Required table ${tableName}: Available`);
            }
        } catch (err) {
            console.log(`❌ Required table ${tableName}: ${err.message}`);
        }
    }
}

// Run the check
if (require.main === module) {
    checkExistingTables()
        .catch(error => {
            console.error('❌ Script error:', error.message);
            process.exit(1);
        });
}

module.exports = { checkExistingTables };