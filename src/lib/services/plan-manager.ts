import { createClient } from '@/lib/supabase/server';
import { 
  CreatePlanRequest, 
  UpdatePlanRequest
} from '@/lib/types/subscription-plans';

export class PlanManager {
  private async getSupabaseClient() {
    return createClient();
  }

  /**
   * Get all active subscription plans
   */
  async getAvailablePlans(): Promise<any[]> {
    const supabase = await this.getSupabaseClient();
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('monthly_price', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch plans: ${error.message}`);
    }

    // Mapear nomes das colunas para o formato esperado pelo frontend
    const mappedData = (data || []).map(plan => {
      const normalized = this.normalizePlanFeatures(plan);
      return {
        ...normalized,
        price_monthly: plan.monthly_price,
        price_yearly: plan.annual_price,
      };
    });

    return mappedData;
  }

  /**
   * Normalize features to always be an array
   */
  private normalizePlanFeatures(plan: any): any {
    let featuresArray: string[] = [];
    
    if (Array.isArray(plan.features)) {
      featuresArray = plan.features;
    } else if (plan.features && typeof plan.features === 'object') {
      // If features is an object, convert to array of strings
      featuresArray = Object.entries(plan.features).map(([key, value]) => 
        typeof value === 'boolean' ? key : `${key}: ${value}`
      );
    } else if (typeof plan.features === 'string') {
      // If features is a string, try to parse it
      try {
        const parsed = JSON.parse(plan.features);
        featuresArray = Array.isArray(parsed) ? parsed : [];
      } catch {
        featuresArray = [plan.features];
      }
    }
    
    return {
      ...plan,
      features: featuresArray
    };
  }

  /**
   * Get a specific plan by ID
   */
  async getPlanById(planId: string): Promise<any | null> {
    const supabase = await this.getSupabaseClient();
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId);

    if (error) {
      throw new Error(`Failed to fetch plan: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null; // Not found
    }

    return this.normalizePlanFeatures(data[0]);
  }

  /**
   * Create a new subscription plan (admin only)
   */
  async createPlan(planData: CreatePlanRequest): Promise<any> {
    // Use service role to bypass RLS for admin operations
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const insertData: any = {
      name: planData.name,
      description: planData.description,
      // Database columns are already named monthly_price and annual_price
      monthly_price: planData.monthly_price,
      annual_price: planData.annual_price,
      features: planData.features,
      is_active: planData.is_active,
    };

    // Map limits to the correct column names that exist in the database
    if (planData.limits) {
      if (planData.limits.clients !== undefined) insertData.max_clients = planData.limits.clients;
      if (planData.limits.campaigns !== undefined) insertData.max_campaigns = planData.limits.campaigns;
      // Note: max_users and max_ad_accounts don't exist in the current schema
    }

    const { data, error } = await supabase
      .from('subscription_plans')
      .insert(insertData)
      .select();

    if (error) {
      throw new Error(`Failed to create plan: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Failed to create plan - no data returned');
    }

    const newPlan = data[0];

    // Create plan_limits record
    const limitsData = {
      plan_id: newPlan.id,
      max_clients: planData.limits?.max_clients || planData.limits?.clients || 5,
      max_campaigns_per_client: planData.limits?.max_campaigns_per_client || planData.limits?.campaigns || 25,
      data_retention_days: planData.limits?.data_retention_days || 90,
      sync_interval_hours: planData.limits?.sync_interval_hours || 24,
      allow_csv_export: planData.limits?.allow_csv_export ? true : false,
      allow_json_export: planData.limits?.allow_json_export ? true : false
    };

    const { error: limitsError } = await supabase
      .from('plan_limits')
      .insert(limitsData);

    if (limitsError) {
      console.error('Warning: Failed to create plan_limits:', limitsError);
      // Don't fail the whole operation, just log the warning
    }

    return newPlan;
  }

  /**
   * Update an existing subscription plan
   */
  async updatePlan(planId: string, updates: UpdatePlanRequest): Promise<any> {
    // Use service role to bypass RLS for admin operations
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // First, check if the plan exists
    const { data: existingPlan, error: fetchError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId);

    if (fetchError) {
      throw new Error(`Failed to fetch plan: ${fetchError.message}`);
    }

    if (!existingPlan || existingPlan.length === 0) {
      throw new Error(`Plan with ID ${planId} not found`);
    }

    console.log('✅ Plan found, proceeding with update');

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    // Database columns are already named monthly_price and annual_price
    if (updates.monthly_price !== undefined) updateData.monthly_price = updates.monthly_price;
    if (updates.annual_price !== undefined) updateData.annual_price = updates.annual_price;
    
    // Ensure features is always a valid array for JSONB
    if (updates.features !== undefined) {
      updateData.features = Array.isArray(updates.features) ? updates.features : [];
    }
    
    if (updates.limits) {
      // Map limits to the correct column names that exist in the database
      if (updates.limits.clients !== undefined) updateData.max_clients = updates.limits.clients;
      if (updates.limits.campaigns !== undefined) updateData.max_campaigns = updates.limits.campaigns;
      // Note: max_users and max_ad_accounts don't exist in the current schema
    }
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
    // Note: is_popular is not in the current schema, so we skip it for now

    updateData.updated_at = new Date().toISOString();
    
    console.log('🔄 Final update data to be sent to database:', JSON.stringify(updateData, null, 2));

    console.log('🔄 Updating plan with data:', JSON.stringify(updateData, null, 2));

    const { data, error } = await supabase
      .from('subscription_plans')
      .update(updateData)
      .eq('id', planId)
      .select();

    if (error) {
      console.error('❌ Supabase update error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to update plan: ${error.message}`);
    }

    console.log('📊 Update result:', { dataLength: data?.length, data });

    if (!data || data.length === 0) {
      // If no data returned, fetch the plan again to return current state
      const { data: updatedPlan } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId);
      
      if (updatedPlan && updatedPlan.length > 0) {
        console.log('⚠️ No data returned from update, but plan exists. Returning current state.');
        return this.normalizePlanFeatures(updatedPlan[0]);
      }
      
      throw new Error('Plan not found after update attempt');
    }

    console.log('✅ Plan updated successfully');
    
    // Update plan_limits if limits are provided
    if (updates.limits) {
      const limitsData: any = {};
      
      if (updates.limits.max_clients !== undefined) limitsData.max_clients = updates.limits.max_clients;
      if (updates.limits.max_campaigns_per_client !== undefined) limitsData.max_campaigns_per_client = updates.limits.max_campaigns_per_client;
      if (updates.limits.data_retention_days !== undefined) limitsData.data_retention_days = updates.limits.data_retention_days;
      if (updates.limits.sync_interval_hours !== undefined) limitsData.sync_interval_hours = updates.limits.sync_interval_hours;
      if (updates.limits.allow_csv_export !== undefined) limitsData.allow_csv_export = updates.limits.allow_csv_export ? true : false;
      if (updates.limits.allow_json_export !== undefined) limitsData.allow_json_export = updates.limits.allow_json_export ? true : false;
      
      limitsData.updated_at = new Date().toISOString();

      // Try to update existing plan_limits, or insert if doesn't exist
      const { error: limitsError } = await supabase
        .from('plan_limits')
        .upsert({
          plan_id: planId,
          ...limitsData
        }, {
          onConflict: 'plan_id'
        });

      if (limitsError) {
        console.error('Warning: Failed to update plan_limits:', limitsError);
        // Don't fail the whole operation, just log the warning
      }
    }
    
    // Return the first (and should be only) updated record with normalized features
    return this.normalizePlanFeatures(data[0]);
  }

  /**
   * Check if a plan exists and is active
   */
  async isPlanActive(planId: string): Promise<boolean> {
    const supabase = await this.getSupabaseClient();
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('is_active')
      .eq('id', planId);

    if (error || !data || data.length === 0) return false;
    return data[0].is_active;
  }
}