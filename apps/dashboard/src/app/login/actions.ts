'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { verifyPassword } from '@nativelayer/security';
import { getDb, merchants } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function loginAction(
  _prev: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  // Validate inputs
  if (!email || !password) return { error: 'Email and password are required.' };

  // For MVP: single admin user from environment
  const adminEmail = (process.env['ADMIN_EMAIL'] ?? '').toLowerCase();
  const adminHash = process.env['ADMIN_PASSWORD_HASH'] ?? '';

  if (email !== adminEmail || !adminHash) {
    return { error: 'Invalid credentials.' };
  }

  const valid = await verifyPassword(password, adminHash);
  if (!valid) return { error: 'Invalid credentials.' };

  // Find the first merchant record (MVP: single merchant per admin)
  const db = getDb();
  const [merchant] = await db.select().from(merchants).limit(1);

  const session = await getSession();
  session.isLoggedIn = true;
  session.email = adminEmail;
  session.merchantId = merchant?.id ?? '';
  await session.save();

  redirect('/dashboard');
}
