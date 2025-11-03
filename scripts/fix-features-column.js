const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixFeaturesColumn() {
  console.log('🔧 Fixing features column format...');
  
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('id, name, features');
  
  if (error) {
    console.error('Error fetching plans:', error);
    return;
  }
  
  console.log('Current features format:');
  plans.forEach(plan => {
    console.log(`- ${plan.name}: ${typeof plan.features} - ${JSON.stringify(plan.features)}`);
  });
  
  // Fix plans with non-array features
  for (const plan of plans) {
    if (!Array.isArray(plan.features)) {
      let newFeatures = [];
      
      if (typeof plan.features === 'string') {
        // If it's a string, try to parse or split
        try {
          newFeatures = JSON.parse(plan.features);
        } catch {
          newFeatures = [plan.features];
        }
      } else if (plan.features && typeof plan.features === 'object') {
        // If it's an object, convert to array
        newFeatures = Object.keys(plan.features);
      } else {
        // Default features based on plan name
        if (plan.name.toLowerCase().includes('basic') || plan.name.toLowerCase().includes('básico')) {
          newFeatures = ['Campaign Management', 'Basic Analytics', 'Email Support'];
        } else if (plan.name.toLowerCase().includes('pro')) {
          newFeatures = ['Advanced Campaign Management', 'Advanced Analytics', 'Priority Support', 'API Access'];
        } else if (plan.name.toLowerCase().includes('enterprise')) {
          newFeatures = ['Enterprise Features', 'Custom Integrations', 'Dedicated Support', 'White-label'];
        } else {
          newFeatures = ['Basic Features'];
        }
      }
      
      console.log(`Updating ${plan.name} features to:`, newFeatures);
      
      const { error: updateError } = await supabase
        .from('subscription_plans')
        .update({ features: newFeatures })
        .eq('id', plan.id);
      
      if (updateError) {
        console.error(`Error updating ${plan.name}:`, updateError);
      } else {
        console.log(`✅ Updated ${plan.name} features`);
      }
    } else {
      console.log(`✅ ${plan.name} already has array features`);
    }
  }
  
  console.log('\n🎉 Features column fix completed!');
}

fixFeaturesColumn();