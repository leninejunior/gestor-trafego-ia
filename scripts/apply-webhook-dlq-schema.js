/**
 * Apply Webhook Dead Letter Queue Schema
 * 
 * Script to apply the dead letter queue schema to the database.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applySchema() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase configuration');
      console.log('Required environment variables:');
      console.log('- NEXT_PUBLIC_SUPABASE_URL');
      console.log('- SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }

    console.log('🔗 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📖 Reading schema file...');
    const schemaPath = path.join(__dirname, '..', 'database', 'webhook-dead-letter-queue-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🚀 Applying dead letter queue schema...');
    
    // Execute the schema as a single query
    const { error: execError } = await supabase.rpc('exec', { sql: schema });
    
    if (execError) {
      console.error('❌ Error executing schema:', execError);
      console.log('Please apply the schema manually in Supabase SQL Editor');
      console.log('Schema file: database/webhook-dead-letter-queue-schema.sql');
      process.exit(1);
    }

    console.log('✅ Dead letter queue schema applied successfully!');
    
    // Test the schema by checking if the table exists
    console.log('🔍 Verifying schema...');
    const { data, error: verifyError } = await supabase
      .from('webhook_dead_letter_queue')
      .select('count(*)', { count: 'exact', head: true });

    if (verifyError) {
      console.error('❌ Schema verification failed:', verifyError);
      process.exit(1);
    }

    console.log('✅ Schema verification successful!');
    console.log(`📊 Dead letter queue table exists and is accessible`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

applySchema();