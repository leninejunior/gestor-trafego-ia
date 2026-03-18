import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { 
  CheckCircle,
  Circle,
  ArrowRight,
  Building2,
  Users,
  CreditCard,
  Zap,
  Target,
  BookOpen,
  Play,
  Settings,
  UserPlus
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/login");
  }

  // Buscar dados do usuário e organização
  const { data: membership } = await supabase
    .from("memberships")
    .select(`
      id,
      role,
      status,
      organization_id,
      organizations (
        id,
        name,
        created_at,
        clients (
          id,
          name,
          client_meta_connections (
            id,
            is_active
          )
        ),
        subscriptions (
          id,
          status,
          subscription_plans!subscriptions_plan_id_fkey (
            name
          )
        )
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership?.organizations) {
    return redirect("/dashboard");
  }

  const organization = membership.organizations;
  const hasClients = organization.clients && organization.clients.length > 0;
  const hasConnections = organization.clients?.some((client: any) => 
    client.client_meta_connections && client.client_meta_connections.length > 0
  );
  const hasActiveSubscription = organization.subscriptions?.some((sub: any) => sub.status === 'active');
  const hasTeamMembers = false; // Seria necessário buscar outros membros

  // Calcular progresso do onboarding
  const steps = [
    { id: 'organization', completed: true, title: 'Organização criada' },
    { id: 'subscription', completed: hasActiveSubscription, title: 'Plano ativado' },
    { id: 'client', completed: hasClients, title: 'Primeiro cliente adicionado' },
    { id: 'connection', completed: hasConnections, title: 'Meta Ads conectado' },
    { id: 'team', completed: hasTeamMembers, title: 'Equipe convidada' }
  ];

  const completedSteps = steps.filter(step => step.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bem-vindo ao seu SaaS! 🎉
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Vamos configurar tudo para você começar a gerenciar suas campanhas
          </p>
          <div className="max-w-md mx-auto">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Progresso do Setup</span>
              <span>{completedSteps}/{steps.length} concluído</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-6 mb-8">
          {steps.map((step, index) => (
            <Card key={step.id} className={`transition-all duration-200 ${
              step.completed ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-blue-200'
            }`}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    step.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step.completed ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <span className="font-bold">{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold ${
                      step.completed ? 'text-green-800' : 'text-gray-900'
                    }`}>
                      {step.title}
                    </h3>
                    <p className="text-gray-600 mt-1">
                      {step.id === 'organization' && 'Sua organização foi criada com sucesso'}
                      {step.id === 'subscription' && (hasActiveSubscription ? 
                        `Plano ${(organization.subscriptions as any)?.[0]?.subscription_plans?.[0]?.name} ativo` : 
                        'Escolha um plano para desbloquear todos os recursos'
                      )}
                      {step.id === 'client' && (hasClients ? 
                        `${(organization.clients as any)?.length} cliente(s) adicionado(s)` : 
                        'Adicione seu primeiro cliente para começar'
                      )}
                      {step.id === 'connection' && (hasConnections ? 
                        'Meta Ads conectado com sucesso' : 
                        'Conecte suas contas do Meta Ads'
                      )}
                      {step.id === 'team' && (hasTeamMembers ? 
                        'Equipe convidada' : 
                        'Convide membros para sua equipe'
                      )}
                    </p>
                  </div>
                  {!step.completed && (
                    <div className="flex-shrink-0">
                      <Button size="sm" variant="outline">
                        {step.id === 'subscription' && 'Escolher Plano'}
                        {step.id === 'client' && 'Adicionar Cliente'}
                        {step.id === 'connection' && 'Conectar Meta'}
                        {step.id === 'team' && 'Convidar Equipe'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                Adicionar Cliente
              </CardTitle>
              <CardDescription>
                Comece adicionando seu primeiro cliente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/dashboard/clients">
                  <Building2 className="w-4 h-4 mr-2" />
                  Gerenciar Clientes
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Zap className="w-5 h-5 mr-2 text-purple-600" />
                Conectar Meta Ads
              </CardTitle>
              <CardDescription>
                Conecte suas contas de anúncios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/dashboard/meta">
                  <Zap className="w-4 h-4 mr-2" />
                  Conectar Agora
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <UserPlus className="w-5 h-5 mr-2 text-green-600" />
                Convidar Equipe
              </CardTitle>
              <CardDescription>
                Adicione membros à sua organização
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/dashboard/team">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Gerenciar Equipe
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              Recursos de Aprendizado
            </CardTitle>
            <CardDescription>
              Aprenda a usar todas as funcionalidades da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <Play className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="font-medium">Tutorial em Vídeo</h4>
                  <p className="text-sm text-gray-500">Aprenda o básico em 10 minutos</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <BookOpen className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-medium">Documentação</h4>
                  <p className="text-sm text-gray-500">Guias detalhados e exemplos</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <Target className="w-5 h-5 text-purple-600" />
                <div>
                  <h4 className="font-medium">Melhores Práticas</h4>
                  <p className="text-sm text-gray-500">Dicas para otimizar campanhas</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <Settings className="w-5 h-5 text-orange-600" />
                <div>
                  <h4 className="font-medium">Configurações Avançadas</h4>
                  <p className="text-sm text-gray-500">Personalize sua experiência</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="flex justify-between items-center mt-8">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              Pular Tutorial
            </Link>
          </Button>
          
          {progress === 100 ? (
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <Link href="/dashboard">
                <CheckCircle className="w-4 h-4 mr-2" />
                Ir para Dashboard
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/clients">
                Continuar Setup
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}