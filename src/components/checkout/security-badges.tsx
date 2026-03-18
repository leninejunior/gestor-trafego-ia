'use client';

import { Shield, Lock, CheckCircle, CreditCard, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function SecurityBadges() {
  const securityFeatures = [
    {
      icon: Shield,
      title: 'Pagamento Seguro',
      description: 'Criptografia SSL 256-bit'
    },
    {
      icon: Lock,
      title: 'Dados Protegidos',
      description: 'LGPD Compliance'
    },
    {
      icon: CheckCircle,
      title: 'Verificado',
      description: 'Empresa certificada'
    },
    {
      icon: CreditCard,
      title: 'Múltiplas Formas',
      description: 'Cartão, PIX, Boleto'
    }
  ];

  return (
    <Card className="bg-green-50 border-green-200">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-green-600" />
          <h3 className="font-medium text-green-900">Checkout Seguro</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {securityFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-900">{feature.title}</p>
                  <p className="text-xs text-green-700">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-3 border-t border-green-200">
          <div className="flex items-center justify-center gap-4 text-xs text-green-700">
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              <span>Processado por Iugu</span>
            </div>
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              <span>SSL Certificado</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrustIndicators() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>Cancelamento gratuito a qualquer momento</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>Suporte técnico especializado</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>Acesso imediato após confirmação</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>Dados protegidos pela LGPD</span>
      </div>
    </div>
  );
}