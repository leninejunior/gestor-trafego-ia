'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ExternalLink, Settings } from 'lucide-react';
import { GoogleCampaignsList } from './google-campaigns-list';

interface GoogleAdsCardProps {
  clientId: string;
  showCampaigns?: boolean;
}

export function GoogleAdsCard({ clientId, showCampaigns = false }: GoogleAdsCardProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, [clientId]);

  const checkConnection = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/google/connections?clientId=${clientId}`);
      const data = await response.json();

      if (response.ok) {
        const activeConnections = data.connections?.filter((c: any) => c.status === 'active') || [];
        setConnections(activeConnections);
        setIsConnected(activeConnections.length > 0);
      } else {
        setError(data.error || 'Erro ao verificar conexões');
      }
    } catch (err) {
      console.error('Erro ao verificar conexão Google:', err);
      setError('Erro ao verificar conexões');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    if (typeof window !== 'undefined') {
      // Redireciona o usuário para a rota de iniciação do OAuth
      window.location.href = `/api/google/oauth/initiate?clientId=${clientId}`;
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
          
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Verificando conexões...</p>
            </div>
          ) : !isConnected ? (
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
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Conectar Google Ads
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
              <p className="text-gray-500 mb-2">
                {connections.length} conta{connections.length > 1 ? 's' : ''} conectada{connections.length > 1 ? 's' : ''}
              </p>
              {connections.length > 0 && (
                <div className="text-sm text-gray-600 mb-4">
                  {connections.map((conn, index) => (
                    <div key={conn.id} className="py-1">
                      Customer ID: {conn.customer_id}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.location.href = `/dashboard/google?client=${clientId}`}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Ver Campanhas
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleConnect}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Reconectar
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Mostrar lista de campanhas se solicitado e conectado */}
      {showCampaigns && isConnected && connections.length > 0 && (
        <div className="mt-6">
          <GoogleCampaignsList 
            clientId={clientId} 
            connectionId={connections[0].id}
          />
        </div>
      )}
    </Card>
  );
}