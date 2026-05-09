import { NextResponse } from 'next/server';

// Lightweight cookie-presence gate for /admin pages — the actual JWT verify
// happens server-side in route handlers (jsonwebtoken needs Node runtime,
// not Edge). This redirect prevents flashes of the admin UI when no cookie
// is present at all.
export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const has = req.cookies.get('cali_session');
    if (!has) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
