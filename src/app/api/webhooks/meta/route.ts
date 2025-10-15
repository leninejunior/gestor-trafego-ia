/**
 * Webhook endpoint para receber atualizações da Meta Ads API
 * - Verificação de assinatura
 * - Processamento de eventos
 * - Sincronização automática
 * - Notificações em tempo real
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import AdvancedSyncService from '@/lib/meta/advanced-sync-service'
import { NotificationService } from '@/lib/notifications/notification-service'

const WEBHOOK_SECRET = process.env.META_WEBHOOK_SECRET || 'your-webhook-secret'
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'your-verify-token'

interface MetaWebhookEntry {
  id: string
  time: number
  changes: Array<{
    field: string
    value: any
  }>
}

interface MetaWebhookPayload {
  object: string
  entry: MetaWebhookEntry[]
}

/**
 * Verificação do webhook (GET)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('Meta webhook verification:', { mode, token, challenge })

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Meta webhook verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  console.log('Meta webhook verification failed')
  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * Processamento de eventos do webhook (POST)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    // Verificar assinatura
    if (!verifySignature(body, signature)) {
      console.error('Invalid webhook signature')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const payload: MetaWebhookPayload = JSON.parse(body)
    console.log('Meta webhook received:', JSON.stringify(payload, null, 2))

    // Processar eventos
    await processWebhookEvents(payload)

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('Error processing Meta webhook:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

/**
 * Verifica a assinatura do webhook
 */
function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  const receivedSignature = signature.replace('sha256=', '')
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  )
}

/**
 * Processa eventos do webhook
 */
async function processWebhookEvents(payload: MetaWebhookPayload): Promise<void> {
  const supabase = createClient()
  const syncService = new AdvancedSyncService()
  const notificationService = new NotificationService()

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      try {
        await processChange(entry.id, change, supabase, syncService, notificationService)
      } catch (error) {
        console.error(`Error processing change for ${entry.id}:`, error)
      }
    }
  }
}

/**
 * Processa uma mudança específica
 */
async function processChange(
  objectId: string,
  change: { field: string; value: any },
  supabase: any,
  syncService: AdvancedSyncService,
  notificationService: NotificationService
): Promise<void> {
  console.log(`Processing change: ${change.field} for object ${objectId}`)

  switch (change.field) {
    case 'campaign_insights':
      await handleCampaignInsightsChange(objectId, change.value, supabase, syncService, notificationService)
      break
    
    case 'adset_insights':
      await handleAdsetInsightsChange(objectId, change.value, supabase, syncService, notificationService)
      break
    
    case 'ad_insights':
      await handleAdInsightsChange(objectId, change.value, supabase, syncService, notificationService)
      break
    
    case 'campaign':
      await handleCampaignChange(objectId, change.value, supabase, syncService, notificationService)
      break
    
    case 'adset':
      await handleAdsetChange(objectId, change.value, supabase, syncService, notificationService)
      break
    
    case 'ad':
      await handleAdChange(objectId, change.value, supabase, syncService, notificationService)
      break
    
    default:
      console.log(`Unhandled change field: ${change.field}`)
  }
}

/**
 * Processa mudanças em insights de campanha
 */
async function handleCampaignInsightsChange(
  accountId: string,
  value: any,
  supabase: any,
  syncService: AdvancedSyncService,
  notificationService: NotificationService
): Promise<void> {
  // Buscar conexões para esta conta
  const { data: connections } = await supabase
    .from('meta_connections')
    .select('id, organization_id')
    .eq('account_id', accountId)

  if (!connections || connections.length === 0) {
    console.log(`No connections found for account ${accountId}`)
    return
  }

  for (const connection of connections) {
    // Iniciar sincronização incremental
    const jobId = await syncService.startIncrementalSync(connection.id, connection.organization_id)
    console.log(`Started incremental sync job ${jobId} for connection ${connection.id}`)

    // Verificar se há alertas a serem enviados
    await checkAndSendAlerts(accountId, connection.organization_id, value, supabase, notificationService)
  }
}

/**
 * Processa mudanças em insights de conjunto de anúncios
 */
async function handleAdsetInsightsChange(
  accountId: string,
  value: any,
  supabase: any,
  syncService: AdvancedSyncService,
  notificationService: NotificationService
): Promise<void> {
  // Similar ao campaign insights
  await handleCampaignInsightsChange(accountId, value, supabase, syncService, notificationService)
}

/**
 * Processa mudanças em insights de anúncios
 */
async function handleAdInsightsChange(
  accountId: string,
  value: any,
  supabase: any,
  syncService: AdvancedSyncService,
  notificationService: NotificationService
): Promise<void> {
  // Similar ao campaign insights
  await handleCampaignInsightsChange(accountId, value, supabase, syncService, notificationService)
}

/**
 * Processa mudanças em campanhas
 */
async function handleCampaignChange(
  accountId: string,
  value: any,
  supabase: any,
  syncService: AdvancedSyncService,
  notificationService: NotificationService
): Promise<void> {
  console.log(`Campaign change detected for account ${accountId}:`, value)

  // Buscar conexões
  const { data: connections } = await supabase
    .from('meta_connections')
    .select('id, organization_id')
    .eq('account_id', accountId)

  if (!connections || connections.length === 0) return

  for (const connection of connections) {
    // Sincronizar campanhas
    const jobId = await syncService.startIncrementalSync(connection.id, connection.organization_id)
    
    // Notificar sobre mudanças importantes
    if (value.status_change) {
      await notificationService.createNotification({
        organizationId: connection.organization_id,
        type: 'campaign_status_change',
        title: 'Campaign Status Changed',
        message: `Campaign status changed to ${value.status_change.new_status}`,
        priority: 'medium',
        metadata: {
          campaignId: value.campaign_id,
          oldStatus: value.status_change.old_status,
          newStatus: value.status_change.new_status
        }
      })
    }
  }
}

/**
 * Processa mudanças em conjuntos de anúncios
 */
async function handleAdsetChange(
  accountId: string,
  value: any,
  supabase: any,
  syncService: AdvancedSyncService,
  notificationService: NotificationService
): Promise<void> {
  // Similar ao campaign change
  console.log(`Adset change detected for account ${accountId}:`, value)
}

/**
 * Processa mudanças em anúncios
 */
async function handleAdChange(
  accountId: string,
  value: any,
  supabase: any,
  syncService: AdvancedSyncService,
  notificationService: NotificationService
): Promise<void> {
  // Similar ao campaign change
  console.log(`Ad change detected for account ${accountId}:`, value)
}

/**
 * Verifica e envia alertas baseados em métricas
 */
async function checkAndSendAlerts(
  accountId: string,
  organizationId: string,
  insights: any,
  supabase: any,
  notificationService: NotificationService
): Promise<void> {
  // Buscar regras de notificação ativas
  const { data: rules } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (!rules || rules.length === 0) return

  for (const rule of rules) {
    const shouldTrigger = evaluateRule(rule, insights)
    
    if (shouldTrigger) {
      await notificationService.createNotification({
        organizationId,
        type: rule.notification_type,
        title: rule.title,
        message: generateAlertMessage(rule, insights),
        priority: rule.priority,
        metadata: {
          ruleId: rule.id,
          accountId,
          insights
        }
      })
    }
  }
}

/**
 * Avalia se uma regra deve ser disparada
 */
function evaluateRule(rule: any, insights: any): boolean {
  const { metric, operator, threshold } = rule.conditions

  const value = insights[metric]
  if (value === undefined || value === null) return false

  switch (operator) {
    case 'greater_than':
      return parseFloat(value) > parseFloat(threshold)
    case 'less_than':
      return parseFloat(value) < parseFloat(threshold)
    case 'equals':
      return parseFloat(value) === parseFloat(threshold)
    case 'greater_than_or_equal':
      return parseFloat(value) >= parseFloat(threshold)
    case 'less_than_or_equal':
      return parseFloat(value) <= parseFloat(threshold)
    default:
      return false
  }
}

/**
 * Gera mensagem de alerta personalizada
 */
function generateAlertMessage(rule: any, insights: any): string {
  const { metric, threshold } = rule.conditions
  const value = insights[metric]
  
  return `${metric.toUpperCase()} is ${value}, which triggered the alert (threshold: ${threshold})`
}

/**
 * Registra evento do webhook para auditoria
 */
async function logWebhookEvent(
  payload: MetaWebhookPayload,
  supabase: any
): Promise<void> {
  await supabase
    .from('webhook_logs')
    .insert({
      source: 'meta',
      event_type: payload.object,
      payload: payload,
      processed_at: new Date().toISOString()
    })
}