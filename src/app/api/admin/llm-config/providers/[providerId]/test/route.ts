/**
 * API para Testar Provedor LLM - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: userRole } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || !userRole.role?.includes('super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { providerId } = await params

    // Simular teste de conexão com o provedor
    console.log(`Testing LLM provider: ${providerId}`)

    // Simular delay de teste
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Simular resultado do teste baseado no ID do provedor
    let success = true
    let responseTime = Math.floor(Math.random() * 2000) + 500 // 500-2500ms
    let error_message = null

    if (providerId === 'provider_local') {
      // Simular falha para provedor local
      success = false
      error_message = 'Connection refused: localhost:11434 not responding'
    } else if (providerId === 'provider_gpt35') {
      // Simular falha de API key
      success = false
      error_message = 'Invalid API key provided'
    }

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Connection test successful',
        details: {
          provider_id: providerId,
          response_time: responseTime,
          test_prompt: 'Hello, this is a connection test.',
          test_response: 'Hello! I\'m working correctly and ready to assist with campaign analysis.',
          tokens_used: 15,
          cost: 0.0005,
          timestamp: new Date().toISOString()
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Connection test failed',
        error: error_message,
        details: {
          provider_id: providerId,
          response_time: responseTime,
          timestamp: new Date().toISOString()
        }
      })
    }

  } catch (error) {
    console.error('Error testing LLM provider:', error)
    return NextResponse.json({
      success: false,
      message: 'Test failed due to internal error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}