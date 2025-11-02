'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus,
  Edit,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  RefreshCw,
  Save,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/utils/currency';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  features: string[];
  limits: {
    clients?: number;
    users?: number;
    campaigns?: number;
    api_calls?: number;
    storage_gb?: number;
    max_clients?: number;
    max_campaigns_per_client?: number;
    data_retention_days?: number;
    sync_interval_hours?: number;
    allow_csv_export?: number | boolean;
    allow_json_export?: number | boolean;
  };
  is_active: boolean;
  is_popular: boolean;
  created_at: string;
  updated_at: string;
}

interface PlanFormData {
  name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  features: string[];
  limits: {
    clients?: number;
    users?: number;
    campaigns?: number;
    api_calls?: number;
    storage_gb?: number;
    max_clients?: number;
    max_campaigns_per_client?: number;
    data_retention_days?: number;
    sync_interval_hours?: number;
    allow_csv_export?: number | boolean;
    allow_json_export?: number | boolean;
  };
  is_active: boolean;
  is_popular: boolean;
}

const defaultLimits = {
  clients: 10,
  users: 5,
  campaigns: 50,
  api_calls: 10000,
  storage_gb: 10,
  max_clients: 5,
  max_campaigns_per_client: 25,
  data_retention_days: 90,
  sync_interval_hours: 24,
  allow_csv_export: 0,
  allow_json_export: 0
};

const featureTemplates = {
  basic: [
    'Campaign Management',
    'Basic Analytics',
    'Email Support',
    'Standard Integrations'
  ],
  professional: [
    'Advanced Campaign Management',
    'Advanced Analytics & Reporting',
    'Priority Support',
    'All Integrations',
    'Custom Dashboards',
    'API Access',
    'Team Collaboration'
  ],
  enterprise: [
    'Enterprise Campaign Management',
    'Advanced Analytics & AI Insights',
    'Dedicated Support Manager',
    'Custom Integrations',
    'White-label Solution',
    'Advanced API Access',
    'Advanced Team Management',
    'Custom Training',
    'SLA Guarantee'
  ]
};

export function AdminPlanManagement() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    monthly_price: 0,
    annual_price: 0,
    features: [],
    limits: { ...defaultLimits },
    is_active: true,
    is_popular: false
  });
  const [newFeature, setNewFeature] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    console.log('🚀 AdminPlanManagement component mounted');
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    console.log('🔄 fetchPlans called');
    try {
      setLoading(true);
      setError(null);
      
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      console.log('📡 Making API call to /api/admin/plans');
      const response = await fetch(`/api/admin/plans?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      console.log('📡 API response status:', response.status);
      
      if (!response.ok) {
        console.log('❌ Response not OK. Status:', response.status, 'StatusText:', response.statusText);
        
        // Try to get error details
        let errorData: any = {};
        try {
          const text = await response.text();
          console.log('📄 Response text:', text);
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        
        console.error('❌ API error response:', errorData);
        
        if (response.status === 401) {
          // Redirecionar para login após 2 segundos
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          throw new Error('Você não está autenticado. Redirecionando para login...');
        } else if (response.status === 403) {
          throw new Error('Você não tem permissões de administrador para acessar esta página.');
        } else {
          const errorMsg = errorData.message || errorData.error || response.statusText || 'Falha ao carregar planos';
          throw new Error(errorMsg);
        }
      }
      
      const data = await response.json();
      console.log('📡 API response data:', data);
      
      if (!data.success) {
        throw new Error(data.message || data.error || 'Falha ao carregar planos');
      }
      
      // Convert price strings to numbers
      const plansWithNumbers = (data.plans || []).map((plan: any) => ({
        ...plan,
        monthly_price: parseFloat(plan.monthly_price) || 0,
        annual_price: parseFloat(plan.annual_price) || 0,
      }));
      
      setPlans(plansWithNumbers);
    } catch (err) {
      console.error('❌ Error fetching plans:', err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      monthly_price: 0,
      annual_price: 0,
      features: [],
      limits: { ...defaultLimits },
      is_active: true,
      is_popular: false
    });
    setNewFeature('');
    setEditingPlan(null);
  };

  const validatePlan = (data: PlanFormData): string[] => {
    const errors: string[] = [];
    
    if (!data.name.trim()) errors.push('Plan name is required');
    if (!data.description.trim()) errors.push('Plan description is required');
    if (data.monthly_price < 0) errors.push('Monthly price cannot be negative');
    if (data.annual_price < 0) errors.push('Annual price cannot be negative');
    if (data.features.length === 0) errors.push('At least one feature is required');
    
    return errors;
  };

  const handleCreatePlan = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const errors = validatePlan(formData);
      if (errors.length > 0) {
        setError(errors.join(', '));
        return;
      }

      console.log('📝 Creating plan:', formData);
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create plan');
      }

      const result = await response.json();
      console.log('✅ Plan created successfully:', result);

      setSuccessMessage(`Plan "${formData.name}" created successfully!`);
      await fetchPlans();
      setIsCreateDialogOpen(false);
      resetForm();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error creating plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  const handleEditPlan = async () => {
    if (!editingPlan) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Debug: Log current formData state
      console.log('🔍 Current formData state:', JSON.stringify(formData, null, 2));
      console.log('🔍 Features type:', typeof formData.features, 'isArray:', Array.isArray(formData.features));

      // Extra validation to catch edge cases
      if (!formData) {
        console.error('❌ FormData is null or undefined');
        setError('Form data is invalid');
        return;
      }

      // Ensure features is always an array
      if (!Array.isArray(formData.features)) {
        console.error('❌ Features is not an array:', typeof formData.features, formData.features);
        setError('Features must be an array');
        return;
      }

      // Ensure prices are numbers
      if (typeof formData.monthly_price !== 'number' || isNaN(formData.monthly_price)) {
        console.error('❌ Monthly price is not a valid number:', formData.monthly_price);
        setError('Monthly price must be a valid number');
        return;
      }

      if (typeof formData.annual_price !== 'number' || isNaN(formData.annual_price)) {
        console.error('❌ Annual price is not a valid number:', formData.annual_price);
        setError('Annual price must be a valid number');
        return;
      }

      const errors = validatePlan(formData);
      if (errors.length > 0) {
        console.error('❌ Local validation errors:', errors);
        setError(errors.join(', '));
        return;
      }

      console.log('✅ Local validation passed');
      console.log('📝 Updating plan:', editingPlan.id, formData);
      
      const requestBody = JSON.stringify(formData);
      console.log('📤 Request body:', requestBody);
      
      const response = await fetch(`/api/admin/plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API error response:', errorData);
        
        // More detailed error handling
        if (errorData.details) {
          console.error('❌ Validation details:', errorData.details);
          const detailsMessage = Array.isArray(errorData.details) 
            ? errorData.details.map(d => d.message || d).join(', ')
            : JSON.stringify(errorData.details);
          throw new Error(`Validation error: ${detailsMessage}`);
        }
        
        throw new Error(errorData.error || errorData.message || 'Failed to update plan');
      }

      const result = await response.json();
      console.log('✅ Plan updated successfully:', result);

      setSuccessMessage(`Plan "${formData.name}" updated successfully!`);
      await fetchPlans();
      setIsEditDialogOpen(false);
      resetForm();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('❌ Error updating plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete plan');
      }

      await fetchPlans();
    } catch (err) {
      console.error('Error deleting plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    }
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    console.log('🔍 Opening edit dialog for plan:', plan.name);
    console.log('🔍 Plan data:', JSON.stringify(plan, null, 2));
    
    setEditingPlan(plan);
    
    // Normalize features to array
    let featuresArray: string[] = [];
    if (Array.isArray(plan.features)) {
      featuresArray = [...plan.features];
      console.log('✅ Features already array:', featuresArray.length, 'items');
    } else if (plan.features && typeof plan.features === 'object') {
      // If features is an object, convert to array of strings
      featuresArray = Object.entries(plan.features).map(([key, value]) => 
        typeof value === 'boolean' ? key : `${key}: ${value}`
      );
      console.log('🔄 Converted features from object to array:', featuresArray.length, 'items');
    } else {
      console.warn('⚠️ Features is not array or object:', typeof plan.features, plan.features);
      featuresArray = [];
    }
    
    // Ensure all required fields have valid values
    const safeFormData = {
      name: plan.name || '',
      description: plan.description || '',
      monthly_price: typeof plan.monthly_price === 'number' ? plan.monthly_price : parseFloat(plan.monthly_price) || 0,
      annual_price: typeof plan.annual_price === 'number' ? plan.annual_price : parseFloat(plan.annual_price) || 0,
      features: featuresArray,
      limits: plan.limits ? { ...plan.limits } : { ...defaultLimits },
      is_active: typeof plan.is_active === 'boolean' ? plan.is_active : true,
      is_popular: typeof plan.is_popular === 'boolean' ? plan.is_popular : false
    };
    
    console.log('📝 Setting form data:', JSON.stringify(safeFormData, null, 2));
    console.log('🔍 Form data validation check:');
    console.log('  - name:', typeof safeFormData.name, safeFormData.name.length, 'chars');
    console.log('  - description:', typeof safeFormData.description, safeFormData.description.length, 'chars');
    console.log('  - monthly_price:', typeof safeFormData.monthly_price, safeFormData.monthly_price);
    console.log('  - annual_price:', typeof safeFormData.annual_price, safeFormData.annual_price);
    console.log('  - features:', typeof safeFormData.features, Array.isArray(safeFormData.features), safeFormData.features.length, 'items');
    console.log('  - limits:', typeof safeFormData.limits, Object.keys(safeFormData.limits).length, 'keys');
    console.log('  - is_active:', typeof safeFormData.is_active, safeFormData.is_active);
    console.log('  - is_popular:', typeof safeFormData.is_popular, safeFormData.is_popular);
    
    setFormData(safeFormData);
    setIsEditDialogOpen(true);
  };

  const addFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const removeFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter(f => f !== feature)
    }));
  };

  const updateLimit = (key: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      limits: {
        ...prev.limits,
        [key]: value
      }
    }));
  };

  const applyFeatureTemplate = (template: keyof typeof featureTemplates) => {
    setFormData(prev => ({
      ...prev,
      features: [...featureTemplates[template]]
    }));
  };

  if (loading) {
    return <PlanManagementSkeleton />;
  }

  if (error) {
    const isAuthError = error.includes('autenticado') || error.includes('Redirecionando');
    
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isAuthError ? 'Autenticação Necessária' : 'Erro ao Carregar Planos'}
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              {isAuthError ? (
                <Button onClick={() => window.location.href = '/login'} variant="default">
                  Ir para Login
                </Button>
              ) : (
                <Button onClick={fetchPlans} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <p className="text-sm text-green-600 font-medium">{successMessage}</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Plan Management</h2>
          <p className="text-gray-600">Create and manage subscription plans</p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Create Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Plan</DialogTitle>
                <DialogDescription>
                  Create a new subscription plan with features and pricing.
                </DialogDescription>
              </DialogHeader>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <PlanForm
                formData={formData}
                setFormData={setFormData}
                newFeature={newFeature}
                setNewFeature={setNewFeature}
                addFeature={addFeature}
                removeFeature={removeFeature}
                updateLimit={updateLimit}
                applyFeatureTemplate={applyFeatureTemplate}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreatePlan} disabled={saving}>
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Create Plan
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className="relative">
            {plan.is_popular && (
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-500 text-white">Popular</Badge>
              </div>
            )}
            
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="mt-1">{plan.description}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openEditDialog(plan)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Plan
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Plan
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Pricing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Monthly</span>
                  <span className="font-semibold">{formatCurrency(plan.monthly_price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Annual</span>
                  <span className="font-semibold">{formatCurrency(plan.annual_price)}</span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <Badge variant={plan.is_active ? "default" : "secondary"}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Limits Summary */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Plan Limits</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Clients:</span>
                    <span className="font-medium">
                      {plan.limits?.max_clients === -1 ? 'Unlimited' : plan.limits?.max_clients || 5}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Campaigns/Client:</span>
                    <span className="font-medium">
                      {plan.limits?.max_campaigns_per_client === -1 ? 'Unlimited' : plan.limits?.max_campaigns_per_client || 25}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data Retention:</span>
                    <span className="font-medium">
                      {plan.limits?.data_retention_days || 90} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sync Interval:</span>
                    <span className="font-medium">
                      {plan.limits?.sync_interval_hours || 24}h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CSV Export:</span>
                    <span className="font-medium">
                      {plan.limits?.allow_csv_export ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">JSON Export:</span>
                    <span className="font-medium">
                      {plan.limits?.allow_json_export ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Features</h4>
                <div className="space-y-1">
                  {(() => {
                    // Normalize features to array for display
                    let featuresToDisplay: string[] = [];
                    if (Array.isArray(plan.features)) {
                      featuresToDisplay = plan.features;
                    } else if (plan.features && typeof plan.features === 'object') {
                      featuresToDisplay = Object.entries(plan.features).map(([key, value]) => 
                        typeof value === 'boolean' ? key : `${key}: ${value}`
                      );
                    }
                    
                    return (
                      <>
                        {featuresToDisplay.slice(0, 2).map((feature, index) => (
                          <div key={index} className="flex items-center text-sm text-gray-600">
                            <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                            {feature}
                          </div>
                        ))}
                        {featuresToDisplay.length > 2 && (
                          <div className="text-sm text-gray-500">
                            +{featuresToDisplay.length - 2} more features
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>
              Update the plan details, features, and pricing.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <PlanForm
            formData={formData}
            setFormData={setFormData}
            newFeature={newFeature}
            setNewFeature={setNewFeature}
            addFeature={addFeature}
            removeFeature={removeFeature}
            updateLimit={updateLimit}
            applyFeatureTemplate={applyFeatureTemplate}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleEditPlan} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Update Plan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PlanFormProps {
  formData: PlanFormData;
  setFormData: React.Dispatch<React.SetStateAction<PlanFormData>>;
  newFeature: string;
  setNewFeature: React.Dispatch<React.SetStateAction<string>>;
  addFeature: () => void;
  removeFeature: (feature: string) => void;
  updateLimit: (key: string, value: number) => void;
  applyFeatureTemplate: (template: keyof typeof featureTemplates) => void;
}

function PlanForm({ 
  formData, 
  setFormData, 
  newFeature, 
  setNewFeature, 
  addFeature, 
  removeFeature, 
  updateLimit,
  applyFeatureTemplate
}: PlanFormProps) {
  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Basic Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Plan Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Professional"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="is_popular"
              checked={formData.is_popular}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_popular: checked }))}
            />
            <Label htmlFor="is_popular">Mark as Popular</Label>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the plan"
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Pricing</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="monthly_price">Monthly Price (BRL)</Label>
            <Input
              id="monthly_price"
              type="number"
              value={formData.monthly_price}
              onChange={(e) => setFormData(prev => ({ ...prev, monthly_price: parseFloat(e.target.value) || 0 }))}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="annual_price">Annual Price (BRL)</Label>
            <Input
              id="annual_price"
              type="number"
              value={formData.annual_price}
              onChange={(e) => setFormData(prev => ({ ...prev, annual_price: parseFloat(e.target.value) || 0 }))}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Features</h3>
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyFeatureTemplate('basic')}
            >
              Basic Template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyFeatureTemplate('professional')}
            >
              Pro Template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyFeatureTemplate('enterprise')}
            >
              Enterprise Template
            </Button>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Input
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            placeholder="Add a feature..."
            onKeyPress={(e) => e.key === 'Enter' && addFeature()}
          />
          <Button type="button" onClick={addFeature}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {formData.features.map((feature, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">{feature}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFeature(feature)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Limits - Cache & Resources */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-medium">Plan Limits (Cache & Resources)</h3>
        <p className="text-sm text-gray-600">
          Configure resource limits and data retention for this plan. Use -1 for unlimited.
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Resource Limits */}
          <div>
            <Label htmlFor="max_clients">Max Clients</Label>
            <Input
              id="max_clients"
              type="number"
              value={formData.limits.max_clients || 5}
              onChange={(e) => updateLimit('max_clients', parseInt(e.target.value) || 0)}
              placeholder="5"
            />
            <p className="text-xs text-gray-500 mt-1">-1 = unlimited</p>
          </div>
          
          <div>
            <Label htmlFor="max_campaigns_per_client">Max Campaigns per Client</Label>
            <Input
              id="max_campaigns_per_client"
              type="number"
              value={formData.limits.max_campaigns_per_client || 25}
              onChange={(e) => updateLimit('max_campaigns_per_client', parseInt(e.target.value) || 0)}
              placeholder="25"
            />
            <p className="text-xs text-gray-500 mt-1">-1 = unlimited</p>
          </div>
          
          {/* Cache & Sync Settings */}
          <div>
            <Label htmlFor="data_retention_days">Data Retention (days)</Label>
            <Input
              id="data_retention_days"
              type="number"
              value={formData.limits.data_retention_days || 90}
              onChange={(e) => updateLimit('data_retention_days', parseInt(e.target.value) || 90)}
              placeholder="90"
              min="30"
              max="3650"
            />
            <p className="text-xs text-gray-500 mt-1">30-3650 days</p>
          </div>
          
          <div>
            <Label htmlFor="sync_interval_hours">Sync Interval (hours)</Label>
            <Input
              id="sync_interval_hours"
              type="number"
              value={formData.limits.sync_interval_hours || 24}
              onChange={(e) => updateLimit('sync_interval_hours', parseInt(e.target.value) || 24)}
              placeholder="24"
              min="1"
              max="168"
            />
            <p className="text-xs text-gray-500 mt-1">1-168 hours</p>
          </div>
          
          {/* Export Permissions */}
          <div className="col-span-2 space-y-3 border-t pt-3">
            <h4 className="text-sm font-medium">Export Permissions</h4>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="allow_csv_export"
                  checked={formData.limits.allow_csv_export !== false}
                  onCheckedChange={(checked) => updateLimit('allow_csv_export', checked ? 1 : 0)}
                />
                <Label htmlFor="allow_csv_export">Allow CSV Export</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="allow_json_export"
                  checked={formData.limits.allow_json_export !== false}
                  onCheckedChange={(checked) => updateLimit('allow_json_export', checked ? 1 : 0)}
                />
                <Label htmlFor="allow_json_export">Allow JSON Export</Label>
              </div>
            </div>
          </div>
          
          {/* Legacy Limits (optional) */}
          <div>
            <Label htmlFor="users">Max Users</Label>
            <Input
              id="users"
              type="number"
              value={formData.limits.users || 5}
              onChange={(e) => updateLimit('users', parseInt(e.target.value) || 0)}
              placeholder="5"
            />
          </div>
          
          <div>
            <Label htmlFor="api_calls">API Calls/month</Label>
            <Input
              id="api_calls"
              type="number"
              value={formData.limits.api_calls || 10000}
              onChange={(e) => updateLimit('api_calls', parseInt(e.target.value) || 0)}
              placeholder="10000"
            />
          </div>
          
          <div>
            <Label htmlFor="storage_gb">Storage (GB)</Label>
            <Input
              id="storage_gb"
              type="number"
              value={formData.limits.storage_gb || 10}
              onChange={(e) => updateLimit('storage_gb', parseInt(e.target.value) || 0)}
              placeholder="10"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanManagementSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
      </div>

      {/* Plans Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="h-6 bg-gray-200 rounded w-32 animate-pulse mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                </div>
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-4 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}