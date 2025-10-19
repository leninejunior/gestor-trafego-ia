import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { name, email, phone, company, lead_type, message } = body

    // Validação básica
    if (!name || !email || !lead_type) {
      return NextResponse.json(
        { error: 'Nome, email e tipo são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Inserir lead
    const { data, error } = await supabase
      .from('landing_leads')
      .insert({
        name,
        email,
        phone: phone || null,
        company: company || null,
        lead_type,
        message: message || null,
        status: 'new',
        source: 'landing_page'
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao inserir lead:', error)
      return NextResponse.json(
        { error: 'Erro ao salvar informações' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Erro no endpoint de leads:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
