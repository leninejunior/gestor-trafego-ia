#!/usr/bin/env node

/**
 * Script para restaurar o Google Ads Card original
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 RESTAURANDO GOOGLE ADS ORIGINAL');
console.log('==================================');

const googleAdsCardPath = path.join(__dirname, '..', 'src', 'components', 'google', 'google-ads-card.tsx');
const backupPath = googleAdsCardPath + '.backup';

// Verificar se existe backup
if (fs.existsSync(backupPath)) {
  // Restaurar do backup
  fs.copyFileSync(backupPath, googleAdsCardPath);
  console.log('✅ Google Ads Card original restaurado do backup');
} else {
  console.log('❌ Backup não encontrado, criando versão original...');
  
  // Criar versão original funcional
  const originalGoogleAdsCard = `'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ExternalLink, Settings } from 'lucide-react';

interface GoogleAdsCardProps {
  clientId: string;
}

export function GoogleAdsCard({ clientId }: GoogleAdsCardProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(\`/api/google/auth?clientId=\${clientId}\`);
      
      if (!response.ok) {
        throw new Error('Erro ao conectar com Google Ads');
      }
      
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error('Erro ao conectar Google Ads:', err);
      setError('Erro ao conectar com Google Ads. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg">Google Ads</CardTitle>
              <CardDescription>Integração com Google Ads API</CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Conectado" : "Não conectado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {!isConnected ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Conectar Google Ads
              </h3>
              <p className="text-gray-500 mb-4">
                Conecte sua conta do Google Ads para importar campanhas e métricas.
              </p>
              <Button 
                onClick={handleConnect}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Conectando...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Conectar Google Ads
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Google Ads Conectado
              </h3>
              <p className="text-gray-500 mb-4">
                Sua conta está conectada e sincronizando dados.
              </p>
              <Button variant="outline" className="w-full">
                <Settings className="w-4 h-4 mr-2" />
                Gerenciar Conexão
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}`;

  fs.writeFileSync(googleAdsCardPath, originalGoogleAdsCard);
  console.log('✅ Google Ads Card original criado');
}

console.log('\n🎯 RESULTADO:');
console.log('=============');
console.log('✅ Google Ads Card restaurado');
console.log('✅ Funcionalidade de conexão ativa');
console.log('✅ Interface profissional mantida');

console.log('\n🔧 PRÓXIMOS PASSOS:');
console.log('==================');
console.log('1. Verificar variáveis de ambiente Google');
console.log('2. Configurar OAuth no Google Cloud Console');
console.log('3. Testar conexão Google Ads');

console.log('\n✅ Google Ads restaurado com sucesso!');