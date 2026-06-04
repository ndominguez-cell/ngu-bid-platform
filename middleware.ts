import { NextResponse, type NextRequest } from 'next/server';

// Auth protection is handled server-side in app/(app)/layout.tsx via
// supabase.auth.getUser() — no middleware needed.
//
// This file is intentionally a no-op. The previous approach of checking a
// Supabase session cookie here caused MIDDLEWARE_INVOCATION_FAILED (500 on
// every request) due to a Next.js 14 / Vercel Edge runtime incompatibility
// where the compiled middleware bundle references __dirname, which is
// undefined in V8 isolates.
//
// With matcher: [], this file is never invoked and produces no Edge bundle.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
