'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Forçar renderização dinâmica (não fazer pre-render estático)
export const dynamic = 'force-dynamic';

function CallbackDebugContent() {
  const searchParams = useSearchParams();
  const [allParams, setAllParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    setAllParams(params);
    
    console.log('🔍 [Callback Debug] Parâmetros recebidos:', params);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔍 Google Callback Debug</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Parâmetros da URL</h2>
          <div className="space-y-2">
            {Object.keys(allParams).length === 0 ? (
              <p className="text-gray-500">Nenhum parâmetro encontrado</p>
            ) : (
              Object.entries(allParams).map(([key, value]) => (
                <div key={key} className="flex gap-4 border-b pb-2">
                  <span className="font-mono font-bold text-blue-600">{key}:</span>
                  <span className="font-mono text-sm break-all">{value}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📋 Checklist</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {allParams.connectionId ? '✅' : '❌'}
              <span>connectionId presente</span>
              {allParams.connectionId && (
                <span className="text-xs text-gray-500">({allParams.connectionId})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {allParams.clientId ? '✅' : '❌'}
              <span>clientId presente</span>
              {allParams.clientId && (
                <span className="text-xs text-gray-500">({allParams.clientId})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {allParams.success ? '✅' : '❌'}
              <span>success presente</span>
            </div>
            <div className="flex items-center gap-2">
              {allParams.error ? '⚠️' : '✅'}
              <span>Sem erros</span>
              {allParams.error && (
                <span className="text-xs text-red-500">({allParams.error})</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">🔗 URL Completa</h2>
          <code className="block bg-gray-100 p-4 rounded text-xs break-all">
            {typeof window !== 'undefined' ? window.location.href : 'Carregando...'}
          </code>
        </div>

        <div className="mt-6 flex gap-4">
          <a
            href="/google/select-accounts"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Ir para Select Accounts (sem params)
          </a>
          {allParams.connectionId && allParams.clientId && (
            <a
              href={`/google/select-accounts?connectionId=${allParams.connectionId}&clientId=${allParams.clientId}`}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Ir para Select Accounts (com params)
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GoogleCallbackDebugPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <CallbackDebugContent />
    </Suspense>
  );
}