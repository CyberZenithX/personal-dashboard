import { NextResponse, type NextRequest } from 'next/server';
import { authDisabled, COOKIE, verifyToken } from '@/lib/auth';

const PUBLIC = [/^\/login$/, /^\/api\/auth\//, /^\/manifest\.webmanifest$/, /^\/icon/, /^\/apple-/, /^\/favicon/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (authDisabled() || PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (await verifyToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
