import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { canManUsers, getLandingPath } from '@/lib/permissions'

export async function proxy(request) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchir la session (obligatoire avec @supabase/ssr)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  const isLoginPage   = pathname.startsWith('/login')
  const isAuthRoute   = pathname.startsWith('/auth')
  const isPublic      = isLoginPage || isAuthRoute

  if (isAuthRoute) return supabaseResponse

  const withRefreshedCookies = (response) => {
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  const redirectTo = (pathname, search = '') => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = search
    return withRefreshedCookies(NextResponse.redirect(url))
  }

  // Pas de session → rediriger vers /login
  if (!session && !isPublic) {
    return redirectTo('/login')
  }

  let profile = null
  if (session?.user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', session.user.id)
      .maybeSingle()
    profile = data
  }

  if (session && !profile) {
    await supabase.auth.signOut()
    if (!isLoginPage) return redirectTo('/login', '?error=profile')
    return supabaseResponse
  }

  if (session && profile.is_active === false) {
    await supabase.auth.signOut()
    if (!isLoginPage) return redirectTo('/login', '?error=disabled')
    return supabaseResponse
  }

  // Session active sur /login → landing selon le rôle Vanilla
  if (session && isLoginPage) {
    return redirectTo(getLandingPath(profile))
  }

  const isAdminPage = pathname.startsWith('/utilisateurs') || pathname.startsWith('/params')
  if (session && isAdminPage && !canManUsers(profile)) {
    return redirectTo(getLandingPath(profile))
  }

  const canonicalPaths = {
    '/stock/IT': '/stock/it',
    '/stock/Finance': '/stock/fin',
    '/demandes/IT': '/demandes/it',
    '/demandes/Finance': '/demandes/fin',
  }
  if (canonicalPaths[pathname]) {
    const url = request.nextUrl.clone()
    url.pathname = canonicalPaths[pathname]
    return withRefreshedCookies(NextResponse.rewrite(url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}