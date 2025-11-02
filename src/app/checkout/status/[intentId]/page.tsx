'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  CreditCard,
  Mail,
  ArrowRight
} from 'lucide-react';

interface SubscriptionIntent {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  user_email: string;
  user_name: string;
  organization_name: string;
  plan_name?: string;
  billing_cycle: string;
  checkout_url?: string;
  created_at: string;
  expires_at: string;
  completed_at?: string;
  error_message?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'bg-yellow-500',
    text: 'Aguardando Pagamento',
    description: 'Seu pagamento está sendo processado',
    progress: 25
  },
  processing: {
    icon: RefreshCw,
    color: 'bg-blue-500',
    text: 'Processando',
    description: 'Confirmando seu pagamento',
    progress: 75
  },
  completed: {
    icon: CheckCircle,
    color: 'bg-green-500',
    text: 'Pagamento Confirmado',
    description: 'Sua assinatura foi ativada com sucesso',
    progress: 100
  },
  failed: {
    icon: XCircle,
    color: 'bg-red-500',
    text: 'Pagamento Falhou',
    description: 'Houve um problema com seu pagamento',
    progress: 0
  },
  expired: {
    icon: AlertTriangle,
    color: 'bg-gray-500',
    text: 'Expirado',
    description: 'O link de pagamento expirou',
    progress: 0
  }
};

export default function CheckoutStatusPage() {
  const params = useParams();
  const router = useRouter();
  const intentId = params.intentId as string;
  
  const [intent, setIntent] = useState<SubscriptionIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/subscriptions/status/${intentId}`);
      
      if (!response.ok) {
        throw new Error('Falha ao buscar status do pagamento');
      }
      
      const data = await response.json();
      setIntent(data.intent);
      
      // Para de fazer polling se o status for final
      if (['completed', 'failed', 'expired'].includes(data.intent.status)) {
        setPolling(false);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setPolling(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [intentId]);

  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(fetchStatus, 3000); // Poll a cada 3 segundos
    return () => clearInterval(interval);
  }, [polling, intentId]);

  const handleRetryPayment = async () => {
    try {
      const response = await fetch(`/api/subscriptions/recovery/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent_id: intentId })
      });
      
      if (!response.ok) {
        throw new Error('Falha ao gerar nova cobrança');
      }
      
      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao tentar novamente');
    }
  };

  const handleResendEmail = async () => {
    try {
      const response = await fetch(`/api/subscriptions/recovery/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent_id: intentId })
      });
      
      if (!response.ok) {
        throw new Error('Falha ao reenviar email');
      }
      
      alert('Email reenviado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reenviar email');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Carregando status do pagamento...</p>
        </div>
      </div>
    );
  }

  if (error || !intent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Erro</CardTitle>
            <CardDescription>
              {error || 'Não foi possível encontrar informações sobre este pagamento'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/checkout')} 
              className="w-full"
            >
              Voltar ao Checkout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = statusConfig[intent.status];
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header com Status */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className={`w-16 h-16 rounded-full ${config.color} flex items-center justify-center mx-auto mb-4`}>
              <StatusIcon className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">{config.text}</CardTitle>
            <CardDescription className="text-lg">
              {config.description}
            </CardDescription>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <Progress value={config.progress} className="h-2" />
              <p className="text-sm text-gray-500 mt-2">
                {config.progress}% concluído
              </p>
            </div>
          </CardHeader>
        </Card>

        {/* Detalhes da Assinatura */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Detalhes da Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Nome</label>
                <p className="font-medium">{intent.user_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="font-medium">{intent.user_email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Organização</label>
                <p className="font-medium">{intent.organization_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Plano</label>
                <p className="font-medium">
                  {intent.plan_name || 'Plano Selecionado'} - {intent.billing_cycle}
                </p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Criado em:</span>
                <span>{new Date(intent.created_at).toLocaleString('pt-BR')}</span>
              </div>
              {intent.completed_at && (
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>Concluído em:</span>
                  <span>{new Date(intent.completed_at).toLocaleString('pt-BR')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>Expira em:</span>
                <span>{new Date(intent.expires_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ações baseadas no Status */}
        {intent.status === 'pending' && (
          <Alert className="mb-6">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Aguardando confirmação do pagamento. Isso pode levar alguns minutos.
              {intent.checkout_url && (
                <Button 
                  variant="link" 
                  className="p-0 h-auto ml-2"
                  onClick={() => window.open(intent.checkout_url, '_blank')}
                >
                  Abrir link de pagamento
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {intent.status === 'processing' && (
          <Alert className="mb-6">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Processando seu pagamento. Por favor, aguarde...
            </AlertDescription>
          </Alert>
        )}

        {intent.status === 'completed' && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Parabéns! Sua assinatura foi ativada com sucesso. 
              Você receberá um email com as instruções de acesso.
            </AlertDescription>
          </Alert>
        )}

        {intent.status === 'failed' && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {intent.error_message || 'Houve um problema com seu pagamento. Tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {intent.status === 'expired' && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              O link de pagamento expirou. Gere um novo link para continuar.
            </AlertDescription>
          </Alert>
        )}

        {/* Botões de Ação */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              {intent.status === 'completed' && (
                <Button 
                  onClick={() => router.push('/dashboard')}
                  className="flex-1"
                >
                  Acessar Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              
              {['failed', 'expired'].includes(intent.status) && (
                <Button 
                  onClick={handleRetryPayment}
                  className="flex-1"
                >
                  Tentar Novamente
                  <RefreshCw className="h-4 w-4 ml-2" />
                </Button>
              )}
              
              {intent.status !== 'completed' && (
                <Button 
                  variant="outline"
                  onClick={handleResendEmail}
                  className="flex-1"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Reenviar Email
                </Button>
              )}
              
              <Button 
                variant="outline"
                onClick={() => router.push('/checkout')}
              >
                Novo Checkout
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Auto-refresh indicator */}
        {polling && (
          <div className="text-center mt-6 text-sm text-gray-500">
            <RefreshCw className="h-4 w-4 inline animate-spin mr-2" />
            Atualizando automaticamente...
          </div>
        )}
      </div>
    </div>
  );
}