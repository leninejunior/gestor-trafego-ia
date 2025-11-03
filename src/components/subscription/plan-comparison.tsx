"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Check, 
  X, 
  Crown, 
  Zap, 
  Building2, 
  Users,
  BarChart3,
  FileText,
  Code,
  Palette,
  Headphones
} from "lucide-react";
import { SubscriptionPlan } from "@/lib/types/subscription";
import { formatCurrency } from "@/lib/utils/currency";

interface PlanComparisonProps {
  plans: SubscriptionPlan[];
  currentPlanId?: string;
  onSelectPlan: (planId: string, billingCycle: 'monthly' | 'annual') => void;
  loading?: boolean;
}

export function PlanComparison({ 
  plans, 
  currentPlanId, 
  onSelectPlan, 
  loading = false 
}: PlanComparisonProps) {
  const [isAnnual, setIsAnnual] = useState(false);

  // Sort plans by price
  const sortedPlans = [...plans].sort((a, b) => a.monthly_price - b.monthly_price);

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'advancedAnalytics':
        return <BarChart3 className="h-4 w-4" />;
      case 'customReports':
        return <FileText className="h-4 w-4" />;
      case 'apiAccess':
        return <Code className="h-4 w-4" />;
      case 'whiteLabel':
        return <Palette className="h-4 w-4" />;
      case 'prioritySupport':
        return <Headphones className="h-4 w-4" />;
      default:
        return <Check className="h-4 w-4" />;
    }
  };

  const getFeatureLabel = (feature: string) => {
    switch (feature) {
      case 'advancedAnalytics':
        return 'Analytics Avançados';
      case 'customReports':
        return 'Relatórios Personalizados';
      case 'apiAccess':
        return 'Acesso à API';
      case 'whiteLabel':
        return 'White Label';
      case 'prioritySupport':
        return 'Suporte Prioritário';
      default:
        return feature;
    }
  };

  const calculateSavings = (monthlyPrice: number, annualPrice: number) => {
    const annualMonthly = annualPrice / 12;
    const savings = ((monthlyPrice - annualMonthly) / monthlyPrice) * 100;
    return Math.round(savings);
  };

  return (
    <div className="space-y-6">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center space-x-4">
        <span className={`text-sm ${!isAnnual ? 'font-medium' : 'text-muted-foreground'}`}>
          Mensal
        </span>
        <Switch
          checked={isAnnual}
          onCheckedChange={setIsAnnual}
          className="data-[state=checked]:bg-green-600"
        />
        <span className={`text-sm ${isAnnual ? 'font-medium' : 'text-muted-foreground'}`}>
          Anual
        </span>
        {isAnnual && (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Economize até 20%
          </Badge>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedPlans.map((plan, index) => {
          const isCurrentPlan = currentPlanId === plan.id;
          const isPopular = index === 1; // Middle plan is usually most popular
          const price = isAnnual ? plan.annual_price : plan.monthly_price;
          const savings = calculateSavings(plan.monthly_price, plan.annual_price);

          return (
            <Card 
              key={plan.id} 
              className={`relative ${
                isCurrentPlan ? 'ring-2 ring-blue-500 shadow-lg' : ''
              } ${
                isPopular ? 'border-2 border-blue-500 shadow-lg scale-105' : ''
              }`}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 hover:bg-blue-600">
                    <Crown className="w-3 h-3 mr-1" />
                    Mais Popular
                  </Badge>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="secondary">
                    Plano Atual
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="min-h-[40px]">
                  {plan.description || `Plano ${plan.name} com recursos essenciais`}
                </CardDescription>
                
                <div className="pt-4">
                  <div className="text-4xl font-bold">
                    {formatCurrency(price)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    /{isAnnual ? 'ano' : 'mês'}
                  </div>
                  
                  {isAnnual && plan.annual_price > 0 && savings > 0 && (
                    <div className="text-sm text-green-600 mt-1">
                      Economize {savings}% ({formatCurrency(plan.monthly_price * 12 - plan.annual_price)}/ano)
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Limits */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Clientes</span>
                    </div>
                    <span className="font-medium">
                      {plan.max_clients === -1 ? 'Ilimitado' : plan.max_clients}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>Campanhas</span>
                    </div>
                    <span className="font-medium">
                      {plan.max_campaigns === -1 ? 'Ilimitado' : plan.max_campaigns}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Usuários</span>
                    </div>
                    <span className="font-medium">
                      Até 10
                    </span>
                  </div>
                </div>

                {/* Features */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 text-sm">Recursos Inclusos</h4>
                  <div className="space-y-2">
                    {(() => {
                      // Handle both array and object formats for features
                      const features = Array.isArray(plan.features) 
                        ? plan.features 
                        : Object.entries(plan.features || {});
                      
                      if (Array.isArray(plan.features)) {
                        return plan.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span>{feature}</span>
                          </div>
                        ));
                      } else {
                        return Object.entries(plan.features || {}).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            {value ? (
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className={value ? "" : "text-muted-foreground"}>
                              {getFeatureLabel(key)}
                            </span>
                          </div>
                        ));
                      }
                    })()}
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-4">
                  <Button 
                    className="w-full" 
                    variant={isCurrentPlan ? "outline" : isPopular ? "default" : "outline"}
                    disabled={isCurrentPlan || loading}
                    onClick={() => onSelectPlan(plan.id, isAnnual ? 'annual' : 'monthly')}
                  >
                    {loading ? (
                      "Processando..."
                    ) : isCurrentPlan ? (
                      "Plano Atual"
                    ) : (
                      "Escolher Plano"
                    )}
                  </Button>
                </div>

                {/* Upgrade/Downgrade Indicator */}
                {!isCurrentPlan && currentPlanId && (
                  <div className="text-center">
                    {(() => {
                      const currentPlan = plans.find(p => p.id === currentPlanId);
                      if (!currentPlan) return null;
                      
                      const currentPrice = isAnnual ? currentPlan.annual_price : currentPlan.monthly_price;
                      const isUpgrade = price > currentPrice;
                      
                      return (
                        <Badge 
                          variant={isUpgrade ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {isUpgrade ? "Upgrade" : "Downgrade"}
                        </Badge>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison Table for larger screens */}
      <div className="hidden lg:block">
        <Card>
          <CardHeader>
            <CardTitle>Comparação Detalhada</CardTitle>
            <CardDescription>
              Compare todos os recursos disponíveis em cada plano
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Recurso</th>
                    {sortedPlans.map(plan => (
                      <th key={plan.id} className="text-center py-3 px-4">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Clientes</td>
                    {sortedPlans.map(plan => (
                      <td key={plan.id} className="text-center py-3 px-4">
                        {plan.max_clients === -1 ? 'Ilimitado' : plan.max_clients}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Campanhas</td>
                    {sortedPlans.map(plan => (
                      <td key={plan.id} className="text-center py-3 px-4">
                        {plan.max_campaigns === -1 ? 'Ilimitado' : plan.max_campaigns}
                      </td>
                    ))}
                  </tr>
                  {(() => {
                    // Handle both array and object formats for features in comparison table
                    const firstPlan = sortedPlans[0];
                    if (!firstPlan) return null;
                    
                    if (Array.isArray(firstPlan.features)) {
                      // For array format, show all unique features across plans
                      const allFeatures = new Set<string>();
                      sortedPlans.forEach(plan => {
                        if (Array.isArray(plan.features)) {
                          plan.features.forEach(feature => allFeatures.add(feature));
                        }
                      });
                      
                      return Array.from(allFeatures).map(feature => (
                        <tr key={feature} className="border-b">
                          <td className="py-3 px-4 font-medium">{feature}</td>
                          {sortedPlans.map(plan => (
                            <td key={plan.id} className="text-center py-3 px-4">
                              {Array.isArray(plan.features) && plan.features.includes(feature) ? (
                                <Check className="h-5 w-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-muted-foreground mx-auto" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ));
                    } else {
                      // For object format
                      return Object.keys(firstPlan.features || {}).map(featureKey => (
                        <tr key={featureKey} className="border-b">
                          <td className="py-3 px-4 font-medium">
                            {getFeatureLabel(featureKey)}
                          </td>
                          {sortedPlans.map(plan => (
                            <td key={plan.id} className="text-center py-3 px-4">
                              {plan.features[featureKey as keyof typeof plan.features] ? (
                                <Check className="h-5 w-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-muted-foreground mx-auto" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ));
                    }
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}