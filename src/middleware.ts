import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Skip middleware for API routes - let them handle their own authentication
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip authentication check for Meta OAuth flow pages
  if (request.nextUrl.pathname.startsWith('/meta/')) {
    console.log('🔄 [MIDDLEWARE] Permitindo acesso ao fluxo OAuth Meta:', request.nextUrl.pathname);
    return NextResponse.next()
  }

  // update user's auth session
  const { supabase, response } = await updateSession(request) // Desestrutura supabase e response

  const { data } = await supabase.auth.getUser() // Agora supabaseClient está definido

  // Se o usuário não estiver logado e tentar acessar o dashboard, redirecione para o login
  if (!data.user && request.nextUrl.pathname.startsWith('/dashboard')) {
    console.log('🚫 [MIDDLEWARE] Usuário não autenticado tentando acessar dashboard');
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