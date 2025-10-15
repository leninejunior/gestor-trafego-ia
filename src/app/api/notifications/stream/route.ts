/**
 * API para Server-Sent Events (SSE)
 * Notificações em tempo real via streaming
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const organizationId = searchParams.get('organizationId')

  if (!organizationId) {
    return new Response('Missing organizationId', { status: 400 })
  }

  // Verificar autenticação
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verificar se o usuário pertence à organização
  const { data: membership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  if (!membership) {
    return new Response('Forbidden', { status: 403 })
  }

  // Criar stream de notificações
  const stream = new ReadableStream({
    start(controller) {
      // Enviar headers SSE
      const encoder = new TextEncoder()
      
      // Heartbeat para manter conexão viva
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: {"type":"heartbeat","timestamp":${Date.now()}}\n\n`))
        } catch (error) {
          clearInterval(heartbeat)
        }
      }, 30000)

      // Escutar mudanças na tabela de notificações
      const channel = supabase
        .channel(`notifications:${organizationId}:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `organization_id=eq.${organizationId}`
          },
          (payload) => {
            // Verificar se a notificação é para este usuário
            if (!payload.new.user_id || payload.new.user_id === user.id) {
              try {
                const data = JSON.stringify({
                  type: 'notification',
                  data: payload.new
                })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              } catch (error) {
                console.error('Error sending SSE notification:', error)
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sync_logs',
            filter: `organization_id=eq.${organizationId}`
          },
          (payload) => {
            try {
              const data = JSON.stringify({
                type: 'sync_update',
                data: payload.new
              })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            } catch (error) {
              console.error('Error sending SSE sync update:', error)
            }
          }
        )
        .subscribe()

      // Cleanup quando a conexão for fechada
      return () => {
        clearInterval(heartbeat)
        channel.unsubscribe()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}