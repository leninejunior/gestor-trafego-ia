'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { 
  CheckCircle,
  Circle,
  ArrowRight,
  Building2,
  Users,
  CreditCard,
  Zap,
  Target,
  Mail,
  Settings,
  ExternalLink,
  RefreshCw,
  X
} from "lucide-react";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  action: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  priority: 'high' | 'medium' | 'low';
}

interface SetupChecklistProps {
  onComplete?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export default function SetupChecklist({ onComplete, onDismiss, compact = false }: SetupChecklistProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    loadChecklistData();
  }, []);

  const loadChecklistData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar dados da organização
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select(`
          id,
          role,
          organization_id,
          organizations (
            id,
            name,
            clients (
              id,
              client_meta_connections (
                id,
                is_active
              )
            ),
            subscriptions (
              id,
              status
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!membership?.organizations) return;

      const org = membership.organizations as any;
      const hasClients = org.clients && org.clients.length > 0;
      const hasConnections = org.clients?.some((client: any) => 
        client.client_meta_connections && client.client_meta_connections.length > 0
      );
      const hasActiveConnections = org.clients?.some((client: any) => 
        client.client_meta_connections?.some((conn: any) => conn.is_active)
      );
      const hasActiveSubscription = org.subscriptions?.some((sub: any) => sub.status === 'active');

      // Buscar outros membros
      const { data: otherMembers } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', org.id as string)
        .neq('user_id', user.id);

      const hasTeamMembers = otherMembers && otherMembers.length > 0;

      const items: ChecklistItem[] = [
        {
          id: 'subscription',
          title: 'Ativar Plano',
          description: 'Escolha um plano para desbloquear todos os recursos',
          icon: <CreditCard className="w-5 h-5" />,
          completed: hasActiveSubscription,
          action: {
            label: hasActiveSubscription ? 'Gerenciar Plano' : 'Escolher Plano',
            href: '/dashboard/billing'
          },
          priority: 'high'
        },
        {
          id: 'client',
          title: 'Adicionar Cliente',
          description: 'Adicione seu primeiro cliente para começar',
          icon: <Building2 className="w-5 h-5" />,
          completed: hasClients,
          action: {
            label: hasClients ? 'Gerenciar Clientes' : 'Adicionar Cliente',
            href: '/dashboard/clients'
          },
          priority: 'high'
        },
        {
          id: 'connection',
          title: 'Conectar Meta Ads',
          description: 'Conecte suas contas de anúncios do Meta',
          icon: <Zap className="w-5 h-5" />,
          completed: hasConnections,
          action: {
            label: hasConnections ? 'Gerenciar Conexões' : 'Conectar Agora',
            href: '/dashboard/meta'
          },
          priority: 'high'
        },
        {
          id: 'active_connection',
          title: 'Ativar Conexões',
          description: 'Certifique-se de que suas conexões estão ativas',
          icon: <Target className="w-5 h-5" />,
          completed: hasActiveConnections,
          action: {
            label: 'Verificar Status',
            href: '/dashboard/meta'
          },
          priority: 'medium'
        },
        {
          id: 'team',
          title: 'Convidar Equipe',
          description: 'Adicione membros à sua organização',
          icon: <Users className="w-5 h-5" />,
          completed: hasTeamMembers,
          action: {
            label: hasTeamMembers ? 'Gerenciar Equipe' : 'Convidar Membros',
            href: '/dashboard/team'
          },
          priority: 'medium'
        },
        {
          id: 'profile',
          title: 'Completar Perfil',
          description: 'Configure suas informações pessoais',
          icon: <Settings className="w-5 h-5" />,
          completed: false, // Seria necessário verificar se o perfil está completo
          action: {
            label: 'Editar Perfil',
            href: '/dashboard/settings'
          },
          priority: 'low'
        }
      ];

      setChecklist(items);
    } catch (error) {
      console.error('Erro ao carregar checklist:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o checklist.",
        variant: "destructive",
      } as any);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleComplete = () => {
    setIsVisible(false);
    onComplete?.();
    toast({
      title: "Parabéns! 🎉",
      description: "Você completou todo o setup inicial!",
    } as any);
  };

  // Calculate derived values BEFORE any conditional returns
  // This ensures all hooks are called consistently
  const completedItems = checklist.filter(item => item.completed).length;
  const totalItems = checklist.length;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const isComplete = completedItems === totalItems;

  const highPriorityIncomplete = checklist.filter(item =>
    item.priority === 'high' && !item.completed
  ).length;

  if (!isVisible || loading) {
    return null;
  }

  if (compact) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium">Setup da Conta</h3>
                <p className="text-sm text-muted-foreground">
                  {completedItems}/{totalItems} concluído
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-16">
                <Progress value={progress} className="h-2" />
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/onboarding">
                  Ver Todos
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="w-6 h-6 text-blue-600" />
            <div>
              <CardTitle>Setup da Conta</CardTitle>
              <CardDescription>
                Complete estas etapas para aproveitar ao máximo a plataforma
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadChecklistData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Progresso: {completedItems}/{totalItems}
            </span>
            <span className="font-medium">
              {Math.round(progress)}% concluído
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          
          {highPriorityIncomplete > 0 && (
            <div className="flex items-center space-x-2 text-sm">
              <Badge variant="destructive" className="text-xs">
                {highPriorityIncomplete} alta prioridade
              </Badge>
              <span className="text-muted-foreground">pendentes</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {checklist.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              item.completed 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : item.priority === 'high'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-muted/50 border-border hover:bg-muted'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`flex-shrink-0 ${
                item.completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
              }`}>
                {item.completed ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </div>
              
              <div className={`flex-shrink-0 ${
                item.completed ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
              }`}>
                {item.icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium ${
                  item.completed ? 'text-green-800 dark:text-green-300' : 'text-foreground'
                }`}>
                  {item.title}
                  {item.priority === 'high' && !item.completed && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      Importante
                    </Badge>
                  )}
                </h4>
                <p className={`text-sm ${
                  item.completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                }`}>
                  {item.description}
                </p>
              </div>
            </div>

            {!item.completed && (
              <Button size="sm" variant="outline" asChild>
                <Link href={item.action.href || '#'}>
                  {item.action.label}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        ))}

        {isComplete && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
            <h3 className="font-medium text-green-800 dark:text-green-300 mb-1">
              Parabéns! Setup Completo! 🎉
            </h3>
            <p className="text-sm text-green-600 dark:text-green-400 mb-3">
              Sua conta está totalmente configurada e pronta para uso.
            </p>
            <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600">
              Ir para Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}