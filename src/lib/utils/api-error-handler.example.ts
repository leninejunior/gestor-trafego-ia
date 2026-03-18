/**
 * Exemplos de uso do utilitário de tratamento de erros de API
 */

import { handleApiError, extractErrorData, getErrorMessage } from './api-error-handler';
import { toast } from '@/hooks/use-toast';

// ❌ ANTES - Código propenso a erros
async function oldWay() {
  try {
    const response = await fetch('/api/users');
    
    if (!response.ok) {
      const errorData = await response.json(); // Pode falhar
      console.error('❌ Erro da API:', errorData); // errorData pode ser undefined
      
      toast({
        title: "Erro",
        description: errorData.error || "Erro desconhecido", // errorData.error pode ser undefined
        variant: "destructive"
      });
    }
  } catch (error) {
    console.error("Erro:", error);
  }
}

// ✅ DEPOIS - Usando o utilitário (Método 1 - Completo)
async function newWayComplete() {
  try {
    const response = await fetch('/api/users');
    
    if (!response.ok) {
      const { errorData, errorMessage } = await handleApiError(response, "Erro ao carregar usuários");
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    }
  } catch (error) {
    console.error("Erro:", error);
    toast({
      title: "Erro",
      description: "Erro de rede ou servidor",
      variant: "destructive"
    });
  }
}

// ✅ DEPOIS - Usando o utilitário (Método 2 - Granular)
async function newWayGranular() {
  try {
    const response = await fetch('/api/users');
    
    if (!response.ok) {
      const errorData = await extractErrorData(response);
      const errorMessage = getErrorMessage(errorData, {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      }, "Erro ao carregar usuários");
      
      // Log para debug
      console.error('❌ Erro da API:', errorData || 'Dados de erro não disponíveis');
      console.error('📨 Status da resposta:', response.status, response.statusText);
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    }
  } catch (error) {
    console.error("Erro:", error);
  }
}

// ✅ Exemplo com tratamento específico por status
async function handleSpecificErrors() {
  try {
    const response = await fetch('/api/users/123');
    
    if (!response.ok) {
      const { errorData, errorMessage } = await handleApiError(response);
      
      // Tratamento específico por status
      if (response.status === 404) {
        console.log('🔍 Usuário não encontrado - fazendo debug...');
        // Lógica específica para 404
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    }
  } catch (error) {
    console.error("Erro:", error);
  }
}

// ✅ Exemplo em componente React
import { useState } from 'react';

function UserComponent() {
  const [loading, setLoading] = useState(false);
  
  const handleSave = async (userData: any) => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sucesso",
          description: "Usuário criado com sucesso",
          variant: "default"
        });
      } else {
        const { errorMessage } = await handleApiError(response, "Erro ao criar usuário");
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro de rede:", error);
      toast({
        title: "Erro",
        description: "Erro de conexão com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  return null; // Componente de exemplo
}

export { oldWay, newWayComplete, newWayGranular, handleSpecificErrors, UserComponent };