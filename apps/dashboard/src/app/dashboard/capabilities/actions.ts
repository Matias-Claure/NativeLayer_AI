'use server';

import { revalidatePath } from 'next/cache';
import { getDb, endpointSettings } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/session';
import { Capability } from '@nativelayer/schemas';

export async function toggleCapabilityAction(
  merchantId: string,
  capability: string,
  enabled: boolean,
): Promise<void> {
  const session = await requireAuth();

  // Ensure the merchantId matches the session (authorization check)
  if (session.merchantId !== merchantId) {
    throw new Error('Unauthorized');
  }

  // Validate capability
  const parsed = Capability.safeParse(capability);
  if (!parsed.success) throw new Error('Invalid capability');

  const db = getDb();

  // Upsert: update if exists, insert if not
  const existing = await db
    .select()
    .from(endpointSettings)
    .where(
      and(
        eq(endpointSettings.merchant_id, merchantId),
        eq(endpointSettings.capability, capability),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(endpointSettings)
      .set({ enabled, updated_at: new Date() })
      .where(
        and(
          eq(endpointSettings.merchant_id, merchantId),
          eq(endpointSettings.capability, capability),
        ),
      );
  } else {
    await db.insert(endpointSettings).values({
      merchant_id: merchantId,
      capability,
      enabled,
    });
  }

  revalidatePath('/dashboard/capabilities');
}
