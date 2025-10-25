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
    const mappedData = (data || []).map(plan => ({
      ...plan,
      price_monthly: plan.monthly_price,
      price_yearly: plan.annual_price,
    }));

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
    const supabase = await this.getSupabaseClient();
    
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
      if (planData.limits.users !== undefined) insertData.max_users = planData.limits.users;
      if (planData.limits.ad_accounts !== undefined) insertData.max_ad_accounts = planData.limits.ad_accounts;
      // Note: max_campaigns doesn't exist in the current schema, so we skip it
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

    return data[0];
  }

  /**
   * Update an existing subscription plan
   */
  async updatePlan(planId: string, updates: UpdatePlanRequest): Promise<any> {
    const supabase = await this.getSupabaseClient();
    
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
      if (updates.limits.users !== undefined) updateData.max_users = updates.limits.users;
      if (updates.limits.ad_accounts !== undefined) updateData.max_ad_accounts = updates.limits.ad_accounts;
      // Note: max_campaigns doesn't exist in the current schema, so we skip it
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