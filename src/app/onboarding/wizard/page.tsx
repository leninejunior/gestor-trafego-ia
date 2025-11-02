'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Users,
  CreditCard,
  Zap,
  Mail,
  User,
  Globe,
  Target,
  Sparkles
} from "lucide-react";

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: WizardStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo!',
    description: 'Vamos configurar sua conta em poucos passos',
    icon: <Sparkles className="w-6 h-6" />
  },
  {
    id: 'organization',
    title: 'Sua Organização',
    description: 'Informações básicas da sua empresa',
    icon: <Building2 className="w-6 h-6" />
  },
  {
    id: 'client',
    title: 'Primeiro Cliente',
    description: 'Adicione seu primeiro cliente',
    icon: <User className="w-6 h-6" />
  },
  {
    id: 'goals',
    title: 'Seus Objetivos',
    description: 'O que você quer alcançar?',
    icon: <Target className="w-6 h-6" />
  },
  {
    id: 'complete',
    title: 'Tudo Pronto!',
    description: 'Sua conta está configurada',
    icon: <CheckCircle className="w-6 h-6" />
  }
];

export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [formData, setFormData] = useState({
    organizationName: '',
    organizationType: '',
    clientName: '',
    clientIndustry: '',
    goals: [] as string[],
    monthlyBudget: ''
  });

  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: membership } = await supabase
      .from('organization_memberships')
      .select(`
        organizations (
          name
        )
      `)
      .eq('user_id', user.id)
      .single();

    setUserData(user);
    if ((membership?.organizations as any)?.name) {
      setFormData(prev => ({
        ...prev,
        organizationName: (membership.organizations as any).name
      }));
    }
  };

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      router.push('/dashboard');
      return;
    }

    if (currentStep === 1) {
      await saveOrganizationData();
    } else if (currentStep === 2) {
      await saveClientData();
    }

    setCurrentStep(prev => prev + 1);
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const saveOrganizationData = async () => {
    if (!formData.organizationName.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Atualizar nome da organização
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (membership?.organization_id) {
        await supabase
          .from('organizations')
          .update({ name: formData.organizationName })
          .eq('id', membership.organization_id);
      }

      toast({
        title: "Organização atualizada!",
        description: "Informações salvas com sucesso.",
      } as any);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as informações.",
        variant: "destructive",
      } as any);
    } finally {
      setLoading(false);
    }
  };

  const saveClientData = async () => {
    if (!formData.clientName.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (membership?.organization_id) {
        await supabase
          .from('clients')
          .insert({
            name: formData.clientName,
            organization_id: membership.organization_id,
            created_by: user.id
          });

        toast({
          title: "Cliente adicionado!",
          description: "Primeiro cliente criado com sucesso.",
        } as any);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o cliente.",
        variant: "destructive",
      } as any);
    } finally {
      setLoading(false);
    }
  };

  const toggleGoal = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }));
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Bem-vindo ao seu SaaS de Marketing! 🎉
              </h2>
              <p className="text-gray-600 text-lg">
                Vamos configurar sua conta em apenas alguns passos simples.
                Isso levará menos de 5 minutos.
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-800 text-sm">
                💡 Você pode pular qualquer etapa e configurar depois no dashboard
              </p>
            </div>
          </div>
        );

      case 'organization':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Building2 className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Sobre sua Organização
              </h2>
              <p className="text-gray-600">
                Nos conte um pouco sobre sua empresa
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="orgName">Nome da Organização *</Label>
                <Input
                  id="orgName"
                  value={formData.organizationName}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    organizationName: e.target.value
                  }))}
                  placeholder="Ex: Minha Agência Digital"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="orgType">Tipo de Negócio</Label>
                <select
                  id="orgType"
                  value={formData.organizationType}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    organizationType: e.target.value
                  }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  <option value="agency">Agência de Marketing</option>
                  <option value="freelancer">Freelancer</option>
                  <option value="inhouse">Equipe Interna</option>
                  <option value="consultant">Consultoria</option>
                  <option value="other">Outro</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'client':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <User className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Seu Primeiro Cliente
              </h2>
              <p className="text-gray-600">
                Adicione um cliente para começar a gerenciar campanhas
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="clientName">Nome do Cliente *</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    clientName: e.target.value
                  }))}
                  placeholder="Ex: Loja ABC"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clientIndustry">Setor/Indústria</Label>
                <select
                  id="clientIndustry"
                  value={formData.clientIndustry}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    clientIndustry: e.target.value
                  }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="services">Serviços</option>
                  <option value="retail">Varejo</option>
                  <option value="saas">SaaS/Software</option>
                  <option value="healthcare">Saúde</option>
                  <option value="education">Educação</option>
                  <option value="other">Outro</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Target className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Seus Objetivos
              </h2>
              <p className="text-gray-600">
                O que você quer alcançar com a plataforma?
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Selecione seus objetivos:</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {[
                    'Aumentar vendas online',
                    'Gerar mais leads',
                    'Melhorar ROI das campanhas',
                    'Automatizar relatórios',
                    'Gerenciar múltiplos clientes',
                    'Otimizar orçamento de anúncios'
                  ].map((goal) => (
                    <button
                      key={goal}
                      onClick={() => toggleGoal(goal)}
                      className={`p-3 text-left border rounded-lg transition-colors ${
                        formData.goals.includes(goal)
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          formData.goals.includes(goal)
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-300'
                        }`}>
                          {formData.goals.includes(goal) && (
                            <CheckCircle className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm">{goal}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="budget">Orçamento Mensal Aproximado</Label>
                <select
                  id="budget"
                  value={formData.monthlyBudget}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    monthlyBudget: e.target.value
                  }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Selecione...</option>
                  <option value="0-1000">Até R$ 1.000</option>
                  <option value="1000-5000">R$ 1.000 - R$ 5.000</option>
                  <option value="5000-10000">R$ 5.000 - R$ 10.000</option>
                  <option value="10000-25000">R$ 10.000 - R$ 25.000</option>
                  <option value="25000+">Mais de R$ 25.000</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Tudo Pronto! 🎉
              </h2>
              <p className="text-gray-600 text-lg mb-6">
                Sua conta está configurada e pronta para uso.
              </p>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-800 mb-2">Próximos passos:</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Conecte suas contas do Meta Ads</li>
                  <li>• Convide membros para sua equipe</li>
                  <li>• Configure seus primeiros relatórios</li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Passo {currentStep + 1} de {steps.length}</span>
            <span>{Math.round(progress)}% concluído</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-2">
              {steps[currentStep].icon}
            </div>
            <CardTitle className="text-xl">{steps[currentStep].title}</CardTitle>
            <CardDescription>{steps[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          <div className="flex space-x-2">
            <Button variant="ghost" asChild>
              <a href="/dashboard">Pular</a>
            </Button>
            <Button onClick={handleNext} disabled={loading}>
              {loading ? (
                'Salvando...'
              ) : currentStep === steps.length - 1 ? (
                'Ir para Dashboard'
              ) : (
                <>
                  Próximo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}