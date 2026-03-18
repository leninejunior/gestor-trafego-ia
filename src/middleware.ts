import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Skip middleware for API routes - let them handle their own authentication
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip authentication check for Meta OAuth flow pages
  if (request.nextUrl.pathname.startsWith('/meta/')) {
    return NextResponse.next()
  }

  // Skip authentication check for Google OAuth flow pages
  if (request.nextUrl.pathname.startsWith('/google/')) {
    return NextResponse.next()
  }

  // Check for auth cookie (simple check without Supabase client)
  const authCookie = request.cookies.get('sb-doiogabdzybqxnyhktbv-auth-token')
  const hasAuth = !!authCookie

  // Se o usuário não estiver logado e tentar acessar áreas protegidas, redirecione para o login
  if (!hasAuth && (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/admin'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se o usuário estiver logado e tentar acessar login/signup, redirecione para o dashboard
  if (hasAuth && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/sign-up'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/ (API routes - they handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}