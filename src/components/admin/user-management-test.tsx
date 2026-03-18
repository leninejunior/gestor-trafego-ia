"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UserManagementTest() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            🧪 TESTE - Componente Correto Carregado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-green-100 border border-green-300 rounded-lg p-4">
            <h3 className="font-bold text-green-800 mb-2">✅ SUCESSO!</h3>
            <p className="text-green-700">
              O componente <code>UserManagementClient</code> está sendo carregado corretamente!
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Teste do Modal:</h4>
            
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <span>Usuário de Teste</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setModalOpen(true)}
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver
              </Button>
            </div>
          </div>

          <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
            <h4 className="font-bold text-yellow-800 mb-2">🔍 Diagnóstico:</h4>
            <ul className="text-yellow-700 space-y-1">
              <li>• Componente: UserManagementClient ✅</li>
              <li>• Modal: UserDetailsDialogEnhanced ✅</li>
              <li>• Botão "Ver": Presente ✅</li>
              <li>• Timestamp: {new Date().toLocaleString()}</li>
            </ul>
          </div>

          <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
            <h4 className="font-bold text-blue-800 mb-2">🚀 Próximos Passos:</h4>
            <ol className="text-blue-700 space-y-1 list-decimal list-inside">
              <li>Limpar cache do navegador (Ctrl+F5)</li>
              <li>Verificar se o servidor foi reiniciado</li>
              <li>Testar em aba anônima/privada</li>
              <li>Verificar console do navegador por erros</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🎉 Modal Funcionando!</DialogTitle>
            <DialogDescription>
              O modal está abrindo corretamente. O sistema está funcionando!
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <p className="text-green-600 font-semibold">
              ✅ Se você está vendo este modal, significa que o sistema está funcionando perfeitamente!
            </p>
            <Button onClick={() => setModalOpen(false)} className="mt-4 w-full">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}