import { NextRequest, NextResponse } from 'next/server'
import { apiAuthService } from '@/lib/api/auth-service'

export async function GET(request: NextRequest) {
  const auth = await apiAuthService.authenticateApiRequest(request)

  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401 }
    )
  }

  return NextResponse.json({
    message: 'Authentication successful',
    organizationId: auth.data?.organizationId,
    permissions: auth.data?.permissions
  })
}
