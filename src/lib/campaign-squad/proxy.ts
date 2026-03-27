import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_SERVICE_URL = 'http://localhost:4010'

function getServiceBaseUrl(): string {
  return (process.env.CAMPAIGN_SQUAD_SERVICE_URL || DEFAULT_SERVICE_URL).replace(/\/$/, '')
}

export async function proxyCampaignSquadRequest(
  request: NextRequest,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH'
    body?: unknown
    query?: URLSearchParams
  } = {}
): Promise<NextResponse> {
  try {
    const method = options.method || 'GET'
    const url = new URL(`${getServiceBaseUrl()}${path}`)

    if (options.query) {
      options.query.forEach((value, key) => {
        url.searchParams.set(key, value)
      })
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }

    if (process.env.CAMPAIGN_SQUAD_INTERNAL_SECRET) {
      headers['x-campaign-squad-secret'] = process.env.CAMPAIGN_SQUAD_INTERNAL_SECRET
    }

    const upstream = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store'
    })

    const text = await upstream.text()

    try {
      const parsed = text ? JSON.parse(text) : null
      return NextResponse.json(parsed, { status: upstream.status })
    } catch {
      return NextResponse.json(
        {
          error: 'Invalid JSON response from campaign squad service',
          raw: text
        },
        { status: 502 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Campaign squad service unavailable',
        detail: error instanceof Error ? error.message : 'Unknown upstream error'
      },
      { status: 503 }
    )
  }
}

