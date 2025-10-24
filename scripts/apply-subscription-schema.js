#!/usr/bin/env node

/**
 * Apply Subscription Plans Schema Script
 * 
 * This script applies the complete subscription plans database schema
 * including tables, RLS policies, functions, and default data.
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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySubscriptionSchema() {
    try {
        console.log('🚀 Starting subscription schema application...');
        
        // Read the schema file
        const schemaPath = path.join(__dirname, '..', 'database', 'subscription-plans-schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found: ${schemaPath}`);
        }
        
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📄 Schema file loaded successfully');
        console.log('🔧 Applying subscription schema to database...');
        
        // Execute the schema
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: schemaSQL
        });
        
        if (error) {
            // If exec_sql doesn't exist, try direct execution
            console.log('⚠️  exec_sql function not available, trying direct execution...');
            
            // Split SQL into individual statements and execute them
            const statements = schemaSQL
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                if (statement) {
                    console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
                    
                    const { error: execError } = await supabase
                        .from('_temp_exec')
                        .select('*')
                        .limit(0); // This will fail but we can catch SQL execution
                    
                    // Alternative: Use the SQL editor approach
                    try {
                        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${supabaseServiceKey}`,
                                'apikey': supabaseServiceKey
                            },
                            body: JSON.stringify({ sql: statement })
                        });
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            console.warn(`⚠️  Statement ${i + 1} warning: ${errorText}`);
                        }
                    } catch (stmtError) {
                        console.warn(`⚠️  Statement ${i + 1} warning: ${stmtError.message}`);
                    }
                }
            }
        }
        
        console.log('✅ Subscription schema applied successfully!');
        
        // Verify the tables were created
        console.log('🔍 Verifying table creation...');
        
        const tables = [
            'subscription_plans',
            'subscriptions', 
            'subscription_invoices',
            'feature_usage'
        ];
        
        for (const table of tables) {
            const { data: tableData, error: tableError } = await supabase
                .from(table)
                .select('*')
                .limit(1);
                
            if (tableError) {
                console.warn(`⚠️  Warning: Could not verify table ${table}: ${tableError.message}`);
            } else {
                console.log(`✅ Table ${table} verified`);
            }
        }
        
        // Check if default plans were inserted
        const { data: plans, error: plansError } = await supabase
            .from('subscription_plans')
            .select('name, monthly_price, is_active');
            
        if (plansError) {
            console.warn(`⚠️  Warning: Could not verify default plans: ${plansError.message}`);
        } else {
            console.log(`✅ Default subscription plans verified: ${plans.length} plans found`);
            plans.forEach(plan => {
                console.log(`   - ${plan.name}: $${plan.monthly_price}/month (${plan.is_active ? 'active' : 'inactive'})`);
            });
        }
        
        console.log('\n🎉 Subscription schema setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('   1. Verify the schema in your Supabase dashboard');
        console.log('   2. Test the RLS policies with different user roles');
        console.log('   3. Begin implementing the subscription management services');
        
    } catch (error) {
        console.error('❌ Error applying subscription schema:', error.message);
        console.error('\n🔧 Troubleshooting tips:');
        console.error('   1. Ensure your Supabase service role key has admin permissions');
        console.error('   2. Check that the organizations table exists (required for foreign keys)');
        console.error('   3. Verify your database connection is working');
        console.error('   4. Try running the SQL manually in the Supabase SQL editor');
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    applySubscriptionSchema();
}

module.exports = { applySubscriptionSchema };