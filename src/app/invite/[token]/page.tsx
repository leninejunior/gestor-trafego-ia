'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  async function handleAcceptInvite() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/organization/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token }),
      });

      if (!response.ok) {
        const errorResponse = await response.json();
        throw new Error(errorResponse.error || 'Failed to accept invite');
      }

      setAccepted(true);
      toast({
        title: 'Sucesso!',
        description: 'Voce foi adicionado a organizacao',
      });

      // Redirecionar para dashboard apos 2 segundos
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (caughtError: any) {
      console.error('Error accepting invite:', caughtError);
      setError(caughtError.message || 'Falha ao aceitar convite');
      toast({
        title: 'Erro',
        description: caughtError.message || 'Falha ao aceitar convite',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Convite aceito!</CardTitle>
            <CardDescription>Voce foi adicionado a organizacao com sucesso</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">Redirecionando para o dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Erro ao aceitar convite</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">O convite pode estar expirado ou invalido.</p>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Ir para dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Convite para organizacao</CardTitle>
          <CardDescription>Voce foi convidado para participar de uma organizacao</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Clique no botao abaixo para aceitar o convite e comecar a colaborar.
          </p>
          <Button onClick={handleAcceptInvite} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aceitar convite
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
