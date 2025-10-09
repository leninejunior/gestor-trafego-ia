"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DebugPage() {
  const [debugData, setDebugData] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [connectionId, setConnectionId] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/user-data');
      const data = await response.json();
      setDebugData(data);
    } catch (error) {
      console.error('Erro ao buscar debug data:', error);
    } finally {
      setLoading(false);
    }
  };

  const testPermissions = async () => {
    if (!connectionId) {
      alert('Digite um Connection ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/debug/test-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          testType: 'check-permissions'
        })
      });
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      console.error('Erro ao testar permissões:', error);
    } finally {
      setLoading(false);
    }
  };

  const simulateDelete = async () => {
    if (!connectionId) {
      alert('Digite um Connection ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/debug/test-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          testType: 'simulate-delete'
        })
      });
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      console.error('Erro ao simular delete:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Debug - Operações DELETE</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>1. Dados do Usuário</CardTitle>
          <CardDescription>
            Verificar estrutura de dados e relacionamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchDebugData} disabled={loading}>
            {loading ? "Carregando..." : "Buscar Dados do Usuário"}
          </Button>
          
          {debugData && (
            <div className="mt-4">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                {JSON.stringify(debugData, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Testar Operações DELETE</CardTitle>
          <CardDescription>
            Testar permissões e operações sem realmente deletar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="connectionId">Connection ID</Label>
            <Input
              id="connectionId"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              placeholder="Digite o ID da conexão para testar"
            />
          </div>
          
          <div className="flex space-x-2">
            <Button onClick={testPermissions} disabled={loading || !connectionId}>
              Testar Permissões
            </Button>
            <Button onClick={simulateDelete} disabled={loading || !connectionId} variant="outline">
              Simular DELETE
            </Button>
          </div>
          
          {testResult && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Resultado do Teste:</h4>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Instruções</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Primeiro, clique em "Buscar Dados do Usuário" para ver sua estrutura de dados</li>
            <li>Copie um Connection ID das conexões listadas</li>
            <li>Cole o ID no campo acima e teste as permissões</li>
            <li>Se as permissões estiverem OK, o DELETE real deve funcionar</li>
            <li>Se houver erro, verifique se as políticas RLS foram aplicadas no Supabase</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}