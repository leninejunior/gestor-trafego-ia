/**
 * Utilitário para tratamento padronizado de erros de API
 */

export interface ApiErrorData {
  error?: string;
  message?: string;
  suggestion?: string;
  details?: any;
}

export interface ApiErrorResponse {
  status: number;
  statusText: string;
  data?: ApiErrorData;
}

/**
 * Extrai dados de erro de uma resposta de API de forma segura
 */
export async function extractErrorData(response: Response): Promise<ApiErrorData> {
  let errorData: ApiErrorData = {};
  let responseText = '';
  
  try {
    // Primeiro, tentar ler como texto para debug
    responseText = await response.text();
    
    // Tentar fazer parse como JSON
    if (responseText.trim()) {
      errorData = JSON.parse(responseText);
    } else {
      errorData = { error: 'Resposta vazia do servidor' };
    }
  } catch (parseError) {
    console.error('❌ Erro ao fazer parse da resposta:', parseError);
    console.error('📨 Resposta bruta que falhou:', responseText);
    
    errorData = { 
      error: `Erro HTTP ${response.status}: ${response.statusText}`,
      details: {
        rawResponse: responseText,
        parseError: parseError instanceof Error ? parseError.message : 'Erro desconhecido'
      }
    };
  }
  
  return errorData;
}

/**
 * Gera uma mensagem de erro amigável baseada nos dados de erro
 */
export function getErrorMessage(
  errorData: ApiErrorData | null | undefined, 
  response: ApiErrorResponse,
  defaultMessage: string = 'Erro interno do servidor'
): string {
  let errorMessage = defaultMessage;
  
  if (errorData?.error) {
    errorMessage = errorData.error;
  } else if (errorData?.message) {
    errorMessage = errorData.message;
  } else if (response.status === 404) {
    errorMessage = 'Recurso não encontrado';
  } else if (response.status === 403) {
    errorMessage = 'Acesso negado';
  } else if (response.status === 401) {
    errorMessage = 'Não autorizado';
  } else if (response.status === 500) {
    errorMessage = 'Erro interno do servidor';
  } else {
    errorMessage = `Erro ${response.status}: ${response.statusText}`;
  }
  
  // Adicionar sugestão se disponível
  if (errorData?.suggestion) {
    errorMessage += `\n\n💡 ${errorData.suggestion}`;
  }
  
  return errorMessage;
}

/**
 * Trata erro de API de forma padronizada
 */
export async function handleApiError(
  response: Response,
  defaultMessage: string = 'Erro interno do servidor'
): Promise<{
  errorData: ApiErrorData;
  errorMessage: string;
}> {
  const errorData = await extractErrorData(response);
  const errorMessage = getErrorMessage(errorData, {
    status: response.status,
    statusText: response.statusText,
    data: errorData
  }, defaultMessage);
  
  // Log para debug
  console.error('❌ Erro da API:', errorData || 'Dados de erro não disponíveis');
  console.error('📨 Status da resposta:', response.status, response.statusText);
  
  return { errorData, errorMessage };
}

/**
 * Acesso seguro a propriedades de errorData
 */
export function safeErrorAccess(errorData: any): ApiErrorData {
  if (!errorData || typeof errorData !== 'object') {
    return {};
  }
  
  return {
    error: errorData.error || undefined,
    message: errorData.message || undefined,
    suggestion: errorData.suggestion || undefined,
    details: errorData.details || undefined
  };
}