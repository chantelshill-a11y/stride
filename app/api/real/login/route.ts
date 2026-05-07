/**
 * Real-mode login: validates password against STRIDE_REAL_MODE_PASSWORD env
 * and sets a signed cookie used by middleware.ts to gate /real/*.
 */

import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const COOKIE_NAME = 'stride_real';
const ONE_DAY = 60 * 60 * 24;

export async function POST(req: Request) {
  let body: { password: string };
  try {
    body = (await req.json()) as { password: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const expected = process.env.STRIDE_REAL_MODE_PASSWORD;
  if (!expected) {
    return Response.json({ error: 'Real mode not configured on this deploy' }, { status: 503 });
  }
  if (!body.password || body.password !== expected) {
    return Response.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: expected,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_DAY,
  });

  return Response.json({ ok: true });
}
