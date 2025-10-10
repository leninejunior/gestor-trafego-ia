"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Eye, Loader2, AlertCircle } from "lucide-react";

interface Client {
  id: string;
  name: string;
  created_at: string;
}

export function ClientsListDynamic() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClients() {
      try {
        const response = await fetch('/api/clients');
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Dados recebidos da API:', data);
        setClients(data.clients || []);
      } catch (err: any) {
        console.error('❌ Erro ao carregar clientes:', err);
        setError(err.message || 'Erro ao carregar clientes');
      } finally {
        setLoading(false);
      }
    }

    loadClients();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Lista de Clientes</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Carregando clientes...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Lista de Clientes</h2>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Erro ao carregar clientes
                </h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="mt-2 text-xs text-red-600">
                  <p><strong>Possíveis soluções:</strong></p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Verifique se você tem uma organização</li>
                    <li>Tente fazer logout e login novamente</li>
                    <li>Verifique o console do navegador (F12)</li>
                  </ul>
                </div>
                <div className="mt-3 space-x-2">
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    size="sm"
                  >
                    Tentar novamente
                  </Button>
                  <Button
                    onClick={() => window.open('/dashboard/team', '_blank')}
                    variant="outline"
                    size="sm"
                  >
                    Ver Organização
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Lista de Clientes ({clients.length})
        </h2>
      </div>
      
      {clients.length > 0 ? (
        <div className="divide-y divide-gray-200">
          {clients.map((client) => (
            <div key={client.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{client.name}</h3>
                  <p className="text-sm text-gray-500">
                    Criado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    ID: {client.id.slice(0, 8)}...
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">Sem conexões</Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/clients/${client.id}`}>
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Detalhes
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Eye className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente encontrado</h3>
          <p className="text-gray-500 mb-6">
            Comece adicionando seu primeiro cliente para gerenciar campanhas de anúncios.
          </p>
        </div>
      )}
    </div>
  );
}