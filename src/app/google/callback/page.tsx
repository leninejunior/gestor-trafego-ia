/**
 * Página de callback para Google OAuth
 * Alternativa ao callback API que está sendo interceptado
 */

'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function GoogleCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    console.log('[Google Callback Page] 🔄 CALLBACK PÁGINA EXECUTADO');
    
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');
    
    console.log('[Google Callback Page] - Code:', !!code);
    console.log('[Google Callback Page] - Error:', error);
    console.log('[Google Callback Page] - State:', state);
    
    // Redirecionar para página de seleção de contas
    const redirectUrl = error 
      ? `/google/select-accounts?error=oauth_error&message=${encodeURIComponent(error)}`
      : `/google/select-accounts?code=${code}&state=${state}`;
    
    console.log('[Google Callback Page] 🔄 REDIRECIONANDO PARA:', redirectUrl);
    
    // Usar router.push para navegação client-side
    router.push(redirectUrl);
    
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          🔄 Processando OAuth...
        </h2>
        <p className="text-gray-600">
          Redirecionando automaticamente...
        </p>
      </div>
    </div>
  );
}


export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Carregando...
          </h2>
        </div>
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
