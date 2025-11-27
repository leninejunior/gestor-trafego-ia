'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

// Forçar renderização dinâmica (não fazer pre-render estático)
export const dynamic = 'force-dynamic';

/**
 * Componente interno que usa useSearchParams
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    console.log('='.repeat(100));
    console.log('[Google Callback Handler] 🔄 PROCESSANDO CALLBACK');
    console.log('[Google Callback Handler] Timestamp:', new Date().toISOString());
    
    // Obter parâmetros da URL
    const connectionId = searchParams.get('connectionId');
    const clientId = searchParams.get('clientId');
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const message = searchParams.get('message');
    
    console.log('[Google Callback Handler] 📊 PARÂMETROS RECEBIDOS:');
    console.log('[Google Callback Handler] - Connection ID:', connectionId);
    console.log('[Google Callback Handler] - Client ID:', clientId);
    console.log('[Google Callback Handler] - Success:', success);
    console.log('[Google Callback Handler] - Error:', error);
    console.log('[Google Callback Handler] - Message:', message);
    
    // Se houve erro, redirecionar direto
    if (error) {
      console.log('[Google Callback Handler] ❌ ERRO DETECTADO, REDIRECIONANDO');
      const redirectUrl = new URL('/google/select-accounts', window.location.origin);
      redirectUrl.searchParams.set('error', error);
      if (message) redirectUrl.searchParams.set('message', message);
      router.push(redirectUrl.toString());
      return;
    }
    
    // Se temos os parâmetros, armazenar em cookies e session storage
    if (connectionId && clientId) {
      console.log('[Google Callback Handler] ✅ PARÂMETROS VÁLIDOS ENCONTRADOS');
      
      // Armazenar em session storage
      try {
        sessionStorage.setItem('google_connectionId', connectionId);
        sessionStorage.setItem('google_clientId', clientId);
        console.log('[Google Callback Handler] 💾 DADOS SALVOS EM SESSION STORAGE');
      } catch (e) {
        console.warn('[Google Callback Handler] ⚠️ Erro ao salvar em session storage:', e);
      }
      
      // Armazenar em localStorage também como backup
      try {
        localStorage.setItem('google_connectionId_backup', connectionId);
        localStorage.setItem('google_clientId_backup', clientId);
        console.log('[Google Callback Handler] 💾 DADOS SALVOS EM LOCAL STORAGE (BACKUP)');
      } catch (e) {
        console.warn('[Google Callback Handler] ⚠️ Erro ao salvar em local storage:', e);
      }
      
      // Redirecionar para select-accounts com os parâmetros
      const redirectUrl = new URL('/google/select-accounts', window.location.origin);
      redirectUrl.searchParams.set('connectionId', connectionId);
      redirectUrl.searchParams.set('clientId', clientId);
      redirectUrl.searchParams.set('success', success || 'oauth_complete');
      
      console.log('[Google Callback Handler] 🎯 REDIRECIONANDO PARA SELECT ACCOUNTS');
      console.log('[Google Callback Handler] - URL:', redirectUrl.toString());
      console.log('='.repeat(100));
      
      router.push(redirectUrl.toString());
    } else {
      console.log('[Google Callback Handler] ⚠️ PARÂMETROS INCOMPLETOS');
      console.log('[Google Callback Handler] - Connection ID:', connectionId);
      console.log('[Google Callback Handler] - Client ID:', clientId);
      
      // Tentar recuperar do session storage
      try {
        const storedConnectionId = sessionStorage.getItem('google_connectionId');
        const storedClientId = sessionStorage.getItem('google_clientId');
        
        if (storedConnectionId && storedClientId) {
          console.log('[Google Callback Handler] ✅ RECUPERADOS DO SESSION STORAGE');
          const redirectUrl = new URL('/google/select-accounts', window.location.origin);
          redirectUrl.searchParams.set('connectionId', storedConnectionId);
          redirectUrl.searchParams.set('clientId', storedClientId);
          router.push(redirectUrl.toString());
          return;
        }
      } catch (e) {
        console.warn('[Google Callback Handler] ⚠️ Erro ao recuperar do session storage:', e);
      }
      
      // Se nada funcionou, redirecionar com erro
      const redirectUrl = new URL('/google/select-accounts', window.location.origin);
      redirectUrl.searchParams.set('error', 'missing_params');
      redirectUrl.searchParams.set('message', 'Parâmetros de callback não encontrados');
      router.push(redirectUrl.toString());
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Processando autenticação do Google...</p>
      </div>
    </div>
  );
}

/**
 * Página intermediária para garantir que os parâmetros do callback
 * sejam capturados e armazenados corretamente antes de redirecionar
 */
export default function CallbackHandlerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
