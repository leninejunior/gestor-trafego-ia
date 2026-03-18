'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertTriangle,
  CreditCard,
  ArrowRight,
  Mail
} from 'lucide-react';

interface SubscriptionIntent {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  user_email: string;
  user_name: string;
  organization_name: string;
  plan_name?: string;
  billing_cycle: string;
  created_at: string;
  expires_at: string;
  completed_at?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'bg-yellow-500',
    text: 'Aguardando Pagamento',
    variant: 'secondary' as const
  },
  processing: {
    icon: Clock,
    color: 'bg-blue-500',
    text: 'Processando',
    variant: 'default' as const
  },
  completed: {
    icon: CheckCircle,
    color: 'bg-green-500',
    text: 'Confirmado',
    variant: 'default' as const
  },
  failed: {
    icon: XCircle,
    color: 'bg-red-500',
    text: 'Falhou',
    variant: 'destructive' as const
  },
  expired: {
    icon: AlertTriangle,
    color: 'bg-gray-500',
    text: 'Expirado',
    variant: 'secondary' as const
  }
};

export default function CheckoutStatusSearchPage() {
  const router = useRouter();
  const [searchType, setSearchType] = useState<'email' | 'cpf'>('email');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SubscriptionIntent[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchValue.trim()) {
      setError('Por favor, informe um email ou CPF válido');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const params = new URLSearchParams({
        [searchType]: searchValue.trim()
      });

      const response = await fetch(`/api/subscriptions/status/public?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar pagamentos');
      }
      
      const data = await response.json();
      setResults(data.intents || []);
      
      if (data.intents.length === 0) {
        setError('Nenhum pagamento encontrado com os dados informados');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleInputChange = (value: string) => {
    if (searchType === 'cpf') {
      setSearchValue(formatCPF(value));
    } else {
      setSearchValue(value);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Consultar Status de Pagamento
          </h1>
          <p className="text-gray-600">
            Informe seu email ou CPF para consultar o status dos seus pagamentos
          </p>
        </div>

        {/* Formulário de Busca */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Pagamentos
            </CardTitle>
            <CardDescription>
              Escolha o tipo de busca e informe os dados para consultar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              {/* Tipo de Busca */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={searchType === 'email' ? 'default' : 'outline'}
                  onClick={() => {
                    setSearchType('email');
                    setSearchValue('');
                    setError(null);
                  }}
                  className="flex-1"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Por Email
                </Button>
                <Button
                  type="button"
                  variant={searchType === 'cpf' ? 'default' : 'outline'}
                  onClick={() => {
                    setSearchType('cpf');
                    setSearchValue('');
                    setError(null);
                  }}
                  className="flex-1"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Por CPF
                </Button>
              </div>

              {/* Campo de Busca */}
              <div>
                <Label htmlFor="search">
                  {searchType === 'email' ? 'Email' : 'CPF'}
                </Label>
                <Input
                  id="search"
                  type={searchType === 'email' ? 'email' : 'text'}
                  placeholder={
                    searchType === 'email' 
                      ? 'seu@email.com' 
                      : '000.000.000-00'
                  }
                  value={searchValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  maxLength={searchType === 'cpf' ? 14 : undefined}
                  required
                />
              </div>

              {/* Botão de Busca */}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar Pagamentos
                  </>
                )}
              </Button>
            </form>

            {/* Erro */}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Pagamentos Encontrados ({results.length})
            </h2>
            
            {results.map((intent) => {
              const config = statusConfig[intent.status];
              const StatusIcon = config.icon;
              
              return (
                <Card key={intent.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge variant={config.variant} className="flex items-center gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {config.text}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {new Date(intent.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-500">Nome</p>
                            <p className="font-medium">{intent.user_name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Organização</p>
                            <p className="font-medium">{intent.organization_name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Plano</p>
                            <p className="font-medium">
                              {intent.plan_name || 'Plano Selecionado'} - {intent.billing_cycle}
                            </p>
                          </div>
                          {intent.completed_at && (
                            <div>
                              <p className="text-sm text-gray-500">Concluído em</p>
                              <p className="font-medium">
                                {new Date(intent.completed_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => router.push(`/checkout/status/${intent.id}`)}
                        variant="outline"
                        size="sm"
                      >
                        Ver Detalhes
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Informações Adicionais */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Precisa de Ajuda?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Status dos Pagamentos</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>Aguardando:</strong> Pagamento ainda não processado</li>
                  <li>• <strong>Processando:</strong> Confirmando o pagamento</li>
                  <li>• <strong>Confirmado:</strong> Pagamento aprovado e assinatura ativa</li>
                  <li>• <strong>Falhou:</strong> Problema com o pagamento</li>
                  <li>• <strong>Expirado:</strong> Link de pagamento vencido</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Dúvidas Frequentes</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Pagamentos podem levar até 24h para processar</li>
                  <li>• Você receberá email de confirmação quando aprovado</li>
                  <li>• Links de pagamento expiram em 7 dias</li>
                  <li>• Entre em contato se precisar de ajuda</li>
                </ul>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button 
                onClick={() => router.push('/checkout')}
                variant="outline"
                className="w-full"
              >
                Fazer Novo Checkout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}