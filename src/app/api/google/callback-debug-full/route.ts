import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      error: 'Endpoint desativado',
      message: 'Use os endpoints de callback Google ativos.'
    },
    { status: 410 }
  )
}
