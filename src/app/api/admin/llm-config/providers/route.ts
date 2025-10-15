/**
 * API para Provedores LLM - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Simular provedores LLM configurados
    const providers = [
      {
        id: 'provider_openai',
        name: 'OpenAI GPT-4',
        description: 'Provedor principal para análises avançadas e chat',
        is_active: true,
        api_key: 'sk-proj-abc123...xyz789', // Mascarado
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4-turbo',
        max_tokens: 4000,
        temperature: 0.7,
        cost_per_1k_tokens: 0.03,
        status: 'connected',
        last_tested: '2024-12-15T10:30:00Z',
        usage_count: 1247,
        total_cost: 37.41
      },
      {
        id: 'provider_claude',
        name: 'Anthropic Claude 3',
        description: 'Backup para análises complexas e relatórios',
        is_active: true,
        api_key: 'sk-ant-api03-abc123...xyz789', // Mascarado
        base_url: 'https://api.anthropic.com',
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        temperature: 0.5,
        cost_per_1k_tokens: 0.015,
        status: 'connected',
        last_tested: '2024-12-15T09:15:00Z',
        usage_count: 456,
        total_cost: 6.84
      },
      {
        id: 'provider_gpt35',
        name: 'OpenAI GPT-3.5 Turbo',
        description: 'Provedor econômico para tarefas simples',
        is_active: false,
        api_key: 'sk-proj-def456...uvw123', // Mascarado
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        max_tokens: 2000,
        temperature: 0.8,
        cost_per_1k_tokens: 0.002,
        status: 'disconnected',
        last_tested: '2024-12-10T14:20:00Z',
        usage_count: 892,
        total_cost: 1.78
      },
      {
        id: 'provider_local',
        name: 'Modelo Local (Ollama)',
        description: 'Modelo local para testes e desenvolvimento',
        is_active: false,
        api_key: '', // Não precisa de API key
        base_url: 'http://localhost:11434/v1',
        model: 'llama2:13b',
        max_tokens: 2048,
        temperature: 0.6,
        cost_per_1k_tokens: 0.0, // Gratuito
        status: 'error',
        last_tested: '2024-12-14T16:45:00Z',
        usage_count: 23,
        total_cost: 0.0
      }
    ]

    return NextResponse.json({
      providers,
      summary: {
        total_providers: providers.length,
        active_providers: providers.filter(p => p.is_active).length,
        connected_providers: providers.filter(p => p.status === 'connected').length,
        total_usage: providers.reduce((sum, p) => sum + p.usage_count, 0),
        total_cost: providers.reduce((sum, p) => sum + p.total_cost, 0)
      }
    })

  } catch (error) {
    console.error('Error fetching LLM providers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      api_key,
      base_url,
      model,
      max_tokens,
      temperature,
      cost_per_1k_tokens
    } = body

    // Validação
    if (!name || !model || !api_key) {
      return NextResponse.json(
        { error: 'Missing required fields: name, model, api_key' },
        { status: 400 }
      )
    }

    // Simular criação do provedor
    const newProvider = {
      id: `provider_${Date.now()}`,
      name,
      description: description || '',
      is_active: false, // Inicia desativado
      api_key: api_key.substring(0, 10) + '...' + api_key.substring(api_key.length - 6), // Mascarar
      base_url: base_url || '',
      model,
      max_tokens: max_tokens || 4000,
      temperature: temperature || 0.7,
      cost_per_1k_tokens: cost_per_1k_tokens || 0.002,
      status: 'disconnected',
      last_tested: null,
      usage_count: 0,
      total_cost: 0.0,
      created_at: new Date().toISOString(),
      created_by: user.id
    }

    console.log('Created LLM provider:', newProvider)

    return NextResponse.json({
      success: true,
      provider: newProvider,
      message: 'Provider created successfully'
    })

  } catch (error) {
    console.error('Error creating LLM provider:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}