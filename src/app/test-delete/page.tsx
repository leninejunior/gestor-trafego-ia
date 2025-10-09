"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TestDeletePage() {
  const [connectionId, setConnectionId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testConnection = async (confirmDelete = false) => {
    if (!connectionId.trim()) {
      alert('Digite um Connection ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/test/delete-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connectionId.trim(),
          confirmDelete
        })
      });

      const data = await response.json();
      setResult(data);
      
      if (data.success && confirmDelete) {
        // Limpar o campo após delete bem-sucedido
        setConnectionId("");
      }
    } catch (error) {
      console.error('Erro no teste:', error);
      setResult({
        success: false,
        error: 'Erro de rede',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/user-data');
      const data = await response.json();
      
      if (data.success && data.debug.connections.data) {
        const connections = data.debug.connections.data;
        if (connections.length > 0) {
          // Pegar o primeiro connection ID
          setConnectionId(connections[0].id);
          setResult({
            success: true,
            action: 'list',
            message: `Encontradas ${connections.length} conexões`,
            connections: connections.map((conn: any) => ({
              id: conn.id,
              account_name: conn.account_name,
              client_name: conn.clients?.name
            }))
          });
        } else {
          setResult({
            success: false,
            error: 'Nenhuma conexão encontrada para testar'
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar conexões:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🧪 Teste DELETE Conexão</h1>
        <div className="text-sm text-gray-500">
          Ambiente: DEV
        </div>
      </div>
      
      <Alert>
        <AlertDescription>
          <strong>⚠️ ATENÇÃO:</strong> Este é um teste real que pode deletar dados. 
          Use apenas em ambiente de desenvolvimento!
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>1. Buscar Conexões Existentes</CardTitle>
          <CardDescription>
            Primeiro, vamos ver quais conexões existem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchConnections} disabled={loading}>
            {loading ? "Buscando..." : "Listar Conexões"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Testar DELETE</CardTitle>
          <CardDescription>
            Digite o ID de uma conexão para testar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="connectionId">Connection ID</Label>
            <Input
              id="connectionId"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              placeholder="UUID da conexão"
              className="font-mono text-sm"
            />
          </div>
          
          <div className="flex space-x-2">
            <Button 
              onClick={() => testConnection(false)} 
              disabled={loading || !connectionId.trim()}
              variant="outline"
            >
              1. Verificar Conexão
            </Button>
            <Button 
              onClick={() => testConnection(true)} 
              disabled={loading || !connectionId.trim()}
              variant="destructive"
            >
              2. 🗑️ DELETAR (REAL)
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              Resultado: {result.success ? '✅ Sucesso' : '❌ Erro'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
            
            {result.success && result.action === 'info' && (
              <Alert className="mt-4">
                <AlertDescription>
                  <strong>Conexão encontrada!</strong> Clique em "DELETAR (REAL)" para executar o DELETE.
                </AlertDescription>
              </Alert>
            )}
            
            {result.success && result.action === 'deleted' && (
              <Alert className="mt-4">
                <AlertDescription>
                  <strong>🎉 DELETE executado com sucesso!</strong> 
                  {result.verification?.stillExists ? 
                    ' ⚠️ Mas a conexão ainda existe no banco.' : 
                    ' ✅ Conexão removida do banco.'
                  }
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Clique em "Listar Conexões" para ver conexões disponíveis</li>
            <li>Copie um Connection ID ou use o que foi preenchido automaticamente</li>
            <li>Clique em "Verificar Conexão" para testar permissões</li>
            <li>Se tudo estiver OK, clique em "DELETAR (REAL)" para executar</li>
            <li>Verifique o resultado para confirmar se funcionou</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}