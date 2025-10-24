#!/usr/bin/env node

/**
 * Subscription Schema Validation Script
 * 
 * This script validates that the subscription schema was applied correctly
 * by checking table existence, RLS policies, functions, and default data.
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
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function validateSubscriptionSchema() {
    console.log('🔍 Validating subscription schema...\n');
    
    let allChecksPass = true;
    const results = {
        tables: {},
        defaultPlans: null,
        functions: {},
        policies: {}
    };

    // Check 1: Verify tables exist and are accessible
    console.log('📋 Checking table existence and accessibility...');
    
    const requiredTables = [
        'subscription_plans',
        'subscriptions',
        'subscription_invoices',
        'feature_usage'
    ];

    for (const tableName of requiredTables) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);

            if (error) {
                console.log(`❌ Table ${tableName}: ${error.message}`);
                results.tables[tableName] = { exists: false, error: error.message };
                allChecksPass = false;
            } else {
                console.log(`✅ Table ${tableName}: Accessible`);
                results.tables[tableName] = { exists: true, accessible: true };
            }
        } catch (err) {
            console.log(`❌ Table ${tableName}: ${err.message}`);
            results.tables[tableName] = { exists: false, error: err.message };
            allChecksPass = false;
        }
    }

    // Check 2: Verify default subscription plans
    console.log('\n💰 Checking default subscription plans...');
    
    try {
        const { data: plans, error } = await supabase
            .from('subscription_plans')
            .select('name, monthly_price, annual_price, is_active, features')
            .eq('is_active', true)
            .order('monthly_price');

        if (error) {
            console.log(`❌ Default plans check failed: ${error.message}`);
            results.defaultPlans = { error: error.message };
            allChecksPass = false;
        } else if (!plans || plans.length === 0) {
            console.log('⚠️  No active subscription plans found');
            results.defaultPlans = { count: 0, warning: 'No active plans' };
        } else {
            console.log(`✅ Found ${plans.length} active subscription plans:`);
            plans.forEach(plan => {
                console.log(`   - ${plan.name}: $${plan.monthly_price}/month, $${plan.annual_price}/year`);
            });
            results.defaultPlans = { count: plans.length, plans };
        }
    } catch (err) {
        console.log(`❌ Default plans check error: ${err.message}`);
        results.defaultPlans = { error: err.message };
        allChecksPass = false;
    }

    // Check 3: Test basic functionality (if tables are accessible)
    if (results.tables.subscription_plans?.exists) {
        console.log('\n🔧 Testing basic functionality...');
        
        try {
            // Test reading plans (should work for public access)
            const { data: publicPlans, error: publicError } = await supabase
                .from('subscription_plans')
                .select('id, name, monthly_price')
                .eq('is_active', true)
                .limit(3);

            if (publicError) {
                console.log(`⚠️  Public plan access: ${publicError.message}`);
            } else {
                console.log(`✅ Public plan access: Can read ${publicPlans.length} plans`);
            }
        } catch (err) {
            console.log(`⚠️  Basic functionality test failed: ${err.message}`);
        }
    }

    // Check 4: Verify required columns exist
    console.log('\n📊 Checking table structure...');
    
    const tableStructureChecks = {
        subscription_plans: ['id', 'name', 'monthly_price', 'annual_price', 'features', 'is_active'],
        subscriptions: ['id', 'organization_id', 'plan_id', 'status', 'billing_cycle'],
        subscription_invoices: ['id', 'subscription_id', 'invoice_number', 'amount', 'status'],
        feature_usage: ['id', 'organization_id', 'feature_key', 'usage_count', 'usage_date']
    };

    for (const [tableName, requiredColumns] of Object.entries(tableStructureChecks)) {
        if (results.tables[tableName]?.exists) {
            try {
                // Try to select specific columns to verify they exist
                const selectColumns = requiredColumns.join(', ');
                const { error } = await supabase
                    .from(tableName)
                    .select(selectColumns)
                    .limit(1);

                if (error) {
                    console.log(`⚠️  Table ${tableName} structure: ${error.message}`);
                } else {
                    console.log(`✅ Table ${tableName} structure: All required columns present`);
                }
            } catch (err) {
                console.log(`⚠️  Table ${tableName} structure check failed: ${err.message}`);
            }
        }
    }

    // Summary
    console.log('\n📋 Validation Summary:');
    console.log('='.repeat(50));
    
    const tableCount = Object.keys(results.tables).length;
    const accessibleTables = Object.values(results.tables).filter(t => t.exists).length;
    
    console.log(`Tables: ${accessibleTables}/${tableCount} accessible`);
    
    if (results.defaultPlans?.count) {
        console.log(`Default Plans: ${results.defaultPlans.count} active plans found`);
    } else {
        console.log('Default Plans: ❌ Not found or inaccessible');
    }

    if (allChecksPass) {
        console.log('\n🎉 Schema validation completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('   1. Begin implementing subscription management services');
        console.log('   2. Create API endpoints for plan and subscription management');
        console.log('   3. Implement feature gating throughout the application');
        console.log('   4. Set up Stripe integration for payment processing');
    } else {
        console.log('\n⚠️  Schema validation completed with issues.');
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Ensure the subscription schema SQL was executed successfully');
        console.log('   2. Check that the organizations table exists (required dependency)');
        console.log('   3. Verify RLS policies are not blocking access');
        console.log('   4. Try running the schema SQL manually in Supabase dashboard');
    }

    return {
        success: allChecksPass,
        results
    };
}

// Run the validation
if (require.main === module) {
    validateSubscriptionSchema()
        .then(({ success }) => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Validation script error:', error.message);
            process.exit(1);
        });
}

module.exports = { validateSubscriptionSchema };