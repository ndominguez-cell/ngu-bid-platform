import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Pass through without auth enforcement if Supabase isn't fully configured
  if (!url || !key) return NextResponse.next({ request });

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;

    const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup');
    if (isAuthRoute && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const isPublicRoute =
      path.startsWith('/login') ||
      path.startsWith('/signup') ||
      path === '/' ||
      path.startsWith('/api/');
    if (!isPublicRoute && !user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return supabaseResponse;
  } catch {
    // If Supabase auth check fails for any reason, pass through rather than 500-ing
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
