import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Sincronizacao de leads indisponivel',
      details: 'Endpoint de sincronizacao nao implementado neste ambiente.'
    },
    { status: 501 }
  )
}
