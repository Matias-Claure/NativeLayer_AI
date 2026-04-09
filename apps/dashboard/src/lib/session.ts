import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isLoggedIn: boolean;
  merchantId: string;
  email: string;
}

function getSessionOptions(): SessionOptions {
  const secret = process.env['SESSION_SECRET'];
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long.');
  }
  return {
    cookieName: 'nl_session',
    password: secret,
    cookieOptions: {
      secure: process.env['NODE_ENV'] === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function requireAuth() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }
  return session;
}
