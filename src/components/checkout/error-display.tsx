'use client';

import { useState } from 'react';
import { 
  AlertTriangle, 
  XCircle, 
  Wifi, 
  Server, 
  CreditCard, 
  RefreshCw, 
  ArrowLeft, 
  Mail, 
  ExternalLink,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckoutError, ErrorAction } from '@/lib/checkout/error-handler';

interface ErrorDisplayProps {
  error: CheckoutError;
  onRetry?: () => void | Promise<void>;
  onBack?: () => void;
  className?: string;
}

const errorIcons = {
  validation: AlertTriangle,
  payment: CreditCard,
  network: Wifi,
  server: Server,
  timeout: Clock,
  rate_limit: AlertTriangle
};

const errorColors = {
  validation: 'text-yellow-600',
  payment: 'text-red-600',
  network: 'text-blue-600',
  server: 'text-purple-600',
  timeout: 'text-orange-600',
  rate_limit: 'text-gray-600'
};

const errorBgColors = {
  validation: 'bg-yellow-50 border-yellow-200',
  payment: 'bg-red-50 border-red-200',
  network: 'bg-blue-50 border-blue-200',
  server: 'bg-purple-50 border-purple-200',
  timeout: 'bg-orange-50 border-orange-200',
  rate_limit: 'bg-muted/50 border-border'
};

export function ErrorDisplay({ error, onRetry, onBack, className }: ErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const ErrorIcon = errorIcons[error.type] || XCircle;
  const iconColor = errorColors[error.type] || 'text-red-600';
  const bgColor = errorBgColors[error.type] || 'bg-red-50 border-red-200';

  const handleAction = async (action: ErrorAction) => {
    switch (action.type) {
      case 'retry':
        if (onRetry) {
          setIsRetrying(true);
          try {
            await onRetry();
            setRetryCount(prev => prev + 1);
          } catch (retryError) {
            console.error('Retry failed:', retryError);
          } finally {
            setIsRetrying(false);
          }
        }
        break;
        
      case 'back':
        if (onBack) {
          onBack();
        } else {
          window.history.back();
        }
        break;
        
      case 'redirect':
        if (action.url) {
          window.location.href = action.url;
        }
        break;
        
      case 'refresh':
        window.location.reload();
        break;
        
      case 'contact':
        const subject = encodeURIComponent(`Erro no Checkout - ${error.code}`);
        const body = encodeURIComponent(
          `Olá,\n\nEncontrei um erro durante o checkout:\n\n` +
          `Código: ${error.code}\n` +
          `Mensagem: ${error.message}\n` +
          `Tipo: ${error.type}\n\n` +
          `Por favor, me ajudem a resolver este problema.\n\n` +
          `Obrigado!`
        );
        window.location.href = `mailto:suporte@exemplo.com?subject=${subject}&body=${body}`;
        break;
        
      default:
        if (action.handler) {
          await action.handler();
        }
    }
  };

  return (
    <Card className={`${bgColor} ${className}`}>
      <CardHeader className="text-center pb-4">
        <div className={`w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-sm`}>
          <ErrorIcon className={`h-8 w-8 ${iconColor}`} />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <CardTitle className="text-lg">Ops! Algo deu errado</CardTitle>
            <Badge variant="outline" className="text-xs">
              {error.type}
            </Badge>
          </div>
          
          <CardDescription className="text-base">
            {error.userMessage}
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error Details */}
        <Alert className="bg-white/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Detalhes técnicos:</strong> {error.message}
            {retryCount > 0 && (
              <span className="block mt-1 text-xs text-gray-500">
                Tentativas realizadas: {retryCount}
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* Recovery Actions */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 mb-3">
            O que você pode fazer:
          </p>
          
          {error.actions.map((action, index) => {
            const isRetryAction = action.type === 'retry';
            const disabled = isRetryAction && isRetrying;
            
            return (
              <Button
                key={index}
                onClick={() => handleAction(action)}
                variant={action.primary ? 'default' : 'outline'}
                className="w-full justify-start"
                disabled={disabled}
              >
                {isRetryAction && isRetrying ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ActionIcon actionType={action.type} className="h-4 w-4 mr-2" />
                )}
                {disabled ? 'Tentando...' : action.label}
                {action.type === 'redirect' && <ExternalLink className="h-3 w-3 ml-auto" />}
              </Button>
            );
          })}
        </div>

        {/* Additional Help */}
        {error.recoverable && (
          <div className="pt-4 border-t border-white/50">
            <div className="bg-white/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                💡 Dicas para resolver:
              </h4>
              <ul className="text-xs text-gray-600 space-y-1">
                {getHelpTips(error.type).map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Error Code */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Código do erro: <code className="bg-white/50 px-1 rounded">{error.code}</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionIcon({ actionType, className }: { actionType: string; className?: string }) {
  switch (actionType) {
    case 'retry':
      return <RefreshCw className={className} />;
    case 'back':
      return <ArrowLeft className={className} />;
    case 'contact':
      return <Mail className={className} />;
    case 'refresh':
      return <RefreshCw className={className} />;
    case 'redirect':
      return <ExternalLink className={className} />;
    default:
      return <AlertTriangle className={className} />;
  }
}

function getHelpTips(errorType: string): string[] {
  switch (errorType) {
    case 'network':
      return [
        'Verifique sua conexão com a internet',
        'Tente desabilitar VPN ou proxy',
        'Aguarde alguns segundos e tente novamente'
      ];
    case 'payment':
      return [
        'Verifique os dados do cartão',
        'Confirme se há saldo disponível',
        'Tente outro método de pagamento'
      ];
    case 'validation':
      return [
        'Verifique se todos os campos estão preenchidos',
        'Confirme se o email está correto',
        'Certifique-se de que os dados estão válidos'
      ];
    case 'server':
      return [
        'Aguarde alguns minutos e tente novamente',
        'Nosso time foi notificado automaticamente',
        'Entre em contato se o problema persistir'
      ];
    case 'timeout':
      return [
        'Sua conexão pode estar lenta',
        'Tente novamente em alguns segundos',
        'Verifique se não há outros downloads ativos'
      ];
    case 'rate_limit':
      return [
        'Aguarde alguns minutos antes de tentar novamente',
        'Evite múltiplas tentativas seguidas',
        'Entre em contato se precisar de ajuda urgente'
      ];
    default:
      return [
        'Tente recarregar a página',
        'Verifique sua conexão',
        'Entre em contato com o suporte se necessário'
      ];
  }
}