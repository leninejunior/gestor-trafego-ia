/**
 * Google Ads Account Selection Page
 * 
 * Allows users to select which Google Ads accounts to connect
 * Requirements: 1.4, 1.5
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface GoogleAdsAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  canManageClients: boolean;
}

function SelectAccountsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectionId = searchParams.get('connectionId');
  const clientId = searchParams.get('clientId');

  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connectionId || !clientId) {
      setError('Parâmetros inválidos');
      setLoading(false);
      return;
    }

    fetchAvailableAccounts();
  }, [connectionId, clientId]);

  const fetchAvailableAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/google/accounts?connectionId=${connectionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar contas');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);

      // Auto-select the first account if only one is available
      if (data.accounts && data.accounts.length === 1) {
        setSelectedAccounts([data.accounts[0].customerId]);
      }

    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountToggle = (customerId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSaveSelection = async () => {
    if (selectedAccounts.length === 0) {
      setError('Selecione pelo menos uma conta');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/google/accounts/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId,
          clientId,
          selectedAccounts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar seleção');
      }

      const data = await response.json();
      
      // Redirect to success page
      router.push(`/dashboard/google?success=connected&accounts=${selectedAccounts.length}`);

    } catch (err) {
      console.error('Error saving selection:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar seleção');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard?cancelled=google_connection');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando contas do Google Ads...</p>
        </div>
      </div>
    );
  }

  if (error && accounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Erro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <Button onClick={fetchAvailableAccounts} variant="outline" size="sm">
                Tentar Novamente
              </Button>
              <Button onClick={handleCancel} variant="ghost" size="sm">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Selecionar Contas do Google Ads</h1>
          <p className="text-muted-foreground">
            Escolha quais contas do Google Ads você deseja conectar a este cliente.
          </p>
        </div>

        {error && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {accounts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma conta encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Não foi possível encontrar contas do Google Ads acessíveis com esta autorização.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={fetchAvailableAccounts} variant="outline">
                    Tentar Novamente
                  </Button>
                  <Button onClick={handleCancel} variant="ghost">
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {accounts.map((account) => (
                <Card key={account.customerId} className="cursor-pointer hover:bg-accent/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={account.customerId}
                        checked={selectedAccounts.includes(account.customerId)}
                        onCheckedChange={() => handleAccountToggle(account.customerId)}
                      />
                      <div className="flex-1">
                        <label 
                          htmlFor={account.customerId}
                          className="cursor-pointer block"
                        >
                          <div className="font-medium">{account.descriptiveName}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {account.customerId}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {account.currencyCode} • {account.timeZone}
                            {account.canManageClients && ' • Conta gerencial'}
                          </div>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={handleSaveSelection}
                disabled={selectedAccounts.length === 0 || saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Conectar {selectedAccounts.length} conta{selectedAccounts.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
              <Button 
                onClick={handleCancel}
                variant="outline"
                disabled={saving}
              >
                Cancelar
              </Button>
            </div>

            {selectedAccounts.length > 0 && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Contas selecionadas:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selectedAccounts.map(customerId => {
                    const account = accounts.find(a => a.customerId === customerId);
                    return (
                      <li key={customerId}>
                        • {account?.descriptiveName} ({customerId})
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SelectAccountsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    }>
      <SelectAccountsContent />
    </Suspense>
  );
}