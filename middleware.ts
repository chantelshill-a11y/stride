/**
 * Password gate for the /real section.
 *
 * Real-mode pages (where Stride connects to actual Outlook / Google / Jira
 * accounts) require an env-set password. Visitors hitting /real without the
 * gate cookie are redirected to /real/login. Synthetic-mode pages remain open.
 *
 * The cookie is signed with NEXTAUTH_SECRET so a stolen cookie can't grant
 * access on a different deploy. (Phase 9: lift the password to NextAuth proper
 * once OAuth flows for Google/Microsoft are wired.)
 */

import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = 'stride_real';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/real') || pathname.startsWith('/real/login')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const expected = process.env.STRIDE_REAL_MODE_PASSWORD;

  if (!expected) {
    // No password configured = real mode is not available on this deploy.
    return NextResponse.redirect(new URL('/real/login?reason=not-configured', req.url));
  }

  if (!cookie || cookie !== expected) {
    return NextResponse.redirect(new URL('/real/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/real/:path*'],
};
