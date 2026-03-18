"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Eye, AlertCircle, Trash2, RefreshCw, Settings } from "lucide-react";

// Usar ícones alternativos que existem
const Loader2 = RefreshCw;
const MoreHorizontal = Settings;
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Client {
  id: string;
  name: string;
  created_at: string;
}

export function ClientsListDynamic() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

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

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    setDeletingId(clientId);
    
    try {
      const response = await fetch(`/api/clients?id=${clientId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Remover cliente da lista local
        setClients(clients.filter(client => client.id !== clientId));
        toast({
          title: "Cliente excluído",
          description: `${data.clientName || clientName} foi excluído com sucesso.`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro ao excluir cliente",
          description: errorData.error || "Ocorreu um erro inesperado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast({
        title: "Erro ao excluir cliente",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

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
            <div key={client.id} className="p-6 hover:bg-muted/50">
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
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/clients/${client.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalhes
                        </Link>
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-600"
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir cliente
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o cliente <strong>{client.name}</strong>? 
                              Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteClient(client.id, client.name)}
                              disabled={deletingId === client.id}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deletingId === client.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Excluindo...
                                </>
                              ) : (
                                'Excluir'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <Eye className="w-12 h-12 text-muted-foreground" />
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