import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin/login')) return NextResponse.next();

  if (!process.env.ADMIN_PASSWORD) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('setup', '1');
    return NextResponse.redirect(url);
  }

  const sessionCookie = req.cookies.get('admin_session')?.value;
  if (!sessionCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
