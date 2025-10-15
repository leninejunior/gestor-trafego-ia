/**
 * Cliente Meta Ads API Avançado
 * - Rate limiting inteligente
 * - Retry automático com backoff
 * - Cache de dados
 * - Monitoramento de quotas
 * - Webhooks integration
 */

import { MetaApiError, MetaAccount, MetaCampaign, MetaInsights } from './types'

interface RateLimitInfo {
  callCount: number
  totalTime: number
  totalCputime: number
  appId: string
  type: string
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
}

export class AdvancedMetaClient {
  private baseUrl = 'https://graph.facebook.com/v18.0'
  private accessToken: string
  private cache = new Map<string, CacheEntry<any>>()
  private rateLimitInfo: RateLimitInfo | null = null
  private requestQueue: Array<() => Promise<any>> = []
  private isProcessingQueue = false

  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2
  }

  constructor(accessToken: string) {
    this.accessToken = accessToken
    this.startQueueProcessor()
  }

  /**
   * Faz uma requisição com retry automático e rate limiting
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig }
    let lastError: Error

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Verificar rate limit antes da requisição
        await this.checkRateLimit()

        const url = `${this.baseUrl}${endpoint}`
        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        })

        // Extrair informações de rate limit dos headers
        this.updateRateLimitInfo(response.headers)

        if (!response.ok) {
          const errorData = await response.json()
          throw new MetaApiError(
            errorData.error?.message || 'API request failed',
            response.status,
            errorData.error?.code,
            errorData.error?.error_subcode
          )
        }

        const data = await response.json()
        return data as T

      } catch (error) {
        lastError = error as Error
        
        // Não fazer retry para alguns tipos de erro
        if (error instanceof MetaApiError) {
          if (error.code === 190 || error.code === 102) { // Token inválido
            throw error
          }
          if (error.status === 400 && error.subcode !== 2446) { // Bad request (exceto rate limit)
            throw error
          }
        }

        // Calcular delay para próxima tentativa
        if (attempt < config.maxRetries) {
          const delay = Math.min(
            config.baseDelay * Math.pow(config.backoffFactor, attempt),
            config.maxDelay
          )
          
          console.log(`Meta API retry ${attempt + 1}/${config.maxRetries} in ${delay}ms`)
          await this.sleep(delay)
        }
      }
    }

    throw lastError!
  }

  /**
   * Verifica e respeita os limites de rate da API
   */
  private async checkRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) return

    const { callCount, totalTime } = this.rateLimitInfo
    const callsPerSecond = callCount / (totalTime / 1000)

    // Se estiver próximo do limite, aguardar
    if (callsPerSecond > 180) { // 200 calls/second é o limite
      const waitTime = 1000 // Aguardar 1 segundo
      console.log(`Rate limit approaching, waiting ${waitTime}ms`)
      await this.sleep(waitTime)
    }
  }

  /**
   * Atualiza informações de rate limit dos headers da resposta
   */
  private updateRateLimitInfo(headers: Headers): void {
    const usageHeader = headers.get('x-business-use-case-usage')
    if (usageHeader) {
      try {
        const usage = JSON.parse(usageHeader)
        const appUsage = Object.values(usage)[0] as any
        this.rateLimitInfo = {
          callCount: appUsage.call_count || 0,
          totalTime: appUsage.total_time || 0,
          totalCputime: appUsage.total_cputime || 0,
          appId: appUsage.app_id || '',
          type: appUsage.type || ''
        }
      } catch (error) {
        console.warn('Failed to parse rate limit info:', error)
      }
    }
  }

  /**
   * Sistema de cache com TTL
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  private setCache<T>(key: string, data: T, ttlMinutes: number = 5): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    })
  }

  /**
   * Processador de fila para requisições
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.isProcessingQueue || this.requestQueue.length === 0) return

      this.isProcessingQueue = true
      
      try {
        while (this.requestQueue.length > 0) {
          const request = this.requestQueue.shift()
          if (request) {
            await request()
            await this.sleep(100) // Pequeno delay entre requisições
          }
        }
      } finally {
        this.isProcessingQueue = false
      }
    }, 1000)
  }

  /**
   * Adiciona requisição à fila
   */
  private queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ===== MÉTODOS PÚBLICOS =====

  /**
   * Busca contas de anúncios com cache
   */
  async getAdAccounts(useCache: boolean = true): Promise<MetaAccount[]> {
    const cacheKey = 'ad_accounts'
    
    if (useCache) {
      const cached = this.getCached<MetaAccount[]>(cacheKey)
      if (cached) return cached
    }

    const response = await this.makeRequest<{data: MetaAccount[]}>('/me/adaccounts', {
      method: 'GET'
    })

    const accounts = response.data || []
    this.setCache(cacheKey, accounts, 30) // Cache por 30 minutos
    
    return accounts
  }

  /**
   * Busca campanhas de uma conta com cache
   */
  async getCampaigns(accountId: string, useCache: boolean = true): Promise<MetaCampaign[]> {
    const cacheKey = `campaigns_${accountId}`
    
    if (useCache) {
      const cached = this.getCached<MetaCampaign[]>(cacheKey)
      if (cached) return cached
    }

    const response = await this.makeRequest<{data: MetaCampaign[]}>(`/${accountId}/campaigns`, {
      method: 'GET'
    })

    const campaigns = response.data || []
    this.setCache(cacheKey, campaigns, 15) // Cache por 15 minutos
    
    return campaigns
  }

  /**
   * Busca insights com cache baseado em parâmetros
   */
  async getInsights(
    objectId: string,
    level: 'account' | 'campaign' | 'adset' | 'ad',
    dateRange: { since: string; until: string },
    metrics: string[] = [],
    useCache: boolean = true
  ): Promise<MetaInsights[]> {
    const cacheKey = `insights_${objectId}_${level}_${dateRange.since}_${dateRange.until}_${metrics.join(',')}`
    
    if (useCache) {
      const cached = this.getCached<MetaInsights[]>(cacheKey)
      if (cached) return cached
    }

    const params = new URLSearchParams({
      level,
      time_range: JSON.stringify(dateRange),
      fields: metrics.length > 0 ? metrics.join(',') : 'impressions,clicks,spend,reach,ctr,cpc,cpp,cpm'
    })

    const response = await this.makeRequest<{data: MetaInsights[]}>(`/${objectId}/insights?${params}`, {
      method: 'GET'
    })

    const insights = response.data || []
    this.setCache(cacheKey, insights, 10) // Cache por 10 minutos
    
    return insights
  }

  /**
   * Busca insights de audiência
   */
  async getAudienceInsights(
    accountId: string,
    targetingSpec: any,
    useCache: boolean = true
  ): Promise<any> {
    const cacheKey = `audience_insights_${accountId}_${JSON.stringify(targetingSpec)}`
    
    if (useCache) {
      const cached = this.getCached<any>(cacheKey)
      if (cached) return cached
    }

    const response = await this.makeRequest<{data: any[]}>(`/${accountId}/delivery_estimate`, {
      method: 'GET',
      body: JSON.stringify({
        targeting_spec: targetingSpec,
        optimization_goal: 'IMPRESSIONS'
      })
    })

    const insights = response.data || []
    this.setCache(cacheKey, insights, 60) // Cache por 1 hora
    
    return insights
  }

  /**
   * Valida token de acesso
   */
  async validateToken(): Promise<{ isValid: boolean; expiresAt?: Date; scopes?: string[] }> {
    try {
      const response = await this.makeRequest<any>('/me', {
        method: 'GET'
      })

      // Buscar informações do token
      const tokenInfo = await this.makeRequest<any>('/debug_token', {
        method: 'GET'
      })

      return {
        isValid: true,
        expiresAt: tokenInfo.data?.expires_at ? new Date(tokenInfo.data.expires_at * 1000) : undefined,
        scopes: tokenInfo.data?.scopes || []
      }
    } catch (error) {
      return { isValid: false }
    }
  }

  /**
   * Limpa cache
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      return
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Obtém estatísticas do cliente
   */
  getStats(): {
    cacheSize: number
    queueSize: number
    rateLimitInfo: RateLimitInfo | null
  } {
    return {
      cacheSize: this.cache.size,
      queueSize: this.requestQueue.length,
      rateLimitInfo: this.rateLimitInfo
    }
  }

  /**
   * Configura webhook para receber atualizações
   */
  async setupWebhook(callbackUrl: string, verifyToken: string): Promise<boolean> {
    try {
      const response = await this.makeRequest<any>('/me/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          object: 'adaccount',
          callback_url: callbackUrl,
          verify_token: verifyToken,
          fields: ['campaign_insights', 'adset_insights', 'ad_insights']
        })
      })

      return response.success === true
    } catch (error) {
      console.error('Failed to setup webhook:', error)
      return false
    }
  }
}

export default AdvancedMetaClient