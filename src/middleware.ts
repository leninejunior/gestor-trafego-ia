import { NextRequest, NextResponse } from 'next/server' // Changed from type NextRequest, type NextResponse
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // update user's auth session
  const response = await updateSession(request)

  const supabaseClient = response.supabaseClient
  const { data } = await supabaseClient.auth.getUser()

  // Se o usuário não estiver logado e tentar acessar o dashboard, redirecione para o login
  if (!data.user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se o usuário estiver logado e tentar acessar login/signup, redirecione para o dashboard
  if (data.user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/sign-up'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}