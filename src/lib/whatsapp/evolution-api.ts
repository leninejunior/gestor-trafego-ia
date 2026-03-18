// Cliente para Evolution API - Envio de mensagens WhatsApp

import type {
  EvolutionAPIMessage,
  EvolutionAPIResponse,
  EvolutionInstanceStatus
} from '@/lib/types/alerts'

export interface EvolutionAPIConfig {
  baseUrl: string
  apiKey: string
  instanceName: string
}

export class EvolutionAPIClient {
  private config: EvolutionAPIConfig

  constructor(config: EvolutionAPIConfig) {
    this.config = config
  }

  /**
   * Headers padrão para requisições
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'apikey': this.config.apiKey
    }
  }

  /**
   * Envia mensagem de texto via WhatsApp
   */
  async sendMessage(to: string, message: string): Promise<EvolutionAPIResponse> {
    try {
      // Limpar número (remover caracteres especiais)
      const cleanNumber = to.replace(/\D/g, '')
      
      // Adicionar código do país se não tiver
      const fullNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`

      const payload: EvolutionAPIMessage = {
        number: fullNumber,
        text: message
      }

      const response = await fetch(
        `${this.config.baseUrl}/message/sendText/${this.config.instanceName}`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Evolution API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error)
      throw error
    }
  }

  /**
   * Envia mensagem com formatação (negrito, itálico, etc)
   */
  async sendFormattedMessage(to: string, message: string): Promise<EvolutionAPIResponse> {
    // Evolution API suporta formatação Markdown do WhatsApp
    // *negrito* _itálico_ ~riscado~ ```monospace```
    return this.sendMessage(to, message)
  }

  /**
   * Verifica status da instância
   */
  async getInstanceStatus(): Promise<EvolutionInstanceStatus> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/instance/connectionState/${this.config.instanceName}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to get instance status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Erro ao verificar status da instância:', error)
      throw error
    }
  }

  /**
   * Testa conexão com a API
   */
  async testConnection(): Promise<boolean> {
    try {
      const status = await this.getInstanceStatus()
      return status.instance.status === 'open'
    } catch (error) {
      console.error('Erro ao testar conexão:', error)
      return false
    }
  }

  /**
   * Gera QR Code para conectar instância
   */
  async generateQRCode(): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/instance/connect/${this.config.instanceName}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to generate QR code: ${response.status}`)
      }

      const data = await response.json()
      return data.qrcode?.base64 || null
    } catch (error) {
      console.error('Erro ao gerar QR code:', error)
      return null
    }
  }

  /**
   * Desconecta instância
   */
  async logout(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/instance/logout/${this.config.instanceName}`,
        {
          method: 'DELETE',
          headers: this.getHeaders()
        }
      )

      return response.ok
    } catch (error) {
      console.error('Erro ao desconectar instância:', error)
      return false
    }
  }
}

/**
 * Formata mensagem de alerta de saldo
 */
export function formatBalanceAlertMessage(data: {
  clientName: string
  accountName: string
  currentBalance: number
  threshold: number
  alertType: string
}): string {
  const emoji = data.currentBalance <= 0 ? '🔴' : '🟡'
  
  return `${emoji} *Alerta de Saldo - Gestor Engrene*

*Cliente:* ${data.clientName}
*Conta:* ${data.accountName}
*Saldo Atual:* R$ ${data.currentBalance.toFixed(2)}
*Limite Configurado:* R$ ${data.threshold.toFixed(2)}

⚠️ ${data.currentBalance <= 0 
  ? 'O saldo está zerado! As campanhas podem ser pausadas.' 
  : 'O saldo está abaixo do limite configurado.'}

💡 *Ação necessária:* Recarregue a conta para evitar interrupção das campanhas.

---
_Gestor Engrene - Sistema de Alertas_
_${new Date().toLocaleString('pt-BR')}_`
}

/**
 * Formata mensagem de teste
 */
export function formatTestMessage(organizationName: string): string {
  return `✅ *Teste de Conexão - Gestor Engrene*

Olá! Esta é uma mensagem de teste do sistema de alertas.

*Organização:* ${organizationName}
*Status:* Conexão estabelecida com sucesso

O sistema está pronto para enviar alertas de saldo via WhatsApp.

---
_Gestor Engrene_
_${new Date().toLocaleString('pt-BR')}_`
}

/**
 * Cria cliente Evolution API a partir da configuração do banco
 */
export function createEvolutionClient(config: {
  evolution_api_url: string
  evolution_api_key: string
  instance_name: string
}): EvolutionAPIClient {
  return new EvolutionAPIClient({
    baseUrl: config.evolution_api_url,
    apiKey: config.evolution_api_key,
    instanceName: config.instance_name
  })
}
