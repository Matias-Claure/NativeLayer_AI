'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb, apiClients } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { generateApiKey } from '@nativelayer/security';
import { requireAuth } from '@/lib/session';

export async function generateKeyAction(
  _prev: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  const session = await requireAuth();
  const merchantId = String(formData.get('merchantId') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (session.merchantId !== merchantId) return { error: 'Unauthorized.' };
  if (!name) return { error: 'Key name is required.' };

  const { raw, hash, prefix } = generateApiKey();
  const db = getDb();

  await db.insert(apiClients).values({
    merchant_id: merchantId,
    name,
    key_hash: hash,
    key_prefix: prefix,
    is_active: true,
  });

  // Redirect with the raw key as a query param (shown once only)
  redirect(`/dashboard/keys?new_key=${encodeURIComponent(raw)}`);
}

export async function revokeKeyAction(clientId: string, merchantId: string): Promise<void> {
  const session = await requireAuth();
  if (session.merchantId !== merchantId) throw new Error('Unauthorized');

  const db = getDb();
  await db
    .update(apiClients)
    .set({ is_active: false })
    .where(and(eq(apiClients.id, clientId), eq(apiClients.merchant_id, merchantId)));

  revalidatePath('/dashboard/keys');
}
