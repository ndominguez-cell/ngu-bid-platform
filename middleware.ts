import { NextResponse, type NextRequest } from 'next/server';

// Check for a Supabase session cookie without importing @supabase/ssr,
// which pulls in Node.js globals (__dirname) incompatible with Edge runtime.
// Full token validation still happens in server components via createClient().
const SUPABASE_REF = 'rsnbsafzruenrefdlntj';

function hasSession(request: NextRequest): boolean {
  // @supabase/ssr stores the session as sb-{ref}-auth-token
  const token = request.cookies.get(`sb-${SUPABASE_REF}-auth-token`);
  return !!token?.value;
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const loggedIn = hasSession(request);

  // Redirect logged-in users away from auth pages
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup');
  if (isAuthRoute && loggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  const isPublicRoute =
    path.startsWith('/login') ||
    path.startsWith('/signup') ||
    path === '/' ||
    path.startsWith('/api/');
  if (!isPublicRoute && !loggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
