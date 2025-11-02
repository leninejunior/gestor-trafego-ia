'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Chrome, 
  AlertCircle, 
  CheckCircle, 
  Settings,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { ConnectGoogleButton } from "./connect-google-button";

interface GoogleConnection {
  id: string;
  customer_id: string;
  status: 'active' | 'expired' | 'revoked';
  last_sync_at: string;
}

interface GoogleAdsCardProps {
  clientId: string;
}

export function GoogleAdsCard({ clientId }: GoogleAdsCardProps) {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkGoogleAdsStatus();
  }, [clientId]);

  const checkGoogleAdsStatus = async () => {
    try {
      setLoading(true);
      
      // Check if Google Ads is configured
      const configResponse = await fetch(`/api/google/auth?clientId=${clientId}`);
      const configData = await configResponse.json();
      
      if (configResponse.status === 503 && !configData.configured) {
        setIsConfigured(false);
        setLoading(false);
        return;
      }
      
      setIsConfigured(true);
      
      // If configured, check for existing connections
      if (configData.connections && configData.connections.length > 0) {
        const activeConnection = configData.connections.find(
          (conn: GoogleConnection) => conn.status === 'active'
        );
        setConnection(activeConnection || configData.connections[0]);
      }
      
    } catch (error) {
      console.error('Error checking Google Ads status:', error);
      setIsConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionUpdate = () => {
    checkGoogleAdsStatus();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Chrome className="w-5 h-5 text-green-600" />
            Google Ads
          </CardTitle>
          <CardDescription>
            Verificando status da integração...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isConfigured === false) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Chrome className="w-5 h-5 text-amber-600" />
            Google Ads
          </CardTitle>
          <CardDescription>
            Integração não configurada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-800 mb-3">
                As credenciais do Google Ads não foram configuradas no sistema. 
                Entre em contato com o administrador para habilitar esta integração.
              </p>
              <div className="text-xs text-amber-700">
                <strong>Credenciais necessárias:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>GOOGLE_CLIENT_ID</li>
                  <li>GOOGLE_CLIENT_SECRET</li>
                  <li>GOOGLE_DEVELOPER_TOKEN</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (connection) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Chrome className="w-5 h-5 text-green-600" />
            Google Ads
          </CardTitle>
          <CardDescription>
            Conta conectada e sincronizada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium text-green-800">
                    Conta Conectada
                  </div>
                  <div className="text-sm text-green-700">
                    ID: {connection.customer_id}
                  </div>
                </div>
              </div>
              <Badge 
                variant={connection.status === 'active' ? 'default' : 'destructive'}
                className={connection.status === 'active' ? 'bg-green-100 text-green-800' : ''}
              >
                {connection.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            
            {connection.last_sync_at && (
              <div className="text-xs text-green-600">
                Última sincronização: {new Date(connection.last_sync_at).toLocaleString('pt-BR')}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/google?client=${clientId}`}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver Campanhas
                </Link>
              </Button>
              <ConnectGoogleButton
                clientId={clientId}
                connection={connection}
                onConnectionUpdate={handleConnectionUpdate}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Chrome className="w-5 h-5 text-green-600" />
          Google Ads
        </CardTitle>
        <CardDescription>
          Conecte sua conta do Google Ads
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-6">
          <Chrome className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">
            Nenhuma conta Google Ads conectada para este cliente.
          </p>
          <ConnectGoogleButton
            clientId={clientId}
            onConnectionUpdate={handleConnectionUpdate}
          />
        </div>
      </CardContent>
    </Card>
  );
}